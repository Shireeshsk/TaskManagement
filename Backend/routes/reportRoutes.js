import { Router } from "express";
import { authenticate, authorize } from "../middleware/Authmiddleware.js";
import { getManagerReport, getAdminReport } from "../controllers/reportController.js";

const ReportRouter = Router();

ReportRouter.get("/manager", authenticate, authorize("MANAGER"), getManagerReport);
ReportRouter.get("/admin", authenticate, authorize("ADMIN"), getAdminReport);

export { ReportRouter };
