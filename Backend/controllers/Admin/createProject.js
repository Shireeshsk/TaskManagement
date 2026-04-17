import { pool } from "../../config/database.js";

export const createProject = async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, description, start_date, end_date, deadline, manager_id } = req.body;
    const target_manager_id = (manager_id || "").toString().trim();

    if (!name) {
      return res.status(400).json({
        message: "Project name is required"
      });
    }

    if (!target_manager_id) {
      return res.status(400).json({
        message: "manager_id is required"
      });
    }

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({
        message: "Start date cannot be after end date"
      });
    }

    if (deadline && start_date && new Date(deadline) < new Date(start_date)) {
      return res.status(400).json({
        message: "Deadline cannot be before start date"
      });
    }

    const managerCheck = await client.query(
      `SELECT id, role, name, email FROM users WHERE id = $1`,
      [target_manager_id]
    );

    if (managerCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Assigned manager not found"
      });
    }

    if (managerCheck.rows[0].role !== "MANAGER") {
      return res.status(400).json({
        message: "Assigned user must have MANAGER role"
      });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO projects 
        (name, description, start_date, end_date, deadline, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, start_date, end_date, deadline, target_manager_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Project created successfully",
      project: {
        ...rows[0],
        manager_name: managerCheck.rows[0].name,
        manager_email: managerCheck.rows[0].email
      }
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
