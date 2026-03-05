import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../generated/prisma";


const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createSubject = async (request: Request, response: Response) => {
    try {
        const { subject_name } = request.body;
        const uuid = uuidv4()

        const existing = await prisma.subject.findFirst({
            where: { subject_name: subject_name }
        })

        if (existing) {
            response.status(400).json({
                status: false,
                message: `Subject name already exists`
            })
            return
        }

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

export const getAllSubject = async (request: Request, response: Response) => {
    try {
        const  search  = request.query.search?.toString() ?? "";


        const findSubject = await prisma.subject.findMany({
            where: { subject_name: { contains: search?.toString() } }
        })

        if (findSubject.length === 0) {
            response.status(404).json({
                status: false,
                message: `Subject not found.`
            })
            return
        }

        response.status(200).json({
            status: true,
            data: findSubject,
            message: `Showing all data.`
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