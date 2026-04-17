import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UsersRound, ArrowLeft, PlusCircle } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function TeamsManager() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    apiFetch("/api/projects").then(r=>r.json()).then(d=>setProjects(d.projects||[]));
    apiFetch("/api/users").then(r=>r.json()).then(d=>setUsers(d.users||[]));
  }, []);

  useEffect(() => {
    if(activeProjectId) {
      apiFetch(`/api/projects/${activeProjectId}/teams`)
        .then(r=>r.json())
        .then(d=>{
            // Promise format fetching detail for each team to show members
            Promise.all(d.teams.map(t => apiFetch(`/api/teams/${t.id}`).then(r=>r.json()).then(teamData => teamData.team)))
            .then(detailedTeams => setTeams(detailedTeams));
        });
    }
  }, [activeProjectId]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if(!activeProjectId) return toast.error("Select a project first");
    
    try {
      const res = await apiFetch("/api/teams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: e.target.name.value, project_id: activeProjectId, leader_id: e.target.leader.value })
      });
      if(res.ok) {
        toast.success("Team Formed"); e.target.reset();
        setActiveProjectId(activeProjectId); // trigger reload implicitly or explicit re-fetch
        apiFetch(`/api/projects/${activeProjectId}/teams`).then(r=>r.json()).then(d=> {
           Promise.all(d.teams.map(t => apiFetch(`/api/teams/${t.id}`).then(r=>r.json()).then(td => td.team)))
           .then(detailedTeams => setTeams(detailedTeams));
        });
      } else toast.error((await res.json()).message);
    } catch { toast.error("Network error"); }
  };

  const handleAddMember = async (teamId, userId) => {
    if(!userId) return;
    try {
      const res = await apiFetch(`/api/teams/${teamId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [userId] })
      });
      if(res.ok) {
        toast.success("Member secured!");
        apiFetch(`/api/teams/${teamId}`).then(r=>r.json()).then(d=>{
            setTeams(teams.map(t => t.id === teamId ? d.team : t));
        });
      } else toast.error("Failed adding member");
    } catch { toast.error("Network error"); }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8">
      <nav className="mb-10 flex gap-4 items-center">
         <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-blue-500"><ArrowLeft/></button>
         <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2"><UsersRound className="text-indigo-500"/> Team Allocations</h1>
      </nav>

      <div className="mb-8">
        <label className="block font-bold text-slate-600 mb-2">Select Active Project to View/Manage Teams:</label>
        <select onChange={e => setActiveProjectId(e.target.value)} className="w-full max-w-sm px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none font-bold text-slate-700">
           <option value="">-- Choose Project --</option>
           {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {activeProjectId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold bg-white p-4 rounded-t-2xl border-b border-slate-200">Deployed Teams</h2>
            {teams.length===0 && <p className="text-slate-400 font-medium">No teams attached to this project.</p>}
            <div className="grid grid-cols-1 gap-4">
              {teams.map(t => (
                <div key={t.id} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                   <h3 className="text-xl font-bold text-slate-800 mb-4 flex justify-between">{t.name} <span className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full">{t.members?.length || 0} Members</span></h3>
                   
                   <div className="mb-4 space-y-2">
                     {t.members?.map(m => (
                       <span key={m.id} className="inline-block bg-slate-100 text-slate-600 text-sm font-semibold px-3 py-1 rounded-lg mr-2">{m.name}</span>
                     ))}
                   </div>
                   
                   <div className="flex gap-2">
                     <select id={`select-${t.id}`} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm font-medium">
                        <option value="">Enroll existing user...</option>
                        {users.filter(u=>!t.members?.find(m=>m.id===u.id)).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                     </select>
                     <button onClick={() => handleAddMember(t.id, document.getElementById(`select-${t.id}`).value)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-700">Add</button>
                   </div>
                </div>
              ))}
            </div>
          </div>
          
          <form onSubmit={handleCreateTeam} className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl shadow-sm sticky top-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-700"><PlusCircle size={18}/> Draft New Team</h3>
            <input name="name" required placeholder="Team Name (e.g. Frontend Alpha)" className="w-full mb-3 px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-400 outline-none" />
            <select name="leader" required className="w-full mb-4 px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-400 outline-none placeholder-slate-400">
               <option value="">-- Appoint Leader --</option>
               {users.filter(u => u.role === "EMPLOYEE").map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl active:scale-95 transition-all">Form Team</button>
          </form>
        </div>
      )}
    </div>
  );
}
