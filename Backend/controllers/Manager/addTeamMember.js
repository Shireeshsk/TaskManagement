import { pool } from "../../config/database.js";

export const addTeamMember = async (req, res) => {
  const client = await pool.connect();

  try {
    const { team_id, user_id } = req.body;
    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!team_id || !user_id) {
      return res.status(400).json({
        message: "team_id and user_id are required"
      });
    }

    if (!requesterId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    await client.query("BEGIN");

    const teamRes = await client.query(
      `SELECT t.id, t.project_id, p.manager_id
       FROM teams t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [team_id]
    );

    if (teamRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Team not found"
      });
    }

    const team = teamRes.rows[0];

    if (role !== "ADMIN" && team.manager_id !== requesterId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Only project manager or admin can add members"
      });
    }

    const userRes = await client.query(
      `SELECT id FROM users WHERE id = $1`,
      [user_id]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User not found"
      });
    }

    const { rows } = await client.query(
      `INSERT INTO team_members (team_id, user_id)
       VALUES ($1, $2)
       RETURNING id, team_id, user_id, joined_at`,
      [team_id, user_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Member added to team",
      member: rows[0]
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