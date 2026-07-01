import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate as any, getMe);

export default router;
