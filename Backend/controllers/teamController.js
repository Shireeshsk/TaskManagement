import { pool } from "../config/database.js";

// POST /teams
export const createTeam = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, project_id, leader_id } = req.body;
    const manager_id = req.user?.id;

    if (!name || !project_id || !leader_id) {
      return res.status(400).json({ message: "Name, project_id, and leader_id are required" });
    }

    const projectCheck = await client.query('SELECT manager_id FROM projects WHERE id = $1', [project_id]);
    if (projectCheck.rows.length === 0) {
       return res.status(404).json({ message: "Project not found" });
    }
    if (req.user.role === 'MANAGER' && projectCheck.rows[0].manager_id !== manager_id) {
       return res.status(403).json({ message: "You are not the assigned manager for this project" });
    }

    const leaderCheck = await client.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [leader_id]
    );

    if (leaderCheck.rows.length === 0) {
      return res.status(404).json({ message: "Leader not found" });
    }

    if (leaderCheck.rows[0].role !== "EMPLOYEE") {
      return res.status(400).json({ message: "Team leader must have EMPLOYEE role" });
    }

    const { rows } = await client.query(
      `INSERT INTO teams (name, project_id, manager_id, leader_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, project_id, manager_id, leader_id]
    );

    return res.status(201).json({ message: "Team created successfully", team: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// POST /teams/:id/members
export const addTeamMembers = async (req, res) => {
  const client = await pool.connect();
  try {
    const team_id = req.params.id;
    const { user_ids } = req.body; // Expect an array of user IDs or a single user ID

    if (!user_ids) {
      return res.status(400).json({ message: "user_ids is required" });
    }

    const userIdsArray = Array.isArray(user_ids) ? user_ids : [user_ids];

    await client.query("BEGIN");
    const addedMembers = [];
    for (const userId of userIdsArray) {
      const { rows } = await client.query(
        `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
        [team_id, userId]
      );
      if (rows.length > 0) addedMembers.push(rows[0]);
    }
    await client.query("COMMIT");

    return res.status(200).json({ message: "Members added successfully", addedMembers });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// GET /teams/:id
export const getTeamById = async (req, res) => {
  try {
    const team_id = req.params.id;
    const { rows } = await pool.query(`SELECT * FROM teams WHERE id = $1`, [team_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    const team = rows[0];

    const membersQuery = await pool.query(
      `SELECT u.id, u.name, u.email, u.role FROM users u 
       JOIN team_members tm ON u.id = tm.user_id 
       WHERE tm.team_id = $1`,
       [team_id]
    );

    const leaderQuery = await pool.query(
      `SELECT id, name, email, role FROM users WHERE id = $1`,
      [team.leader_id]
    );

    const leader = leaderQuery.rows[0] || null;
    const members = membersQuery.rows;

    if (leader && !members.some((m) => m.id === leader.id)) {
      members.unshift(leader);
    }

    team.leader = leader;
    team.members = members;

    return res.status(200).json({ team });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /projects/:id/teams
export const getTeamsByProject = async (req, res) => {
  try {
    const project_id = req.params.id;

    if (req.user?.role === "MANAGER") {
      const projectCheck = await pool.query(
        `SELECT manager_id FROM projects WHERE id = $1`,
        [project_id]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (projectCheck.rows[0].manager_id !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: you are not assigned to this project" });
      }
    }

    const { rows } = await pool.query(
      `SELECT
         t.*,
         u.name AS leader_name,
         u.email AS leader_email
       FROM teams t
       LEFT JOIN users u ON t.leader_id = u.id
       WHERE t.project_id = $1`,
      [project_id]
    );

    return res.status(200).json({ teams: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /teams
export const getAllTeams = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM teams ORDER BY created_at DESC`);
    return res.status(200).json({ teams: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
