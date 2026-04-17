import { pool } from "../config/database.js";

export const updateUserRole = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.params.id;
    const normalizedRole = (req.body?.role || "").toString().trim().toUpperCase();

    if (!normalizedRole) {
      return res.status(400).json({ message: "Role is required" });
    }

    const allowedRoles = ["ADMIN", "MANAGER", "EMPLOYEE"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (req.user.id === userId) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    const { rows } = await client.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role`,
      [normalizedRole, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: `User role updated to ${normalizedRole}`,
      user: rows[0]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export const getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, date_of_joining FROM users`
    );
    return res.status(200).json({ users: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const { rows } = await pool.query(
      `SELECT id, email, name, role, date_of_joining FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getLedTeams = async (req, res) => {
  try {
    const userId = req.params.id;
    const { rows } = await pool.query(
      `SELECT * FROM teams WHERE leader_id = $1`,
      [userId]
    );
    return res.status(200).json({ teams: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
