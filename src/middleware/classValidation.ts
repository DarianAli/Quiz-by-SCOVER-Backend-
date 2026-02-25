import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createDataSchema = Joi.object({
    class_name: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).required().messages({"string.pattern.base": "Class name can only contain letters, numbers, and underscores"}),
    class_program: Joi.string().valid("UTBK", "SKD").optional()
})

export const updateDataSchema = Joi.object({
    class_name: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).optional().messages({"string.pattern.base": "Class name can only contain letters, numbers, and underscores"}),
    class_program: Joi.string().valid("UTBK", "SKD").optional()
})

export const addData = (request: Request, response: Response, next: NextFunction) => {
    const { error } = createDataSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}

export const updateData = (request: Request, response: Response, next: NextFunction) => {
    const { error } = updateDataSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}