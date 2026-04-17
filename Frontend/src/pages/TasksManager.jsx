import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function TasksManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [collaboratorsByTaskId, setCollaboratorsByTaskId] = useState({});
  const [taskPendingCollabByTaskId, setTaskPendingCollabByTaskId] = useState({});
  const [newTaskCollaboratorIds, setNewTaskCollaboratorIds] = useState([]);
  const preselectedTeamId = searchParams.get("teamId");

  const loadTaskCollaborators = useCallback(async (taskList) => {
    if (!taskList.length) {
      setCollaboratorsByTaskId({});
      return;
    }

    const details = await Promise.all(
      taskList.map(async (task) => {
        try {
          const res = await apiFetch(`/api/tasks/${task.id}`);
          if (!res.ok) return { id: task.id, collaborators: [] };
          const data = await res.json();
          return { id: task.id, collaborators: data?.task?.collaborators || [] };
        } catch {
          return { id: task.id, collaborators: [] };
        }
      })
    );

    const next = {};
    details.forEach((entry) => {
      next[entry.id] = entry.collaborators;
    });
    setCollaboratorsByTaskId(next);
  }, []);

  const loadTasks = useCallback(async (tid) => {
    if (!tid) {
      setTasks([]);
      setCollaboratorsByTaskId({});
      return;
    }
    const r = await apiFetch(`/api/teams/${tid}/tasks`);
    const d = await r.json();
    const taskList = d.tasks || [];
    setTasks(taskList);
    await loadTaskCollaborators(taskList);
  }, [loadTaskCollaborators]);

  const loadAssignableUsers = useCallback((tid) => {
    if (!tid) return setAssignableUsers([]);
    apiFetch(`/api/teams/${tid}`)
      .then((r) => r.json())
      .then((d) => {
        const teamMembers = d?.team?.members || [];
        const localTeamEmployees = [];
        const seenLocal = new Set();

        teamMembers.forEach((member) => {
          if (member.role !== "EMPLOYEE") return;
          if (seenLocal.has(member.id)) return;
          seenLocal.add(member.id);
          localTeamEmployees.push(member);
        });

        // Prefer broader manager-style options when users directory is available.
        // For team-lead accounts (where /api/users may be unavailable), fallback to team members.
        const selectedTeam = teams.find((team) => team.id === tid);
        if (!selectedTeam || users.length === 0) {
          setAssignableUsers(localTeamEmployees);
          return;
        }

        const teamLeaderIds = new Set(teams.map((team) => team.leader_id).filter(Boolean));
        const expandedOptions = users.filter(
          (user) =>
            user.role === "EMPLOYEE" &&
            (!teamLeaderIds.has(user.id) || user.id === selectedTeam.leader_id)
        );

        setAssignableUsers(expandedOptions.length > 0 ? expandedOptions : localTeamEmployees);
      })
      .catch(() => setAssignableUsers([]));
  }, [teams, users]);

  const selectTeam = useCallback((teamId) => {
    setActiveTeamId(teamId);
    loadTasks(teamId);
    loadAssignableUsers(teamId);
  }, [loadAssignableUsers, loadTasks]);

  useEffect(() => {
    const uId = localStorage.getItem("user_id");
    apiFetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));

    apiFetch(`/api/users/${uId}/led_teams`).then(r => {
      if(r.ok) return r.json();
      return {teams: []};
    }).then(d => {
      if(d.teams && d.teams.length > 0) {
         setTeams(d.teams); // Pre-fill teams dropdown for leaders
         const defaultTeamId =
           preselectedTeamId && d.teams.some((t) => t.id === preselectedTeamId)
             ? preselectedTeamId
             : d.teams[0].id;
         selectTeam(defaultTeamId);
      } else {
         // Attempt loading projects for Managers/Admins
         apiFetch("/api/projects").then(r=>r.json()).then(d=>setProjects(d.projects||[]));
      }
    });
  }, [preselectedTeamId, selectTeam]);

  useEffect(() => {
    if (activeTeamId) loadAssignableUsers(activeTeamId);
  }, [activeTeamId, teams, users, loadAssignableUsers]);

  const handleProjectSelect = (e) => {
    const pid = e.target.value;
    if(pid) {
      apiFetch(`/api/projects/${pid}/teams`).then(r=>r.json()).then(d=>setTeams(d.teams||[]));
      setActiveTeamId("");
      setAssignableUsers([]);
      setTasks([]);
      setCollaboratorsByTaskId({});
      setTaskPendingCollabByTaskId({});
      setNewTaskCollaboratorIds([]);
    } else { 
      setTeams([]); 
      setActiveTeamId(""); 
      setAssignableUsers([]);
      setTasks([]);
      setCollaboratorsByTaskId({});
      setTaskPendingCollabByTaskId({});
      setNewTaskCollaboratorIds([]);
    }
  };

  const handleTeamSelect = (e) => {
    const tid = e.target.value;
    setNewTaskCollaboratorIds([]);
    selectTeam(tid);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if(!activeTeamId) return;
    const collaboratorIds = [...newTaskCollaboratorIds];

    const body = {
      title: e.target.title.value,
      description: e.target.description.value,
      project_id: teams.find(t=>t.id===activeTeamId)?.project_id,
      team_id: activeTeamId,
      assignee_id: e.target.assignee.value,
      collaborator_ids: collaboratorIds,
      priority: e.target.priority.value
    };
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if(res.ok) {
        toast.success("Task Deployed");
        e.target.reset();
        setNewTaskCollaboratorIds([]);
        loadTasks(activeTeamId);
      } else toast.error("Failed to create task");
    } catch { toast.error("Network error"); }
  };

  const updatePriority = async (taskId, priority) => {
    try {
      const r = await apiFetch(`/api/tasks/${taskId}/priority`, {
        method: "PATCH", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ priority })
      });
      if(r.ok) { toast.success("Priority Updated"); loadTasks(activeTeamId); }
      else toast.error((await r.json()).message);
    } catch {
      toast.error("Failed to update priority");
    }
  };

  const handleAddCollaborators = async (taskId) => {
    const selectedIds = taskPendingCollabByTaskId[taskId] || [];

    if (selectedIds.length === 0) {
      return toast.error("Select at least one collaborator");
    }

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Collaborators added");
        setTaskPendingCollabByTaskId((prev) => ({ ...prev, [taskId]: [] }));
        const detailRes = await apiFetch(`/api/tasks/${taskId}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setCollaboratorsByTaskId((prev) => ({
            ...prev,
            [taskId]: detailData?.task?.collaborators || []
          }));
        }
      } else {
        toast.error(data?.message || "Failed to add collaborators");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const removeNewTaskCollaborator = (userId) => {
    setNewTaskCollaboratorIds((prev) => prev.filter((id) => id !== userId));
  };

  const toggleTaskPendingCollaborator = (taskId, userId) => {
    setTaskPendingCollabByTaskId((prev) => {
      const current = prev[taskId] || [];
      const next = current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId];
      return { ...prev, [taskId]: next };
    });
  };

  const toggleNewTaskCollaborator = (userId) => {
    setNewTaskCollaboratorIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getAvailableCollaboratorsForTask = (task) => {
    const existingCollaboratorIds = new Set((collaboratorsByTaskId[task.id] || []).map((c) => c.id));
    return assignableUsers.filter(
      (user) => user.id !== task.assignee_id && !existingCollaboratorIds.has(user.id)
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8">
      <nav className="mb-10 flex gap-4 items-center">
         <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-blue-500"><ArrowLeft/></button>
         <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2"><CheckSquare className="text-amber-500"/> Task Generation HQ</h1>
      </nav>

      <div className="flex gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        {projects.length > 0 && (
          <select onChange={handleProjectSelect} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold">
             <option value="">-- View Project --</option>
             {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select value={activeTeamId} disabled={teams.length===0} onChange={handleTeamSelect} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold">
           <option value="">-- Target Team --</option>
           {teams.map((t) => (
             <option key={t.id} value={t.id}>
               {t.name}
             </option>
           ))}
        </select>
      </div>

      {activeTeamId && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-300 pb-2">Active Tasks in Team Queue</h2>
              {tasks.length===0 && <p className="text-slate-400 font-medium">No tasks established.</p>}
              {tasks.map((t) => {
                const availableCollaborators = getAvailableCollaboratorsForTask(t);
                return (
                 <div key={t.id} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between">
                       <h3 className="font-extrabold text-lg text-slate-800">{t.title}</h3>
                       <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${t.status==='COMPLETED'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-3">
                       <select value={t.priority} onChange={e=>updatePriority(t.id, e.target.value)} className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-bold border border-slate-200 outline-none focus:border-amber-400">
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="CRITICAL">CRITICAL</option>
                       </select>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Collaborators</p>
                      <p className="text-xs text-slate-500">
                        {(collaboratorsByTaskId[t.id] || []).length > 0
                          ? (collaboratorsByTaskId[t.id] || []).map((c) => c.name).join(", ")
                          : "None"}
                      </p>
                      <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                        {availableCollaborators.length === 0 && (
                          <p className="text-xs text-slate-500">No collaborators available for this task</p>
                        )}
                        {availableCollaborators.map((u) => (
                            <label key={u.id} className="flex items-center gap-2 text-sm py-1">
                              <input
                                type="checkbox"
                                checked={(taskPendingCollabByTaskId[t.id] || []).includes(u.id)}
                                onChange={() => toggleTaskPendingCollaborator(t.id, u.id)}
                              />
                              <span>{u.name} ({u.role})</span>
                            </label>
                          ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddCollaborators(t.id)}
                        disabled={availableCollaborators.length === 0}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800"
                      >
                        Add Collaborators
                      </button>
                    </div>
                 </div>
                );
              })}
           </div>

           <form onSubmit={handleCreateTask} className="p-6 bg-amber-50 border border-amber-200 rounded-3xl shadow-sm sticky top-8">
              <h3 className="text-lg font-extrabold mb-4 text-amber-700">Deploy New Task</h3>
              <input name="title" required placeholder="Task Title" className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none" />
              <textarea name="description" placeholder="Requirements..." className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none h-20" />
              <select name="assignee" required className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none">
                 <option value="">-- Assign Operative --</option>
                 {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              <div className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Pick Collaborators</p>
                <div className="max-h-32 overflow-y-auto border border-amber-200 rounded-lg p-2 bg-white">
                  {assignableUsers.length === 0 && <p className="text-xs text-slate-500">No collaborators available for this team</p>}
                  {assignableUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={newTaskCollaboratorIds.includes(u.id)}
                        onChange={() => toggleNewTaskCollaborator(u.id)}
                      />
                      <span>{u.name} ({u.role})</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Selected: {newTaskCollaboratorIds.length > 0
                    ? newTaskCollaboratorIds
                        .map((id) => assignableUsers.find((u) => u.id === id)?.name || id)
                        .join(", ")
                    : "None"}
                </p>
                {newTaskCollaboratorIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {newTaskCollaboratorIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removeNewTaskCollaborator(id)}
                        className="px-2 py-1 text-xs rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                      >
                        Remove {assignableUsers.find((u) => u.id === id)?.name || id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select name="priority" className="w-full mb-4 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none font-bold">
                 <option value="MEDIUM">MEDIUM Priority</option>
                 <option value="CRITICAL">CRITICAL Priority</option>
              </select>
              <button className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold tracking-wide rounded-xl active:scale-95 transition-all">Submit Task</button>
           </form>
         </div>
      )}
    </div>
  );
}
