import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/api.js';

export default function RequestCard({ request, onUpdated, onViewAudit }) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const isOwner = request.createdBy?._id === user.id || request.createdBy === user.id;
  const isPending = request.status === 'pending';

  // Step 1: Manager or Admin
  // Step 2: HR or Admin
  const canApproveCurrentStep =
    isPending &&
    !isOwner &&
    ((request.currentStep === 1 && (user.role === 'manager' || user.role === 'admin')) ||
      (request.currentStep === 2 && (user.role === 'hr' || user.role === 'admin')));

  const canCancel = isPending && (isOwner || user.role === 'admin');

  async function handleApprove() {
    setActionError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/requests/${request._id}/approve`, { comment });
      onUpdated(res.data.request);
      setComment('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setActionError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/requests/${request._id}/reject`, { comment });
      onUpdated(res.data.request);
      setComment('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this pending request?')) {
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/requests/${request._id}/cancel`);
      onUpdated(res.data.request);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Stepper state calculations
  const step1 = request.steps?.find((s) => s.step === 1);
  const step2 = request.steps?.find((s) => s.step === 2);

  const isStep1Done = step1?.decision === 'approved';
  const isStep1Rejected = step1?.decision === 'rejected';
  const isStep1Active = isPending && request.currentStep === 1;

  const isStep2Done = step2?.decision === 'approved';
  const isStep2Rejected = step2?.decision === 'rejected';
  const isStep2Active = isPending && request.currentStep === 2;

  return (
    <div className="request-card">
      <div className="request-card-header">
        <div className="request-meta">
          <span className={`type-badge type-${request.type}`}>{request.type}</span>
          <span className={`status-badge status-${request.status}`}>
            &bull; {request.status}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Requested on {new Date(request.createdAt).toLocaleDateString()}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onViewAudit(request._id)}
        >
          Audit Trail
        </button>
      </div>

      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        Requested by: <strong>{request.createdBy?.name || 'User'}</strong> (
        {request.createdBy?.email || 'N/A'})
      </div>

      <div className="request-title">{request.details}</div>

      <div className="request-Highlight">
        {request.type === 'expense' ? (
          <span>Amount: <strong>${Number(request.amount).toFixed(2)}</strong></span>
        ) : (
          <span>
            Dates: <strong>{new Date(request.startDate).toLocaleDateString()}</strong> &rarr;{' '}
            <strong>{new Date(request.endDate).toLocaleDateString()}</strong>
          </span>
        )}
      </div>

      {/* 2-Step Sequential Approval Visual Stepper */}
      <div className="stepper">
        {/* Step 1 Node */}
        <div
          className={`step-node ${
            isStep1Done ? 'done' : isStep1Rejected ? 'rejected' : isStep1Active ? 'active' : ''
          }`}
        >
          <div className="step-circle">
            {isStep1Done ? '✓' : isStep1Rejected ? '✕' : '1'}
          </div>
          <div>
            <div>Step 1: Manager</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isStep1Done
                ? `Approved by ${step1.approver?.name || 'Manager'}`
                : isStep1Rejected
                ? 'Rejected'
                : isStep1Active
                ? 'Awaiting Decision'
                : 'Pending'}
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className={`step-connector ${isStep1Done ? 'done' : ''}`} />

        {/* Step 2 Node */}
        <div
          className={`step-node ${
            isStep2Done ? 'done' : isStep2Rejected ? 'rejected' : isStep2Active ? 'active' : ''
          }`}
        >
          <div className="step-circle">
            {isStep2Done ? '✓' : isStep2Rejected ? '✕' : '2'}
          </div>
          <div>
            <div>Step 2: HR</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isStep2Done
                ? `Approved by ${step2.approver?.name || 'HR'}`
                : isStep2Rejected
                ? 'Rejected'
                : isStep2Active
                ? 'Awaiting Decision'
                : 'Queued after Step 1'}
            </div>
          </div>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {/* Contextual Action Controls */}
      <div className="request-footer">
        {canApproveCurrentStep ? (
          <div className="decision-box">
            <input
              type="text"
              className="decision-input"
              placeholder={`Decision note/comment (optional)...`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
            />
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={handleApprove}
              disabled={submitting}
            >
              Approve (Step {request.currentStep})
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleReject}
              disabled={submitting}
            >
              Reject
            </button>
          </div>
        ) : isPending && isOwner ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Your request is currently in queue (Step {request.currentStep}).
            </span>
            {canCancel && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel Request
              </button>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {request.status === 'approved'
              ? 'Request has been fully approved by Manager & HR.'
              : request.status === 'rejected'
              ? 'Request was rejected and is now locked.'
              : request.status === 'cancelled'
              ? 'Request was cancelled by the employee.'
              : `Awaiting Step ${request.currentStep} decision.`}
          </div>
        )}
      </div>
    </div>
  );
}
