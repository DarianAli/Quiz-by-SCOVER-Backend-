import { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import fs from "node:fs"
import path from "node:path"
import prisma from "../config/prisma.js"
import { UPLOAD_DIR } from "../global.js"
import { ok, created, badRequest, notFound, serverError } from "../utils/response.util.js"
import { parseWordQuestionFile, type ParseResult, type ParsedQuestion } from "../services/WordQuestionParser.service.js"
import { classifyQuestionsWithAI } from "../services/AiQuestionAssist.service.js"

// In-memory staging area
/**Soal hasil parse BELUM masuk DB, tapi ditahan di sini supaya tentor bisa
 * review/edit/hapus dahulu di frontend sebelum "Save to quiz". Sesi otomatis dibersihkan setelah 
 * 30 menit supaya tidak numpuk kalau tentor manutup tab.
 * Kalau butuh multi-instance/serverless, ganti Map ini dengan Redis.
 */

interface ImportSession {
    ownerId: number;
    mediaDir: string;
    createdAt: number;
    result: ParseResult;
    isCommitting?: boolean;
}

const ImportSession = new Map<string, ImportSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of ImportSession.entries()) {
        if (now - session.createdAt > SESSION_TTL_MS) {
            fs.rm(session.mediaDir, { recursive: true, force: true }, () => {})
            ImportSession.delete(id)
        }
    }
}
setInterval(cleanupExpiredSessions, 5 * 60 * 1000).unref();

// POST /question-import/parse
/**multipart/form-data, field "file" (.docx/.doc). Boleh dipanggil berkali - kali
 * untuk upload banyak file - tiap file menghasilkan importSessionId sendiri.
 */

export const parseWordImport = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if (!user) { badRequest(response, "File .docx/ .doc wajib diupload (field 'file')."); return; }
        if (!request.file) { badRequest(response, "File .docx /.doc wajib diupload (field 'file')."); return; }

        const ext = path.extname(request.file.originalname).toLocaleLowerCase();
        if (![".docx", ".doc"].includes(ext)) {
            badRequest(response, "Format file tidak didukung. Gunakan .docx atau .doc"); return;
        }

        const result = await parseWordQuestionFile(request.file.path, request.file.originalname);

        /** AI assist itu OPTIONAL (butuh ANTHOPIC_API_KEY). Kalau tidak di-set.
         * classifyQuestionWithAI akan skip dan mengembalikan data apa adanya.
         */
        const enriched = await classifyQuestionsWithAI(result.questions);

        const sessionId = uuidv4()
        ImportSession.set(sessionId, {
            ownerId: user.idUser,
            mediaDir: result.media_dir,
            createdAt: Date.now(),
            result: { ...result, questions: enriched },
        });

        created(response, "File berhasil di-parse.", {
            import_session_id: sessionId,
            source_filename: result.source_filename,
            total_questions: result.total_questions,
            questions: enriched,
            warnings_count: enriched.filter(q => q.warnings.length > 0).length,
        });
    } catch (error) {
        console.error("[ParseWordImport]", error);
        serverError(response, "Gagal memproses file. Pastikan file tidak corrupt.");
    }
}

// GET /question-import/:sessionId/media/:filename
// serve gambar hasil ekstraksi docx review page bisa preview sebelum commit.
export const getImportMedia = async(request: Request, response: Response): Promise<void> => {
    const sessionId = Array.isArray(request.params.sessionId) ? request.params.sessionId[0] : request.params.sessionId;
    const filename   = Array.isArray(request.params.filename)  ? request.params.filename[0]  : request.params.filename;

    const session = ImportSession.get(sessionId);
    if (!session) { notFound(response, "Import session tidak ditemukan atau sudah kadaluwarsa."); return; }

    const baseFilename = path.basename(filename);
    let filePath = path.join(session.mediaDir, "media", baseFilename);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(session.mediaDir, baseFilename);
    }
    if (!fs.existsSync(filePath)) { notFound(response, "Gambar tidak ditemukan."); return; }
    response.sendFile(filePath);
}

// POST /question-import/:sessionId/commmit
/** Body: { quizId: string(uuid), question: EditedQuestion[] }
 * `question` adalah hasil review/edit dari frontend - TIDAK dibaca ulang
 * dari session, supaya perubahan tentor di review page (edit teks, hapus soal,
 * ganti kunci) benar benar yang tersimpan
 */
interface CommitQuestionInput {
    question_text: string;
    question_type?: string
    difficulty?: string
    poin?: number;
    discussion?: string | null
    /** Single image (legacy/backward compat) */
    image?: string | null
    /** Multiple images — tiap elemen adalah filename relatif (tanpa "media/") dari sesi import */
    images?: string[]
    options: { text: string; is_correct: boolean }[]
}

export const commitWordImport = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if  (!user) { badRequest( response, "Unauthorized." ); return }

        const sessionId = Array.isArray(request.params.sessionId) ? request.params.sessionId[0] : request.params.sessionId;
        const { quizId, questions } = request.body as { quizId: string; questions: CommitQuestionInput[] };

        if (!quizId) { badRequest(response, "quizId wajib diisi."); return; }
        if (!Array.isArray(questions) || questions.length === 0) {
            badRequest(response, "Tidak ada soal untuk disimpan."); return;
        }
 
        const session = ImportSession.get(sessionId);
        if (!session) { notFound(response, "Import session tidak ditemukan atau sudah kedaluwarsa."); return; }
        if (session.isCommitting) {
            badRequest(response, "Sesi import ini sedang diproses. Harap tunggu.");
            return;
        }
        session.isCommitting = true;
 
        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizId) } });
        if (!quiz) { 
            session.isCommitting = false;
            notFound(response, "Quiz tujuan tidak ditemukan."); 
            return; 
        }
 
        // Pastikan folder tujuan gambar permanen ada
        const publicImageDir = path.join(UPLOAD_DIR, "question_image");
        fs.mkdirSync(publicImageDir, { recursive: true });
 
        const created_questions = await prisma.$transaction(async (tx) => {
            const results = [];
            let orderIndex = 0;
            for (const q of questions) {
                if (!q.question_text?.trim()) continue; // skip soal kosong

                let updated_question_text = q.question_text || "";
                let updated_discussion = q.discussion || "";
                let updated_options = (q.options || []).map(o => ({ ...o }));
 
                // ── Kumpulkan semua nama file gambar dari payload ──────────────
                // Frontend bisa kirim via `images[]` (multi) ATAU `image` (single legacy)
                const rawImageNames: string[] = [];
                if (Array.isArray(q.images) && q.images.length > 0) {
                    rawImageNames.push(...q.images);
                } else if (q.image) {
                    rawImageNames.push(q.image);
                }

                // Pindahkan setiap gambar dari staging (temp) ke folder permanen
                const permanentFilenames: string[] = [];
                for (const imgName of rawImageNames) {
                    const base = path.basename(imgName.replace(/\\/g, "/"));
                    let src = path.join(session.mediaDir, "media", base);
                    if (!fs.existsSync(src)) {
                        src = path.join(session.mediaDir, base);
                    }

                    if (fs.existsSync(src)) {
                        const ext = path.extname(base) || ".png";
                        const permanentFilename = `${uuidv4()}${ext}`;
                        fs.copyFileSync(src, path.join(publicImageDir, permanentFilename));
                        permanentFilenames.push(permanentFilename);

                        // Rewrite temporary markdown image URLs to point to permanent URL
                        const baseSafe = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const urlRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^)]*?${baseSafe}\\)(\\{[^}]*\\})?`, "g");
                        const replacement = `![$1](/public/question_image/${permanentFilename})$2`;
                        
                        updated_question_text = updated_question_text.replace(urlRegex, replacement);
                        updated_discussion = updated_discussion.replace(urlRegex, replacement);
                        updated_options = updated_options.map(o => ({ ...o, text: o.text.replace(urlRegex, replacement) }));
                    }
                }
 
                const newQuestion = await tx.questions.create({
                    data: {
                        uuid: uuidv4(),
                        question_text: updated_question_text,
                        // question_image tetap kosong untuk soal impor — gambar pakai relasi question_images
                        question_image: "",
                        question_type: (q.question_type ?? "MULTIPLE_CHOICE") as any,
                        difficulty: (q.difficulty ?? "EASY") as any,
                        poin: q.poin ?? 10,
                        discussion: updated_discussion,
                        order_index: orderIndex++,
                        quizId: quiz.id,
                    },
                });

                // Simpan semua gambar ke tabel question_images
                if (permanentFilenames.length > 0) {
                    await tx.question_images.createMany({
                        data: permanentFilenames.map((filename, idx) => ({
                            uuid: uuidv4(),
                            filename,
                            order_index: idx,
                            questionsId: newQuestion.id,
                        })),
                    });
                }

            if (updated_options.length > 0) {
                await tx.options.createMany({
                    data: updated_options.map((opt, idx) => ({
                        uuid: uuidv4(),
                        option_text: opt.text,
                        option_image: "",
                        is_correct: opt.is_correct,
                        order_index: idx,
                        questionsId: newQuestion.id
                    })),
                });
            }

            results.push(newQuestion);
        }

        return results;
    });

    // Bersihkan session setelah commit sukses
    fs.rm(session.mediaDir, { recursive: true, force: true }, () => {})
    ImportSession.delete(sessionId)

    created(response, `${created_questions.length} soal berhasil disimpan ke quiz.`, {
        quiz_uuid: quiz.uuid,
        imported_count: created_questions.length,
    });
    } catch (error) {
        console.error("[commitWordImport]", error)
        
        const sessionId = Array.isArray(request.params.sessionId) ? request.params.sessionId[0] : request.params.sessionId;
        const session = ImportSession.get(sessionId);
        if (session) {
            session.isCommitting = false;
        }

        serverError(response, "Gagal menyimpan soal ke database.")
    }
};


// DELETE
// Batal import - buang session + file temp tanpa menyimpan apapun ke DB.
export const discardWordImport = async (request: Request, response: Response): Promise<void> => {
    const sessionId = Array.isArray(request.params.sessionId) ? request.params.sessionId[0] : request.params.sessionId;
    const session = ImportSession.get(sessionId);
    if (!session) { notFound(response, "Import session tidak ditemukan"); return; }

    fs.rm(session.mediaDir, { recursive: true, force: true }, () => {})
    ImportSession.delete(sessionId);
    ok(response, "Import dibatalkan")
}