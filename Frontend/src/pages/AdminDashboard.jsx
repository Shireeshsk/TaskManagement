import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, FolderKanban, CheckSquare, UsersRound, LogOut } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showActiveTeams, setShowActiveTeams] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [collaboratorsByTaskId, setCollaboratorsByTaskId] = useState({});

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [reportRes, projectsRes, teamsRes, tasksRes, usersRes] = await Promise.all([
          apiFetch("/api/reports/admin"),
          apiFetch("/api/projects"),
          apiFetch("/api/teams"),
          apiFetch("/api/tasks"),
          apiFetch("/api/users")
        ]);

        if (
          reportRes.status === 401 || reportRes.status === 403 ||
          projectsRes.status === 401 || projectsRes.status === 403 ||
          teamsRes.status === 401 || teamsRes.status === 403 ||
          tasksRes.status === 401 || tasksRes.status === 403 ||
          usersRes.status === 401 || usersRes.status === 403
        ) {
          toast.error("Session expired. Please log in again.");
          navigate("/");
          return;
        }

        const [reportData, projectsData, teamsData, tasksData, usersData] = await Promise.all([
          reportRes.json(),
          projectsRes.json(),
          teamsRes.json(),
          tasksRes.json(),
          usersRes.json()
        ]);

        setStats(reportData || null);
        setProjects(projectsData?.projects || []);
        setTeams(teamsData?.teams || []);
        setTasks(tasksData?.tasks || []);

        const usersMap = {};
        (usersData?.users || []).forEach((user) => {
          usersMap[user.id] = user;
        });
        setUsersById(usersMap);
      } catch {
        toast.error("Failed to fetch dashboard data.");
      }
    };

    loadDashboard();
  }, [navigate]);

  useEffect(() => {
    const loadTaskCollaborators = async () => {
      if (!showAllTasks || tasks.length === 0) {
        if (!showAllTasks) setCollaboratorsByTaskId({});
        return;
      }

      try {
        const detailRows = await Promise.all(
          tasks.map(async (task) => {
            try {
              const res = await apiFetch(`/api/tasks/${task.id}`);
              if (!res.ok) return { taskId: task.id, collaborators: [] };
              const data = await res.json();
              return {
                taskId: task.id,
                collaborators: data?.task?.collaborators || []
              };
            } catch {
              return { taskId: task.id, collaborators: [] };
            }
          })
        );

        const next = {};
        detailRows.forEach((entry) => {
          next[entry.taskId] = entry.collaborators;
        });
        setCollaboratorsByTaskId(next);
      } catch {
        setCollaboratorsByTaskId({});
      }
    };

    loadTaskCollaborators();
  }, [showAllTasks, tasks]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      toast.info("Logged out successfully");
      navigate("/");
    } catch {
      toast.error("Failed to logout");
    }
  };

  const projectById = useMemo(() => {
    const map = {};
    projects.forEach((project) => {
      map[project.id] = project;
    });
    return map;
  }, [projects]);

  const enrichedTeams = useMemo(() => {
    return teams.map((team) => {
      const leader = usersById[team.leader_id];
      const project = projectById[team.project_id];
      const manager = project ? usersById[project.manager_id] : usersById[team.manager_id];
      return {
        ...team,
        leader_name: leader?.name || "N/A",
        leader_email: leader?.email || "N/A",
        project_name: project?.name || "N/A",
        manager_name: manager?.name || "N/A",
        manager_email: manager?.email || "N/A"
      };
    });
  }, [teams, usersById, projectById]);

  const teamLoadById = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!map[task.team_id]) {
        map[task.team_id] = { total: 0, completed: 0 };
      }
      map[task.team_id].total += 1;
      if (task.status === "COMPLETED") map[task.team_id].completed += 1;
    });
    return map;
  }, [tasks]);

  const enrichedTasks = useMemo(() => {
    const teamById = {};
    enrichedTeams.forEach((team) => {
      teamById[team.id] = team;
    });

    return tasks
      .map((task) => {
        const team = teamById[task.team_id];
        const assignee = usersById[task.assignee_id];
        return {
          ...task,
          assignee_name: assignee?.name || "N/A",
          assignee_email: assignee?.email || "N/A",
          team_name: team?.name || "N/A",
          team_lead_name: team?.leader_name || "N/A",
          team_lead_email: team?.leader_email || "N/A",
          manager_name: team?.manager_name || "N/A",
          manager_email: team?.manager_email || "N/A"
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [tasks, usersById, enrichedTeams]);

  const handleTeamClick = (teamId) => {
    const team = enrichedTeams.find((entry) => entry.id === teamId);
    if (!team) return;
    setSelectedTeam(team);
  };

  const handleActiveTeamsToggle = () => {
    setShowActiveTeams((prev) => {
      const next = !prev;
      if (!next) setSelectedTeam(null);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <h1 className="text-2xl font-black text-blue-600 tracking-tight flex items-center gap-2">
          Administrator Panel
        </h1>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors font-semibold">
          <LogOut size={18}/> Logout
        </button>
      </nav>

      <main className="flex-1 p-10 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Organization Overview</h2>
          <p className="text-slate-500 mt-2 text-lg">System-wide metrics and performance data.</p>
        </div>

        {!stats ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-6 py-1">
              <div className="h-2 rounded bg-slate-200"></div>
              <div className="space-y-3"><div className="grid grid-cols-3 gap-4"><div className="h-2 rounded bg-slate-200 col-span-2"></div></div></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div onClick={() => navigate("/admin/users")} className="cursor-pointer">
              <StatCard title="Total Users" value={stats.totalUsers} icon={<Users className="text-blue-500" size={24}/>} color="bg-blue-50" border="border-blue-100" />
            </div>
            <div onClick={() => navigate("/projects")} className="cursor-pointer">
              <StatCard title="Total Projects" value={stats.totalProjects} icon={<FolderKanban className="text-purple-500" size={24}/>} color="bg-purple-50" border="border-purple-100" />
            </div>
            <div className="cursor-pointer" onClick={handleActiveTeamsToggle}>
              <StatCard title="Active Teams" value={stats.totalTeams} icon={<UsersRound className="text-emerald-500" size={24}/>} color="bg-emerald-50" border="border-emerald-100" />
            </div>
            <div className="cursor-pointer" onClick={() => setShowAllTasks((prev) => !prev)}>
              <StatCard title="Overall Tasks" value={stats.tasks?.total} detail={`${stats.tasks?.completed} completed`} icon={<CheckSquare className="text-amber-500" size={24}/>} color="bg-amber-50" border="border-amber-100" />
            </div>
          </div>
        )}

        {showActiveTeams && enrichedTeams.length > 0 && (
          <div className="mt-12">
            <h3 className="text-2xl font-black text-slate-900 mb-4">Active Teams</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrichedTeams.map((team) => {
                const load = teamLoadById[team.id] || { total: 0, completed: 0 };
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleTeamClick(team.id)}
                    className={`p-5 rounded-2xl bg-white border shadow-sm text-left transition-all ${
                      selectedTeam?.id === team.id
                        ? "border-blue-400"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-lg font-bold text-slate-900">{team.name}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Team Load: {load.completed} / {load.total} completed
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showActiveTeams && selectedTeam && (
          <div className="mt-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 mb-4">Active Team Details</h3>
            <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Team Name:</span> {selectedTeam.name}</p>
            <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Team Lead:</span> {selectedTeam.leader_name}</p>
            <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Team Lead Email:</span> {selectedTeam.leader_email}</p>
            <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Project Name:</span> {selectedTeam.project_name}</p>
            <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Manager:</span> {selectedTeam.manager_name}</p>
            <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Manager Email:</span> {selectedTeam.manager_email}</p>
          </div>
        )}

        {showAllTasks && (
          <div className="mt-10">
            <h3 className="text-2xl font-black text-slate-900 mb-4">All Tasks</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {enrichedTasks.map((task) => (
                <div key={task.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <p className="text-lg font-bold text-slate-900">{task.title}</p>
                  <p className="text-sm text-slate-600 mt-2"><span className="font-bold text-slate-900">Assignee:</span> {task.assignee_name} ({task.assignee_email})</p>
                  <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Team Name:</span> {task.team_name}</p>
                  <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Team Lead:</span> {task.team_lead_name} ({task.team_lead_email})</p>
                  <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Manager:</span> {task.manager_name} ({task.manager_email})</p>
                  <p className="text-sm text-slate-600">
                    <span className="font-bold text-slate-900">Collaborators:</span>{" "}
                    {(collaboratorsByTaskId[task.id] || []).length > 0
                      ? (collaboratorsByTaskId[task.id] || [])
                          .map((c) => `${c.name} (${c.email})`)
                          .join(", ")
                      : "None"}
                  </p>
                  <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Status:</span> {task.status}</p>
                  <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Priority:</span> {task.priority}</p>
                </div>
              ))}
              {enrichedTasks.length === 0 && (
                <div className="col-span-full p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <p className="text-slate-500 font-medium">No tasks found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-16 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm">
           <h3 className="text-xl font-bold text-slate-900 mb-6">Quick Actions</h3>
           <div className="flex gap-4">
             <button onClick={() => navigate("/projects")} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95">Manage Projects</button>
             <button onClick={() => navigate("/admin/users")} className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all active:scale-95">User Directory</button>
             <button onClick={() => navigate("/admin/teams")} className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all active:scale-95">All Teams</button>
             <button onClick={() => setShowAllTasks((prev) => !prev)} className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all active:scale-95">All Tasks</button>
           </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color, border, detail }) {
  return (
    <div className={`p-6 rounded-3xl ${color} border ${border} relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-600 font-bold text-sm tracking-widest uppercase">{title}</h3>
        <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
      </div>
      <p className="text-5xl font-black text-slate-900 tracking-tighter">{value || 0}</p>
      {detail && <p className="mt-2 text-sm font-semibold opacity-70 text-slate-700">{detail}</p>}
    </div>
  );
}
