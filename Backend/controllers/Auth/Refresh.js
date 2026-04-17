import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../../config/database.js";
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/generateTokens.js";

export const Refresh = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        message: "No refresh token provided"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH);
    } catch (err) {
      return res.status(401).json({
        message: "Invalid or expired refresh token"
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const tokenResult = await client.query(
      `SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2`,
      [decoded.id, hashedToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        message: "Refresh token not recognized (possible reuse attack)"
      });
    }

    const { rows } = await client.query(
      `SELECT id, email, name, role FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "User not found"
      });
    }

    const user = rows[0];

    await client.query("BEGIN");
    transactionStarted = true;

    await client.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1 AND token = $2`,
      [decoded.id, hashedToken]
    );

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const newHashedToken = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token)
       VALUES ($1, $2)`,
      [user.id, newHashedToken]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    };

    res.cookie("access_token", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });

    res.cookie("refresh_token", newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      message: "Token refreshed"
    });

  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    console.error(error);

    return res.status(500).json({
      message: "Internal Server Error"
    });

  } finally {
    client.release();
  }
};
