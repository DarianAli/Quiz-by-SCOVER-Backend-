import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid"
import { PrismaClient, status } from "../../generated/prisma/client"; 
import bcrypt from "bcrypt"
import rateLimit from "express-rate-limit";
import { boolean } from "joi";


const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createUser = async (request: Request, response: Response) => {
    try {
        const { userName, email, password, full_name, role, phone_number, parent_full_name, parent_phone_number, classId } = request.body;
        const uuid = uuidv4()
        const hashed = await bcrypt.hash(password, 10)


        const findClass = await prisma.classes.findUnique({
            where: { idClass: Number(classId) }
        })

        if (!findClass) {
            response.status(404).json({
                status: false,
                message: "Class not found."
            })
            return
        }
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    {email},
                    {userName},
                    {phone_number}
                ]
            }
        })

        if (existingUser) {
            response.status(409).json({
                status: false,
                message: `User with this email, username or phone number already exists.`
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
            },
            select: {
                uuid: true,
                userName: true,
                email: true,
                full_name: true,
                role: true,
                phone_number: true,
                parent_full_name: true,
                parent_phone_number: true,
                classId: true
            },
        })
        response.status(201).json({
            status: true,
            data: newUser,
            message: `Successfully create a user.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(500).json({
            status: false,
            message: `Theres a problem when trying to create a user. Internal server error.`
        })
        return
    }
}

export const getAllUser = async (request: Request, response: Response) => {
    try {
        const search = request.query.search?.toString() ?? "";

        const allData = await prisma.user.findMany({
            where: { 
                userName: { contains: search?.toString() }
            },
            select: {
                uuid: true,
                userName: true,
                email: true,
                full_name: true,
                role: true,
                phone_number: true,
                parent_full_name: true,
                parent_phone_number: true,
                class: true
            }
        })

        response.status(200).json({
            status: true,
            data: allData,
            message: `Show all data.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(500).json({
            status: false,
            message: `Internal server error.`
        })
        return
    }
}

export const getById = async (request: Request, response: Response) => {
    try {
        const { idUser } = request.params;
        const id = Number(idUser)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findUser = await prisma.user.findUnique({
            where: { idUser: id },
            include: {
                class: true
            }
        })

        if (!findUser) {
            response.status(404).json({
                status: false,
                message: `User not found.`
            })
            return
        }

        response.status(200).json({
            status: true,
            data: findUser,
            message: `Show user by ID.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(500).json({
            status: false,
            message: `Internal server error.`
        })
        return
    }
}

export const updateUser = async (request: Request, response: Response) => {
    try {
        const { idUser } = request.params;
        const { userName, email, full_name, role, phone_number, parent_full_name, parent_phone_number, classId } = request.body;
        const id = Number(idUser)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }
        if (classId !== undefined) {
            const findClass = await prisma.classes.findUnique({
                where: {
                    idClass: Number(classId)
                }
            })

            if (!findClass) {
                response.status(404).json({
                    status: false,
                    message: `Class not found.`
                })
            return
            }
        }

        const findUser = await prisma.user.findUnique({
            where: {
                idUser: id
            }
        })

        if (!findUser) {
            response.status(404).json({
                status: false,
                message: `User not found.`
            })
            return
        }

        const findDuplicates = await prisma.user.findFirst({
            where: {
                OR: [
                    {userName},
                    {email},
                    {phone_number}
                ],
                NOT: {
                    idUser: id
                }
            }
        })

        if (findDuplicates) {
            if (email && findDuplicates.email === email) {
                return response.status(409).json({ message: `Email already used.` })
            }
            if (userName && findDuplicates.userName === userName) {
                return response.status(409).json({ message: "Username already used" });
            }
            if (phone_number && findDuplicates.phone_number === phone_number) {
                return response.status(409).json({ message: "Phone number already used" });
            }
        }

        const updateData = await prisma.user.update({
            data: {
                userName: userName || findUser.userName,
                email: email || findUser.email,
                full_name: full_name || findUser.full_name,
                role: role || findUser.role,
                phone_number: phone_number || findUser.phone_number,
                parent_full_name: parent_full_name || findUser.parent_full_name,
                parent_phone_number: parent_phone_number || findUser.parent_phone_number,
                classId: classId || findUser.classId
            },
            select: {
                uuid: true,
                userName: true,
                email: true,
                full_name: true,
                role: true,
                phone_number: true,
                parent_full_name: true,
                parent_phone_number: true,
                class: true
            },
            where: { idUser: Number(idUser) }
        })

        response.status(200).json({
            status: true,
            data: updateData,
            message: `Successfully update data.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(500).json({
            status: false,
            message: `Internal server error.`
        })
        return
    }
}




