import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "../../generated/prisma";


const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createSubject = async (request: Request, response: Response) => {
    try {
        const { subject_name, classId } = request.body;

        if (classId !== undefined) {
            if (!Array.isArray(classId) || classId.length === 0) {
                response.status(400).json({
                    status: false,
                    message: `classIds must be a non-empty array.`
                });
                return;
            }

            const uniqueId = [ ...new Set(classId.map(Number)) ]

            const foundClasses = await prisma.classes.findMany({
                where: {
                    idClass: { in: uniqueId }
                }
            });

            if (foundClasses.length !== uniqueId.length) {
                response.status(404).json({
                    status: false,
                    message: `One or more classId not found.`
                });
                return;
            }
        }

        const existing = await prisma.subject.findFirst({
            where: { subject_name }
        })

        if (existing) {
            response.status(409).json({
                status: false,
                message: `Subject with this name already exists.`
            })
            return
        }
        
        const uuid = uuidv4()

        const newSubject = await prisma.subject.create({
            data: {
                uuid,
                subject_name,
                ...(classId && {
                    subjectClass: {
                        create: classId.map((id: number) => ({
                            class: {
                                connect: { idClass: Number(id) }
                            }
                        }))
                    } 
                })
            },
            select: {
                idSubject: true,
                uuid: true,
                subject_name: true,
                created_at: true,
                updated_at: true,
                subjectClass: {
                    select: {
                        class: {
                            select: {
                                idClass: true,
                                class_name: true,
                                class_program: true
                            }
                        }
                    }
                }
            }
        })

        const result = {
            ...newSubject,
            classes: newSubject.subjectClass.map(sc => sc.class),
            subjectClass: undefined
        }
        
        response.status(201).json({
            status: true,
            data: result,
            message: `Successfully create subject.`
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

export const getByID = async (request: Request, response: Response) => {
    try {
        const { idSubject } = request.params;
        const id = Number(idSubject)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findIdSubject = await prisma.subject.findUnique({
            where: { idSubject: id }
        })

        if (!findIdSubject) {
            response.status(404).json({
                status: false,
                message: `Subject not found.`
            })
            return
        }

        response.status(200).json({
            status: true,
            data: findIdSubject,
            message: `Show subject data.`
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

export const updateSubject = async (request: Request, response: Response) => {
    try {
        const { idSubject } = request.params;
        const id = Number(idSubject)
        const { subject_name } = request.body;

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findSubject = await prisma.subject.findUnique({
            where: { idSubject: id }
        })

        if (!findSubject) {
            response.status(404).json({
                status: false,
                message: `Subject not found.`
            })
            return
        }

        const existing = await prisma.subject.findFirst({
            where: {
                subject_name,
                idSubject: { not: id }
            }
        })

        if (existing) {
            response.status(400).json({
                status: false,
                message: `Subject name already exists`
            })
            return
        }

        const updateDataS = await prisma.subject.update({
            data: {
                subject_name: subject_name ?? findSubject.subject_name
            },
            where: { idSubject: id }
        })
        
        response.status(200).json({
            status: true,
            data: updateDataS,
            message: `Successfully updated subject data.`
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

export const deleteSubject = async (request: Request, response: Response) => {
    try {
        const { idSubject } = request.params;
        const id = Number(idSubject)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        const findSubject = await prisma.subject.findUnique({
            where: { idSubject: id }
        })

        if (!findSubject) {
            response.status(404).json({
                status: false,
                message: `Subject not found.`
            })
            return
        }

        const deleteSubject = await prisma.subject.delete({
            where: { idSubject: id }
        })

        response.status(200).json({
            status: true,
            data: deleteSubject,
            message: `Successfully deleted subject.`
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

export const getSubjectByUser = async (request: Request, response: Response) => {
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
            select: {
                idUser: true,
                userName: true,
                classId: true,
                class: {
                    select: {
                        idClass: true,
                        class_name: true,
                        class_program: true
                    }
                }
            }
        })

        if (!findUser) {
            response.status(404).json({
                status: false,
                message: `User not found.`
            })
            return
        }

        const subject = await prisma.subjectClass.findMany({
            where: { classId: findUser.classId },
            select: {
                subject: {
                    select: {
                        idSubject: true,
                        uuid: true,
                        subject_name: true,
                        created_at: true,
                        updated_at: true
                    }
                }
            }
        })

        const subjectList = subject.map(items => items.subject)

        response.status(200).json({
            status: true,
            data: {
                user: {
                    idUser: findUser.idUser,
                    userName: findUser.userName
                },
                class: findUser.class,
                subject: subjectList
            },
            message: `Successfully get subjects by user class.`
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