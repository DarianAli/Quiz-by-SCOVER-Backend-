import bcrypt from "bcrypt";

const BCRYPT_SALT_ROUNDS = 10;

export class UserService {
    /**
     * Generates an initial hashed password for a bulk-uploaded user.
     * Default initial password format: `<userName>123`
     */
    static async generateInitialPassword(userName: string): Promise<string> {
        const raw = `${userName}123`;
        return bcrypt.hash(raw, BCRYPT_SALT_ROUNDS);
    }
}
