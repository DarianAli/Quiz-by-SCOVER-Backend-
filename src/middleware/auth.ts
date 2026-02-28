import { Request, Response, NextFunction } from "express";
import { SECRET } from "../../global";
import Jwt from "jsonwebtoken";

interface JwPayLoad {
    idUser: number,
    userName: string,
    role: string
}

export const verifyToken = ( request: Request, response: Response, next: NextFunction ) => {
    const token = (request.headers.authorization as string)?.split(" ")[1]

    if (!token) {
        response.status(401).json({
            status: false,
            message: `Token not found.`
        })
        return
    }

    try {
        const secretKey = SECRET || "token"
        const decoded = Jwt.verify(token, secretKey)
        request.user = decoded as JwPayLoad
        next()
    } catch (error) {
        console.error(error)

        response.status(401).json({
            status: false,
            message: `Internal error for token.`
        })
        return
    }
}

export const verifyRole = ( allowedRole: string[] ) => {
    return ( request: Request, response: Response, next: NextFunction ) => {
        const user = request.user;

        if (!user) {
            response.status(401).json({
                status: false,
                message: `Authentication required.`
            })
            return
        }

        if (!user.role || !allowedRole.includes(user?.role ?? "STUDENT")) {
            response.status(403).json({
                message: `Role that allowed is between ${ allowedRole.join("/") }`
            })
            return
        }
        next()
    }
}