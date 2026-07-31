import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_URL = path.resolve(__dirname, "../");
export const UPLOAD_DIR = path.resolve(__dirname, "../public");
export const getPort = process.env.PORT ?? "3000";
export const getSecret = process.env.SECRET;