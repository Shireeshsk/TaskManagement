import { pool } from "../../config/database.js";

export const addTaskCollaborators = async (req, res) => {
  const client = await pool.connect();

  try {
    const { task_id, user_ids } = req.body;
    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!task_id || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        message: "task_id and user_ids[] are required"
      });
    }

    await client.query("BEGIN");

    // 🔹 Get task + project manager + team
    const taskRes = await client.query(
      `SELECT t.id, t.team_id, p.manager_id
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [task_id]
    );

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const task = taskRes.rows[0];

    // 🔐 Authorization
    if (role !== "ADMIN" && task.manager_id !== requesterId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Only project manager or admin can add collaborators"
      });
    }

    // 🔹 Validate all users belong to team
    for (const userId of user_ids) {
      const check = await client.query(
        `SELECT id FROM team_members 
         WHERE team_id = $1 AND user_id = $2`,
        [task.team_id, userId]
      );

      if (check.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `User ${userId} is not part of the team`
        });
      }

      await client.query(
        `INSERT INTO task_collaborators (task_id, user_id)
         VALUES ($1, $2)`,
        [task_id, userId]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Collaborators added successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        message: "One or more users already collaborators"
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error"
    });

  } finally {
    client.release();
  }
};