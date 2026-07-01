import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { processPendingReminders, checkAndMarkExpiredItems } from '../services/reminderScheduler';

const router = Router();

// Protect all routes
router.use(authenticate as any);

// Manual trigger for developer/admin testing
router.post('/trigger-check', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Run the scheduler tasks immediately
    await processPendingReminders();
    await checkAndMarkExpiredItems();

    res.status(200).json({
      status: 'success',
      message: 'Reminder and expiration check tasks triggered and processed successfully.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
