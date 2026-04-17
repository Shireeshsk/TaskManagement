import { Router } from "express";
import { authenticate, authorize } from "../middleware/Authmiddleware.js";
import { createProject, getProjects, getProjectById } from "../controllers/projectController.js";
import { getTeamsByProject } from "../controllers/teamController.js";

const ProjectRouter = Router();

ProjectRouter.post("/", authenticate, authorize("ADMIN"), createProject);
ProjectRouter.get("/", authenticate, authorize("ADMIN", "MANAGER"), getProjects);
ProjectRouter.get("/:id", authenticate, authorize("ADMIN", "MANAGER"), getProjectById);
ProjectRouter.get("/:id/teams", authenticate, authorize("ADMIN", "MANAGER"), getTeamsByProject);

export { ProjectRouter };
