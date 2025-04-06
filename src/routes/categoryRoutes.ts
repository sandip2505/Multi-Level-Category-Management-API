import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// authentication middleware to all category routes
router.use(authenticate);

router.post('/', categoryController.createCategory);
router.get('/', categoryController.getAllCategories);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

export default router;