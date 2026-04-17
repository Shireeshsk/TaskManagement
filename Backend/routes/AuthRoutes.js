import { Router } from "express";
import { Register } from "../controllers/Auth/Register.js";
import { Login } from "../controllers/Auth/Login.js";
import { Logout } from "../controllers/Auth/Logout.js";
import { Refresh } from "../controllers/Auth/Refresh.js";
import { Me } from "../controllers/Auth/Me.js";
import { authenticate } from "../middleware/Authmiddleware.js";

export const Authrouter = Router()
Authrouter.post('/register',Register)
Authrouter.post('/login',Login)
Authrouter.post('/logout',Logout)
Authrouter.post("/refresh",Refresh)
Authrouter.get("/me", authenticate, Me)
