import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FolderKanban, ArrowLeft, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [usersById, setUsersById] = useState({});

  const loadProjects = useCallback(() => {
    apiFetch("/api/projects")
      .then(r => {
        if(r.status === 401 || r.status === 403) return navigate("/");
        return r.json();
      })
      .then(d => { if(d?.projects) setProjects(d.projects); });
  }, [navigate]);
  useEffect(() => { 
     loadProjects(); 
     apiFetch("/api/users").then(r=>r.json()).then(d=> {
        if(d?.users) {
          setManagers(d.users.filter(u => u.role === 'MANAGER'));
          setUsersById(
            d.users.reduce((acc, user) => {
              acc[user.id] = user;
              return acc;
            }, {})
          );
        }
     });
  }, [loadProjects]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const description = e.target.description.value;
    const manager_id = e.target.manager.value;
    const selectedManager = managers.find((m) => m.id === manager_id);

    if (!manager_id) {
      toast.error("Please select a Manager for this project.");
      return;
    }

    try {
      const res = await apiFetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, manager_id })
      });
      const data = await res.json();
      if(res.ok) {
        toast.success(`Project created and assigned to ${selectedManager?.name || "manager"}`);
        e.target.reset();
        loadProjects();
      } else toast.error(data.message);
    } catch { toast.error("Error creating project"); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8">
      <nav className="mb-10 flex gap-4 items-center">
         <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-blue-500"><ArrowLeft/></button>
         <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2"><FolderKanban className="text-purple-500"/> Projects Portfolio</h1>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {projects.map(p => {
            const managerFromUsers = usersById[p.manager_id];
            const displayManagerName = p.manager_name || managerFromUsers?.name || "Unassigned";
            const displayManagerEmail = p.manager_email || managerFromUsers?.email || "No manager email";

            return (
              <div key={p.id} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                 <h3 className="text-xl font-bold text-slate-800">{p.name}</h3>
                 <p className="text-slate-500 mt-2">{p.description || "No description provided."}</p>
                 <p className="text-sm text-slate-600 mt-3 font-semibold">
                   Manager: {displayManagerName}
                 </p>
                 <p className="text-sm text-slate-500">
                   {displayManagerEmail}
                 </p>
                 <p className="text-xs font-bold text-slate-400 mt-4 tracking-widest uppercase">Started: {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            );
          })}
          {projects.length===0 && <p className="text-slate-400 font-medium">No projects found.</p>}
        </div>

        <div>
          <form onSubmit={handleCreate} className="p-6 bg-white border border-purple-100 rounded-3xl shadow-lg sticky top-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-600"><Plus size={18}/> Initiate Project</h3>
            <input name="name" required placeholder="Project Title" className="w-full mb-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none" />
            <select name="manager" required className="w-full mb-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none">
               <option value="">-- Assign Manager --</option>
               {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
            </select>
            <textarea name="description" placeholder="Project details..." className="w-full mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none h-24" />
            <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md">Deploy Project</button>
          </form>
        </div>
      </div>
    </div>
  );
}
