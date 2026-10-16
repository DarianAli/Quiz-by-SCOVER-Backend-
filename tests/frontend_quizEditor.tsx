"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Eye,
  Save,
  Rocket,
  Plus,
  FileText,
  CheckCircle2,
  Circle,
  Trash2,
  ChevronRight,
  FileUp,
} from "lucide-react"
import { getSubjectTheme } from "@/lib/theme/subject-themes"
import { getQuestionTypeTheme, normalizeQuestionType, type QuestionTypeKey } from "@/lib/theme/question-type-themes"
import { questionItemToFormValue, formValueToQuestionItem, type QuestionFormValue } from "@/types/questions"
import QuestionFormEditor from "../Subject/QuestionFormEditor"
import { toast } from "react-toastify"
import { post, put, get, drop } from "@/lib/api-bridge"
import { getCookie } from "@/lib/client-cookie"
import { BASE_API_URL } from "@/global"
import ImportQuestionPage from "../Subject/ImportQuestions/ImportQuestionsPage"
import MathText from "@/components/shared/MathText"


interface QuizEditorProps {
  quiz: any
  onSave: (quiz: any) => Promise<void> | void
  onBack: () => void
}

type SaveState = "idle" | "saving" | "saved"

type ViewMode = "list" | "question"

// Helper to deduce a theme from a subject ID if you still need it,
// or you can just hardcode / pick randomly
import type { SubjectThemeKey } from "@/lib/theme/subject-themes"

function getSubjectThemeKeyFallback(subjectId: number): SubjectThemeKey {
  const themes: SubjectThemeKey[] = ["math", "physics", "english", "biology", "history"]
  return themes[subjectId % themes.length] || "math"
}

export default function QuizEditor({ quiz: initialQuiz, onSave, onBack }: QuizEditorProps) {
  const [quiz, setQuiz] = useState<any>(initialQuiz)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [view, setView] = useState<ViewMode>("list")
  const [showImportPanel, setShowImportPanel] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const theme = getSubjectTheme(getSubjectThemeKeyFallback(quiz.subjectId))
  const className = quiz.class?.class_name ?? "Class"
  const subjectName = quiz.subject?.subject_name ?? "Subject"
  const activeQuestion = quiz.questions?.[activeIndex]
  const totalPoints = quiz.questions?.reduce((sum: number, q: any) => sum + (q.poin || 0), 0) || 0

  useEffect(() => {
    setSaveState("saving")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await onSave(quiz)
      setSaveState("saved")
    }, 800)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [quiz])

  const updateQuestion = (updated: any) => {
    setQuiz((prev: any) => ({
      ...prev,
      questions: prev.questions.map((q: any, i: number) => (i === activeIndex ? updated : q)),
    }))
  }

  const addQuestion = () => {
    const newQuestion = {
      id: undefined,
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`, // ✅ id sementara unik
      question_text: "",
      question_image: "",
      question_type: "multiple_choice",
      difficulty: quiz.difficulty,
      poin: 10,
      options: [
        { id: `tmp-${Date.now()}-a`, option_text: "", is_correct: false },
        { id: `tmp-${Date.now()}-b`, option_text: "", is_correct: false },
      ],
    }
    setQuiz((prev: any) => ({ ...prev, questions: [...(prev.questions || []), newQuestion] }))
    setActiveIndex(quiz.questions ? quiz.questions.length : 0)
  }

  const refetchQuiz = async () => {
    const token = getCookie("token") as string
    const response = await get(`${BASE_API_URL}/quiz/${quiz.uuid}`, token)
    if (response.data?.success) setQuiz(response.data.data)
  }

  const deleteQuestion = async (index: number) => {
    const question = quiz.questions?.[index]
    // Only call backend if the question is already persisted (has a real id/uuid)
    if (question && (question.uuid || question.id) && !String(question.id).startsWith("tmp-")) {
      try {
        const token = getCookie("token") as string
        const idToDelete = question.uuid || question.id
        await drop(`${BASE_API_URL}/question/delete/${idToDelete}`, token)
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Gagal menghapus soal dari database")
        return // Abort — don't remove from UI if DB delete failed
      }
    }
    setQuiz((prev: any) => ({ ...prev, questions: prev.questions.filter((_: any, i: number) => i !== index) }))
    setActiveIndex((prev: number) => Math.max(0, prev - 1))
  }

  const handleSaveDraft = () => {
    onSave(quiz)
    setSaveState("saved")
  }

  const handlePublish = () => {
    setQuiz((prev: any) => ({ ...prev, status: "PUBLISHED" }))
  }

  const openQuestion = (index: number) => {
    setActiveIndex(index)
    setView("question")
  }

  const backToList = () => setView("list")

const handleSaveQuestionForm = async (value: QuestionFormValue) => {
  if (!activeQuestion) return
  const isNew = !activeQuestion.id

  try {
    const token = getCookie("token") as string
    let questionId = activeQuestion.id

    if (isNew) {
      const qPayload = {
        question_text: value.prompt,
        difficulty: quiz.difficulty,
        poin: value.points || 10,
        quizId: quiz.uuid,
        discussion: value.explanation,
        question_type: value.type, // ✅ Kirim tipe soal ke backend
      }
      const resQ = await post(`${BASE_API_URL}/question/add`, qPayload, token)
      if (!resQ.data?.success) {
        toast.error(resQ.data?.message || "Gagal membuat pertanyaan")
        return
      }
      questionId = resQ.data.data.id

      // ✅ Simpan questionId ke state SEGERA — sebelum step opsi.
      updateQuestion({
        ...formValueToQuestionItem(value, questionId),
        id: questionId,
      })

      if (value.choices && value.choices.length > 0) {
        const optionPromises = value.choices.map((opt, idx) =>
          post(`${BASE_API_URL}/option/add`, {
            option_text: opt.text,
            is_correct: String(opt.isCorrect),
            order_index: idx,
            questionId: questionId
          }, token)
        )
        const optionResults = await Promise.all(optionPromises)
        const failed = optionResults.find(r => !r.data?.success)
        if (failed) {
          toast.error(failed.data?.message || "Sebagian pilihan jawaban gagal disimpan")
          return
        }
      }
      toast.success("Question created")
    } else {
      // ✅ Edit: persist ke backend via PUT (bukan hanya update lokal)
      const updatePayload = {
        question_text: value.prompt,
        difficulty: quiz.difficulty,
        poin: value.points || 10,
        discussion: value.explanation,
        question_type: value.type, // ✅ Pastikan tipe soal tersimpan saat edit
      }
      const questionIdOrUuid = activeQuestion.uuid || activeQuestion.id
      const resUpdate = await put(`${BASE_API_URL}/question/update/${questionIdOrUuid}`, updatePayload, token)
      if (!resUpdate.data?.success) {
        toast.error(resUpdate.data?.message || "Gagal memperbarui pertanyaan")
        return
      }

      updateQuestion({
        ...formValueToQuestionItem(value, activeQuestion.idQuestion || activeQuestion.id),
        id: questionId
      })
      toast.success("Question updated")
    }

    setView("list")
  } catch (err: any) {
    console.error("[handleSaveQuestionForm]", {
      endpoint: `${BASE_API_URL}/question/add | /option/add | /question/update`,
      status: err?.response?.status,
      message: err?.response?.data?.message ?? err?.message,
      body: err?.response?.data,
    })
    toast.error(err?.response?.data?.message || "Failed to save question")
  }
}

  if (view === "question" && activeQuestion) {
    // Normalize question_type from backend (UPPERCASE enum) to frontend lowercase key
    const resolvedType = normalizeQuestionType(activeQuestion.question_type)
    const parsedInitialValue: QuestionFormValue = {
        prompt: activeQuestion.question_text || "",
        points: activeQuestion.poin || 10,
        explanation: activeQuestion.discussion || "",
        type: resolvedType,
        difficulty: activeQuestion.difficulty || "EASY",
        tag: "",
        choices: activeQuestion.options?.map((o: any) => ({
            id: o.uuid || o.idOption || o.id,
            text: o.option_text,
            isCorrect: typeof o.is_correct === "string" ? o.is_correct === "true" : Boolean(o.is_correct),
            isEditing: false
        })) || []
    }

    return (
      <div className="min-h-dvh bg-slate-50 pt-6">
        <QuestionFormEditor
          key={activeQuestion.id || activeIndex}
          initialValue={parsedInitialValue}
          onCancel={backToList}
          onSave={handleSaveQuestionForm}
          onDelete={() => {
            deleteQuestion(activeIndex)
            setView("list")
          }}
          saveLabel="Save changes"
        />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
          aria-label="Back to console"
        >
          <ArrowLeft size={16} />
          Console
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <AutosaveIndicator state={saveState} />
          <button
            onClick={onBack}
            type="button"
            className="h-9 px-3.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => openQuestion(activeIndex)}
            type="button"
            disabled={quiz.questions?.length === 0}
            className="h-9 px-3.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px"
          >
            <Eye size={15} />
            Preview
          </button>
          <button
            onClick={handleSaveDraft}
            type="button"
            className="h-9 px-3.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px"
          >
            <Save size={15} />
            Save draft
          </button>
          <button
            onClick={handlePublish}
            type="button"
            className={`h-9 px-4 rounded-xl text-sm font-semibold text-white flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px hover:shadow-md ${theme.button}`}
          >
            <Rocket size={15} />
            Publish changes
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6 animate-fade-slide-up">
          <div className={`w-11 h-11 rounded-2xl ${theme.iconBg} text-white flex items-center justify-center flex-shrink-0`}>
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Editing</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">Edit quiz</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${theme.badge}`}>{className}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${theme.badge}`}>{subjectName}</span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Update details, reorder questions, and publish when ready.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Quiz title
                </label>
                <input
                  value={quiz.quiz_title}
                  onChange={(e) => setQuiz((prev: any) => ({ ...prev, quiz_title: e.target.value }))}
                  placeholder="Untitled quiz"
                  aria-label="Quiz title"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-slate-900/10"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={quiz.duration}
                    onChange={(e) => setQuiz((prev: any) => ({ ...prev, duration: Number(e.target.value) }))}
                    aria-label="Duration in minutes"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-slate-900/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Questions
                  </label>
                  <div className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700 flex items-center">
                    {quiz.questions?.length || 0}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Total points
                  </label>
                  <div className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700 flex items-center">
                    {totalPoints}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Questions</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Click any question to edit it.</p>
                </div>
                <button
                  onClick={() => {
                    addQuestion()
                    setView("question")
                  }}
                  type="button"
                  className={`h-9 px-4 rounded-xl text-sm font-semibold text-white flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px hover:shadow-md ${theme.button}`}
                >
                  <Plus size={15} />
                  Add question
                </button>
                <button 
                  onClick={() => setShowImportPanel(true)}
                  type="button"
                  className="h-9 px-3.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                >
                  <FileUp size={15} />
                  Import from Word
                </button>
              </div>

              {quiz.questions && quiz.questions.length > 0 ? (
                <div className="space-y-2.5">
                  {quiz.questions.map((q: any, i: number) => (
                    <QuestionListCard
                      key={q.id ?? q.tempId ?? `idx-${i}`}  
                      question={q}
                      index={i}
                      active={i === activeIndex}
                      onOpen={() => openQuestion(i)}
                      onDelete={() => deleteQuestion(i)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  onAdd={() => {
                    addQuestion()
                    setView("question")
                  }}
                  theme={theme as any}
                />
              )}
            </div>
          </div>

          <div className="space-y-5 lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-9 h-9 rounded-xl ${theme.iconBg} text-white flex items-center justify-center flex-shrink-0`}>
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Quiz ID</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">{quiz.uuid || quiz.id}</p>
                </div>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Questions</dt>
                  <dd className="font-semibold text-slate-900">{quiz.questions?.length || 0}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Total points</dt>
                  <dd className="font-semibold text-slate-900">{totalPoints}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-semibold text-slate-900">{quiz.duration} min</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <Badge tone={quiz.status === "COMPLETED" || quiz.status === "PUBLISHED" ? "green" : "amber"}>
                      {quiz.status === "COMPLETED" || quiz.status === "PUBLISHED" ? "Published" : "Draft"}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-900 mb-3">Ready checklist</p>
              <ul className="space-y-2">
                <ChecklistItem done={(quiz.quiz_title || "").trim().length > 0} label="Title filled" />
                <ChecklistItem done={(quiz.questions?.length || 0) >= 3} label="At least 3 questions added" />
                <ChecklistItem
                  done={(quiz.questions?.length || 0) > 0 && quiz.questions.every((q: any) => (q.question_text || "").trim().length > 0)}
                  label="Every question has text"
                />
                <ChecklistItem done={quiz.status === "COMPLETED" || quiz.status === "PUBLISHED"} label="Ready to publish" />
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showImportPanel && (
        <ImportQuestionPage 
          quizId={quiz.uuid}
          onClose={() => setShowImportPanel(false)}
          onImportComplete={refetchQuiz}
        />
      )}
    </div>
  )
}

function QuestionListCard({
  question,
  index,
  active,
  onOpen,
  onDelete,
}: {
  question: any
  index: number
  active: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const typeTheme = getQuestionTypeTheme(question.question_type || "multiple_choice")

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-150 hover:-translate-y-px hover:shadow-sm ${
        active ? "border-slate-300 bg-slate-50" : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      <button
        onClick={onOpen}
        type="button"
        aria-label={`Edit question ${index + 1}`}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
      >
        <span
          className={`w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 ${typeTheme.iconBg}`}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md tracking-wide uppercase ${typeTheme.badge}`}>
              {typeTheme.label}
            </span>
            <span className="text-xs text-slate-400">{question.poin || 0} pts</span>
          </div>
          <div className="text-sm text-slate-900 truncate line-clamp-1">
            {question.question_text ? (
              <MathText text={question.question_text} className="inline" />
            ) : (
              <span className="text-slate-300 italic">Empty question</span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-300 flex-shrink-0 group-hover:text-slate-400 transition-colors" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        type="button"
        aria-label={`Delete question ${index + 1}`}
        className="absolute top-2.5 right-9 w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle size={16} className="text-slate-300 flex-shrink-0" />
      )}
      <span className={done ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </li>
  )
}

function EmptyState({ onAdd, theme }: { onAdd: () => void; theme: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-base font-semibold text-slate-900">Start your first question</p>
      <p className="text-sm text-slate-500 mt-1 mb-4">This quiz doesn&apos;t have any questions yet.</p>
      <button
        onClick={onAdd}
        type="button"
        className={`px-4 h-10 rounded-xl text-white text-sm font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-md ${theme.button}`}
      >
        Add first question
      </button>
    </div>
  )
}

function AutosaveIndicator({ state }: { state: SaveState }) {
  const label = state === "saving" ? "Saving..." : state === "saved" ? "Saved" : ""
  if (!label) return null
  return (
    <span className={`text-xs font-medium ${state === "saving" ? "text-slate-400" : "text-emerald-600"}`}>
      {label}
    </span>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "slate" | "green" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${tones[tone]}`}>{children}</span>
}