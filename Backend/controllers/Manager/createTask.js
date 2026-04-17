import { pool } from "../../config/database.js";

export const createTask = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description,
      project_id,
      team_id,
      assignee_id,
      collaborator_ids,
      priority,
      start_date,
      end_date,
      deadline
    } = req.body;

    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!title || !project_id || !team_id || !assignee_id) {
      return res.status(400).json({
        message: "title, project_id, team_id, assignee_id are required"
      });
    }

    await client.query("BEGIN");

    // 🔹 Check project + manager
    const projectRes = await client.query(
      `SELECT id, manager_id FROM projects WHERE id = $1`,
      [project_id]
    );

    if (projectRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Project not found" });
    }

    const project = projectRes.rows[0];

    if (role !== "ADMIN" && project.manager_id !== requesterId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Only project manager or admin can create tasks"
      });
    }

    // 🔹 Validate team
    const teamRes = await client.query(
      `SELECT id FROM teams WHERE id = $1 AND project_id = $2`,
      [team_id, project_id]
    );

    if (teamRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Team does not belong to this project"
      });
    }

    // 🔹 Validate assignee is team member
    const assigneeRoleRes = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [assignee_id]
    );

    if (assigneeRoleRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Assignee not found"
      });
    }

    if (assigneeRoleRes.rows[0].role !== "EMPLOYEE") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Tasks can only be assigned to users with EMPLOYEE role"
      });
    }

    const teamLeaderRes = await client.query(
      `SELECT leader_id FROM teams WHERE id = $1`,
      [team_id]
    );

    const isSelectedTeamLeader =
      teamLeaderRes.rows.length > 0 && teamLeaderRes.rows[0].leader_id === assignee_id;

    if (!isSelectedTeamLeader) {
      const leadElsewhereRes = await client.query(
        `SELECT 1 FROM teams WHERE leader_id = $1 LIMIT 1`,
        [assignee_id]
      );

      if (leadElsewhereRes.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Assignee must be selected team's leader or a non-team-lead employee"
        });
      }
    }

    const collaboratorIds = Array.isArray(collaborator_ids)
      ? [...new Set(collaborator_ids.filter((id) => id && id !== assignee_id))]
      : [];

    const teamLeaderId = teamLeaderRes.rows[0]?.leader_id;
    for (const collaboratorId of collaboratorIds) {
      const collaboratorRoleRes = await client.query(
        `SELECT role FROM users WHERE id = $1`,
        [collaboratorId]
      );

      if (collaboratorRoleRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: `Collaborator not found: ${collaboratorId}`
        });
      }

      if (collaboratorRoleRes.rows[0].role !== "EMPLOYEE") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Collaborators must have EMPLOYEE role"
        });
      }

      if (collaboratorId !== teamLeaderId) {
        const collaboratorLeadElsewhere = await client.query(
          `SELECT 1 FROM teams WHERE leader_id = $1 LIMIT 1`,
          [collaboratorId]
        );

        if (collaboratorLeadElsewhere.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Collaborator cannot be a team lead of another group"
          });
        }
      }
    }

    // 🔹 Insert task
    const { rows } = await client.query(
      `INSERT INTO tasks
       (title, description, project_id, team_id, assignee_id, priority, start_date, end_date, deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        title,
        description,
        project_id,
        team_id,
        assignee_id,
        priority || "MEDIUM",
        start_date,
        end_date,
        deadline
      ]
    );

    const createdTask = rows[0];
    for (const collaboratorId of collaboratorIds) {
      await client.query(
        `INSERT INTO task_collaborators (task_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [createdTask.id, collaboratorId]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Task created successfully",
      task: createdTask
    });

  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23503") {
      return res.status(400).json({
        message: "Invalid project_id, team_id or assignee_id"
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
