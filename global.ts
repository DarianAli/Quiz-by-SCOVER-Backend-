// import path from "path"

// export const BASE_URL = `${path.join(__dirname, "../")}`
// export const PORT = process.env.PORT
// export const SECRET = process.env.SECRET


import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const BASE_URL = path.join(__dirname, "../")
export const UPLOAD_DIR = path.join(__dirname, "../public")
export const getPort = process.env.PORT ?? "9000"
export const getSecret = process.env.SECRET