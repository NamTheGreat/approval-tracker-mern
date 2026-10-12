import React, { useState, useEffect } from 'react';
import { api } from '../api/api.js';

export default function AuditModal({ requestId, onClose }) {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await api.get(`/requests/${requestId}/audit`);
        setAuditLogs(res.data.auditTrail || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAudit();
  }, [requestId]);

  function formatActionLabel(action) {
    switch (action) {
      case 'CREATED':
        return 'Created';
      case 'APPROVED_STEP_1':
        return 'Step 1 Approved (Manager)';
      case 'APPROVED_STEP_2':
        return 'Step 2 Approved (HR)';
      case 'REJECTED':
        return 'Rejected';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return action;
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Request Audit Trail</h3>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
            Loading audit history...
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && auditLogs.length === 0 && (
          <div className="empty-state">No audit logs found for this request.</div>
        )}

        {!loading && auditLogs.length > 0 && (
          <div className="timeline">
            {auditLogs.map((log) => (
              <div key={log._id} className="timeline-item">
                <div className="timeline-action">
                  {formatActionLabel(log.action)}{' '}
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 400,
                      color: 'var(--text-muted)',
                    }}
                  >
                    ({log.fromStatus} &rarr; {log.toStatus})
                  </span>
                </div>
                <div className="timeline-meta">
                  By <strong>{log.actor?.name || 'Unknown'}</strong> (
                  {log.actor?.role || 'user'}) &bull;{' '}
                  {new Date(log.timestamp).toLocaleString()}
                </div>
                {log.comment && (
                  <div className="timeline-comment">
                    <em>&ldquo;{log.comment}&rdquo;</em>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
