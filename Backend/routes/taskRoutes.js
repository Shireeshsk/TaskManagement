import { Router } from "express";
import { authenticate, authorize } from "../middleware/Authmiddleware.js";
import {
  createTask,
  assignTask,
  updateTaskStatus,
  updateTaskPriority,
  addTaskCollaborators,
  getTaskById,
  getAllTasks
} from "../controllers/taskController.js";

const TaskRouter = Router();

TaskRouter.get("/", authenticate, authorize("ADMIN"), getAllTasks);
TaskRouter.post("/", authenticate, createTask);
TaskRouter.patch("/:id/assign", authenticate, assignTask);
TaskRouter.patch("/:id/status", authenticate, updateTaskStatus);
TaskRouter.patch("/:id/priority", authenticate, updateTaskPriority);
TaskRouter.post("/:id/collaborators", authenticate, addTaskCollaborators);
TaskRouter.get("/:id", authenticate, getTaskById);

export { TaskRouter };
