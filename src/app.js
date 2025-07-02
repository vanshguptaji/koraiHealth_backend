import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";
import labReportRouter from "./routes/labReport.routes.js";
import dotenv from "dotenv";
dotenv.config();

const app = express()

// Convert CORS_ORIGIN string to array
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : [];

app.use(cors({
    origin: corsOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.use("/api/v1/users", userRouter);
app.use("/api/v1/lab-reports", labReportRouter);

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal server error",
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

export { app };