import * as requestService from '../services/requestService.js';

/**
 * Handle creation of a new leave or expense request.
 * POST /requests
 */
export async function create(req, res, next) {
  try {
    const request = await requestService.createRequest(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle listing requests with filters and pagination.
 * GET /requests
 */
export async function list(req, res, next) {
  try {
    const { requests, pagination } = await requestService.getRequests(
      req.user,
      req.query
    );
    res.status(200).json({
      success: true,
      data: {
        requests,
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle retrieving a specific request by ID.
 * GET /requests/:id
 */
export async function getById(req, res, next) {
  try {
    const request = await requestService.getRequestById(
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: { request },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle approving a request at the current step.
 * POST /requests/:id/approve
 */
export async function approve(req, res, next) {
  try {
    const request = await requestService.approveRequest(
      req.params.id,
      req.user,
      req.body?.comment || ''
    );
    res.status(200).json({
      success: true,
      message: 'Request approved successfully',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle rejecting a request.
 * POST /requests/:id/reject
 */
export async function reject(req, res, next) {
  try {
    const request = await requestService.rejectRequest(
      req.params.id,
      req.user,
      req.body?.comment || ''
    );
    res.status(200).json({
      success: true,
      message: 'Request rejected successfully',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle cancelling a pending request by the creator.
 * POST /requests/:id/cancel
 */
export async function cancel(req, res, next) {
  try {
    const request = await requestService.cancelRequest(
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      message: 'Request cancelled successfully',
      data: { request },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle fetching audit trail for a request.
 * GET /requests/:id/audit
 */
export async function getAuditTrail(req, res, next) {
  try {
    const auditTrail = await requestService.getRequestAuditTrail(
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: { auditTrail },
    });
  } catch (error) {
    next(error);
  }
}
