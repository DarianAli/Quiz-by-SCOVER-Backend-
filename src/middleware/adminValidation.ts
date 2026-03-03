import { Request, Response, NextFunction } from "express";
import Joi from "joi";


export const addAdminSchema = Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).required().messages({"string.pattern.base": "Username can only contain letters, numbers, and underscores"}),
    email: Joi.string().email().required(),
    role: Joi.string().valid("ADMIN").required(),
    phone_number: Joi.string().min(10).max(13).required(),
})

export const updateAdminSchema = Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).optional().messages({"string.pattern.base": "Username can only contain letters, numbers, and underscores"}),
    email: Joi.string().email().optional(),
    phone_number: Joi.string().min(6).max(13).optional()
})

export const addData = ( request: Request, response: Response, next: NextFunction ) => {
    const { error } = addAdminSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}

export const updateData = ( request: Request, response: Response, next: NextFunction ) => {
    const { error } = updateAdminSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}