import dotenv from "dotenv";
dotenv.config();

import express      from "express";
import cors         from "cors";
import morgan       from "morgan";
import path         from "path";

import { UPLOAD_DIR } from "./global.js";
import { globalLimiter } from "./middleware/rateLimiter.js";

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoute       from "./Router/authRouter.js";
import userRoute       from "./Router/userRoute.js";
import classRoute      from "./Router/classRouter.js";
import adminRoute      from "./Router/admin.internal.js";
import quizRoute       from "./Router/quizRouter.js";
import subjectRoute    from "./Router/subjectRoute.js";
import questionRouter  from "./Router/questionRouter.js";
import optionRouter    from "./Router/optionRouter.js";
import studentRouter   from "./Router/studentRouter.js";
import leaderboardRouter from "./Router/leaderboardRouter.js";
import tentorRouter    from "./Router/tentorRouter.js";
import importRouter    from "./Router/importRouter.js";
import moduleRoute     from "./Router/moduleRoute.js";

// ─── App setup ────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
const app  = express();

// ─── Middleware: Security & Parsing ──────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map(o => o.trim());

import cookieParser from "cookie-parser";

app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── HTTP Request Logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/auth",        authRoute);          // POST /auth/login
app.use("/user",        userRoute);          // CRUD users (admin)
app.use("/class",       classRoute);         // CRUD classes (admin)
app.use("/admin",       adminRoute);         // admin internal
app.use("/quiz",        quizRoute);          // quiz CRUD + attempt
app.use("/subject",     subjectRoute);       // subject management
app.use("/question",    questionRouter);     // question CRUD
app.use("/option",      optionRouter);       // option CRUD
app.use("/student",     studentRouter);      // student-specific APIs
app.use("/leaderboard", leaderboardRouter);  // class leaderboard
app.use("/tentor",      tentorRouter);       // tentor-specific APIs
app.use("/import",      importRouter);       // bulk import soal
app.use("/module",      moduleRoute);        // module management

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use("/public", express.static(UPLOAD_DIR));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found." }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Catches any error thrown from route handlers / middleware via next(err)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[GlobalErrorHandler]", err.message, err.stack);
    res.status(500).json({
        success: false,
        message: "Internal server error.",
        error:   process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
// Guard against unhandled rejections/exceptions that would crash the process
process.on("uncaughtException", (err) => {
    console.error("[UNCAUGHT EXCEPTION]", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
    console.error("[UNHANDLED REJECTION]", reason);
});

app.listen(PORT, () => {
    console.log(`✅  Server running at http://localhost:${PORT}  [${process.env.NODE_ENV ?? "development"}]`);
});