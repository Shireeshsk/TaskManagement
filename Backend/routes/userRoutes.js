import { Router } from "express";
import { authenticate, authorize } from "../middleware/Authmiddleware.js";
import { updateUserRole, getUsers, getUserById, getLedTeams } from "../controllers/userController.js";
import { getTasksByUser } from "../controllers/taskController.js";

const UserRouter = Router();

UserRouter.patch("/:id/role", authenticate, authorize("ADMIN"), updateUserRole);
UserRouter.get("/", authenticate, authorize("ADMIN", "MANAGER"), getUsers);
UserRouter.get("/:id", authenticate, authorize("ADMIN"), getUserById);
UserRouter.get("/:id/tasks", authenticate, getTasksByUser);
UserRouter.get("/:id/led_teams", authenticate, getLedTeams);

export { UserRouter };
