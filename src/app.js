import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from "express";

const app = express()

//which origin can access our backend
app.use(cors({
    origin: process.env.CORS_ORIGIN
}))

//json handled and limit its size
app.use(express.json({ limit: "16kb" }))

//url handled with params
app.use(express.urlencoded({ extended: true, limit: "16kb" }))

//to access the public folder for file store or to get the file
app.use(express.static("public"))

//to access cookie from user browser and set the cookies
app.use(cookieParser())




export { app };

