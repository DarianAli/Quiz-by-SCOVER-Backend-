import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../generated/prisma";


const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createSubject = async (request: Request, response: Response) => {
    try {
        const { subject_name } = request.body;
        const uuid = uuidv4()

        const createData = await prisma.subject.create({
            data: {
                uuid,
                subject_name
            }
        })

        response.status(201).json({
            status: true,
            data: createData,
            message: `Successfully created a subject`
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