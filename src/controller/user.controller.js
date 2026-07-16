import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.service.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken= user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken,refreshToken}

    }catch(error){
        //debug
        console.log(error)
        throw new ApiError(500,"something went wrong while generating access and refresh token ")
    };
}
const registerUser = asyncHandler(async (req,res) => {
    //algorithm-->
    //get user details from frontend
    //validation - not empty
    //chack if user already exist:username
    //check for images, check for  avatar
    //upload them to cloudinary, avatar 
    //create user object - create entry in db
    //remove password and refresh token field from response
    //chec for user creation
    //return res

    const{fullName, email, username , password}=req.body
    //console.log("email: ",email)

    if ([fullName,email,username,password].some((field)=>field?.trim()=== "")){
        throw new ApiError(400,"fields are required")
    } 
    

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if (existedUser){
        throw new ApiError(409, " User with email or Username already exist")
    }

    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath=req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        avatarPublicId: avatar.public_id,
        coverImage:coverImage?.url || "",
        coverImagePublicId:coverImage?.public_id || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken "
    )

    if (!createdUser){
        throw new ApiError(500, "Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(201 , createdUser, "User registered successfully")
    )

})
const loginUser = asyncHandler(async (req,res) => {
    //req body -> data
    // username or email
    //find the user
    //password check
    //access and refresh token
    //send cookies
    
    const {email,username,password} = req.body

    if (!(username || email)){
        throw new ApiError(400,"username or email required")
    }

    //debug
    console.log("Request Body:", req.body);
    console.log("Email:", email);
    console.log("Username:", username);


    const user = await User.findOne({
        $or :[{username},{email}]
    })
    //debug
    console.log("Found User:", user);

    if(!user){
        throw new ApiError(404,"user does not exist")
    }
    //debug
    console.log("Entered Password:", password);
    console.log("Stored Password:", user.password);

    const isPasswordValid= await user.isPasswordCorrect(password)
    
    //debug
    console.log("Password Match:", isPasswordValid);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,
            {
               user: loggedInUser, accessToken,refreshToken//for user to save tokens locally
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req,res) =>{
     //using middleware
     //cookie can be accessed through req.cookie
     await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { 
                refreshToken: undefined
            }
        },{
            new: true
        }     
     )
      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {},"User logged out"))
})

const refreshAccessToken =asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
        
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        }
    
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw ApiError(401, error?.message || "Invalid refresh token" )
    }

})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword ,newPassword} =req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false}) 

    return res
    .status(200)
    .json(new ApiResponse(200,{},"password changed successfully"))

})

const getCurrentuser = asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(new ApiResponse(200,
        req.user,
        "current user fetched successfully"))
})

const updateAccountDetails =asyncHandler(async(req,res)=>{
    const {fullName,email}=req.body

    if (!(fullName || email) ){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email:email
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    // Get the old avatar public ID from the current logged-in user
    const oldAvatarPublicId = req.user?.avatarPublicId

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar?.url){
        throw new ApiError(400, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url,
                avatarPublicId: avatar.public_id
            }
        },
        {new:true}
    ).select("-password")

    // Delete the old avatar image from Cloudinary using publicId directly
    if (oldAvatarPublicId) {
        await deleteFromCloudinary(oldAvatarPublicId);
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Avatar updated successfully")
    )
})
const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is missing")
    }

    // Get the old cover image public ID from the current logged-in user
    const oldCoverImagePublicId = req.user?.coverImagePublicId

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage?.url){
        throw new ApiError(400, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url,
                coverImagePublicId: coverImage.public_id
            }
        },
        {new:true}
    ).select("-password")

    // Delete the old cover image from Cloudinary using publicId directly
    if (oldCoverImagePublicId) {
        await deleteFromCloudinary(oldCoverImagePublicId);
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover Image updated successfully")
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentuser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}