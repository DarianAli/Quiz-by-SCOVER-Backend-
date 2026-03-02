import { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma";
import { v4 as uuidv4 } from "uuid"
import bcrypt from "bcrypt"


const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createAdmin = async (request: Request, response: Response) => {
    try {
        const { username, password, email, role, phone_number } = request.body;
        const uuid = uuidv4()
        const hashed = await bcrypt.hash(password, 10)

        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: [
                    {email},
                    {username},
                    {phone_number}
                ]
            }
        })

        if (existingAdmin) {
            response.status(409).json({
                status: false,
                message: `Admin with this email, username or phone number already exists.`
            })
            return
        }

        const createData = await prisma.admin.create({
            data: {
                uuid,
                username,
                password: hashed,
                email,
                role,
                phone_number,
            },
            select: {
                uuid: true,
                username: true,
                email: true,
                role: true,
                phone_number: true
            }
        })

        response.status(201).json({
            status: true,
            data: createData,
            message: `Successfully create.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(500).json({
            status: false,
            message: `Internal server error.`
        })
    }
}