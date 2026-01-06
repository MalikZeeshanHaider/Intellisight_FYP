import express from 'express';
import {
  getAllCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
} from '../controllers/camera.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createCameraSchema,
  updateCameraSchema,
  getCameraSchema,
  deleteCameraSchema,
} from '../validators/camera.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getAllCameras);
router.get('/:id', validateRequest(getCameraSchema), getCameraById);
router.post('/', validateRequest(createCameraSchema), createCamera);
router.put('/:id', validateRequest(updateCameraSchema), updateCamera);
router.delete('/:id', validateRequest(deleteCameraSchema), deleteCamera);

export default router;
