import { Router } from "express";
import { authenticate, authorize } from "../middleware/Authmiddleware.js";
import { createTeam, addTeamMembers, getTeamById, getAllTeams } from "../controllers/teamController.js";
import { getTasksByTeam } from "../controllers/taskController.js";

const TeamRouter = Router();

TeamRouter.get("/", authenticate, authorize("ADMIN"), getAllTeams);
TeamRouter.post("/", authenticate, authorize("MANAGER"), createTeam);
TeamRouter.post("/:id/members", authenticate, authorize("MANAGER"), addTeamMembers);
TeamRouter.get("/:id", authenticate, getTeamById);
TeamRouter.get("/:id/tasks", authenticate, getTasksByTeam);

export { TeamRouter };
