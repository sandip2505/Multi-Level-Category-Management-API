import express, { Application } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import categoryRoutes from './routes/categoryRoutes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/category', categoryRoutes);

// Health check route
// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'ok' });
// });

export default app;