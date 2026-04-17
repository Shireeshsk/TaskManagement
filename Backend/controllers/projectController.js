import { pool } from "../config/database.js";

export const createProject = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, start_date, end_date, deadline, manager_id } = req.body;
    const target_manager_id = manager_id?.trim() || null;

    if (!name) return res.status(400).json({ message: "Project name is required" });
    if (!target_manager_id) return res.status(400).json({ message: "You must assign a Manager to this project" });

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ message: "Start date cannot be after end date" });
    }
    if (deadline && start_date && new Date(deadline) < new Date(start_date)) {
      return res.status(400).json({ message: "Deadline cannot be before start date" });
    }

    const managerCheck = await client.query(
      `SELECT id, role, name, email FROM users WHERE id = $1`,
      [target_manager_id]
    );

    if (managerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Assigned manager not found" });
    }

    if (managerCheck.rows[0].role !== "MANAGER") {
      return res.status(400).json({ message: "Assigned user must have MANAGER role" });
    }

    const { rows } = await client.query(
      `INSERT INTO projects (name, description, start_date, end_date, deadline, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, start_date, end_date, deadline, target_manager_id]
    );

    return res.status(201).json({
      message: "Project created successfully",
      project: {
        ...rows[0],
        manager_name: managerCheck.rows[0].name,
        manager_email: managerCheck.rows[0].email
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export const getProjects = async (req, res) => {
  try {
    let query = `
      SELECT
        p.*,
        u.name AS manager_name,
        u.email AS manager_email
      FROM projects p
      LEFT JOIN users u ON u.id::text = p.manager_id::text
    `;
    let params = [];
    if (req.user?.role === 'MANAGER') {
       query += ` WHERE p.manager_id = $1`;
       params.push(req.user.id);
    }
    query += ` ORDER BY p.created_at DESC`;
    const { rows } = await pool.query(query, params);
    return res.status(200).json({ projects: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { rows } = await pool.query(
      `SELECT
         p.*,
         u.name AS manager_name,
         u.email AS manager_email
       FROM projects p
       LEFT JOIN users u ON u.id::text = p.manager_id::text
       WHERE p.id = $1`,
      [projectId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = rows[0];
    if (req.user?.role === "MANAGER" && project.manager_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: you are not assigned to this project" });
    }

    return res.status(200).json({ project });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
