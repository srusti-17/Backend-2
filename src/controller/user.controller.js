import {asyncHandler} from "../utils/asyncHandler.js"

const registerUser = asyncHandler(async (req,res) => {
    //get user details from frontend
    //validation - not empty
    //chack if user already exist:username
    //check for images, check for  avatar
    //upload them to cloudinary, avatar 
    //create user object - create entry in db
    //remove password and refresh token field from response
    //chec for user creation
    //return res

    //const{fullName, email, username , password}=req.body
    res.status(500).json({
        message:"chai aur code"
    })
    console.log("email:",email)
})
export {
    registerUser,
}