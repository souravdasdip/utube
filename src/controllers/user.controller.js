import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const registerUser = asyncHandler(async (req, res) => {
    // get user details
    // validation - not empty
    // check if user is exist
    // check for images, avatar
    // upload them in cloudinary
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { fullName, email, username, password } = req.body

    // validation
    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required!")
    }

    // check user exist
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User already exist!")
    }

    //check for  images ( take path from multer )
    const avatarLocalPath = req?.files.avatar[0]?.path
    const converImageLocalPath = req?.files.coverImage[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required!")
    }

    //upload on cloudinary
    const avatarObj = await uploadOnCloudinary(avatarLocalPath)
    const coverImageObj = await uploadOnCloudinary(converImageLocalPath)

    if (!avatarObj) {
        throw new ApiError(400, "Avatar file is required!")
    }


    //create user in database
    const user = await User.create({
        fullName,
        avatar: avatarObj.url,
        coverImage: coverImageObj?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong with register new user!")
    }


    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully!")
    )
})



export { registerUser };

