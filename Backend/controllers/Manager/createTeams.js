import { pool } from "../../config/database.js";

export const createTeam = async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, project_id, leader_id } = req.body;
    const manager_id = req.user?.id;
    const role = req.user?.role;

    if (!name || !project_id || !leader_id) {
      return res.status(400).json({
        message: "name, project_id, leader_id are required"
      });
    }

    if (!manager_id) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    await client.query("BEGIN");

    const projectRes = await client.query(
      `SELECT id, manager_id FROM projects WHERE id = $1`,
      [project_id]
    );

    if (projectRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const project = projectRes.rows[0];

    if (role !== "ADMIN" && project.manager_id !== manager_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Only project manager can create team"
      });
    }

    const leaderRes = await client.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [leader_id]
    );

    if (leaderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Leader not found"
      });
    }

    if (leaderRes.rows[0].role !== "EMPLOYEE") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Team leader must have EMPLOYEE role"
      });
    }

    if (leader_id === manager_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Manager cannot be the team leader"
      });
    }

    const { rows } = await client.query(
      `INSERT INTO teams (name, project_id, manager_id, leader_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, project_id, manager_id, leader_id, created_at`,
      [name, project_id, manager_id, leader_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Team created successfully",
      team: rows[0]
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
