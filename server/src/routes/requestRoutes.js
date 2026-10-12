import { Router } from 'express';
import * as requestController from '../controllers/requestController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createRequestSchema,
  decisionSchema,
} from '../validators/requestValidator.js';

const router = Router();

// Protect all request routes with JWT authentication
router.use(authenticate);

// Create a new request (employee, manager, hr, admin)
router.post('/', validate(createRequestSchema), requestController.create);

// List requests with pagination and filters
router.get('/', requestController.list);

// Get single request details by ID
router.get('/:id', requestController.getById);

// Approve a request (Step 1 requires manager, Step 2 requires HR; admin can oversee)
router.post(
  '/:id/approve',
  authorizeRoles('manager', 'hr', 'admin'),
  validate(decisionSchema),
  requestController.approve
);

// Reject a request
router.post(
  '/:id/reject',
  authorizeRoles('manager', 'hr', 'admin'),
  validate(decisionSchema),
  requestController.reject
);

// Cancel a request (owner or admin only)
router.post('/:id/cancel', requestController.cancel);

// Retrieve audit trail for a request
router.get('/:id/audit', requestController.getAuditTrail);

export default router;
