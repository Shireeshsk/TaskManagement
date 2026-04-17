import jwt from 'jsonwebtoken'
import {config} from 'dotenv'
config();

const accessSecret = process.env.ACCESS
const refreshSecret = process.env.REFRESH 

export const generateAccessToken = (user)=>{
    const payload = {
        id : user.id,
        email : user.email,
        role : user.role
    }
    const accessToken = jwt.sign(payload,accessSecret,{expiresIn:'15m'})
    return accessToken
}

export const generateRefreshToken = (user)=>{
    const payload = {
        id : user.id,
        email : user.email,
        role : user.role
    }
    const refreshToken = jwt.sign(payload,refreshSecret,{expiresIn:'7d'})
    return refreshToken
}