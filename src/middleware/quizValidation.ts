import type { Request, Response, NextFunction } from "express";
import Joi from 'joi'

const addDataSchema = Joi.object ({
    quiz_title: Joi.string().required(),
    quiz_date: Joi.date().required(),
    duration: Joi.number().min(0).required(),
    status: Joi.string().valid('COMPLETED', 'INCOMPLETED').required(),
    difficulty: Joi.string().valid('EASY', 'MEDIUM', 'HARD').required(),
})

const editDataSchema = Joi.object ({
    quiz_title: Joi.string().optional(),
    quiz_date: Joi.date().optional(),
    duration: Joi.number().min(0).optional(),
    status: Joi.string().valid('COMPLETED', 'INCOMPLETED').optional(),
    difficulty: Joi.string().valid('EASY', 'MEDIUM', 'HARD').optional(),
})

export const verifyAddQuiz = (request: Request, response: Response, next: NextFunction) =>  {
    const {error} = addDataSchema.validate(request.body, {abortEarly: false});

    if(error) {
        return response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
    }
    return next();
}

export const verifyEditQuiz = (request: Request, response: Response, next: NextFunction) =>  {
    const {error} = editDataSchema.validate(request.body, {abortEarly: false});

    if (error) {
        return response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
    }
    return next();
}