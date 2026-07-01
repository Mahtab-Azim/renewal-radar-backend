import { Router } from 'express';
import { createItem, getItems, getItem, updateItem, deleteItem } from '../controllers/items';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Protect all routes in this router
router.use(authenticate as any);

router.post('/', createItem as any);
router.get('/', getItems as any);
router.get('/:id', getItem as any);
router.put('/:id', updateItem as any);
router.delete('/:id', deleteItem as any);

export default router;
