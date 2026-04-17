import bcrypt from "bcryptjs"
import {generateAccessToken,generateRefreshToken} from "../../utils/generateTokens.js"
import { pool } from "../../config/database.js";
import crypto from "crypto";
import {validateEmail,validateName,validatePassword} from "../../utils/validations.js";
export const Register = async(req,res)=>{
    const client = await pool.connect();
    try{
        const {email,name,password,role} = req.body
        if(!email || !name || !password){
            return res.status(400).json({
                message : "Missing fields name email or password"
            })
        }
        const emailResult = validateEmail(email);
        const nameResult = validateName(name);
        const passwordResult = validatePassword(password);
        if (emailResult.error){
            return res.status(400).json({
                message : emailResult.error.details[0].message
            })
        }
        if (nameResult.error){
            return res.status(400).json({
                message : nameResult.error.details[0].message
            })
        }
        if (passwordResult.error){
            return res.status(400).json({
                message : passwordResult.error.details[0].message
            })
        }
        await client.query('BEGIN');
        const existingUser = await client.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        )
        if(existingUser.rows.length>0){
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Email already registered try logging in'
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        let userRole = 'EMPLOYEE';
        if (role === 'ADMIN' || role === 'MANAGER') {
            userRole = role;
        }
        const { rows } = await client.query(
            `INSERT INTO users (name, email, password, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, role`,
            [name, email, hashedPassword, userRole]
        );
        const user = rows[0];
        const accessToken = generateAccessToken(user)
        const refreshToken = generateRefreshToken(user)
        const hashedRefreshToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
        await client.query(
            `INSERT INTO refresh_tokens (user_id, token)
            VALUES ($1, $2)`,
            [user.id, hashedRefreshToken]
        );
        await client.query('COMMIT');

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        };

        res.cookie('access_token', accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refresh_token',refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        return res.status(201).json({
            message: 'Registration successful',
            user
        });
    }catch(error){
        await client.query('ROLLBACK');
        console.log(error)
        return res.status(500).json({
            message: 'Internal Server Error'
        })
    } finally {
        client.release();
    }
}
