import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerProjectWorkspace from "./pages/ManagerProjectWorkspace";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import UsersDirectory from "./pages/UsersDirectory";
import Projects from "./pages/Projects";
import TeamsManager from "./pages/TeamsManager";
import TasksManager from "./pages/TasksManager";
import AdminTeams from "./pages/AdminTeams";
import AdminTasks from "./pages/AdminTasks";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        <Route path="/projects" element={<Projects />} />
        
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UsersDirectory />} />
        <Route path="/admin/teams" element={<AdminTeams />} />
        <Route path="/admin/tasks" element={<AdminTasks />} />
        
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/manager/projects/:projectId" element={<ManagerProjectWorkspace />} />
        <Route path="/manager/teams" element={<TeamsManager/>} />
        <Route path="/manager/tasks" element={<TasksManager/>} />

        <Route path="/employee" element={<EmployeeDashboard />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} theme="light" />
    </Router>
  );
}
