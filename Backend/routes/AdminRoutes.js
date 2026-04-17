import {Router} from 'express'
import { authenticate, authorize } from '../middleware/Authmiddleware.js'
import { createProject } from '../controllers/Admin/createProject.js'
import { promoteUser } from '../controllers/Admin/PromoteUser.js'

export const AdminRouter = Router()

AdminRouter.post("/create-project",authenticate,authorize("ADMIN"),createProject)
AdminRouter.post("/promote-user",authenticate,authorize("ADMIN"),promoteUser)