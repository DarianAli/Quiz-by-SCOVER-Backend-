import prisma from "./src/config/prisma.js";

async function run() {
    const quiz = await prisma.quiz.findFirst();
    console.log("Quiz ID:", quiz?.uuid);
    const questions = await prisma.questions.findMany({ where: { quizId: quiz?.id }});
    console.log("Questions in DB for quiz:", questions.length);
    for (const q of questions) {
        console.log(`- ID: ${q.id} | Order: ${q.order_index} | Text: ${q.question_text.slice(0, 30)}`);
    }
}
run();
