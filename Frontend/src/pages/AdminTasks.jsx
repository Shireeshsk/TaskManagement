import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckSquare } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function AdminTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    apiFetch("/api/tasks")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          toast.error("Unauthorized to view tasks.");
          navigate("/");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.tasks) setTasks(data.tasks);
      })
      .catch(() => toast.error("Failed to fetch tasks"));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8">
      <nav className="mb-8 flex items-center gap-4">
        <Link to="/admin" className="text-slate-500 hover:text-amber-600">
          <ArrowLeft />
        </Link>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
          <CheckSquare className="text-amber-600" /> All Tasks
        </h1>
      </nav>

      <div className="space-y-4">
        {tasks.map((task) => (
          <div key={task.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-100 font-bold">{task.status}</span>
            </div>
            <p className="text-sm text-slate-600 mt-2">{task.description || "No description provided."}</p>
            <p className="text-sm text-slate-500 mt-2">Priority: {task.priority}</p>
            <p className="text-sm text-slate-500">Team ID: {task.team_id}</p>
            <p className="text-sm text-slate-500">Assignee ID: {task.assignee_id}</p>
          </div>
        ))}
      </div>
      {tasks.length === 0 && <p className="text-slate-500 font-medium">No tasks found.</p>}
    </div>
  );
}
