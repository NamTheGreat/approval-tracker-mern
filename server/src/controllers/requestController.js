import * as requestService from '../services/requestService.js';

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const create = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.user, req.body);
  res.status(201).json({
    success: true,
    message: 'Request submitted successfully',
    data: { request },
  });
});

export const list = asyncHandler(async (req, res) => {
  const data = await requestService.getRequests(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req, res) => {
  const request = await requestService.getRequestById(req.params.id, req.user);
  res.status(200).json({ success: true, data: { request } });
});

export const approve = asyncHandler(async (req, res) => {
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
});

export const reject = asyncHandler(async (req, res) => {
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
});

export const cancel = asyncHandler(async (req, res) => {
  const request = await requestService.cancelRequest(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Request cancelled successfully',
    data: { request },
  });
});

export const getAuditTrail = asyncHandler(async (req, res) => {
  const auditTrail = await requestService.getRequestAuditTrail(
    req.params.id,
    req.user
  );
  res.status(200).json({ success: true, data: { auditTrail } });
});
