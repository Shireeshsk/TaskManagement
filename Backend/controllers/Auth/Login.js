import bcrypt from "bcryptjs"
import crypto from "crypto";
import {generateAccessToken,generateRefreshToken} from "../../utils/generateTokens.js"
import { pool } from "../../config/database.js";
import {validateEmail,validateName,validatePassword} from "../../utils/validations.js";

export const Login = async (req,res)=>{
    const client = await pool.connect()
    try{
        const {email , password} = req.body;
        if(!email || !password){
            return res.status(400).json({
                message : "Missing fields email or password"
            })
        }
        const emailResult = validateEmail(email);
        const passwordResult = validatePassword(password);
        if (emailResult.error){
            return res.status(400).json({
                message : emailResult.error.details[0].message
            })
        }
        if (passwordResult.error){
            return res.status(400).json({
                message : passwordResult.error.details[0].message
            })
        }
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT id, email, name, password, role FROM users WHERE email = $1`,
            [email]
        );
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await client.query('ROLLBACK');
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
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

        res.cookie('refresh_token', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    }catch(error){
        await client.query('ROLLBACK');
        console.log(error)
        return res.status(500).json({
            message: 'Internal Server Error'
        })
    }finally{
        client.release();
    }
}
