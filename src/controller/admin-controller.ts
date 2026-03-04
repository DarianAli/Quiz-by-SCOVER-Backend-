import { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma";
import { v4 as uuidv4 } from "uuid"
import bcrypt from "bcrypt"
import { date } from "joi";


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

export const getAdminProfile = async (request: Request, response: Response) => {
    try {
        const { idAdmin } = request.params;
        const id = Number(idAdmin)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findAdmin = await prisma.admin.findUnique({
            where: { idAdmin: id },
            select: {
                username: true,
                email: true,
                role: true,
                phone_number: true,
            }
        })

        if (!findAdmin) {
            response.status(404).json({
                status: false,
                message: `Admin not found.`
            })
            return
        }

        response.status(200).json({
            status: true,
            data: findAdmin,
            message: `Admin profile retrieved successfully.`
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

export const updateAdmin = async (request: Request, response: Response) => {
    try {
        const { idAdmin } = request.params;
        const id = Number(idAdmin)
        const { username, email, phone_number } = request.body;

        if(Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findAdmin = await prisma.admin.findUnique({
            where: {
                idAdmin: id
            }
        })

        if (!findAdmin) {
            response.status(404).json({
                status: false,
                message: `Admin not found.`
            })
            return
        }

        const findDUplicates = await prisma.admin.findFirst({
            where: {
                OR: [
                    {username},
                    {email},
                    {phone_number}
                ],
                NOT: {
                    idAdmin: id
                }
            }
        })

        if (findDUplicates) {
            if (email && findDUplicates.email === email) {
                return response.status(409).json({
                    status: false,
                    message: `Email already used.`
                })
            }

            if (username && findDUplicates.username === username) {
                return response.status(409).json({
                    status: false,
                    message: `Username already used.`
                })
            }

            if (phone_number && findDUplicates.phone_number === phone_number) {
                return response.status(409).json({
                    status: false,
                    message: `Phone number already used.`
                })
            }
        }


        const updateData = await prisma.admin.update({
            data: {
                username: username ?? findAdmin.username,
                email: email ?? findAdmin.email,
                phone_number: phone_number ?? findAdmin.phone_number,
            },
            select: {
                uuid: true,
                username: true,
                email: true,
                role: true
            },
            where: { 
                idAdmin: id 
            }
        })
        
        response.status(200).json({
            status: true,
            data: updateData,
            message: `Successfully updated the data.`
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

export const updatePassword = async (request: Request, response : Response) => {
    try {
        const { idAdmin } = request.params;
        const { password } = request.body;
        const id = Number(idAdmin)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findAdmin = await prisma.admin.findUnique({
            where: { idAdmin: id }
        })

        if (!findAdmin) {
            response.status(404).json({
                status: false,
                message: `Account not found.`
            })
            return
        }

        const isSame = await bcrypt.compare(password, findAdmin.password) 
        
        if (isSame) {
            response.status(400).json({
                status: false,
                message: `Password cannot be the same as old password.`
            })
            return
        }

        const hashed = await bcrypt.hash(password, 10)

        await prisma.admin.update({
            data: {
                password: hashed,
            },
            where: { idAdmin: id }
        })

        response.status(200).json({
            status: true,
            message: `Successfully updated the password :)`
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