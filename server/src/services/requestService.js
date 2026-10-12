import { Request } from '../models/Request.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../errors/AppError.js';

export async function createRequest(user, data) {
  const newRequest = await Request.create({
    type: data.type,
    details: data.details,
    ...(data.type === 'expense'
      ? { amount: data.amount }
      : { startDate: data.startDate, endDate: data.endDate }),
    createdBy: user.id,
    status: 'pending',
    currentStep: 1,
    steps: [],
  });

  await AuditLog.create({
    requestId: newRequest._id,
    actor: user.id,
    action: 'CREATED',
    fromStatus: 'none',
    toStatus: 'pending',
    comment: 'Request created by employee',
  });

  return newRequest;
}

export async function getRequests(user, query = {}) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  const scope = query.scope || (user.role === 'employee' ? 'mine' : 'pending_for_me');

  if (scope === 'mine') {
    filter.createdBy = user.id;
  } else if (scope === 'pending_for_me') {
    if (user.role === 'employee') {
      return { requests: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    }
    filter.status = 'pending';
    filter.createdBy = { $ne: user.id };
    if (user.role === 'manager') filter.currentStep = 1;
    if (user.role === 'hr') filter.currentStep = 2;
  } else if (scope === 'all' && user.role !== 'admin') {
    throw new AppError(
      'Forbidden: Only administrators can view all requests across the organization',
      403
    );
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

export async function getRequestById(requestId, user) {
  const request = await Request.findById(requestId)
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  const isOwner = request.createdBy._id.toString() === user.id;
  if (!isOwner && !['manager', 'hr', 'admin'].includes(user.role)) {
    throw new AppError('Forbidden: You do not have permission to view this request', 403);
  }

  return request;
}

async function decideRequest(requestId, user, decision, comment = '') {
  const current = await Request.findById(requestId);
  if (!current) {
    throw new AppError('Request not found', 404);
  }

  const verb = decision === 'approved' ? 'approve' : 'reject';
  const noun = decision === 'approved' ? 'approval' : 'rejection';

  if (current.createdBy.toString() === user.id) {
    throw new AppError(`Forbidden: Approvers cannot ${verb} their own request`, 403);
  }

  if (current.status !== 'pending') {
    throw new AppError(`Request is already ${current.status} and cannot be ${decision}`, 409);
  }

  if (current.currentStep === 1 && user.role !== 'manager' && user.role !== 'admin') {
    throw new AppError(`Forbidden: Step 1 ${noun} requires a Manager role`, 403);
  }
  if (current.currentStep === 2 && user.role !== 'hr' && user.role !== 'admin') {
    throw new AppError(`Forbidden: Step 2 ${noun} requires an HR role`, 403);
  }

  const isReject = decision === 'rejected';
  const isStep1 = current.currentStep === 1;

  const setFields = isReject
    ? { status: 'rejected' }
    : isStep1
    ? { currentStep: 2 }
    : { status: 'approved' };

  const toStatus = isReject ? 'rejected' : isStep1 ? 'pending' : 'approved';
  const action = isReject ? 'REJECTED' : isStep1 ? 'APPROVED_STEP_1' : 'APPROVED_STEP_2';

  // Atomic concurrency-safe update: filter requires expected status AND currentStep
  const updatedRequest = await Request.findOneAndUpdate(
    { _id: requestId, status: 'pending', currentStep: current.currentStep },
    {
      $set: setFields,
      $push: {
        steps: {
          step: current.currentStep,
          approver: user.id,
          decision,
          comment,
          decidedAt: new Date(),
        },
      },
    },
    { new: true }
  )
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!updatedRequest) {
    throw new AppError(
      'Conflict: Request was already processed by another approver or step has changed',
      409
    );
  }

  await AuditLog.create({
    requestId,
    actor: user.id,
    action,
    fromStatus: 'pending',
    toStatus,
    comment,
  });

  return updatedRequest;
}

export const approveRequest = (id, user, comment) =>
  decideRequest(id, user, 'approved', comment);

export const rejectRequest = (id, user, comment) =>
  decideRequest(id, user, 'rejected', comment);

export async function cancelRequest(requestId, user) {
  const current = await Request.findById(requestId);
  if (!current) {
    throw new AppError('Request not found', 404);
  }

  if (current.createdBy.toString() !== user.id && user.role !== 'admin') {
    throw new AppError('Forbidden: Only the request creator can cancel this request', 403);
  }

  if (current.status !== 'pending') {
    throw new AppError(`Cannot cancel request that is already ${current.status}`, 409);
  }

  const updatedRequest = await Request.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    { $set: { status: 'cancelled' } },
    { new: true }
  )
    .populate('createdBy', 'name email role')
    .populate('steps.approver', 'name email role');

  if (!updatedRequest) {
    throw new AppError(
      'Conflict: Request was already processed and can no longer be cancelled',
      409
    );
  }

  await AuditLog.create({
    requestId,
    actor: user.id,
    action: 'CANCELLED',
    fromStatus: 'pending',
    toStatus: 'cancelled',
    comment: 'Request cancelled by requester',
  });

  return updatedRequest;
}

export async function getRequestAuditTrail(requestId, user) {
  await getRequestById(requestId, user);
  return AuditLog.find({ requestId })
    .sort({ timestamp: 1 })
    .populate('actor', 'name email role');
}
