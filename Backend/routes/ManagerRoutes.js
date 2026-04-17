import { Router } from "express";
import { authenticate, authorize } from "../middleware/Authmiddleware.js";
import { createTeam } from "../controllers/Manager/createTeams.js";
import { addTeamMember } from "../controllers/Manager/addTeamMember.js";
import { addTaskCollaborators } from "../controllers/Manager/addCollaborators.js";
import { createTask } from "../controllers/Manager/createTask.js";

export const ManagerRoutes = Router()

ManagerRoutes.post('/create-Team',authenticate,authorize("MANAGER"),createTeam)
ManagerRoutes.post('/add-Team-Member',authenticate,authorize("MANAGER"),addTeamMember)
ManagerRoutes.post('/add-collaborator',authenticate,authorize("MANAGER"),addTaskCollaborators)
ManagerRoutes.post('/create-task',authenticate,authorize("MANAGER"),createTask)

