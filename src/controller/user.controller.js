import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.service.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken= user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken,refreshToken}

    }catch{
        throw new ApiError(500,"something went wrong while generating access and refresh token ")
    }
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
        coverImage:coverImage?.url || "",
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

    if (!username || !email){
        throw new ApiError(400,"username or email required")
    }

    const user = await User.findOne({
        $or :[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"user does not exist")
    }

    const isPasswordValid= await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

    const options ={
        httpOnly: true,
        secure: true//cookies can only be modifies by server
    }
    return res.status(200)
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
     User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { }
        }
     )
})

export {
    registerUser,
    loginUser,
    logoutUser
}