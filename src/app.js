import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from "express";

const app = express()

//which origin can access our backend
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

//json handled and limit its size
app.use(express.json({ limit: "16kb" }))

//url handled with params / extended means, accept nested object also
app.use(express.urlencoded({ extended: true, limit: "16kb" }))

//to access the public folder for file store or to get the file
app.use(express.static("public"))

//to access cookie from user browser and set the cookies
app.use(cookieParser())



//routers import
import userRouter from './routes/user.route.js';
import videoRouter from './routes/video.route.js';


//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/videos", videoRouter)


export { app };

