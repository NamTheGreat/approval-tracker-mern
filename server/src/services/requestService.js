import { Request } from '../models/Request.js';
import { AppError } from '../errors/AppError.js';
import { createAuditEntry, getAuditHistoryByRequestId } from './auditService.js';

/**
 * Creates a new leave or expense request and records the initial audit log.
 * @param {Object} user - The authenticated user creating the request
 * @param {Object} data - Validated request body
 * @returns {Promise<Request>}
 */
export async function createRequest(user, data) {
  const requestPayload = {
    type: data.type,
    details: data.details,
    createdBy: user.id,
    status: 'pending',
    currentStep: 1,
    steps: [],
  };

  if (data.type === 'expense') {
    requestPayload.amount = data.amount;
  } else if (data.type === 'leave') {
    requestPayload.startDate = data.startDate;
    requestPayload.endDate = data.endDate;
  }

  const newRequest = await Request.create(requestPayload);

  // Record initial audit entry
  await createAuditEntry({
    requestId: newRequest._id,
    actor: user.id,
    action: 'CREATED',
    fromStatus: 'none',
    toStatus: 'pending',
    comment: 'Request created by employee',
  });

  return newRequest;
}

/**
 * Lists requests with pagination, filters, and role-based scoping.
 * @param {Object} user - Authenticated user
 * @param {Object} query - Validated query parameters
 * @returns {Promise<{ requests: Array, pagination: Object }>}
 */
export async function getRequests(user, query = {}) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  // Scoping logic
  const scope = query.scope || (user.role === 'employee' ? 'mine' : 'pending_for_me');

  if (scope === 'mine') {
    filter.createdBy = user.id;
  } else if (scope === 'pending_for_me') {
    filter.status = 'pending';
    // Cannot approve own request
    filter.createdBy = { $ne: user.id };

    if (user.role === 'manager') {
      filter.currentStep = 1;
    } else if (user.role === 'hr') {
      filter.currentStep = 2;
    } else if (user.role === 'admin') {
      // Admins can see pending for any step
    } else {
      // Regular employees have no pending approvals for them
      return {
        requests: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }
  } else if (scope === 'all') {
    if (user.role !== 'admin') {
      throw new AppError('Forbidden: Only administrators can view all requests across the organization', 403);
    }
  }

  const [requests, total] = await Promise.all([
    Request.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email role')
      .populate('steps.approver', 'name email role'),
    Request.countDocuments(filter),
  ]);

  return {
    requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

/**
 * Retrieves a single request by ID with permission checks.
 * @param {string} requestId
 * @param {Object} user
 * @returns {Promise<Request>}
 */
export async function getRequestById(requestId, user) {
  const request = await Request.findById(requestId)
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Permission check: owner, approvers (manager, hr), and admin can view
  const isOwner = request.createdBy._id.toString() === user.id;
  const isApproverOrAdmin = ['manager', 'hr', 'admin'].includes(user.role);

  if (!isOwner && !isApproverOrAdmin) {
    throw new AppError('Forbidden: You do not have permission to view this request', 403);
  }

  return request;
}

/**
 * Approves a request sequentially using atomic findOneAndUpdate.
 * @param {string} requestId
 * @param {Object} user
 * @param {string} comment
 * @returns {Promise<Request>}
 */
export async function approveRequest(requestId, user, comment = '') {
  // 1. Fetch current document to validate business prerequisites
  const current = await Request.findById(requestId);
  if (!current) {
    throw new AppError('Request not found', 404);
  }

  // Guard: Approver cannot approve their own request
  if (current.createdBy.toString() === user.id) {
    throw new AppError('Forbidden: Approvers cannot approve their own request', 403);
  }

  // Guard: Request must be currently pending
  if (current.status !== 'pending') {
    throw new AppError(
      `Request is already ${current.status} and cannot be approved`,
      409
    );
  }

  // Guard: Role vs Step verification
  if (current.currentStep === 1) {
    if (user.role !== 'manager' && user.role !== 'admin') {
      throw new AppError('Forbidden: Step 1 approval requires a Manager role', 403);
    }
  } else if (current.currentStep === 2) {
    if (user.role !== 'hr' && user.role !== 'admin') {
      throw new AppError('Forbidden: Step 2 approval requires an HR role', 403);
    }
  } else {
    throw new AppError('Invalid approval step sequence', 409);
  }

  // 2. Prepare Atomic Update
  // Filter MUST include _id, status: 'pending', AND expected currentStep
  // This guarantees race conditions cannot advance or double-approve
  let filter;
  let update;
  let toStatus;
  let action;

  if (current.currentStep === 1) {
    filter = { _id: requestId, status: 'pending', currentStep: 1 };
    update = {
      $set: { currentStep: 2 },
      $push: {
        steps: {
          step: 1,
          approver: user.id,
          decision: 'approved',
          comment,
          decidedAt: new Date(),
        },
      },
    };
    toStatus = 'pending';
    action = 'APPROVED_STEP_1';
  } else {
    filter = { _id: requestId, status: 'pending', currentStep: 2 };
    update = {
      $set: { status: 'approved' },
      $push: {
        steps: {
          step: 2,
          approver: user.id,
          decision: 'approved',
          comment,
          decidedAt: new Date(),
        },
      },
    };
    toStatus = 'approved';
    action = 'APPROVED_STEP_2';
  }

  const updatedRequest = await Request.findOneAndUpdate(filter, update, {
    new: true,
  })
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!updatedRequest) {
    throw new AppError(
      'Conflict: Request was already processed by another approver or step has changed',
      409
    );
  }

  // 3. Record Audit Log
  await createAuditEntry({
    requestId,
    actor: user.id,
    action,
    fromStatus: 'pending',
    toStatus,
    comment,
  });

  return updatedRequest;
}

/**
 * Rejects a request using atomic findOneAndUpdate.
 * @param {string} requestId
 * @param {Object} user
 * @param {string} comment
 * @returns {Promise<Request>}
 */
export async function rejectRequest(requestId, user, comment = '') {
  const current = await Request.findById(requestId);
  if (!current) {
    throw new AppError('Request not found', 404);
  }

  // Guard: Approver cannot reject their own request
  if (current.createdBy.toString() === user.id) {
    throw new AppError('Forbidden: Approvers cannot reject their own request', 403);
  }

  // Guard: Must be pending
  if (current.status !== 'pending') {
    throw new AppError(
      `Request is already ${current.status} and cannot be rejected`,
      409
    );
  }

  // Guard: Role authorization for current step
  if (current.currentStep === 1) {
    if (user.role !== 'manager' && user.role !== 'admin') {
      throw new AppError('Forbidden: Step 1 rejection requires a Manager role', 403);
    }
  } else if (current.currentStep === 2) {
    if (user.role !== 'hr' && user.role !== 'admin') {
      throw new AppError('Forbidden: Step 2 rejection requires an HR role', 403);
    }
  }

  // Atomic Update
  const filter = { _id: requestId, status: 'pending', currentStep: current.currentStep };
  const update = {
    $set: { status: 'rejected' },
    $push: {
      steps: {
        step: current.currentStep,
        approver: user.id,
        decision: 'rejected',
        comment,
        decidedAt: new Date(),
      },
    },
  };

  const updatedRequest = await Request.findOneAndUpdate(filter, update, {
    new: true,
  })
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!updatedRequest) {
    throw new AppError(
      'Conflict: Request was already processed by another approver or status has changed',
      409
    );
  }

  // Record Audit Log
  await createAuditEntry({
    requestId,
    actor: user.id,
    action: 'REJECTED',
    fromStatus: 'pending',
    toStatus: 'rejected',
    comment,
  });

  return updatedRequest;
}

/**
 * Cancels a pending request (owner or admin only) using atomic findOneAndUpdate.
 * @param {string} requestId
 * @param {Object} user
 * @returns {Promise<Request>}
 */
export async function cancelRequest(requestId, user) {
  const current = await Request.findById(requestId);
  if (!current) {
    throw new AppError('Request not found', 404);
  }

  // Guard: Only owner or admin can cancel
  const isOwner = current.createdBy.toString() === user.id;
  if (!isOwner && user.role !== 'admin') {
    throw new AppError('Forbidden: Only the request creator can cancel this request', 403);
  }

  // Guard: Request must still be pending
  if (current.status !== 'pending') {
    throw new AppError(
      `Cannot cancel request that is already ${current.status}`,
      409
    );
  }

  // Atomic Update
  const filter = { _id: requestId, status: 'pending' };
  const update = { $set: { status: 'cancelled' } };

  const updatedRequest = await Request.findOneAndUpdate(filter, update, {
    new: true,
  })
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!updatedRequest) {
    throw new AppError(
      'Conflict: Request was already processed and can no longer be cancelled',
      409
    );
  }

  // Record Audit Log
  await createAuditEntry({
    requestId,
    actor: user.id,
    action: 'CANCELLED',
    fromStatus: 'pending',
    toStatus: 'cancelled',
    comment: 'Request cancelled by requester',
  });

  return updatedRequest;
}

/**
 * Retrieves the complete audit history for a request.
 * @param {string} requestId
 * @param {Object} user
 * @returns {Promise<Array>}
 */
export async function getRequestAuditTrail(requestId, user) {
  // Ensure user has permission to view this request
  await getRequestById(requestId, user);

  return getAuditHistoryByRequestId(requestId);
}
