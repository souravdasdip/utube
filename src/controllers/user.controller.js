import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

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


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request!")
    }

    try {
        //user info decoded
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        console.log({user});
        if(!user){
            throw new ApiError(401, "Invalid refresh token!")
        }

        //token match with db and user
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired!")
        }

        //generate new access and refresh token and send to user
        const {accesstoken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
        
        //set cookies the at and rt
        const options = {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
        .cookie("accessToken", accesstoken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(200, {
            accesstoken,
            refreshToken: newRefreshToken
        },"Access token refreshed"))

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token!")
    }
})


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
                refreshToken: 1 //removes the field from document
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


const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    //user id get from middleware(verifyJWT)
    const user = await User.findById(req.user?._id)
    const isPasswordCOrrect = await user.isPasswordCOrrect(oldPassword)

    if(!isPasswordCOrrect){
        throw new ApiError(400, "Invalid Password!")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})
    //after save user.isModified(password) hook will run

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully!"))
})  

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully!"))
})


const updateAccountDetails = asyncHandler(async(req, res) => {
    const {username, fullName} = req.body

    if(!username || !fullName){
        throw new ApiError(400, "All fields are required!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                username
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details successfully!"))
})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalpath = req.file?.path

    if(!avatarLocalpath){
        throw new ApiError(400, "Avatar file is missing!")
    }

    const uploadedAvatar = await uploadOnCloudinary(avatarLocalpath)

    if(!uploadedAvatar.url){
        throw new ApiError(400, "Error while uploading avatar!")
    }

    const updatedUserAvatarObj = await User.findByIdAndUpdate(req.user?._id, {
        avatar: uploadedAvatar.url
    },{
        new: true
    })

    return res.status(200)
        .json(new ApiResponse(200, updatedUserAvatarObj, "Avatar updated successfully!"))

})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalpath = req.file?.path

    if(!coverImageLocalpath){
        throw new ApiError(400, "Cover image file is missing!")
    }

    const uploadedcoverImage = await uploadOnCloudinary(coverImageLocalpath)

    if(!uploadedcoverImage.url){
        throw new ApiError(400, "Error while uploading coverI image!")
    }

    const updatedUsercoverImageObj = await User.findByIdAndUpdate(req.user?._id, {
        coverImage: uploadedcoverImage.url
    },{
        new: true
    })

    return res.status(200)
        .json(new ApiResponse(200, updatedUsercoverImageObj, "Cover image updated successfully!"))

})


//subscriber and subscribe to find
const getUserChannelProfile = asyncHandler(async(req, res) => {
    const { username } = req.params
    
    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing!")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },{
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },{
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },{
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },{
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist!")
    }

    console.log({channel});

    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "Channel info fetched!"))
})

//get watch history
const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            //Find User in users table
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },{
            //Lookup the watchHistory video ids and extract video information from the "VIDEO" table
            $lookup: {
                from: "videos",
                localField: 'watchHistory',
                foreignField: "_id",
                as: "watchHistory",
                //Nested pipeline for get the owner of the VIDEO reverse from "User" table
                pipeline: [{
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        //get only this information
                        pipeline: [{
                            $project:{
                                fullName: 1,
                                username: 1,
                                avatar: 1
                            }
                        }]
                    }
                },{
                    //get the o index from the results
                    $addFields: {
                        owner: {
                            $first: "$owner"
                        }
                    }
                }]
            }
        }
    ])

    console.log({user});
    return res
        .status(200)
        .json(new ApiResponse(200, user[0]?.watchHistory,"Watch history successfully!"))
})

export { getWatchHistory, getUserChannelProfile, updateUserAvatar, updateUserCoverImage, updateAccountDetails, getCurrentUser, changeCurrentPassword, loginUser, logoutUser, registerUser, refreshAccessToken };

