import { Response, Request } from "express"
import { PrismaClient } from "@prisma/client"
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient ({ errorFormat: "pretty"})

export const getAllQuiz = async (request: Request, response: Response) => {
    try {
        const { search } = request.query;
        
        const AllQuiz = await prisma.quiz.findMany({
            where: {quiz_title: {contains: search?.toString() || ""}}, 
            include: {
                subject: true,
                questions: true,
                scores: true
            }  
        })

        return response.status(200).json({
            success: true,
            data : AllQuiz,
            message : "All quiz found successfully"
        })
    } catch (error) {
        return response.status(400).json({
            success: false,
            message: `failed to fetch all quiz. ${error}`
        })
    }
};

export const getQuizById = async (request: Request, response: Response) => {
    try {
        const idQuiz = request.params.idQuiz;

        if (!idQuiz) {
            return response.status(400).json({
                success: false,
                message: "id Quiz is required"
            })
        }

        const AllQuiz = await prisma.quiz.findUnique({
            where: { idQuiz: Number(idQuiz)},
            include: {
                subject: true,
                questions: true,
                scores: true
            }

        })

        if (!AllQuiz) {
            return response.status(404).json({
                success: false,
                message: "quiz not found"
            })
        }

        return response.status(200).json({
            success: true,
            data : AllQuiz,
            message : "quiz found successfully"
        })

    } catch (error) {
        return response.status(400).json({
            success: false,
            message: `failed to fetch quiz. ${error}`
        })
    }
}

export const createQuiz = async (request: Request, response: Response) => {
    try {
      const user = ( request as any ).user
      const { quiz_title, quiz_date, duration, status, difficulty } = request.body;
      const uuid = uuidv4();
  
      if (!duration || duration <= 0) {
        return response.status(400).json({
          success: false,
          message: "duration must be greater than 0"
        })
      }
    
        const newQuiz = await prisma.quiz.create({
          data: {
            uuid,
            quiz_title,
            quiz_date: new Date(quiz_date),
            duration: Number(duration),
            status,
            difficulty,
            created_by: user.idUser,
            
          }
        });
    
        return response.status(200).json({
          status: true,
          data: newQuiz
        })
    
      } catch (error) {
        console.error(error);
  
        return response.status(500).json({
          status: false,
          message: `Failed to create quiz${error}`,
        })
      }
}

export const updateQuiz = async (request: Request, response: Response) => {
    try {
        const { idQuiz } = request.params;
        const { quiz_title, quiz_date, duration, status, difficulty } = request.body;
    
        const updatedQuiz = await prisma.quiz.update({
          where: { idQuiz: Number(idQuiz) },
          data: {
            quiz_title,
            quiz_date: new Date(quiz_date),
            duration: Number(duration),
            status,
            difficulty,
          }
        });
    
        return response.status(200).json({
          status: true,
          data: updatedQuiz,
          message: "Quiz updated successfully"
        })
    
      } catch (error) {
        return response.status(500).json({
          status: false,
          message: `Failed to update quiz. ${error}`,
        })
      }
}


export const deleteQuiz = async (request: Request, response: Response) => {
    try {
      const { idQuiz } = request.params;
  
      const deletedQuiz = await prisma.quiz.delete({
        where: { idQuiz: Number(idQuiz) }
      });
  
      return response.status(200).json({
        status: true,
        data: deletedQuiz,
        message: "Quiz deleted successfully"
      })
  
    } catch (error) {
      return response.status(500).json({
        status: false,
        message: `Failed to delete quiz. ${error}`,
      })
    }
}