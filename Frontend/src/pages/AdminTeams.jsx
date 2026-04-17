import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UsersRound } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function AdminTeams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    apiFetch("/api/teams")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          toast.error("Unauthorized to view teams.");
          navigate("/");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.teams) setTeams(data.teams);
      })
      .catch(() => toast.error("Failed to fetch teams"));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8">
      <nav className="mb-8 flex items-center gap-4">
        <Link to="/admin" className="text-slate-500 hover:text-indigo-600">
          <ArrowLeft />
        </Link>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
          <UsersRound className="text-indigo-600" /> All Teams
        </h1>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">{team.name}</h2>
            <p className="text-sm text-slate-500 mt-2">Project ID: {team.project_id}</p>
            <p className="text-sm text-slate-500">Manager ID: {team.manager_id}</p>
            <p className="text-sm text-slate-500">Leader ID: {team.leader_id}</p>
          </div>
        ))}
      </div>
      {teams.length === 0 && <p className="text-slate-500 font-medium">No teams found.</p>}
    </div>
  );
}
