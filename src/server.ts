import app from './app';
import { env } from './config/env';
import { initScheduler } from './services/reminderScheduler';

const PORT = env.port;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT} in ${env.nodeEnv} mode.`);
  
  // Initialize cron jobs
  initScheduler();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});
