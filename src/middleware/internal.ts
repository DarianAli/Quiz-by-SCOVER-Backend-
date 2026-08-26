import { Request, Response, NextFunction } from "express";

export const internalAuth = ( request: Request, response: Response, next: NextFunction ) => {
    const secret = request.headers["x-internal-secret"]

    if (!secret || secret !== process.env.INTERNAL_SECRET) {
        response.status(403).json({
            status: false,
            message: `Forbidden: Internal access only`
        })
        return
    }
    next()
}