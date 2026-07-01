import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notifications';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Protect all routes in this router
router.use(authenticate as any);

router.get('/', getNotifications as any);
router.put('/read-all', markAllAsRead as any);
router.put('/:id/read', markAsRead as any);

export default router;
