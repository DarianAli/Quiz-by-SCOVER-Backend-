import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid"
import { Jwt } from "jsonwebtoken";
import { PrismaClient } from "../../generated/prisma/client"; 
import bcrypt from "bcrypt"


const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createUser = async (request: Request, response: Response) => {
    try {
        const { userName, email, password, full_name, role, phone_number, parent_full_name, parent_phone_number } = request.body;
        const uuid = uuidv4()
        const { classId } = request.body;
        const hashed = await bcrypt.hash(password, 11)

        const findClass = await prisma.classes.findFirst({
            where: { idClass: Number(classId) }
        })

        if (!findClass) {
            response.status(404).json({
                status: false,
                message: "Class that you mention did not found."
            })
            return
        }

        const newUser = await prisma.user.create({
            data: {
                uuid,
                userName,
                email,
                password: hashed,
                full_name,
                role,
                phone_number,
                parent_full_name,
                parent_phone_number,
                classId: Number(classId)
            }
        })
        response.status(201).json({
            status: true,
            data: newUser,
            message: `Successfuly create a user.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(400).json({
            status: false,
            message: `Theres a problem when trying to create a user. Internal server error.`
        })
        return
    }
}




