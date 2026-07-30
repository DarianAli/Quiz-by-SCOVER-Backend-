import { Response, Request, NextFunction } from "express"
import Joi from "joi"
import xss from "xss"



const addDataSchema = Joi.object ({
    question_text: Joi.string().trim().min(1).max(5000).required(),
    question_image: Joi.string().uri().optional(),
    difficulty: Joi.string().valid('EASY', 'MEDIUM', 'HARD').required(),
    poin: Joi.number().min(0).required(),
    quizId: Joi.string().required(),
    discussion: Joi.string().trim().max(5000).allow("").optional(),
})

const editDataSchema = Joi.object ({
    question_text: Joi.string().trim().min(1).max(5000).optional(),
    question_image: Joi.string().uri().optional(),
    difficulty: Joi.string().valid('EASY', 'MEDIUM', 'HARD').optional(),
    poin: Joi.number().min(0).optional(),
    discussion: Joi.string().trim().max(5000).allow("").optional(),
    order_index: Joi.number().min(0).optional(),
})

export const verifyAddQuestion = (request: Request, response: Response, next: NextFunction) =>  {
    const {error} = addDataSchema.validate(request.body, {abortEarly: false});

    if(error) {
        return response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
    }

    request.body.question_text = xss(request.body.question_text)
    if(request.body.question_image) {
        request.body.question_image = xss(request.body.question_image)
    }
    if(request.body.discussion) {
        request.body.discussion = xss(request.body.discussion)
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

    if (request.body.question_text) {
        request.body.question_text = xss(request.body.question_text)
    }
    if (request.body.question_image) {
        request.body.question_image = xss(request.body.question_image)
    }
    if (request.body.discussion) {
        request.body.discussion = xss(request.body.discussion)
    }
    return next();
}