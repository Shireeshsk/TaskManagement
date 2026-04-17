import { pool } from "../config/database.js";

// GET /reports/manager - team performance
export const getManagerReport = async (req, res) => {
  try {
    const managerId = req.user.id;

    // A report on teams managed by this manager.
    const { rows: teamStats } = await pool.query(
      `SELECT t.id as team_id, t.name as team_name, COUNT(DISTINCT tm.user_id) as member_count, 
              COUNT(DISTINCT ta.id) as task_count,
              SUM(CASE WHEN ta.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN tasks ta ON t.id = ta.team_id
       WHERE t.manager_id = $1
       GROUP BY t.id, t.name`,
       [managerId]
    );

    return res.status(200).json({ teamStats });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /reports/admin - org-wide stats
export const getAdminReport = async (req, res) => {
  try {
    const { rows: usersCount } = await pool.query(`SELECT COUNT(*) as total_users FROM users`);
    const { rows: projectsCount } = await pool.query(`SELECT COUNT(*) as total_projects FROM projects`);
    const { rows: teamsCount } = await pool.query(`SELECT COUNT(*) as total_teams FROM teams`);
    const { rows: tasksCount } = await pool.query(
      `SELECT 
         COUNT(*) as total_tasks,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
         SUM(CASE WHEN status = 'TODO' THEN 1 ELSE 0 END) as todo_tasks,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_tasks
       FROM tasks`
    );

    return res.status(200).json({
      totalUsers: parseInt(usersCount[0].total_users, 10),
      totalProjects: parseInt(projectsCount[0].total_projects, 10),
      totalTeams: parseInt(teamsCount[0].total_teams, 10),
      tasks: {
        total: parseInt(tasksCount[0].total_tasks || 0, 10),
        completed: parseInt(tasksCount[0].completed_tasks || 0, 10),
        todo: parseInt(tasksCount[0].todo_tasks || 0, 10),
        inProgress: parseInt(tasksCount[0].in_progress_tasks || 0, 10)
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
