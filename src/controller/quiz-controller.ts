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

            response.status(200).json({
            success: true,
            data : AllQuiz,
            message : "All quiz found successfully"
        })
        return
    } catch (error) {
            console.error(error)
            response.status(500).json({
              success: false,
              message: `failed to fetch all quiz.`
        })
        return
    }
};

export const getQuizById = async (request: Request, response: Response) => {
    try {
        const idQuiz = request.params.idQuiz;
        const id = Number(idQuiz)

        if (!idQuiz) {
                response.status(400).json({
                success: false,
                message: "id Quiz is required"
            })
            return
        }

        if (Number.isNaN(id)) {
            response.status(400).json({
                success: false,
                message: "id Quiz must be a number"
            })
            return
        }

        const findQuiz = await prisma.quiz.findFirst({
          where: { idQuiz: id }
        })

        if (!findQuiz) {
            response.status(404).json({
                success: false,
                message: "quiz not found"
            })
            return
        }

        const AllQuiz = await prisma.quiz.findUnique({
            where: { idQuiz: Number(idQuiz)},
            include: {
                subject: true,
                questions: true,
                scores: true
            }

        })

          response.status(200).json({
            success: true,
            data : AllQuiz,
            message : "quiz found successfully"
        })
        return

    } catch (error) {
            console.error(error)
            response.status(500).json({
              success: false,
              message: `failed to fetch quiz.`
        })
        return
    }
}

export const createQuiz = async (request: Request, response: Response) => {
    try {
      const user = request.user;
      const admin = request.admin

      let createdById: number | null = null
      let creatorRole: any = null

      if (admin) {
        createdById = admin.idAdmin
        creatorRole = admin.role
      } else if (user) {
        createdById = user.idUser
        creatorRole = user.role
      } else {
        response.status(401).json({
          success: false,
          message: "Unauthorized"
        })
        return
      }

      console.log("CREATED BY ID:", createdById)

      const { quiz_title, quiz_date, duration, status, difficulty } = request.body;
      const uuid = uuidv4();
  
      if (!duration || duration <= 0) {
          response.status(400).json({
          success: false,
          message: "duration must be greater than 0"
        })
        return
      }
    
        const newQuiz = await prisma.quiz.create({
          data: {
            uuid,
            quiz_title,
            quiz_date: new Date(quiz_date),
            duration: Number(duration),
            status,
            difficulty,
            created_by: createdById,
            creator_role: creatorRole 
          },
          include: {
            subject: true,
            questions: true,
            scores: true,
          }
        });
          console.log("USER DATA: ",user)
          response.status(201).json({
          success: true,
          data: newQuiz
        })
        return
    
      } catch (error) {
          console.error(error);
          response.status(500).json({
            success: false,
            message: `Failed to create quiz.`,
        })
        return
      }
}


export const updateQuiz = async (request: Request, response: Response) => {
    try {
        const { idQuiz } = request.params;
        const { quiz_title, quiz_date, duration, status, difficulty } = request.body;
        const id = Number(idQuiz)

        if (Number.isNaN(id)) {
          response.status(400).json({
              success: false,
              message: "id Quiz must be a number"
          })
          return
      }

      const findQuiz = await prisma.quiz.findFirst({
        where: { idQuiz: id }
      })

      if (!findQuiz) {
          response.status(404).json({
              success: false,
              message: "quiz not found"
          })
          return
      }
    
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
    
          response.status(200).json({
          status: true,
          data: updatedQuiz,
          message: "Quiz updated successfully"
        })
        return
    
      } catch (error) {
          console.error(error)
          response.status(500).json({
            status: false,
            message: `Failed to update quiz.`,
        })
        return
      }
}


export const deleteQuiz = async (request: Request, response: Response) => {
    try {
      const { idQuiz } = request.params;
      const id = Number(idQuiz)

      if (Number.isNaN(id)) {
        response.status(400).json({
            success: false,
            message: "id Quiz must be a number"
        })
        return
    }

    const findQuiz = await prisma.quiz.findFirst({
      where: { idQuiz: id }
    })

    if (!findQuiz) {
        response.status(404).json({
            success: false,
            message: "quiz not found"
        })
        return
    }
  
      const deletedQuiz = await prisma.quiz.delete({
        where: { idQuiz: Number(idQuiz) }
      });
  
        response.status(200).json({
        status: true,
        data: deletedQuiz,
        message: "Quiz deleted successfully"
      })
      return
  
    } catch (error) {
      console.error(error)
        response.status(500).json({
          status: false,
          message: `Failed to delete quiz.`,
      })
      return
    }
}