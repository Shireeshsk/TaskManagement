import express from 'express'
import { config } from 'dotenv'
config()
import {pool} from './config/database.js'
import cors from 'cors'
import cookieParser from 'cookie-parser';

import { Authrouter } from './routes/AuthRoutes.js';
import { UserRouter } from './routes/userRoutes.js';
import { ProjectRouter } from './routes/projectRoutes.js';
import { TeamRouter } from './routes/teamRoutes.js';
import { TaskRouter } from './routes/taskRoutes.js';
import { ReportRouter } from './routes/reportRoutes.js';
import { AdminRouter } from './routes/AdminRoutes.js';
import { ManagerRoutes } from './routes/ManagerRoutes.js';
const app = express();
const port = process.env.PORT

app.use(cors({
    origin: process.env.FRONTEND_URL, // Your Vite frontend URL
    credentials: true // Crucial for accepting the httpOnly cookies
}));
app.use(express.json())
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }))
app.get('/', (req, res) => {
    return res.status(200).json({ message: 'Server is up and running fine' })
})

app.use('/api/auth', Authrouter);
app.use('/api/users', UserRouter);
app.use('/api/projects', ProjectRouter);
app.use('/api/teams', TeamRouter);
app.use('/api/tasks', TaskRouter);
app.use('/api/reports', ReportRouter);
app.use('/api/admin', AdminRouter);
app.use('/api/manager', ManagerRoutes);

try {
  await pool.query('select 1')
  console.log('DB connected')
} catch (err) {
  console.error('DB connection failed', err)
}
app.listen(port, () => {
    console.log(`Server runnning on http://localhost:${port}`)
})
