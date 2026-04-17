import { pool } from "../../config/database.js";
export const promoteUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.body?.userId || req.body?.user_id || req.body?.id;
    const normalizedRole = (req.body?.role || "").toString().trim().toUpperCase();

    if (!userId || !normalizedRole) {
      return res.status(400).json({
        message: "userId and role are required"
      });
    }

    const allowedRoles = ["ADMIN", "MANAGER", "EMPLOYEE"];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: "Invalid role. Only ADMIN, MANAGER, or EMPLOYEE allowed"
      });
    }

    if (req.user.id === userId) {
      return res.status(400).json({
        message: "You cannot change your own role"
      });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, email, name, role FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User not found"
      });
    }

    const targetUser = rows[0];

    if (targetUser.role === normalizedRole) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `User is already a ${normalizedRole}`
      });
    }

    const updatedUser = await client.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, email, name, role`,
      [normalizedRole, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: `User role changed to ${normalizedRole}`,
      user: updatedUser.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return res.status(500).json({
      message: "Internal Server Error"
    });

  } finally {
    client.release();
  }
};
