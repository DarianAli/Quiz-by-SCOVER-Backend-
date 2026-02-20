import { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma/client";
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