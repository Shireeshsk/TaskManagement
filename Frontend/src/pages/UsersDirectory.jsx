import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Users, ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function UsersDirectory() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const currentUserId = localStorage.getItem("user_id");

  const loadUsers = useCallback(() => {
    apiFetch("/api/users")
      .then(r => {
        if(r.status === 401 || r.status === 403) {
           toast.error("Unauthorized to view this panel.");
           navigate("/"); 
           return null;
        }
        return r.json();
      })
      .then(data => { if(data?.users) setUsers(data.users); })
      .catch(() => toast.error("Failed to load user directory."));
  }, [navigate]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (userId, targetRole) => {
    if(!targetRole) return;
    try {
      const res = await apiFetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole })
      });
      const data = await res.json();
      if(res.ok) {
        toast.success(data.message);
        loadUsers();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to update user role.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <Link to="/admin" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold transition-colors">
          <ArrowLeft size={20}/> Back to Dashboard
        </Link>
        <h1 className="text-xl font-black text-blue-600 tracking-tight flex items-center gap-2">
           <ShieldAlert size={20}/> Admin Access
        </h1>
      </nav>

      <main className="flex-1 p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">User Directory</h2>
            <p className="text-slate-500 mt-2 text-lg">Manage organizational access and roles.</p>
          </div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
             <Users size={32} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <th className="p-6">Name</th>
                <th className="p-6">Email Address</th>
                <th className="p-6">Join Date</th>
                <th className="p-6 text-right">Access Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-6 font-bold text-slate-900">{u.name}</td>
                  <td className="p-6 text-slate-500 font-medium">{u.email}</td>
                  <td className="p-6 text-slate-400 text-sm">{new Date(u.date_of_joining).toLocaleDateString()}</td>
                  <td className="p-6 text-right flex items-center justify-end gap-3">
                    <span className={`px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase shadow-sm border
                        ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                          u.role === 'MANAGER' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 
                          'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {u.role}
                    </span>
                    
                    <select onChange={(e) => {
                         handleRoleChange(u.id, e.target.value);
                         e.target.value = ""; // reset UI back to placeholder
                      }} disabled={u.id === currentUserId} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <option value="">Change Role...</option>
                      <option value="EMPLOYEE">To Employee</option>
                      <option value="MANAGER">To Manager</option>
                      <option value="ADMIN">To Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="p-10 text-center text-slate-400 font-medium animate-pulse">Loading directory...</div>}
        </div>
      </main>
    </div>
  );
}
