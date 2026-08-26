"use client"

import { useCallback, useEffect, useState } from "react"
import { Upload, FileText, Loader2, X, CheckSquare, Square, Trash2, ArrowLeft } from "lucide-react"
import { toast } from "react-toastify"
import QuestionReviewCard, { type ReviewQuestion, type ReviewOption } from "./QuestionReviewCard"
import QuestionNavigation from "./QuestionNavigation"
import { questionImportService, type ImportQuestion } from "@/services/questionImport.service"
import { resolveLocalImagePaths } from "@/lib/content-parser"

interface ImportQuestionPageProps {
    quizId: string
    onClose: () => void
    onImportComplete: () => void
}

type Stage = "upload" | "parsing" | "review" | "committing"

let localIdCounter = 0
const nextLocalId = () => `q-${Date.now()}-${localIdCounter++}`

function toReviewQuestion(q: ImportQuestion, sessionId: string): ReviewQuestion {
    // Resolve any local filesystem image paths embedded in the question text
    // (e.g. ![](/var/folders/.../image1.png)) into proper backend media URLs.
    const resolveText = (text: string) =>
        resolveLocalImagePaths(text, sessionId, questionImportService.mediaUrl)

    return {
        localId: nextLocalId(),
        number: q.number,
        question_text: resolveText(q.question_text),
        question_type: "MULTIPLE_CHOICE",
        difficulty: q.ai_suggested_difficulty ?? "EASY",
        poin: 10,
        discussion: "",
        // Legacy single image (untuk tampilan di editor)
        image: q.images[0]?.replace(/^media\//, "") ?? null,
        imageUrl: q.images[0] ? questionImportService.mediaUrl(sessionId, q.images[0].replace(/^media\//, "")) : null,
        // Semua gambar (multi-image support)
        images: q.images.map(img => img.replace(/^media\//, "")),
        imageUrls: q.images.map(img => questionImportService.mediaUrl(sessionId, img.replace(/^media\//, ""))),
        options: q.options.map((o): ReviewOption => ({
            id: `opt-${nextLocalId()}`,
            letter: o.letter,
            text: resolveText(o.text),
            is_correct: o.letter === q.correct_letter
        })),
        warnings: q.warnings,
        aiSuggestedDifficulty: q.ai_suggested_difficulty ?? "EASY",
        aiSuggestedTopic: q.ai_suggested_topic,
        aiEquationFlag: q.ai_equation_flag,
        selected: false
    }
}

export default function ImportQuestionPage({ quizId, onClose, onImportComplete }: ImportQuestionPageProps) {
    const [stage, setStage] = useState<Stage>("upload")
    const [isDragging, setIsDragging] = useState(false)
    const [sessionId, setSessionId] = useState<string |null>(null)
    const [sourceFilename, setSourceFilename] = useState<string>("")
    const [questions, setQuestions] = useState<ReviewQuestion[]>([])
    const [parseProgress, setParseProgress] = useState<string>("")
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (questions.length === 0) {
            if (currentIndex !== 0) setCurrentIndex(0)
            return
        }
        if (currentIndex > questions.length - 1) {
            setCurrentIndex(questions.length - 1)
        }
    }, [questions.length, currentIndex])

    const handleFile = useCallback(async (file: File) => {
        setStage("parsing")
        setParseProgress(`Membaca ${file.name}...`)
        try {
            const result = await questionImportService.parseFile(file)
            setSessionId(result.import_session_id)
            setSourceFilename(result.source_filename)
            setQuestions(result.questions.map((q) => toReviewQuestion(q, result.import_session_id)))
            setCurrentIndex(0)
            setStage("review")
            if (result.warnings_count > 0) {
                toast.warning(`${result.warnings_count} dari ${result.total_questions} soal punya direview manual.`)
            } else {
                toast.success(`${result.total_questions} soal berhasil di-parse.`)
            }
        } catch (error: any) {
            toast.error(error?.message || "Gagal memproses file.")
            setStage("upload")
        } 
    }, [])

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
    }

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
    }

    const updateQuestion = (localId: string, updated: ReviewQuestion) => {
        setQuestions((prev) => prev.map((q) => (q.localId === localId ? updated : q))) 
    }

    const deleteQuestion = (localId: string) => {
        setQuestions((prev) => {
            const idx = prev.findIndex((q) => q.localId === localId)
            const next = prev.filter((q) => q.localId !== localId)
            if (idx !== -1) {
                setCurrentIndex((ci) => {
                    if (next.length === 0) return 0
                    if (idx < ci) return ci - 1
                    return Math.min(ci, next.length - 1)
                })
            } 
            return next
        })
    }

    const duplicateQuestion = (localId: string) => {
        setQuestions((prev) => {
            const idx = prev.findIndex((q) => q.localId === localId)
            if (idx === -1) return prev
            const clone: ReviewQuestion = {
                ...prev[idx],
                localId: nextLocalId(),
                options: prev[idx].options.map((o) => ({ ...o, id: `opt-${nextLocalId()}` })),
            }
            const next = [...prev]
            next.splice(idx + 1, 0, clone)
            setCurrentIndex(idx + 1)
            return next
        })
    }

    const selectedCount = questions.filter((q) => q.selected).length
    const allSelected = questions.length > 0 && selectedCount === questions.length

    const toggleSelectAll = () => {
        setQuestions((prev) => prev.map((q) => ({...q, selected: !allSelected})))
    }

    const bulkDelete = () => {
        setQuestions((prev) => {
            const next = prev.filter((q) => !q.selected)
            setCurrentIndex((ci) => (next.length === 0 ? 0 : Math.min(ci, next.length - 1)))
            return next
        })
    }

    const bulkSetDifficulty = (difficulty: ReviewQuestion["difficulty"]) => {
        setQuestions((prev) => prev.map((q) => (q.selected ? { ...q, difficulty } : q)))
    }

    const handleCommit = async () => {
        if (!sessionId) return
        if (questions.length === 0) {
            toast.error("Tidak ada soal untuk disimpan.")
            return
        }

        const invalidIdx = questions.findIndex((q) => q.question_type === "MULTIPLE_CHOICE" && !q.options.some((o) => o.is_correct))
        if (invalidIdx !== -1) {
            toast.error(`Soal #${questions[invalidIdx].number} belum punya jawaban benar yang ditandai.`)
            setCurrentIndex(invalidIdx)
            return
        }

        setStage("committing")
        try {
            const payload = questions.map((q) => ({
                question_text: q.question_text,
                question_type: q.question_type,
                difficulty: q.difficulty,
                poin: q.poin,
                discussion: q.discussion || null,
                // Kirim semua gambar via `images[]` — backend akan simpan ke question_images tabel
                images: q.images ?? (q.image ? [q.image] : []),
                options: q.options.map((o) => ({ text: o.text, is_correct: o.is_correct })),
            }))
            const result = await questionImportService.commit(sessionId, quizId, payload)
            toast.success(`${result.imported_count} soal berhasil ditambahkan ke quiz.`)
            onImportComplete()
            onClose()
        } catch (error: any) {
            toast.error(error?.message || "Gagal menyimpan soal.")
            setStage("review")
        }
    }

    const handleCancel = async () => {
        if (sessionId) {
            try { await questionImportService.discard(sessionId) } catch { /* best-effort */ }
        }
        onClose()
    }

    const currentQuestion = questions[currentIndex]

    return (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between">
                <button
                    onClick={handleCancel}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
                >
                    <ArrowLeft size={16} /> Cancel import
                </button>
                {stage === "review" && (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{questions.length} soal siap disimpan</span>
                        <button
                            onClick={handleCommit}
                            className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                        >
                            Save {questions.length} questions to quiz
                        </button>
                    </div>
                )}
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {stage === "upload" && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                        className={`rounded-2xl border-2 border-dashed p-16 text-center transition-colors ${isDragging ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`}
                    >
                        <Upload className="mx-auto mb-4 text-slate-300" size={40}/>
                        <p className="text-base font-semibold text-slate-900 mb-1">Upload soal dari Word</p>
                        <p className="text-sm text-slate-500 mb-5">Drag & drop file .docx atau .doc di sini, atau klik untuk pilih file</p>
                        <label className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer hover:bg-slate-800">
                            <FileText size={15} /> Choose file
                        </label>
                        <p className="text-xs text-slate-400 mt-4">
                            Format soal: nomor list, opsi A-E, kunci ditandai "Kunci: X". Rumus matematika (equation editor Word)
                            otomatis dikonversi ke LaTeX - tidak jadi gambar.
                        </p>
                    </div>
                )}

                {stage === "parsing" && (
                    <div className="rounded-2xl bg-white p-16 text-center ring-1 ring-slate-100">
                        <Loader2 className="mx-auto mb-4 text-slate-400 animate-spin" size={32} />
                        <p className="text-sm font-medium text-slate-600">{parseProgress}</p>
                    </div>
                )}

                {(stage === "review" || stage === "committing") && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <FileText size={16} className="text-slate-400" />
                                <span className="text-xs text-slate-400">
                                    {sourceFilename || "Imported file"} - {questions.length} questions
                                </span>
                            </div>

                            {/* Bulk action bar */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={toggleSelectAll}
                                    className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:slate-900"
                                >
                                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    Select all
                                </button>
                                {selectedCount > 0 && (
                                    <>
                                        <span className="text-xs text-slate-400">{selectedCount} selected</span>
                                        <div className="h-4 w-px bg-slate-200" />
                                        <select
                                            onChange={(e) => e.target.value && bulkSetDifficulty(e.target.value as ReviewQuestion["difficulty"])}
                                            defaultValue=""
                                            className="h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                                        >
                                            <option value="" disabled>Set difficulty...</option>
                                            <option value="EASY">Easy</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HARD">Hard</option>
                                        </select>
                                        <button
                                            onClick={bulkDelete}
                                            className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"
                                        >
                                            <Trash2 size={13}/> Delete selected
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        { questions.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-2xl ring-1 ring-slate-100">
                                Semua soal sudah dihapus dari daftar import.    
                            </div>
                        ) : (
                            <>
                                {/* Pagination - a lightweight nav bar, never a full list of a editors */}
                                <QuestionNavigation 
                                    question={questions}
                                    currentIndex={currentIndex}
                                    onSelect={setCurrentIndex}
                                />

                                {/* Only the ACTIVE question is ever mounted here */}
                                {currentQuestion && (
                                    <QuestionReviewCard 
                                        key={currentQuestion.localId}
                                        question={currentQuestion}
                                        index={currentIndex}
                                        total={questions.length}
                                        onChange={(updated) => updateQuestion(currentQuestion.localId, updated)}
                                        onDelete={() => deleteQuestion(currentQuestion.localId)}
                                        onDuplicate={() => duplicateQuestion(currentQuestion.localId)}
                                    />
                                )}  

                                {/* Footer prev/next, mirrors the top pagination for long questions */}
                                <div className="flex items-center justify-between bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3">
                                    <button
                                        onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                                        disabled={currentIndex === 0}
                                        className="h-9 px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                                    >
                                        ← Previous
                                    </button>
                                    <span className="text-xs text-slate-400">
                                        Question {currentIndex + 1} of {questions.length}
                                    </span>
                                    <button
                                        onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                                        disabled={currentIndex === questions.length - 1}
                                        className="h-9 px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:bg-transparent"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </>
                        ) }
                    </div>
                )}
            </div>
        </div>
    )
}