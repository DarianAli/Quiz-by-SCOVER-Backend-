import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { getQuizReview, gradeMultipleComplex } from "../src/controller/answer-controller.js";

// Helper to mock Express req and res
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

// ─── Unit Tests: gradeMultipleComplex ─────────────────────────────────────────

test("gradeMultipleComplex: Exact match [1,3,5] vs [1,3,5] => true", () => {
    const options = [
        { id: 1, is_correct: true },
        { id: 2, is_correct: false },
        { id: 3, is_correct: true },
        { id: 4, is_correct: false },
        { id: 5, is_correct: true },
        { id: 7, is_correct: false },
    ];
    const result = gradeMultipleComplex([1, 3, 5], options);
    assert.strictEqual(result, true);
});

test("gradeMultipleComplex: Different order [1,3,5] vs [5,1,3] => true", () => {
    const options = [
        { id: 1, is_correct: true },
        { id: 2, is_correct: false },
        { id: 3, is_correct: true },
        { id: 4, is_correct: false },
        { id: 5, is_correct: true },
    ];
    const result = gradeMultipleComplex([5, 1, 3], options);
    assert.strictEqual(result, true);
});

test("gradeMultipleComplex: Missing option [1,3,5] vs [1,3] => false", () => {
    const options = [
        { id: 1, is_correct: true },
        { id: 2, is_correct: false },
        { id: 3, is_correct: true },
        { id: 4, is_correct: false },
        { id: 5, is_correct: true },
    ];
    const result = gradeMultipleComplex([1, 3], options);
    assert.strictEqual(result, false);
});

test("gradeMultipleComplex: Extra option [1,3,5] vs [1,3,5,7] => false", () => {
    const options = [
        { id: 1, is_correct: true },
        { id: 2, is_correct: false },
        { id: 3, is_correct: true },
        { id: 4, is_correct: false },
        { id: 5, is_correct: true },
        { id: 7, is_correct: false },
    ];
    const result = gradeMultipleComplex([1, 3, 5, 7], options);
    assert.strictEqual(result, false);
});

test("gradeMultipleComplex: Completely incorrect selection [1,3,5] vs [2,4,6] => false", () => {
    const options = [
        { id: 1, is_correct: true },
        { id: 2, is_correct: false },
        { id: 3, is_correct: true },
        { id: 4, is_correct: false },
        { id: 5, is_correct: true },
        { id: 6, is_correct: false },
    ];
    const result = gradeMultipleComplex([2, 4, 6], options);
    assert.strictEqual(result, false);
});

test("gradeMultipleComplex: Empty selection => false", () => {
    const options = [
        { id: 1, is_correct: true },
        { id: 2, is_correct: false },
        { id: 3, is_correct: true },
        { id: 5, is_correct: true },
    ];
    const result = gradeMultipleComplex([], options);
    assert.strictEqual(result, false);
});

// ─── Controller Integration Tests: getQuizReview ─────────────────────────────

test("getQuizReview: MULTIPLE_COMPLEX correctness evaluation across all cases", async () => {
    const origQuizFindFirst = prisma.quiz.findFirst;
    const origAttemptFindFirst = prisma.attempt.findFirst;
    const origQuestionsFindMany = prisma.questions.findMany;
    const origAnswersFindMany = prisma.answers.findMany;

    try {
        const mockQuiz = {
            id: 1,
            uuid: "quiz-uuid-mc",
            quiz_title: "Multiple Complex Quiz",
        };

        const mockAttempt = {
            id: 10,
            userId: 99,
            quizId: 1,
            isFinished: true,
            attempt_number: 1,
        };

        const mockOptions = [
            { id: 1, uuid: "opt-1", option_text: "A", option_image: "", is_correct: true },
            { id: 2, uuid: "opt-2", option_text: "B", option_image: "", is_correct: false },
            { id: 3, uuid: "opt-3", option_text: "C", option_image: "", is_correct: true },
            { id: 4, uuid: "opt-4", option_text: "D", option_image: "", is_correct: false },
            { id: 5, uuid: "opt-5", option_text: "E", option_image: "", is_correct: true },
            { id: 7, uuid: "opt-7", option_text: "F", option_image: "", is_correct: false },
        ];

        const mockQuestions = [
            {
                id: 101,
                uuid: "q-101",
                question_text: "Q1: Exact match",
                question_image: null,
                discussion: "Explanation 1",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
            {
                id: 102,
                uuid: "q-102",
                question_text: "Q2: Different order",
                question_image: null,
                discussion: "Explanation 2",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
            {
                id: 103,
                uuid: "q-103",
                question_text: "Q3: Missing option",
                question_image: null,
                discussion: "Explanation 3",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
            {
                id: 104,
                uuid: "q-104",
                question_text: "Q4: Extra option",
                question_image: null,
                discussion: "Explanation 4",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
            {
                id: 105,
                uuid: "q-105",
                question_text: "Q5: Completely incorrect",
                question_image: null,
                discussion: "Explanation 5",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
            {
                id: 106,
                uuid: "q-106",
                question_text: "Q6: Empty selection",
                question_image: null,
                discussion: "Explanation 6",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
            {
                id: 107,
                uuid: "q-107",
                question_text: "Q7: Unanswered (skipped)",
                question_image: null,
                discussion: "Explanation 7",
                poin: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                is_strict: false,
                options: mockOptions,
            },
        ];

        const mockAnswers = [
            // Q1: Exact match [1, 3, 5]
            {
                id: 1,
                attemptId: 10,
                quizId: 1,
                userId: 99,
                questionsId: 101,
                optionsId: null,
                answer_text: "1,3,5",
            },
            // Q2: Different order [5, 1, 3]
            {
                id: 2,
                attemptId: 10,
                quizId: 1,
                userId: 99,
                questionsId: 102,
                optionsId: null,
                answer_text: "5,1,3",
            },
            // Q3: Missing option [1, 3]
            {
                id: 3,
                attemptId: 10,
                quizId: 1,
                userId: 99,
                questionsId: 103,
                optionsId: null,
                answer_text: "1,3",
            },
            // Q4: Extra option [1, 3, 5, 7]
            {
                id: 4,
                attemptId: 10,
                quizId: 1,
                userId: 99,
                questionsId: 104,
                optionsId: null,
                answer_text: "1,3,5,7",
            },
            // Q5: Completely incorrect [2, 4, 6]
            {
                id: 5,
                attemptId: 10,
                quizId: 1,
                userId: 99,
                questionsId: 105,
                optionsId: null,
                answer_text: "2,4,6",
            },
            // Q6: Empty selection (empty string)
            {
                id: 6,
                attemptId: 10,
                quizId: 1,
                userId: 99,
                questionsId: 106,
                optionsId: null,
                answer_text: "",
            },
            // Q7 is not in mockAnswers (unanswered)
        ];

        (prisma.quiz.findFirst as any) = async () => mockQuiz;
        (prisma.attempt.findFirst as any) = async () => mockAttempt;
        (prisma.questions.findMany as any) = async () => mockQuestions;
        (prisma.answers.findMany as any) = async () => mockAnswers;

        const { req, res, getResponse } = createMockReqRes(
            { idUser: 99 },
            { uuid: "quiz-uuid-mc" }
        );

        await getQuizReview(req, res);

        const { status, body } = getResponse();
        assert.strictEqual(status, 200);
        assert.strictEqual(body.success, true);

        const review = body.data.review;
        assert.strictEqual(review.length, 7);

        // Q1: Exact match => isCorrect = true
        assert.strictEqual(review[0].question_uuid, "q-101");
        assert.strictEqual(review[0].isCorrect, true);
        assert.strictEqual(review[0].isSkipped, false);

        // Q2: Different order => isCorrect = true
        assert.strictEqual(review[1].question_uuid, "q-102");
        assert.strictEqual(review[1].isCorrect, true);
        assert.strictEqual(review[1].isSkipped, false);

        // Q3: Missing option => isCorrect = false
        assert.strictEqual(review[2].question_uuid, "q-103");
        assert.strictEqual(review[2].isCorrect, false);
        assert.strictEqual(review[2].isSkipped, false);

        // Q4: Extra option => isCorrect = false
        assert.strictEqual(review[3].question_uuid, "q-104");
        assert.strictEqual(review[3].isCorrect, false);
        assert.strictEqual(review[3].isSkipped, false);

        // Q5: Completely incorrect => isCorrect = false
        assert.strictEqual(review[4].question_uuid, "q-105");
        assert.strictEqual(review[4].isCorrect, false);
        assert.strictEqual(review[4].isSkipped, false);

        // Q6: Empty selection => isCorrect = false
        assert.strictEqual(review[5].question_uuid, "q-106");
        assert.strictEqual(review[5].isCorrect, false);

        // Q7: Unanswered => isCorrect = false, isSkipped = true
        assert.strictEqual(review[6].question_uuid, "q-107");
        assert.strictEqual(review[6].isCorrect, false);
        assert.strictEqual(review[6].isSkipped, true);

        // Summary counts
        const summary = body.data.summary;
        assert.strictEqual(summary.totalQuestions, 7);
        assert.strictEqual(summary.correct, 2); // Q1 and Q2
        assert.strictEqual(summary.unanswered, 2); // Q6 (answer_text = "") and Q7 (null)
        assert.strictEqual(summary.wrong, 3); // Q3, Q4, Q5
    } finally {
        prisma.quiz.findFirst = origQuizFindFirst;
        prisma.attempt.findFirst = origAttemptFindFirst;
        prisma.questions.findMany = origQuestionsFindMany;
        prisma.answers.findMany = origAnswersFindMany;
    }
});
