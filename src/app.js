import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";
import labReportRouter from "./routes/labReport.routes.js";
import dotenv from "dotenv";
dotenv.config();

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN ,
    credentials: true,
    optionsSuccessStatus: 200,
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.use("/api/v1/users", userRouter);

app.use("/api/v1/lab-reports", labReportRouter);

// http://localhost:8000/api/v1/users/register

export { app };