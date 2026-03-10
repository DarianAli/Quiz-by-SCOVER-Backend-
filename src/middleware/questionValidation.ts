import { Response, Request, NextFunction } from "express"
import Joi from "joi"

const addDataSchema = Joi.object ({
    question_text: Joi.string().required(),
    question_image: Joi.string().optional(),
    difficulty: Joi.string().valid('EASY', 'MEDIUM', 'HARD').required(),
    poin: Joi.number().min(0).required(),
    quizId: Joi.number().required()
})

const editDataSchema = Joi.object ({
    question_text: Joi.string().optional(),
    question_image: Joi.string().optional(),
    difficulty: Joi.string().valid('EASY', 'MEDIUM', 'HARD').optional(),
    poin: Joi.number().min(0).optional(),
})

export const verifyAddQuestion = (request: Request, response: Response, next: NextFunction) =>  {
    const {error} = addDataSchema.validate(request.body, {abortEarly: false});

    if(error) {
        return response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
    }
    return next();
}

export const verifyEditQuestion = (request: Request, response: Response, next: NextFunction) =>  {
    const {error} = editDataSchema.validate(request.body, {abortEarly: false});

    if(error) {
        return response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
    }
    return next();
}