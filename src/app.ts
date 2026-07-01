import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import itemRoutes from './routes/items';
import notificationRoutes from './routes/notifications';
import reminderRoutes from './routes/reminders';
import { errorHandler } from './middlewares/errorHandler';
import { NotFoundError } from './utils/errors';

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reminders', reminderRoutes);

// Catch-all route for undefined paths
app.all('*', (req, _res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server`));
});

// Global error handler middleware
app.use(errorHandler);

export default app;
