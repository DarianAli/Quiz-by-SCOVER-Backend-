import { Request, Response, NextFunction } from "express";
import Joi from "joi";


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


