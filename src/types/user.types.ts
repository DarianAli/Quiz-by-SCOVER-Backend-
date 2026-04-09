import { role } from "../../generated/prisma/client";
import { UserRow } from "../utils/userRow.validator";

export interface UploadError {
    row:    number;
    data:   Partial<UserRow>;
    errors: string[];
}

export interface ValidatedRow {
    row:  number;
    data: UserRow;
}

export interface UserInsertPayload {
    uuid:                string;
    userName:            string;
    email:               string;
    password:            string;
    full_name:           string;
    role:                role;
    phone_number:        string;
    classId:             number;
    parent_full_name:    string;
    parent_phone_number: string;
}
