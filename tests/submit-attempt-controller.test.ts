import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { submitAttempt } from "../src/controller/attempt-controller.js";

// Helper to create mock Express req and res
function createMockReqRes(user: any, params: any) {
    const req: any = {
        user,
        params,
    };
    let responseStatus = 200;
    let responseBody: any = null;

    const res: any = {
        status(code: number) {
            responseStatus = code;
            return res;
        },
        json(body: any) {
            responseBody = body;
            return res;
        },
    };

    return {
        req,
        res,
        getResponse: () => ({ status: responseStatus, body: responseBody }),
    };
}

// Helper: mock $transaction to run the callback with a tx proxy that delegates
// attempt.update and scores.create back to the (already-mocked) top-level prisma.
function mockTransaction() {
    (prisma as any).$transaction = async (fn: (tx: any) => Promise<any>) => {
        const tx = {
            attempt: { update: (args: any) => prisma.attempt.update(args) },
            scores:  { create: (args: any) => prisma.scores.create(args) },
        };
        return fn(tx);
    };
}

test("submitAttempt controller integration: Mixed standalone + STORY_GROUP", async () => {
    // Save original prisma methods
    const origQuizFindFirst    = prisma.quiz.findFirst;
    const origAttemptFindFirst = prisma.attempt.findFirst;
    const origAnswersFindMany  = prisma.answers.findMany;
    const origQuestionsFindMany = prisma.questions.findMany;
    const origAttemptUpdate    = prisma.attempt.update;
    const origScoresCreate     = prisma.scores.create;
    const origStreakFindFirst  = prisma.user_streak.findFirst;
    const origStreakUpdate     = prisma.user_streak.update;
    const origStreakCreate     = prisma.user_streak.create;
    const origActivityCreate   = prisma.activity_log.create;
    const origTransaction      = (prisma as any).$transaction;

    try {
        const mockQuiz = {
            id: 1,
            uuid: "quiz-uuid-1",
            duration: 60,
            difficulty: "MEDIUM",
        };
        const mockAttempt = {
            id: 10,
            userId: 42,
            quizId: 1,
            isFinished: false,
            start_time: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
            quiz: mockQuiz,
        };

        // User answers:
        // child A (101) = correct (+10)
        // child B (102) = correct (+10)
        // child C (103) = correct (+10)
        // standalone D (201) = correct (+10)
        const mockAnswers = [
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 101,
                optionsId: 1001,
                answer_text: null,
                options: { is_correct: true },
                questions: {
                    id: 101,
                    poin: 10,
                    question_type: "MULTIPLE_CHOICE",
                    allow_multiple_answers: false,
                    is_strict: false,
                    options: [{ id: 1001, is_correct: true, option_text: "Option A" }],
                },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 102,
                optionsId: 1002,
                answer_text: null,
                options: { is_correct: true },
                questions: {
                    id: 102,
                    poin: 10,
                    question_type: "MULTIPLE_CHOICE",
                    allow_multiple_answers: false,
                    is_strict: false,
                    options: [{ id: 1002, is_correct: true, option_text: "Option B" }],
                },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 103,
                optionsId: 1003,
                answer_text: null,
                options: { is_correct: true },
                questions: {
                    id: 103,
                    poin: 10,
                    question_type: "MULTIPLE_CHOICE",
                    allow_multiple_answers: false,
                    is_strict: false,
                    options: [{ id: 1003, is_correct: true, option_text: "Option C" }],
                },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 201,
                optionsId: 2001,
                answer_text: null,
                options: { is_correct: true },
                questions: {
                    id: 201,
                    poin: 10,
                    question_type: "MULTIPLE_CHOICE",
                    allow_multiple_answers: false,
                    is_strict: false,
                    options: [{ id: 2001, is_correct: true, option_text: "Option D" }],
                },
            },
        ];

        // Top-level questions returned by DB:
        // 1 STORY_GROUP (id 100) with 3 children (101, 102, 103)
        // 1 standalone D (id 201)
        const mockTopLevelQuestions = [
            {
                id: 100,
                uuid: "q-story-100",
                question_text: "Story Context",
                question_type: "STORY_GROUP",
                poin: 10, // Container poin must not be added to maxScore
                parentId: null,
                children: [
                    { id: 101, uuid: "q-child-101", question_text: "Child A", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                    { id: 102, uuid: "q-child-102", question_text: "Child B", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                    { id: 103, uuid: "q-child-103", question_text: "Child C", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                ],
            },
            {
                id: 201,
                uuid: "q-standalone-201",
                question_text: "Standalone D",
                question_type: "MULTIPLE_CHOICE",
                poin: 10,
                parentId: null,
                children: [],
            },
        ];

        let createdScoreData: any = null;
        let updatedAttemptData: any = null;

        prisma.quiz.findFirst     = async () => mockQuiz as any;
        prisma.attempt.findFirst  = async () => mockAttempt as any;
        prisma.answers.findMany   = async () => mockAnswers as any;
        prisma.questions.findMany = async () => mockTopLevelQuestions as any;
        prisma.attempt.update = async (args: any) => {
            updatedAttemptData = args.data;
            return {} as any;
        };
        prisma.scores.create = async (args: any) => {
            createdScoreData = args.data;
            return {} as any;
        };
        prisma.user_streak.findFirst = async () => null as any;
        prisma.user_streak.create    = async () => ({} as any);
        prisma.activity_log.create   = async () => ({} as any);
        mockTransaction();

        const { req, res, getResponse } = createMockReqRes({ idUser: 42 }, { uuid: "quiz-uuid-1" });

        await submitAttempt(req, res);

        const response = getResponse();
        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);

        const scoreResult = response.body.data.score_result;
        assert.equal(scoreResult.total_questions, 4, "total_questions must be 4");
        assert.equal(scoreResult.correct, 4, "correct must be 4");
        assert.equal(scoreResult.wrong, 0, "wrong must be 0");
        assert.equal(scoreResult.skipped, 0, "skipped must be 0");
        assert.equal(scoreResult.score, 100, "normalized score must be 100");
        assert.equal(scoreResult.accuracy, 100, "accuracy must be 100");

        assert.equal(createdScoreData.total_questions, 4);
        assert.equal(createdScoreData.score, 100);
        assert.equal(createdScoreData.review_status, "AUTO_GRADED");
        assert.equal(updatedAttemptData.isFinished, true);

    } finally {
        // Restore prisma methods
        prisma.quiz.findFirst     = origQuizFindFirst;
        prisma.attempt.findFirst  = origAttemptFindFirst;
        prisma.answers.findMany   = origAnswersFindMany;
        prisma.questions.findMany = origQuestionsFindMany;
        prisma.attempt.update     = origAttemptUpdate;
        prisma.scores.create      = origScoresCreate;
        prisma.user_streak.findFirst = origStreakFindFirst;
        prisma.user_streak.update    = origStreakUpdate;
        prisma.user_streak.create    = origStreakCreate;
        prisma.activity_log.create   = origActivityCreate;
        (prisma as any).$transaction = origTransaction;
    }
});

test("submitAttempt controller integration: Three correct (one wrong)", async () => {
    const origQuizFindFirst    = prisma.quiz.findFirst;
    const origAttemptFindFirst = prisma.attempt.findFirst;
    const origAnswersFindMany  = prisma.answers.findMany;
    const origQuestionsFindMany = prisma.questions.findMany;
    const origAttemptUpdate    = prisma.attempt.update;
    const origScoresCreate     = prisma.scores.create;
    const origStreakFindFirst  = prisma.user_streak.findFirst;
    const origStreakUpdate     = prisma.user_streak.update;
    const origStreakCreate     = prisma.user_streak.create;
    const origActivityCreate   = prisma.activity_log.create;
    const origTransaction      = (prisma as any).$transaction;

    try {
        const mockQuiz = {
            id: 1,
            uuid: "quiz-uuid-1",
            duration: 60,
            difficulty: "MEDIUM",
        };
        const mockAttempt = {
            id: 10,
            userId: 42,
            quizId: 1,
            isFinished: false,
            start_time: new Date(Date.now() - 10 * 60 * 1000),
            quiz: mockQuiz,
        };

        // User answers:
        // child A (101) = correct (+10)
        // child B (102) = correct (+10)
        // child C (103) = WRONG
        // standalone D (201) = correct (+10)
        const mockAnswers = [
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 101,
                optionsId: 1001,
                answer_text: null,
                options: { is_correct: true },
                questions: { id: 101, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 102,
                optionsId: 1002,
                answer_text: null,
                options: { is_correct: true },
                questions: { id: 102, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 103,
                optionsId: 1003,
                answer_text: null,
                options: { is_correct: false },
                questions: { id: 103, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 201,
                optionsId: 2001,
                answer_text: null,
                options: { is_correct: true },
                questions: { id: 201, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
        ];

        const mockTopLevelQuestions = [
            {
                id: 100,
                uuid: "q-story-100",
                question_text: "Story Context",
                question_type: "STORY_GROUP",
                poin: 10,
                parentId: null,
                children: [
                    { id: 101, uuid: "q-child-101", question_text: "Child A", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                    { id: 102, uuid: "q-child-102", question_text: "Child B", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                    { id: 103, uuid: "q-child-103", question_text: "Child C", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                ],
            },
            {
                id: 201,
                uuid: "q-standalone-201",
                question_text: "Standalone D",
                question_type: "MULTIPLE_CHOICE",
                poin: 10,
                parentId: null,
                children: [],
            },
        ];

        let createdScoreData: any = null;

        prisma.quiz.findFirst     = async () => mockQuiz as any;
        prisma.attempt.findFirst  = async () => mockAttempt as any;
        prisma.answers.findMany   = async () => mockAnswers as any;
        prisma.questions.findMany = async () => mockTopLevelQuestions as any;
        prisma.attempt.update     = async () => ({} as any);
        prisma.scores.create = async (args: any) => {
            createdScoreData = args.data;
            return {} as any;
        };
        prisma.user_streak.findFirst = async () => null as any;
        prisma.user_streak.create    = async () => ({} as any);
        prisma.activity_log.create   = async () => ({} as any);
        mockTransaction();

        const { req, res, getResponse } = createMockReqRes({ idUser: 42 }, { uuid: "quiz-uuid-1" });

        await submitAttempt(req, res);

        const response = getResponse();
        assert.equal(response.status, 200);

        const scoreResult = response.body.data.score_result;
        assert.equal(scoreResult.total_questions, 4, "total_questions must be 4");
        assert.equal(scoreResult.correct, 3, "correct must be 3");
        assert.equal(scoreResult.wrong, 1, "wrong must be 1");
        assert.equal(scoreResult.skipped, 0, "skipped must be 0");
        assert.equal(scoreResult.score, 75, "normalized score must be 75");
        assert.equal(scoreResult.accuracy, 75, "accuracy must be 75");
        assert.equal(createdScoreData.score, 75);
    } finally {
        prisma.quiz.findFirst     = origQuizFindFirst;
        prisma.attempt.findFirst  = origAttemptFindFirst;
        prisma.answers.findMany   = origAnswersFindMany;
        prisma.questions.findMany = origQuestionsFindMany;
        prisma.attempt.update     = origAttemptUpdate;
        prisma.scores.create      = origScoresCreate;
        prisma.user_streak.findFirst = origStreakFindFirst;
        prisma.user_streak.update    = origStreakUpdate;
        prisma.user_streak.create    = origStreakCreate;
        prisma.activity_log.create   = origActivityCreate;
        (prisma as any).$transaction = origTransaction;
    }
});

test("submitAttempt controller integration: Unanswered child questions", async () => {
    const origQuizFindFirst    = prisma.quiz.findFirst;
    const origAttemptFindFirst = prisma.attempt.findFirst;
    const origAnswersFindMany  = prisma.answers.findMany;
    const origQuestionsFindMany = prisma.questions.findMany;
    const origAttemptUpdate    = prisma.attempt.update;
    const origScoresCreate     = prisma.scores.create;
    const origStreakFindFirst  = prisma.user_streak.findFirst;
    const origStreakUpdate     = prisma.user_streak.update;
    const origStreakCreate     = prisma.user_streak.create;
    const origActivityCreate   = prisma.activity_log.create;
    const origTransaction      = (prisma as any).$transaction;

    try {
        const mockQuiz = {
            id: 1,
            uuid: "quiz-uuid-1",
            duration: 60,
            difficulty: "MEDIUM",
        };
        const mockAttempt = {
            id: 10,
            userId: 42,
            quizId: 1,
            isFinished: false,
            start_time: new Date(Date.now() - 10 * 60 * 1000),
            quiz: mockQuiz,
        };

        // User answers:
        // child A (101) = correct (+10)
        // child B (102) = correct (+10)
        // child C (103) = UNANSWERED (no answer record)
        // standalone D (201) = correct (+10)
        const mockAnswers = [
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 101,
                optionsId: 1001,
                answer_text: null,
                options: { is_correct: true },
                questions: { id: 101, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 102,
                optionsId: 1002,
                answer_text: null,
                options: { is_correct: true },
                questions: { id: 102, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
            {
                attemptId: 10,
                userId: 42,
                quizId: 1,
                questionsId: 201,
                optionsId: 2001,
                answer_text: null,
                options: { is_correct: true },
                questions: { id: 201, poin: 10, question_type: "MULTIPLE_CHOICE", allow_multiple_answers: false, is_strict: false, options: [] },
            },
        ];

        const mockTopLevelQuestions = [
            {
                id: 100,
                uuid: "q-story-100",
                question_text: "Story Context",
                question_type: "STORY_GROUP",
                poin: 10,
                parentId: null,
                children: [
                    { id: 101, uuid: "q-child-101", question_text: "Child A", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                    { id: 102, uuid: "q-child-102", question_text: "Child B", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                    { id: 103, uuid: "q-child-103", question_text: "Child C", question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                ],
            },
            {
                id: 201,
                uuid: "q-standalone-201",
                question_text: "Standalone D",
                question_type: "MULTIPLE_CHOICE",
                poin: 10,
                parentId: null,
                children: [],
            },
        ];

        let createdScoreData: any = null;

        prisma.quiz.findFirst     = async () => mockQuiz as any;
        prisma.attempt.findFirst  = async () => mockAttempt as any;
        prisma.answers.findMany   = async () => mockAnswers as any;
        prisma.questions.findMany = async () => mockTopLevelQuestions as any;
        prisma.attempt.update     = async () => ({} as any);
        prisma.scores.create = async (args: any) => {
            createdScoreData = args.data;
            return {} as any;
        };
        prisma.user_streak.findFirst = async () => null as any;
        prisma.user_streak.create    = async () => ({} as any);
        prisma.activity_log.create   = async () => ({} as any);
        mockTransaction();

        const { req, res, getResponse } = createMockReqRes({ idUser: 42 }, { uuid: "quiz-uuid-1" });

        await submitAttempt(req, res);

        const response = getResponse();
        assert.equal(response.status, 200);

        const scoreResult = response.body.data.score_result;
        assert.equal(scoreResult.total_questions, 4, "total_questions must be 4");
        assert.equal(scoreResult.correct, 3, "correct must be 3");
        assert.equal(scoreResult.wrong, 0, "wrong must be 0");
        assert.equal(scoreResult.skipped, 1, "skipped must be 1");
        assert.equal(scoreResult.score, 75, "normalized score must be 75");
        assert.equal(scoreResult.accuracy, 100, "accuracy must be 100");
        assert.equal(createdScoreData.score, 75);
        assert.equal(createdScoreData.skipped, 1);
    } finally {
        prisma.quiz.findFirst     = origQuizFindFirst;
        prisma.attempt.findFirst  = origAttemptFindFirst;
        prisma.answers.findMany   = origAnswersFindMany;
        prisma.questions.findMany = origQuestionsFindMany;
        prisma.attempt.update     = origAttemptUpdate;
        prisma.scores.create      = origScoresCreate;
        prisma.user_streak.findFirst = origStreakFindFirst;
        prisma.user_streak.update    = origStreakUpdate;
        prisma.user_streak.create    = origStreakCreate;
        prisma.activity_log.create   = origActivityCreate;
        (prisma as any).$transaction = origTransaction;
    }
});
