import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, LogOut } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [teamStats, setTeamStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/projects"),
      apiFetch("/api/reports/manager")
    ])
      .then(async ([projectsRes, reportRes]) => {
        if (
          projectsRes.status === 401 ||
          projectsRes.status === 403 ||
          reportRes.status === 401 ||
          reportRes.status === 403
        ) {
          toast.error("Session expired. Please log in again.");
          navigate("/");
          return;
        }

        const projectsData = await projectsRes.json();
        const reportData = await reportRes.json();

        if (projectsData?.projects) setProjects(projectsData.projects);
        if (reportData?.teamStats) setTeamStats(reportData.teamStats);
      })
      .catch(() => toast.error("Failed to load dashboard data."))
      .finally(() => setIsLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      toast.info("Logged out successfully");
      navigate("/");
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <h1 className="text-2xl font-black text-indigo-600 tracking-tight flex items-center gap-2">
          Manager Dashboard
        </h1>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors font-semibold">
          <LogOut size={18}/> Logout
        </button>
      </nav>

      <main className="flex-1 p-10 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Assigned Projects</h2>
            <p className="text-slate-500 mt-2 text-lg">Open a project to manage only its teams and tasks.</p>
          </div>
        </div>

        {!isLoading && teamStats.length > 0 && (
          <div className="mb-10">
            <h3 className="text-2xl font-black text-slate-900 mb-4">Team Load</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamStats.map((team) => (
                <div key={team.team_id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <p className="text-lg font-bold text-slate-900">{team.team_name}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Team Load: {team.completed_tasks || 0} / {team.task_count || 0} completed
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-slate-400 font-medium">Loading projects...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/manager/projects/${project.id}`)}
                className="text-left p-7 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-2xl font-black text-slate-800">{project.name}</h3>
                  <FolderKanban className="text-indigo-500" size={26} />
                </div>
                <p className="text-slate-500 font-medium">
                  {project.description || "No description provided."}
                </p>
                <p className="text-xs tracking-widest uppercase text-slate-400 mt-6 font-bold">
                  Open Project Workspace
                </p>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full p-10 text-center border-2 border-dashed border-slate-300 rounded-3xl">
                <h3 className="text-xl font-bold text-slate-500">No projects assigned.</h3>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
