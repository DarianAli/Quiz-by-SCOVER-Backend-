import rateLimit from "express-rate-limit"
import { Request, Response } from "express"
import { status } from "@prisma/client"

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
            message: "Too many requests"
        })
    }
})

export const postLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many requests"
        })
    }
})

export const updateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many requests"
        })  
    }
})

export const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many requests"
        })  
    }
})

export const deleteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many requests"
        })
    }
})

export const attemptLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many requests"
        })
    }
})

// Jawaban soal — lebih longgar karena siswa bisa menjawab banyak soal berturut-turut
export const answerLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120, // max 120 jawaban/menit, lebih dari cukup untuk semua soal
    handler: (request: Request, response: Response) =>{
        response.status(429).json({
            status: false,
            message: "Too many answer submissions, slow down."
        })
    }
})