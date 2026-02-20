import { Request, Response } from "express";
import { PrismaClient, status } from "../../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { v4 as uuidv4 } from "uuid"
import "dotenv/config";


const prisma = new PrismaClient({ 
    errorFormat: "pretty", 
})

export const createClass = async (request: Request, response: Response) => {
    try {
        const { class_name, class_program } = request.body;
        const uuid = uuidv4()

        const data = await prisma.classes.create({
            data: {
                uuid,
                class_name,
                class_program
            }
        })
        response.status(201).json({
            status: true,
            data: data,
            message: `Successfully created a class.`
        })
        return
    } catch (error) {
        console.error(error)

        response.status(500).json({
            status: false,
            message: `Failed to create a class.`
        })
        return
    }
}

export const classUpdate = async (request: Request, response: Response) => {
    try {
        const { idClass } = request.params;
        const { class_name, class_program } = request.body;

        if (!idClass) {
            response.status(400).json({
                status: false,
                message: `idClas is required.`
            })
            return
        }

        const findClass = await prisma.classes.findFirst({
            where: { idClass: Number(idClass) }
        })

        if (!findClass) {
            response.status(404).json({
                status: false,
                message: `Class did not found.`
            })
            return
        }
        
        const updateData = await prisma.classes.update({
            data: {
                class_name: class_name || findClass.class_name,
                class_program: class_program || findClass.class_program
            },
            where: { idClass: Number(idClass) }
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