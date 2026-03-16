import { Request, Response, NextFunction } from "express";
import Joi from "joi";

const addDataSchema = Joi.object({
    option_text: Joi.string().trim().min(1).max(5000).required(),
    option_image: Joi.string().uri().optional(),
    is_correct: Joi.boolean().required(),
    questionId: Joi.number().required()
})

const editDataSchema = Joi.object({
    option_text: Joi.string().trim().min(1).max(5000).optional(),
    option_image: Joi.string().uri().optional(),
    is_correct: Joi.boolean().optional(),
})

export const verifyAddOption = (request : Request, response : Response, next : NextFunction) => {
    const {error} = addDataSchema.validate(request.body, {abortEarly: false});

    if(error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next();
}

export const verifyEditOption = (request : Request, response : Response, next : NextFunction) => {
    const {error} = editDataSchema.validate(request.body, {abortEarly: false});

    if(error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next();
}