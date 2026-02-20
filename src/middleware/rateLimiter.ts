import rateLimit from "express-rate-limit"

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: {
    status: false,
    message: "Terlalu banyak request, coba lagi nanti."
  },
  standardHeaders: true,
  legacyHeaders: false,
})