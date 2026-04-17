import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PlusCircle, UsersRound, CheckSquare } from "lucide-react";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/api";

export default function ManagerProjectWorkspace() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [collaboratorsByTaskId, setCollaboratorsByTaskId] = useState({});
  const [taskPendingCollabByTaskId, setTaskPendingCollabByTaskId] = useState({});
  const [newTaskCollaboratorIds, setNewTaskCollaboratorIds] = useState([]);

  const employees = useMemo(
    () => users.filter((u) => u.role === "EMPLOYEE"),
    [users]
  );

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

  const fetchTasks = useCallback((teamId) => {
    if (!teamId) {
      setTasks([]);
      setCollaboratorsByTaskId({});
      return Promise.resolve();
    }
    return apiFetch(`/api/teams/${teamId}/tasks`)
      .then((res) => res.json())
      .then((data) => {
        const taskList = data?.tasks || [];
        setTasks(taskList);
        return loadTaskCollaborators(taskList);
      });
  }, [loadTaskCollaborators]);

  const fetchAssignableUsers = useCallback((teamId) => {
    if (!teamId) {
      setAssignableUsers([]);
      return Promise.resolve();
    }

    const selectedTeam = teams.find((team) => team.id === teamId);
    if (!selectedTeam) {
      setAssignableUsers([]);
      return Promise.resolve();
    }

    const teamLeaderIds = new Set(teams.map((team) => team.leader_id).filter(Boolean));
    const options = users.filter(
      (user) =>
        user.role === "EMPLOYEE" &&
        (!teamLeaderIds.has(user.id) || user.id === selectedTeam.leader_id)
    );

    setAssignableUsers(options);
    return Promise.resolve();
  }, [teams, users]);

  const fetchTeams = useCallback(() => {
    return apiFetch(`/api/projects/${projectId}/teams`)
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          toast.error("You can only access projects assigned to you.");
          navigate("/manager");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        const projectTeams = data?.teams || [];
        setTeams(projectTeams);
        if (!selectedTeamId && projectTeams.length > 0) {
          const initialTeamId = projectTeams[0].id;
          setSelectedTeamId(initialTeamId);
          fetchTasks(initialTeamId);
          fetchAssignableUsers(initialTeamId);
        } else if (selectedTeamId && projectTeams.some((team) => team.id === selectedTeamId)) {
          fetchTasks(selectedTeamId);
          fetchAssignableUsers(selectedTeamId);
        } else if (projectTeams.length === 0) {
          setSelectedTeamId("");
          setTasks([]);
          setAssignableUsers([]);
          setCollaboratorsByTaskId({});
          setTaskPendingCollabByTaskId({});
          setNewTaskCollaboratorIds([]);
        }
      });
  }, [fetchAssignableUsers, fetchTasks, navigate, projectId, selectedTeamId]);

  useEffect(() => {
    apiFetch(`/api/projects/${projectId}`)
      .then((res) => {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          toast.error("Project not available.");
          navigate("/manager");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.project) setProject(data.project);
      });

    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data?.users || []));

    fetchTeams();
  }, [fetchTeams, navigate, projectId]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchAssignableUsers(selectedTeamId);
    }
  }, [selectedTeamId, fetchAssignableUsers]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    const name = e.target.teamName.value;
    const leader_id = e.target.leaderId.value;

    try {
      const res = await apiFetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, project_id: projectId, leader_id })
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.message || "Failed to create team");

      toast.success("Team created successfully");
      e.target.reset();
      await fetchTeams();
    } catch {
      toast.error("Network error while creating team");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) return toast.error("Select a team first");

    const assignee_id = e.target.assigneeId.value;
    const collaborator_ids = [...newTaskCollaboratorIds];
    const title = e.target.title.value;
    const description = e.target.description.value;
    const priority = e.target.priority.value;

    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          project_id: projectId,
          team_id: selectedTeamId,
          assignee_id,
          collaborator_ids,
          priority
        })
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.message || "Failed to create task");

      toast.success("Task created and assigned");
      e.target.reset();
      setNewTaskCollaboratorIds([]);
      await fetchTasks(selectedTeamId);
    } catch {
      toast.error("Network error while creating task");
    }
  };

  const handleAddCollaborators = async (taskId) => {
    const selectedIds = taskPendingCollabByTaskId[taskId] || [];

    if (selectedIds.length === 0) return toast.error("Select at least one collaborator");

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedIds })
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.message || "Failed to add collaborators");

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
    } catch {
      toast.error("Network error while adding collaborators");
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
      <nav className="mb-8 flex items-center gap-4">
        <button onClick={() => navigate("/manager")} className="text-slate-400 hover:text-indigo-600">
          <ArrowLeft />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            {project?.name || "Project Workspace"}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Teams and tasks for this assigned project only.
          </p>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UsersRound className="text-indigo-500" size={20} />
              Project Teams
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => {
                    setSelectedTeamId(team.id);
                    setNewTaskCollaboratorIds([]);
                    fetchTasks(team.id);
                    fetchAssignableUsers(team.id);
                  }}
                  className={`text-left p-4 border rounded-xl transition-all ${
                    selectedTeamId === team.id
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <p className="font-bold text-slate-900">{team.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Team Lead: {team.leader_name || "Unassigned"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {team.leader_email || "No leader email"}
                  </p>
                </button>
              ))}
            </div>
            {teams.length === 0 && <p className="text-slate-400 mt-4">No teams in this project yet.</p>}
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckSquare className="text-amber-500" size={20} />
              Team Tasks
            </h2>
            {selectedTeamId ? (
              <div className="space-y-3 mt-4">
                {tasks.map((task) => {
                  const availableCollaborators = getAvailableCollaboratorsForTask(task);
                  return (
                  <div key={task.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-slate-900">{task.title}</p>
                      <span className="text-xs px-2 py-1 rounded bg-slate-200 font-bold">
                        {task.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{task.description || "No description"}</p>
                    <p className="text-xs text-slate-500 mt-2">Priority: {task.priority}</p>
                    <div className="mt-3 border border-slate-200 rounded-xl p-3 bg-white space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Collaborators</p>
                      <p className="text-xs text-slate-500">
                        {(collaboratorsByTaskId[task.id] || []).length > 0
                          ? (collaboratorsByTaskId[task.id] || []).map((c) => c.name).join(", ")
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
                                checked={(taskPendingCollabByTaskId[task.id] || []).includes(u.id)}
                                onChange={() => toggleTaskPendingCollaborator(task.id, u.id)}
                              />
                              <span>{u.name} ({u.role})</span>
                            </label>
                          ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddCollaborators(task.id)}
                        disabled={availableCollaborators.length === 0}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
                      >
                        Add Collaborators
                      </button>
                    </div>
                  </div>
                  );
                })}
                {tasks.length === 0 && <p className="text-slate-400">No tasks in selected team.</p>}
              </div>
            ) : (
              <p className="text-slate-400 mt-4">Select a team to view tasks.</p>
            )}
          </div>
        </div>

        <div className="space-y-6 sticky top-8">
          <form onSubmit={handleCreateTeam} className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-indigo-700 flex items-center gap-2">
              <PlusCircle size={18} /> Create Team
            </h3>
            <input
              name="teamName"
              required
              placeholder="Team name"
              className="w-full mb-3 px-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none"
            />
            <select
              name="leaderId"
              required
              className="w-full mb-4 px-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none"
            >
              <option value="">-- Select Team Leader --</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <button className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
              Create Team
            </button>
          </form>

          <form onSubmit={handleCreateTask} className="p-6 bg-amber-50 border border-amber-200 rounded-3xl shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-amber-700 flex items-center gap-2">
              <PlusCircle size={18} /> Create Task
            </h3>
            <input
              name="title"
              required
              placeholder="Task title"
              className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none"
            />
            <textarea
              name="description"
              placeholder="Task description"
              className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none h-20"
            />
            <select
              name="assigneeId"
              required
              className="w-full mb-3 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none"
            >
              <option value="">-- Assign Employee --</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
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
            <select
              name="priority"
              defaultValue="MEDIUM"
              className="w-full mb-4 px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <button className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">
              Create Task
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
