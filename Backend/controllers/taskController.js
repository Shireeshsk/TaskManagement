import { pool } from "../config/database.js";

// POST /tasks
export const createTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, description, project_id, team_id, assignee_id, collaborator_ids, priority, start_date, end_date, deadline } = req.body;

    if (!title || !project_id || !team_id || !assignee_id) {
      return res.status(400).json({ message: "title, project_id, team_id, assignee_id are required" });
    }

    const teamCheck = await client.query('SELECT manager_id, leader_id, project_id FROM teams WHERE id = $1', [team_id]);
    if (teamCheck.rows.length === 0) return res.status(404).json({ message: "Team not found" });

    if (teamCheck.rows[0].project_id !== project_id) {
      return res.status(400).json({ message: "Team does not belong to the provided project" });
    }

    if (req.user.role !== 'ADMIN' && teamCheck.rows[0].manager_id !== req.user.id && teamCheck.rows[0].leader_id !== req.user.id) {
       return res.status(403).json({ message: "Forbidden: Only assigned Managers or Team Leads can deploy tasks" });
    }

    if (req.user.role === "MANAGER" && teamCheck.rows[0].manager_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You can create tasks only in your assigned projects" });
    }

    const assigneeCheck = await client.query(`SELECT role FROM users WHERE id = $1`, [assignee_id]);
    if (assigneeCheck.rows.length === 0) {
      return res.status(404).json({ message: "Assignee not found" });
    }
    if (assigneeCheck.rows[0].role !== "EMPLOYEE") {
      return res.status(400).json({ message: "Tasks can only be assigned to users with EMPLOYEE role" });
    }

    const { leader_id } = teamCheck.rows[0];
    const isSelectedTeamLeader = leader_id === assignee_id;
    if (!isSelectedTeamLeader) {
      const leadElsewhereCheck = await client.query(
        `SELECT 1 FROM teams WHERE leader_id = $1 LIMIT 1`,
        [assignee_id]
      );

      if (leadElsewhereCheck.rows.length > 0) {
        return res.status(400).json({
          message: "Assignee must be selected team's leader or a non-team-lead employee"
        });
      }
    }

    const collaboratorIds = Array.isArray(collaborator_ids)
      ? [...new Set(collaborator_ids.filter((id) => id && id !== assignee_id))]
      : [];

    for (const collaboratorId of collaboratorIds) {
      const collaboratorCheck = await client.query(`SELECT role FROM users WHERE id = $1`, [collaboratorId]);
      if (collaboratorCheck.rows.length === 0) {
        return res.status(404).json({ message: `Collaborator not found: ${collaboratorId}` });
      }
      if (collaboratorCheck.rows[0].role !== "EMPLOYEE") {
        return res.status(400).json({ message: "Collaborators must have EMPLOYEE role" });
      }

      if (collaboratorId !== leader_id) {
        const collaboratorLeadElsewhere = await client.query(
          `SELECT 1 FROM teams WHERE leader_id = $1 LIMIT 1`,
          [collaboratorId]
        );
        if (collaboratorLeadElsewhere.rows.length > 0) {
          return res.status(400).json({
            message: "Collaborator cannot be a team lead of another group"
          });
        }
      }
    }

    const { rows } = await client.query(
      `INSERT INTO tasks (title, description, project_id, team_id, assignee_id, priority, start_date, end_date, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, project_id, team_id, assignee_id, priority || "MEDIUM", start_date, end_date, deadline]
    );

    const createdTask = rows[0];
    for (const collaboratorId of collaboratorIds) {
      await client.query(
        `INSERT INTO task_collaborators (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [createdTask.id, collaboratorId]
      );
    }

    return res.status(201).json({ message: "Task created successfully", task: createdTask });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// PATCH /tasks/:id/assign
export const assignTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const taskId = req.params.id;
    const { assignee_id } = req.body;

    if (!assignee_id) return res.status(400).json({ message: "assignee_id is required" });

    const taskCheck = await client.query(
      'SELECT ta.team_id, t.manager_id, t.leader_id FROM tasks ta JOIN teams t ON ta.team_id = t.id WHERE ta.id = $1',
      [taskId]
    );
    if (taskCheck.rows.length === 0) return res.status(404).json({ message: "Task not found" });
    
    if (req.user.role !== 'ADMIN' && taskCheck.rows[0].manager_id !== req.user.id && taskCheck.rows[0].leader_id !== req.user.id) {
       return res.status(403).json({ message: "Forbidden: Only Managers or Team Leads can reassign tasks" });
    }

    if (req.user.role === "MANAGER" && taskCheck.rows[0].manager_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You can reassign tasks only in your assigned projects" });
    }

    const assigneeCheck = await client.query(`SELECT role FROM users WHERE id = $1`, [assignee_id]);
    if (assigneeCheck.rows.length === 0) {
      return res.status(404).json({ message: "Assignee not found" });
    }
    if (assigneeCheck.rows[0].role !== "EMPLOYEE") {
      return res.status(400).json({ message: "Tasks can only be assigned to users with EMPLOYEE role" });
    }

    const { leader_id } = taskCheck.rows[0];
    const isSelectedTeamLeader = leader_id === assignee_id;
    if (!isSelectedTeamLeader) {
      const leadElsewhereCheck = await client.query(
        `SELECT 1 FROM teams WHERE leader_id = $1 LIMIT 1`,
        [assignee_id]
      );

      if (leadElsewhereCheck.rows.length > 0) {
        return res.status(400).json({
          message: "Assignee must be selected team's leader or a non-team-lead employee"
        });
      }
    }

    const { rows } = await client.query(
      `UPDATE tasks SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [assignee_id, taskId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Task not found" });

    return res.status(200).json({ message: "Task assigned successfully", task: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// PATCH /tasks/:id/status
export const updateTaskStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const taskId = req.params.id;
    const { status } = req.body;
    const userId = req.user.id;

    if (!status) return res.status(400).json({ message: "status is required" });

    const allowedStatuses = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "IN_REVIEW"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    // Check if the task exists and get related team information to verify the manager or assignee
    const taskQuery = await client.query(
      `SELECT
         ta.assignee_id,
         t.manager_id,
         t.leader_id,
         EXISTS (
           SELECT 1
           FROM task_collaborators tc
           WHERE tc.task_id = ta.id AND tc.user_id = $2
         ) AS is_collaborator
       FROM tasks ta
       JOIN teams t ON ta.team_id = t.id
       WHERE ta.id = $1`,
      [taskId, userId]
    );

    if (taskQuery.rows.length === 0) return res.status(404).json({ message: "Task not found" });

    const { assignee_id, manager_id, leader_id, is_collaborator } = taskQuery.rows[0];

    // Only the assignee, collaborator, team leader, or manager can update the status
    if (
      req.user.role !== "ADMIN" &&
      userId !== assignee_id &&
      userId !== manager_id &&
      userId !== leader_id &&
      !is_collaborator
    ) {
      return res.status(403).json({
        message: "Forbidden: Only assignee, collaborator, leader, or manager can update the status of this task"
      });
    }

    const { rows } = await client.query(
      `UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, taskId]
    );

    return res.status(200).json({ message: "Task status updated", task: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// PATCH /tasks/:id/priority
export const updateTaskPriority = async (req, res) => {
  const client = await pool.connect();
  try {
    const taskId = req.params.id;
    const { priority } = req.body;
    const userId = req.user.id;

    if (!priority) return res.status(400).json({ message: "priority is required" });

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (!allowedPriorities.includes(priority)) return res.status(400).json({ message: "Invalid priority" });

    // Find the task and related team to verify if the user is the manager
    const taskQuery = await client.query(
      `SELECT t.manager_id, t.leader_id 
       FROM tasks ta
       JOIN teams t ON ta.team_id = t.id
       WHERE ta.id = $1`,
      [taskId]
    );

    if (taskQuery.rows.length === 0) return res.status(404).json({ message: "Task not found" });

    const { manager_id, leader_id } = taskQuery.rows[0];

    // Only the manager or team leader can update the priority
    if (req.user.role !== 'ADMIN' && userId !== manager_id && userId !== leader_id) {
      return res.status(403).json({ message: "Forbidden: Only the manager or team leader can update task priority" });
    }

    const { rows } = await client.query(
      `UPDATE tasks SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [priority, taskId]
    );

    return res.status(200).json({ message: "Task priority updated", task: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// POST /tasks/:id/collaborators
export const addTaskCollaborators = async (req, res) => {
  const client = await pool.connect();
  try {
    const taskId = req.params.id;
    const { user_ids } = req.body;

    if (!user_ids) return res.status(400).json({ message: "user_ids is required" });
    const userIdsArray = Array.isArray(user_ids) ? user_ids : [user_ids];

    const taskCheck = await client.query(
      'SELECT ta.assignee_id, t.manager_id, t.leader_id FROM tasks ta JOIN teams t ON ta.team_id = t.id WHERE ta.id = $1',
      [taskId]
    );
    if (taskCheck.rows.length === 0) return res.status(404).json({ message: "Task not found" });
    
    if (req.user.role !== 'ADMIN' && taskCheck.rows[0].manager_id !== req.user.id && taskCheck.rows[0].leader_id !== req.user.id) {
       return res.status(403).json({ message: "Forbidden: Only Managers or Team Leads can add collaborators" });
    }

    await client.query("BEGIN");
    const assigneeId = taskCheck.rows[0].assignee_id;
    const teamLeaderId = taskCheck.rows[0].leader_id;
    const uniqueUserIds = [...new Set(userIdsArray.filter((id) => id && id !== assigneeId))];

    const addedCollaborators = [];
    for (const userId of uniqueUserIds) {
      const collaboratorCheck = await client.query(`SELECT role FROM users WHERE id = $1`, [userId]);
      if (collaboratorCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: `Collaborator not found: ${userId}` });
      }
      if (collaboratorCheck.rows[0].role !== "EMPLOYEE") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Collaborators must have EMPLOYEE role" });
      }

      if (userId !== teamLeaderId) {
        const collaboratorLeadElsewhere = await client.query(
          `SELECT 1 FROM teams WHERE leader_id = $1 LIMIT 1`,
          [userId]
        );
        if (collaboratorLeadElsewhere.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Collaborator cannot be a team lead of another group"
          });
        }
      }

      const { rows } = await client.query(
        `INSERT INTO task_collaborators (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
        [taskId, userId]
      );
      if (rows.length > 0) addedCollaborators.push(rows[0]);
    }
    await client.query("COMMIT");

    return res.status(200).json({ message: "Collaborators added", addedCollaborators });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// GET /tasks/:id
export const getTaskById = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { rows } = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [taskId]);

    if (rows.length === 0) return res.status(404).json({ message: "Task not found" });

    const task = rows[0];

    const collabs = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN task_collaborators tc ON u.id = tc.user_id WHERE tc.task_id = $1`,
       [taskId]
    );
    task.collaborators = collabs.rows;

    return res.status(200).json({ task });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /users/:id/tasks
export const getTasksByUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.user.role !== "ADMIN" && req.user.id !== userId) {
      return res.status(403).json({ message: "Forbidden: You can only view your own tasks" });
    }

    const { rows } = await pool.query(
      `SELECT
         t.*,
         (t.assignee_id = $1) AS is_assignee,
         EXISTS (
           SELECT 1
           FROM task_collaborators tc
           WHERE tc.task_id = t.id AND tc.user_id = $1
         ) AS is_collaborator
       FROM tasks t
       WHERE
         t.assignee_id = $1
         OR EXISTS (
           SELECT 1
           FROM task_collaborators tc
           WHERE tc.task_id = t.id AND tc.user_id = $1
         )
       ORDER BY t.created_at DESC`,
      [userId]
    );
    return res.status(200).json({ tasks: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /teams/:id/tasks
export const getTasksByTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const { rows } = await pool.query(`SELECT * FROM tasks WHERE team_id = $1`, [teamId]);
    return res.status(200).json({ tasks: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /tasks
export const getAllTasks = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM tasks ORDER BY created_at DESC`);
    return res.status(200).json({ tasks: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
