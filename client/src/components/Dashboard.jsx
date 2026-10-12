import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/api.js';
import RequestCard from './RequestCard.jsx';
import CreateRequestModal from './CreateRequestModal.jsx';
import AuditModal from './AuditModal.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  const defaultScope =
    user.role === 'employee'
      ? 'mine'
      : user.role === 'admin'
      ? 'all'
      : 'pending_for_me';

  const [scope, setScope] = useState(defaultScope);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [auditRequestId, setAuditRequestId] = useState(null);

  // Sync default scope when switching demo roles
  useEffect(() => {
    if (user.role === 'employee') {
      setScope('mine');
    } else if (user.role === 'admin') {
      setScope('all');
    } else {
      setScope('pending_for_me');
    }
    setPage(1);
  }, [user.role]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('page', String(page));
      params.set('limit', '5');
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await api.get(`/requests?${params.toString()}`);
      setRequests(res.data.requests || []);
      setPagination(
        res.data.pagination || { total: 0, page: 1, limit: 5, totalPages: 0 }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope, page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handleRequestCreated() {
    setScope('mine');
    setPage(1);
    fetchRequests();
  }

  function handleRequestUpdated() {
    fetchRequests();
  }

  return (
    <main className="container">
      <div className="dashboard-top">
        <div className="dashboard-title">
          <h2>Leave &amp; Expense Requests</h2>
          <p>
            {user.role === 'employee' &&
              'Submit leave or expense requests and track your 2-step approval progress.'}
            {user.role === 'manager' &&
              'Manager Queue: Review and approve Step 1 pending requests.'}
            {user.role === 'hr' &&
              'HR Queue: Review and finalize Step 2 requests approved by managers.'}
            {user.role === 'admin' &&
              'Admin Console: Oversee all organization requests, approvals, and audit trails.'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Request
        </button>
      </div>

      {/* Controls Bar: Scope Tabs & Filters */}
      <div className="controls-bar">
        <div className="tabs">
          {['manager', 'hr', 'admin'].includes(user.role) && (
            <button
              type="button"
              className={`tab-btn ${scope === 'pending_for_me' ? 'active' : ''}`}
              onClick={() => {
                setScope('pending_for_me');
                setStatusFilter('');
                setPage(1);
              }}
            >
              Pending For Me ({user.role === 'manager' ? 'Step 1' : user.role === 'hr' ? 'Step 2' : 'Queue'})
            </button>
          )}

          <button
            type="button"
            className={`tab-btn ${scope === 'mine' ? 'active' : ''}`}
            onClick={() => {
              setScope('mine');
              setPage(1);
            }}
          >
            My Requests
          </button>

          {user.role === 'admin' && (
            <button
              type="button"
              className={`tab-btn ${scope === 'all' ? 'active' : ''}`}
              onClick={() => {
                setScope('all');
                setPage(1);
              }}
            >
              All Requests
            </button>
          )}
        </div>

        <div className="filters">
          {scope !== 'pending_for_me' && (
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.42rem 0.75rem', fontSize: '0.82rem' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}

          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.42rem 0.75rem', fontSize: '0.82rem' }}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="expense">Expense</option>
            <option value="leave">Leave</option>
          </select>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={fetchRequests}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
            No requests found
          </div>
          <p style={{ fontSize: '0.85rem' }}>
            {scope === 'pending_for_me'
              ? 'You are all caught up! No pending requests require your approval right now.'
              : 'No requests match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="request-list">
          {requests.map((req) => (
            <RequestCard
              key={req._id}
              request={req}
              onUpdated={handleRequestUpdated}
              onViewAudit={(id) => setAuditRequestId(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &larr; Previous
          </button>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Page <strong>{pagination.page}</strong> of{' '}
            <strong>{pagination.totalPages}</strong> ({pagination.total} total)
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next &rarr;
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateRequestModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRequestCreated}
        />
      )}

      {auditRequestId && (
        <AuditModal
          requestId={auditRequestId}
          onClose={() => setAuditRequestId(null)}
        />
      )}
    </main>
  );
}
