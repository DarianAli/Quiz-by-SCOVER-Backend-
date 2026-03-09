import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createDataSchema = Joi.object({
    subject_name: Joi.string().pattern(/^[A-Za-z0-9]+(?:[\s\-][A-Za-z0-9]+)*$/).min(3).max(100).required().messages({
        "string.empty": "Subject name is required",
        "string.min": "Subject name must be at least 3 characters",
        "string.max": "Subject name must not exceed 100 characters",
        "string.pattern.base": "Subject name can only contain letters, numbers, single spaces, and hyphens (-). No special characters allowed.",
        "any.required": "Subject name is required"
    }),
    classId: Joi.array().optional()
})

export const updateDataSchema = Joi.object({
    subject_name: Joi.string().pattern(/^[A-Za-z0-9]+(?:[\s\-][A-Za-z0-9]+)*$/).min(3).max(100).required().messages({
        "string.empty": "Subject name is required",
        "string.min": "Subject name must be at least 3 characters",
        "string.max": "Subject name must not exceed 100 characters",
        "string.pattern.base": "Subject name can only contain letters, numbers, single spaces, and hyphens (-). No special characters allowed.",
        "any.required": "Subject name is required"
    })
})

export const assignDataSchema = Joi.object({
    classId : Joi.array().required()
})

export const assignDataValidation = (request: Request, response: Response, next: NextFunction) => {
    const { error } = assignDataSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}

export const createDataValidation = (request: Request, response: Response, next: NextFunction) => {
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

export const updateDataValidation = (request: Request, response: Response, next: NextFunction) => {
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