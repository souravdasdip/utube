import jwt from 'jsonwebtoken';
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if (!token) {
            throw new ApiError(401, "Unauthorized request!")
        }

        const decodedUserFromToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        //user check from db
        const user = await User.findById(decodedUserFromToken?._id).select("-password -refreshToken")

        if (!user) {
            throw new ApiError(401, "Invalid access Token!")
        }

        //set user in req body
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid token!")
    }
})