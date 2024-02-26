import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)

        //generate user access token 
        const accesstoken = await user.generateAccessToken()

        //generate refresh token
        const refreshToken = await user.generateRefreshToken()

        //update refresh token in database
        user.refreshToken = refreshToken

        //then user should be saved without validation
        await user.save({ validateBeforeSave: false })


        return {
            accesstoken,
            refreshToken
        }
    } catch (error) {
        throw new ApiError(500, "Somthing went wrong while generating access and refresh token!")
    }
}

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
    // const converImageLocalPath = req?.files.coverImage[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required!")
    }

    //check cover image
    let converImageLocalPath;
    if (req.files && Array.isArray(req.files.converImage) && req.files.converImage.length > 0) {
        converImageLocalPath = req.files.coverImage[0].path
    }

    //upload on cloudinary
    const avatarObj = await uploadOnCloudinary(avatarLocalPath)
    const coverImageObj = await uploadOnCloudinary(converImageLocalPath) || ""

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

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body

    console.log({ email });
    // validation
    if (!username || !email) {
        throw new ApiError(400, "Email and Username is required!")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(400, "User is not found! Please sign up!")
    }

    const ispasswordCorrect = await user.isPasswordCOrrect(password)

    // console.log(ispasswordCorrect);
    if (!ispasswordCorrect) {
        throw new ApiError(401, "Invalid user credentials!")
    }

    //get the access and refreshtoken 
    const { accesstoken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    //set up the response object
    const loggedinUser = await User.findById(user._id).select("-password -refreshToken")

    //set cookies and configure how cookies only modify on server
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accesstoken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, {
            user: loggedinUser,
            accesstoken,
            refreshToken
        },
            "User logged In Successfully!"
        ))
})


//logout
const logoutUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }, {
        new: true
    }
    )

    //set cookies and configure how cookies only modify on server
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out!"))
})

export { loginUser, logoutUser, registerUser };

