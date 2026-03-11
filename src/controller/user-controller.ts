import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid"
import { PrismaClient, role } from "../../generated/prisma/client"; 
import bcrypt from "bcrypt"
import Jwt from "jsonwebtoken"
import { parseExcelBuffer } from "../service/excel.parser";
import { UserRow, validateUserRow } from "../utils/userRow.validator";

interface UploadError {
    row: number,
    data: Partial<UserRow>
    errors: string[]
}

const VALID_ROLES = Object.values(role);

const prisma = new PrismaClient({ errorFormat: "pretty" })

export const bulkCreateUsers = async (request: Request, response: Response) => {
    try {
        if (!request.file) {
            response.status(400).json({
                status:  false,
                message: "No file uploaded. Please upload an .xlsx or .csv file.",
            });
            return;
        }

        let rows: UserRow[];
        try {
            rows = await parseExcelBuffer(request.file.buffer);
        } catch {
            response.status(400).json({
                status:  false,
                message: "Failed to parse the uploaded file. Ensure it matches the required template.",
            });
            return;
        }

        if (rows.length === 0) {
            response.status(400).json({
                status:  false,
                message: "The uploaded file contains no data rows.",
            });
            return;
        }

        const uploadErrors: UploadError[] = [];
        const validRows: { row: number; data: UserRow }[] = [];

        rows.forEach((row, idx) => {
            const rowNumber = idx + 2; // +2 because row 1 is the header
            const result = validateUserRow(row, rowNumber);
            if (!result.valid) {
                uploadErrors.push({ row: rowNumber, data: row, errors: result.errors });
            } else {
                validRows.push({ row: rowNumber, data: row });
            }
        });

        const uniqueClassIds = [...new Set(validRows.map(r => Number(r.data.classId)))];
        const existingClasses = await prisma.classes.findMany({
            where: { idClass: { in: uniqueClassIds } },
            select: { idClass: true },
        });
        const validClassIds = new Set(existingClasses.map(c => c.idClass));

        const rowsWithBadClass: typeof validRows = [];
        const rowsPassedClassCheck: typeof validRows = [];

        for (const item of validRows) {
            if (!validClassIds.has(Number(item.data.classId))) {
                uploadErrors.push({
                    row:    item.row,
                    data:   item.data,
                    errors: [`Row ${item.row}: classId ${item.data.classId} does not exist.`],
                });
                rowsWithBadClass.push(item);
            } else {
                rowsPassedClassCheck.push(item);
            }
        }

        if (rowsPassedClassCheck.length === 0) {
            response.status(422).json({
                status:       false,
                message:      "All rows failed validation. No users were created.",
                total_failed: uploadErrors.length,
                errors:       uploadErrors,
            });
            return;
        }

        const fileUserNames    = rowsPassedClassCheck.map(r => r.data.userName);
        const fileEmails       = rowsPassedClassCheck.map(r => r.data.email);
        const filePhoneNumbers = rowsPassedClassCheck.map(r => r.data.phone_number);

        const seenInFile = {
            userNames:    new Map<string, number>(),
            emails:       new Map<string, number>(),
            phoneNumbers: new Map<string, number>(),
        };

        const [dbUsers, dbAdmins] = await Promise.all([
            prisma.user.findMany({
                where: {
                    OR: [
                        { userName:     { in: fileUserNames    } },
                        { email:        { in: fileEmails       } },
                        { phone_number: { in: filePhoneNumbers } },
                    ],
                },
                select: { userName: true, email: true, phone_number: true },
            }),
            prisma.admin.findMany({
                where: {
                    OR: [
                        { email:        { in: fileEmails       } },
                        { phone_number: { in: filePhoneNumbers } },
                    ],
                },
                select: { email: true, phone_number: true },
            }),
        ]);

        const dbUserNames    = new Set(dbUsers.map(u => u.userName));
        const dbEmails       = new Set([...dbUsers.map(u => u.email),  ...dbAdmins.map(a => a.email)]);
        const dbPhoneNumbers = new Set([...dbUsers.map(u => u.phone_number), ...dbAdmins.map(a => a.phone_number)]);

        const toInsert: {
            uuid:                 string;
            userName:             string;
            email:                string;
            password:             string;
            full_name:            string;
            role:                 role;
            phone_number:         string;
            classId:              number;
            parent_full_name:     string;
            parent_phone_number:  string;
        }[] = [];

        for (const item of rowsPassedClassCheck) {
            const { data, row } = item;
            const rowErrors: string[] = [];

            if (seenInFile.userNames.has(data.userName)) {
                rowErrors.push(`Row ${row}: userName "${data.userName}" is duplicated within the file (first seen at row ${seenInFile.userNames.get(data.userName)}).`);
            } else {
                seenInFile.userNames.set(data.userName, row);
            }

            if (seenInFile.emails.has(data.email)) {
                rowErrors.push(`Row ${row}: email "${data.email}" is duplicated within the file.`);
            } else {
                seenInFile.emails.set(data.email, row);
            }

            if (seenInFile.phoneNumbers.has(data.phone_number)) {
                rowErrors.push(`Row ${row}: phone_number "${data.phone_number}" is duplicated within the file.`);
            } else {
                seenInFile.phoneNumbers.set(data.phone_number, row);
            }

            if (dbUserNames.has(data.userName)) {
                rowErrors.push(`Row ${row}: userName "${data.userName}" already exists in the database.`);
            }
            if (dbEmails.has(data.email)) {
                rowErrors.push(`Row ${row}: email "${data.email}" already exists in the database.`);
            }
            if (dbPhoneNumbers.has(data.phone_number)) {
                rowErrors.push(`Row ${row}: phone_number "${data.phone_number}" already exists in the database.`);
            }

            if (rowErrors.length > 0) {
                uploadErrors.push({ row, data, errors: rowErrors });
                continue;
            }


            const trimmedRole = data.role.trim();
            if (!VALID_ROLES.includes(trimmedRole as role)) {
                uploadErrors.push({ row, data, errors: [`Row ${row}: Invalid role "${trimmedRole}".`] });
                continue;
            }

            const rawPassword = `${data.userName}123`;
            const hashedPassword = await bcrypt.hash(rawPassword, 10);

            toInsert.push({
                uuid:                uuidv4(),
                userName:            data.userName,
                email:               data.email,
                password:            hashedPassword,
                full_name:           data.full_name,
                role:                trimmedRole as role,
                phone_number:        data.phone_number,
                classId:             Number(data.classId),
                parent_full_name:    data.parent_full_name  ?? "",
                parent_phone_number: data.parent_phone_number ?? "",
            });
        }

        // ── 7. Prisma createMany ───────────────────────────────────────────────
        let createdCount = 0;

        if (toInsert.length > 0) {
            const result = await prisma.user.createMany({
                data:           toInsert,
                skipDuplicates: true, // safety net for any race conditions
            });
            createdCount = result.count;
            if (createdCount < toInsert.length) {
                console.warn(
                    `[bulkCreateUsers] ${toInsert.length - createdCount} row(s) skipped due to race condition duplicates`
                );
            }
        }

        // ── 8. Response ────────────────────────────────────────────────────────
        const statusCode = uploadErrors.length > 0 && createdCount === 0 ? 422
                         : uploadErrors.length > 0                       ? 207 // Multi-Status: partial success
                         :                                                 201;

        response.status(statusCode).json({
            status:          createdCount > 0,
            message:
                createdCount === 0
                    ? "No users were created. All rows failed."
                    : `Successfully created ${createdCount} user(s).${uploadErrors.length > 0 ? ` ${uploadErrors.length} row(s) failed.` : ""}`,
            total_rows:      rows.length,
            total_created:   createdCount,
            total_failed:    uploadErrors.length,
            errors:          uploadErrors.length > 0 ? uploadErrors : undefined,
        });
        return;

    } catch (error) {
        console.error("[bulkCreateUsers]", error);
        response.status(500).json({
            status:  false,
            message: "Internal server error.",
        });
        return;
    }
};

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

        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: [
                    {email},
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

        if (existingAdmin) {
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
                idUser: true,
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
            select: {
                idUser: true,
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

        const requester = request.user;

        if (requester?.role !== "ADMIN" && requester?.idUser !== id) {
            return response.status(403).json({
                status: false,
                message: "Forbidden: You can only edit your own account."
            });
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
                return response.status(409).json({ status: false, message: `Email already used.` })
            }
            if (userName && findDuplicates.userName === userName) {
                return response.status(409).json({ status: false, message: "Username already used" });
            }
            if (phone_number && findDuplicates.phone_number === phone_number) {
                return response.status(409).json({ status: false, message: "Phone number already used" });
            }
        }

        const updateData = await prisma.user.update({
            data: {
                userName: userName ?? findUser.userName,
                email: email ?? findUser.email,
                full_name: full_name ?? findUser.full_name,
                role: role ?? findUser.role,
                phone_number: phone_number ?? findUser.phone_number,
                parent_full_name: parent_full_name ?? findUser.parent_full_name,
                parent_phone_number: parent_phone_number ?? findUser.parent_phone_number,
                classId: classId ?? findUser.classId
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

export const updatePasswordAdmin = async (request: Request, response: Response) => {
    try {
        const { idUser } = request.params;
        const { password } = request.body;
        const id = Number(idUser)

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
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

        const isSame = await bcrypt.compare(password, findUser.password)

        if (isSame) {
            response.status(400).json({
                status: false,
                message: `New password cannot be the same as old password.`
            })
            return
        }

        const hashed = await bcrypt.hash(password, 10)

        await prisma.user.update({
            where: { idUser: id },
            data: { password: hashed }
        })

        response.status(200).json({
            status: true,
            message: `Successfully update user password.`
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

export const updatePasswordUser = async (request: Request, response: Response) => {
    try {
        const { idUser } = request.params;
        const id = Number(idUser)
        const { oldPassword, newPassword, confirmPassword } =  request.body;

        if (Number.isNaN(id)) {
            response.status(400).json({
                status: false,
                message: `ID must be a number.`
            })
            return
        }

        if ( newPassword !== confirmPassword ) {
            response.status(400).json({
                status: false,
                message: `Password confirmation does not match.`
            })
            return
        }

        const findUser = await prisma.user.findUnique({
            where:{ idUser: id }
        })

        if (!findUser) {
            response.status(404).json({
                status: false,
                message: `User not found.`
            })
            return
        }

        const validOld = await bcrypt.compare(oldPassword, findUser.password)

        if (!validOld) {
            response.status(401).json({
                status: false,
                message: `Old password is incorrect.`
            })
            return
        }

        const samePassword = await bcrypt.compare(newPassword, findUser.password)

        if (samePassword) {
            response.status(400).json({
                status: false,
                message: `New password cannot be same as old password.`
            })
            return
        }

        const hashed = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { idUser: id },
            data: { password: hashed }
        })

        response.status(200).json({
            status: true,
            message: `Successfully updated password.`
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

export const deleteUser = async( request: Request, response: Response ) => {
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
            where: { idUser: id }
        })

        if (!findUser) {
            response.status(404).json({
                status: false,
                message: `User not found.`
            })
            return
        }

        const deletedData = await prisma.user.delete({
            where: {
                idUser: id
            },
            select: {
                idUser: true,
                uuid: true,
                userName: true,
                email: true,
                full_name: true,
                role: true
            }
        })

        response.status(200).json({
            status: true,
            data: deletedData,
            message: `Successfully delete data.`
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

export const auth = async (request: Request, response: Response) => {
    try {
        const { email, password } = request.body;

        const invalid = () => {
            return response.status(401).json({
                status: false,
                logged: false,
                message: "Invalid credentials."
            });
        };

        const admin = await prisma.admin.findFirst({
            where: { email }
        });

        if (admin) {
            const match = await bcrypt.compare(password, admin.password);
            if (!match) return invalid();

            const data = {
                idAdmin: admin.idAdmin,
                email: admin.email,
                role: "ADMIN",
                userName: admin.username
            };

            if (!process.env.SECRET) {
                response.status(500).json({
                    status: false,
                    message: `Server configuration error.`
                })
                return
            }

            const TOKEN = Jwt.sign(
                { idAdmin: admin.idAdmin, email: admin.email, role: "ADMIN" },
                process.env.SECRET,
                { expiresIn: "1d" }
            );

            return response.status(200).json({
                status: true,
                logged: true,
                data,
                message: "Successfully logged in.",
                TOKEN
            });
        }

        const user = await prisma.user.findFirst({
            where: { email }
        });

        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return invalid();

            const data = {
                idUser: user.idUser,
                email: user.email,
                role: user.role,
                userName: user.userName
            };

            if (!process.env.SECRET){
                response.status(500).json({
                    status: false,
                    message: `Server configuration error.`
                })
                return
            }

            const TOKEN = Jwt.sign(
                { idUser: user.idUser, email: user.email, role: user.role },
                process.env.SECRET,
                { expiresIn: "1d" }
            );

            return response.status(200).json({
                status: true,
                logged: true,
                data,
                message: "Successfully logged in.",
                TOKEN
            });
        }

        if (!user && !admin) {
            return response.status(404).json({
                status: false,
                message: `User not found.`
            })
        }

        return invalid();

    } catch (error) {
        console.error(error);

        return response.status(500).json({
            status: false,
            message: "Internal server error."
        });
    }
};