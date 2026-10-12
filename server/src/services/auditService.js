import { AuditLog } from '../models/AuditLog.js';

/**
 * Creates an immutable audit log entry for request state transitions.
 * @param {Object} params
 * @param {string} params.requestId - Associated Request ID
 * @param {string} params.actor - ID of the user performing the action
 * @param {string} params.action - Event action type ('CREATED', 'APPROVED_STEP_1', etc.)
 * @param {string} params.fromStatus - Previous status
 * @param {string} params.toStatus - Resulting status
 * @param {string} [params.comment=''] - Optional comment/note
 * @returns {Promise<AuditLog>}
 */
export async function createAuditEntry({
  requestId,
  actor,
  action,
  fromStatus,
  toStatus,
  comment = '',
}) {
  return AuditLog.create({
    requestId,
    actor,
    action,
    fromStatus,
    toStatus,
    comment,
    timestamp: new Date(),
  });
}

/**
 * Fetches the chronological audit history for a given request.
 * @param {string} requestId
 * @returns {Promise<Array>}
 */
export async function getAuditHistoryByRequestId(requestId) {
  return AuditLog.find({ requestId })
    .sort({ timestamp: 1 })
    .populate('actor', 'name email role');
}
