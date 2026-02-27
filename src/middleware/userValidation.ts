import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { status } from "../../generated/prisma";



export const addDataSchema = Joi.object({
    userName: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).required().messages({"string.pattern.base": "Username can only contain letters, numbers, and underscores"}),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    full_name: Joi.string().required(),
    role: Joi.string().valid("TENTOR", "STUDENT").required(),
    phone_number: Joi.string().min(10).max(13).required(),
    classId: Joi.number().when('role', {
    is: 'STUDENT',
    then: Joi.required(),
        otherwise: Joi.optional()
    }),
    parent_full_name: Joi.string().when('role', {
        is: 'STUDENT',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    parent_phone_number: Joi.string().min(10).max(13).when('role', {
        is: 'STUDENT',
        then: Joi.required(),
        otherwise: Joi.optional()
    })
})

export const updateDataSchema = Joi.object({
    userName: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).optional().messages({"string.pattern.base": "Username can only contain letters, numbers, and underscores"}),
    email: Joi.string().email().optional(),
    full_name: Joi.string().optional(),
    role: Joi.string().valid("TENTOR", "STUDENT").optional(),
    phone_number: Joi.string().min(10).max(13).optional(),
    classId: Joi.number().optional(),
    parent_full_name: Joi.string().optional(),
    parent_phone_number: Joi.string().min(10).max(13).optional()
})

export const updatePasswordSchema = Joi.object({
    password: Joi.string().min(6).max(128).required()
})

export const updatePasswordUserSchema = Joi.object({
    oldPassword: Joi.string().min(6).max(128).required(),
    newPassword: Joi.string().min(6).max(128).required(),
    confirmPassword: Joi.string().min(6).max(128).required(),
})

export const authSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    user: Joi.optional()
})

export const verifyLogin = ( request: Request, response: Response, next: NextFunction ) => {
    const { error } = authSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}

export const updatePasswordDataUser = ( request: Request, response: Response, next: NextFunction ) => {
    const { error } = updatePasswordUserSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}

export const updatePasswordData = ( request: Request, response: Response, next: NextFunction ) => {
    const { error } = updatePasswordSchema.validate(request.body, { abortEarly: false })

    if (error) {
        response.status(400).json({
            status: false,
            message: error.details.map(it => it.message).join()
        })
        return
    }
    return next()
}

export const addData = (request: Request, response: Response, next: NextFunction) => {
    const { error } = addDataSchema.validate(request.body, { abortEarly: false })

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

