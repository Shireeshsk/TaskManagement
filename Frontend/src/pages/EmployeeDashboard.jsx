import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, LogOut } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETED"];

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const grouped = useMemo(() => {
    return {
      inProgress: tasks.filter((task) => task.status === "IN_PROGRESS"),
      todo: tasks.filter((task) => task.status === "TODO"),
      blocked: tasks.filter((task) => task.status === "BLOCKED"),
      completed: tasks.filter((task) => task.status === "COMPLETED")
    };
  }, [tasks]);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      navigate("/");
      return;
    }

    apiFetch(`/api/users/${userId}/tasks`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          toast.error("Session expired. Please log in again.");
          navigate("/");
          return { tasks: [] };
        }
        return res.json();
      })
      .then((data) => {
        setTasks(data?.tasks || []);
      })
      .catch(() => toast.error("Failed to load tasks"))
      .finally(() => setLoading(false));
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

  const handleUpdateStatus = async (taskId, status) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.message || "Failed to update status");
        return;
      }

      setTasks((prev) => prev.map((task) => (task.id === taskId ? data.task : task)));
      toast.success("Task status updated");
    } catch {
      toast.error("Network error while updating status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <h1 className="text-2xl font-black text-emerald-600 flex items-center gap-2">
          <ClipboardList size={22} />
          Employee Dashboard
        </h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors font-semibold"
        >
          <LogOut size={18} />
          Logout
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-bold uppercase">In Progress</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{grouped.inProgress.length}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-bold uppercase">Todo</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{grouped.todo.length}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-bold uppercase">Blocked</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{grouped.blocked.length}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-bold uppercase">Completed</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{grouped.completed.length}</p>
          </div>
        </div>

        {loading && <p className="text-slate-500">Loading tasks...</p>}

        {!loading && tasks.length === 0 && (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center">
            <p className="text-slate-500 font-semibold">No tasks assigned as assignee or collaborator yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between gap-4 items-start">
                <div>
                  <p className="text-lg font-black text-slate-900">{task.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{task.description || "No description provided."}</p>
                </div>
                <div className="flex gap-2">
                  {task.is_assignee && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                      ASSIGNEE
                    </span>
                  )}
                  {task.is_collaborator && !task.is_assignee && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">
                      COLLABORATOR
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Priority: {task.priority}</p>
                <p className="text-xs font-bold text-slate-500 uppercase">Status: {task.status}</p>
              </div>

              <div className="mt-4">
                <label className="text-xs font-bold text-slate-600 uppercase">Update Status</label>
                <select
                  value={task.status}
                  disabled={updatingTaskId === task.id}
                  onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                  className="mt-1 w-full md:w-64 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
