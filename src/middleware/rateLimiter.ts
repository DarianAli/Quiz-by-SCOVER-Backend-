import rateLimit from "express-rate-limit"
import { Request, Response } from "express"

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: {
    status: false,
    message: "Terlalu banyak request, coba lagi nanti."
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const registerLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many request"
        })
    }
})

export const postLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many request"
        })
    }
})

export const updateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many request"
        })  
    }
})

export const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many request"
        })  
    }
})

export const deleteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many request"
        })
    }
})