import crypto from "crypto";
import { pool } from "../../config/database.js";

export const Logout = async (req, res) => {
  const client = await pool.connect();
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      const hashedRefreshToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      await client.query(`DELETE FROM refresh_tokens WHERE token = $1`, [hashedRefreshToken]);
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    };

    res.clearCookie('access_token', {
      ...cookieOptions
    });

    res.clearCookie('refresh_token', {
      ...cookieOptions
    });

    return res.status(200).json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Internal Server Error'
    });
  } finally {
    client.release();
  }
};
