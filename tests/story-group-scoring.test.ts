import test from "node:test";
import assert from "node:assert/strict";

// Helper simulating the exact scorable question selection and scoring algorithm from submitAttempt
function evaluateQuizAttempt({
    topLevelQuestions,
    userAnswers,
    quizDifficulty = "MEDIUM",
}: {
    topLevelQuestions: any[];
    userAnswers: any[];
    quizDifficulty?: string;
}) {
    const DIFFICULTY_MULTIPLIER: Record<string, number> = {
        EASY: 1.0,
        MEDIUM: 1.5,
        HARD: 2.0,
    };
    function calculateXP(score: number, difficulty: string): number {
        const mult = DIFFICULTY_MULTIPLIER[difficulty] ?? 1.0;
        return Math.round((score / 100) * 100 * mult);
    }

    // Scorable questions: all normal questions + STORY_GROUP children, excluding STORY_GROUP container parents
    const scorableQuestions = topLevelQuestions.flatMap(q =>
        q.question_type === 'STORY_GROUP'
            ? (q.children || []).filter((c: any) => c.question_type !== 'STORY_GROUP')
            : [q]
    );
    const scorableQuestionIds = new Set(scorableQuestions.map(q => q.id));

    let correct = 0, wrong = 0, score = 0;
    for (const ans of userAnswers) {
        if (!scorableQuestionIds.has(ans.questionsId)) continue;

        const qType      = ans.questions.question_type;
        const allowMulti = ans.questions.allow_multiple_answers;
        const isStrict   = ans.questions.is_strict;
        const poin       = ans.questions.poin;

        if (qType === 'MULTIPLE_COMPLEX' || allowMulti) {
            if (ans.answer_text) {
                const selectedIds = ans.answer_text.split(",").map(Number).filter((n: number) => !isNaN(n));
                const allOpts     = ans.questions.options || [];
                const correctIds  = new Set(allOpts.filter((o: any) => o.is_correct).map((o: any) => o.id));
                const selectedSet = new Set(selectedIds);
                let isCorrectMC   = correctIds.size === selectedSet.size;
                if (isCorrectMC) {
                    for (const id of correctIds) {
                        if (!selectedSet.has(id)) { isCorrectMC = false; break; }
                    }
                }
                if (isCorrectMC) { correct++; score += poin; }
                else { wrong++; }
            } else {
                wrong++;
            }
        } else if (qType === 'FILL_BLANK') {
            if (ans.answer_text) {
                const student = ans.answer_text.trim();
                const correctOptions = (ans.questions.options || []).filter((o: any) => o.is_correct);
                const isCorrectFB = correctOptions.some((opt: any) => {
                    const correctText = opt.option_text.trim();
                    if (isStrict) return student === correctText;
                    return student.toLowerCase() === correctText.toLowerCase();
                });
                if (isCorrectFB) { correct++; score += poin; }
                else { wrong++; }
            } else {
                wrong++;
            }
        } else if (ans.options) {
            if (ans.options.is_correct) {
                correct++;
                score += poin;
            } else {
                wrong++;
            }
        } else if (ans.answer_text) {
            // Essay / Short Answer
        }
    }

    const total_questions       = scorableQuestions.length;
    const answeredScorableCount = userAnswers.filter(ans => scorableQuestionIds.has(ans.questionsId)).length;
    const skipped               = Math.max(0, total_questions - answeredScorableCount);
    const maxScore              = scorableQuestions.reduce((a, q) => a + q.poin, 0);
    const normalizedScore       = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const accuracy              = (correct + wrong) > 0
        ? Math.round((correct / (correct + wrong)) * 100)
        : 0;
    const xp_earned             = calculateXP(normalizedScore, quizDifficulty);
    const hasEssay              = scorableQuestions.some(q => q.question_type === 'ESSAY' || q.question_type === 'SHORT_ANSWER');
    const reviewStatus          = hasEssay ? 'WAITING_REVIEW' : 'AUTO_GRADED';

    return {
        total_questions,
        correct,
        wrong,
        skipped,
        score: normalizedScore,
        rawScore: score,
        maxScore,
        accuracy,
        xp_earned,
        reviewStatus,
    };
}

test("1. Normal questions only", () => {
    const topLevelQuestions = [
        { id: 1, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: null, children: [] },
        { id: 2, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: null, children: [] },
        { id: 3, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: null, children: [] },
    ];

    // Case 1a: All correct
    const answersAllCorrect = [
        { questionsId: 1, questions: { id: 1, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 2, questions: { id: 2, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 3, questions: { id: 3, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];
    const res1a = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersAllCorrect });
    assert.equal(res1a.total_questions, 3);
    assert.equal(res1a.maxScore, 30);
    assert.equal(res1a.rawScore, 30);
    assert.equal(res1a.score, 100);
    assert.equal(res1a.correct, 3);
    assert.equal(res1a.wrong, 0);
    assert.equal(res1a.skipped, 0);

    // Case 1b: 2 correct, 1 wrong
    const answers2Correct = [
        { questionsId: 1, questions: { id: 1, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 2, questions: { id: 2, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 3, questions: { id: 3, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: false } },
    ];
    const res1b = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answers2Correct });
    assert.equal(res1b.total_questions, 3);
    assert.equal(res1b.maxScore, 30);
    assert.equal(res1b.rawScore, 20);
    assert.equal(res1b.score, 67); // Math.round(20/30 * 100) = 67
    assert.equal(res1b.correct, 2);
    assert.equal(res1b.wrong, 1);
    assert.equal(res1b.skipped, 0);

    // Case 1c: 1 correct, 1 wrong, 1 skipped
    const answers1Skipped = [
        { questionsId: 1, questions: { id: 1, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 2, questions: { id: 2, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: false } },
    ];
    const res1c = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answers1Skipped });
    assert.equal(res1c.total_questions, 3);
    assert.equal(res1c.maxScore, 30);
    assert.equal(res1c.rawScore, 10);
    assert.equal(res1c.score, 33);
    assert.equal(res1c.correct, 1);
    assert.equal(res1c.wrong, 1);
    assert.equal(res1c.skipped, 1);
});

test("2. STORY_GROUP + 3 children", () => {
    const topLevelQuestions = [
        {
            id: 100,
            question_type: "STORY_GROUP",
            poin: 10, // Parent container points must be excluded!
            parentId: null,
            children: [
                { id: 101, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                { id: 102, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
                { id: 103, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 100 },
            ],
        },
    ];

    // 2a: All correct
    const answersAllCorrect = [
        { questionsId: 101, questions: { id: 101, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 102, questions: { id: 102, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 103, questions: { id: 103, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];
    const res2a = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersAllCorrect });
    assert.equal(res2a.total_questions, 3);
    assert.equal(res2a.maxScore, 30);
    assert.equal(res2a.rawScore, 30);
    assert.equal(res2a.score, 100);
    assert.equal(res2a.correct, 3);
    assert.equal(res2a.wrong, 0);
    assert.equal(res2a.skipped, 0);

    // 2b: 2 correct, 1 wrong
    const answers2Correct = [
        { questionsId: 101, questions: { id: 101, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 102, questions: { id: 102, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 103, questions: { id: 103, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: false } },
    ];
    const res2b = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answers2Correct });
    assert.equal(res2b.total_questions, 3);
    assert.equal(res2b.maxScore, 30);
    assert.equal(res2b.rawScore, 20);
    assert.equal(res2b.score, 67);
    assert.equal(res2b.correct, 2);
    assert.equal(res2b.wrong, 1);
    assert.equal(res2b.skipped, 0);
});

test("3. Multiple STORY_GROUPs", () => {
    const topLevelQuestions = [
        {
            id: 200,
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 201, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 200 },
                { id: 202, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 200 },
            ],
        },
        {
            id: 300,
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 301, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 300 },
                { id: 302, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 300 },
                { id: 303, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 300 },
            ],
        },
    ];

    // All correct
    const answersAll = [
        { questionsId: 201, questions: { id: 201, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 202, questions: { id: 202, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 301, questions: { id: 301, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 302, questions: { id: 302, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 303, questions: { id: 303, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];
    const res = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersAll });
    assert.equal(res.total_questions, 5);
    assert.equal(res.maxScore, 50);
    assert.equal(res.rawScore, 50);
    assert.equal(res.score, 100);
    assert.equal(res.skipped, 0);

    // 3 answered (2 in SG1, 1 in SG2), 2 skipped in SG2
    const answersPartial = [
        { questionsId: 201, questions: { id: 201, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 202, questions: { id: 202, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 301, questions: { id: 301, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];
    const resPartial = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersPartial });
    assert.equal(resPartial.total_questions, 5);
    assert.equal(resPartial.maxScore, 50);
    assert.equal(resPartial.rawScore, 30);
    assert.equal(resPartial.score, 60);
    assert.equal(resPartial.skipped, 2);
});

test("4. Mixed standalone + STORY_GROUP (Prompt Example Specification)", () => {
    // child A = 10
    // child B = 10
    // child C = 10
    // standalone D = 10
    // Expected: total_questions = 4, maxScore = 40
    const topLevelQuestions = [
        {
            id: 1, // Container parent
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 }, // child A
                { id: 11, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 }, // child B
                { id: 12, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 }, // child C
            ],
        },
        {
            id: 20, // standalone D
            question_type: "MULTIPLE_CHOICE",
            poin: 10,
            parentId: null,
            children: [],
        },
    ];

    // 4a: All correct -> score = 40, normalized = 100
    const answersAll = [
        { questionsId: 10, questions: { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 11, questions: { id: 11, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 12, questions: { id: 12, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 20, questions: { id: 20, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];
    const resAll = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersAll });
    assert.equal(resAll.total_questions, 4, "total_questions must be 4");
    assert.equal(resAll.maxScore, 40, "maxScore must be 40");
    assert.equal(resAll.rawScore, 40, "score must be 40");
    assert.equal(resAll.score, 100, "normalized must be 100");
    assert.equal(resAll.skipped, 0, "skipped must be 0");

    // 4b: Three correct (one wrong) -> score = 30, normalized = 75
    const answersThreeCorrect = [
        { questionsId: 10, questions: { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 11, questions: { id: 11, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 12, questions: { id: 12, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: false } },
        { questionsId: 20, questions: { id: 20, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];
    const resThree = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersThreeCorrect });
    assert.equal(resThree.total_questions, 4, "total_questions must be 4");
    assert.equal(resThree.maxScore, 40, "maxScore must be 40");
    assert.equal(resThree.rawScore, 30, "score must be 30");
    assert.equal(resThree.score, 75, "normalized must be 75");
    assert.equal(resThree.correct, 3);
    assert.equal(resThree.wrong, 1);
    assert.equal(resThree.skipped, 0);
});

test("5. Unanswered child questions", () => {
    // child A = 10, child B = 10, child C = 10, standalone D = 10
    // Student answers child A, child B, and standalone D. Child C is UNANSWERED.
    const topLevelQuestions = [
        {
            id: 1,
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 }, // child A
                { id: 11, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 }, // child B
                { id: 12, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 }, // child C (unanswered)
            ],
        },
        {
            id: 20,
            question_type: "MULTIPLE_CHOICE",
            poin: 10,
            parentId: null,
            children: [],
        },
    ];

    const answersUnansweredChild = [
        { questionsId: 10, questions: { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 11, questions: { id: 11, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
        { questionsId: 20, questions: { id: 20, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];

    const res = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answersUnansweredChild });
    assert.equal(res.total_questions, 4, "total_questions must be 4");
    assert.equal(res.maxScore, 40, "maxScore must be 40");
    assert.equal(res.rawScore, 30, "score must be 30");
    assert.equal(res.score, 75, "normalized must be 75");
    assert.equal(res.correct, 3, "correct must be 3");
    assert.equal(res.wrong, 0, "wrong must be 0");
    assert.equal(res.skipped, 1, "skipped must be 1 (child C was unanswered)");
    assert.equal(res.accuracy, 100, "accuracy must be 100% on answered questions");
});

test("6. Complex question types as STORY_GROUP children (MULTIPLE_COMPLEX & FILL_BLANK)", () => {
    const topLevelQuestions = [
        {
            id: 1,
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 10, question_type: "MULTIPLE_COMPLEX", poin: 15, parentId: 1, allow_multiple_answers: true },
                { id: 11, question_type: "FILL_BLANK", poin: 10, parentId: 1, is_strict: false },
            ],
        },
    ];

    const answers = [
        {
            questionsId: 10,
            answer_text: "1,2",
            questions: {
                id: 10,
                question_type: "MULTIPLE_COMPLEX",
                allow_multiple_answers: true,
                poin: 15,
                options: [
                    { id: 1, is_correct: true },
                    { id: 2, is_correct: true },
                    { id: 3, is_correct: false },
                ],
            },
        },
        {
            questionsId: 11,
            answer_text: "Photosynthesis",
            questions: {
                id: 11,
                question_type: "FILL_BLANK",
                is_strict: false,
                poin: 10,
                options: [{ id: 5, option_text: "photosynthesis", is_correct: true }],
            },
        },
    ];

    const res = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answers });
    assert.equal(res.total_questions, 2);
    assert.equal(res.maxScore, 25);
    assert.equal(res.rawScore, 25);
    assert.equal(res.score, 100);
    assert.equal(res.correct, 2);
    assert.equal(res.wrong, 0);
    assert.equal(res.skipped, 0);
});

test("7. Rogue answer for container question or unscorable question is safely ignored", () => {
    const topLevelQuestions = [
        {
            id: 1,
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10, parentId: 1 },
            ],
        },
    ];

    const answers = [
        // Rogue answer for container question id 1
        { questionsId: 1, questions: { id: 1, question_type: "STORY_GROUP", poin: 10 }, options: { is_correct: true } },
        // Valid answer for child id 10
        { questionsId: 10, questions: { id: 10, question_type: "MULTIPLE_CHOICE", poin: 10 }, options: { is_correct: true } },
    ];

    const res = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answers });
    assert.equal(res.total_questions, 1);
    assert.equal(res.maxScore, 10);
    assert.equal(res.rawScore, 10, "Rogue answer must not add points");
    assert.equal(res.score, 100);
    assert.equal(res.correct, 1, "Rogue answer must not increment correct");
    assert.equal(res.skipped, 0);
});

test("8. ESSAY child in STORY_GROUP triggers WAITING_REVIEW status", () => {
    const topLevelQuestions = [
        {
            id: 1,
            question_type: "STORY_GROUP",
            poin: 10,
            parentId: null,
            children: [
                { id: 10, question_type: "ESSAY", poin: 20, parentId: 1 },
            ],
        },
    ];

    const answers = [
        { questionsId: 10, questions: { id: 10, question_type: "ESSAY", poin: 20 }, answer_text: "Essay answer here" },
    ];

    const res = evaluateQuizAttempt({ topLevelQuestions, userAnswers: answers });
    assert.equal(res.total_questions, 1);
    assert.equal(res.maxScore, 20);
    assert.equal(res.reviewStatus, "WAITING_REVIEW");
    assert.equal(res.skipped, 0);
});
