import React, { useState } from 'react';
import { api } from '../api/api.js';

export default function CreateRequestModal({ onClose, onCreated }) {
  const [type, setType] = useState('expense');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        type,
        details,
      };

      if (type === 'expense') {
        payload.amount = Number(amount);
      } else {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }

      const res = await api.post('/requests', payload);
      onCreated(res.data.request);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Submit New Approval Request</h3>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="req-type">
              Request Type
            </label>
            <select
              id="req-type"
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="expense">Expense Reimbursement</option>
              <option value="leave">Leave / Time Off</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="req-details">
              Reason / Details
            </label>
            <textarea
              id="req-details"
              className="form-textarea"
              rows={3}
              placeholder={
                type === 'expense'
                  ? 'Describe the expense and business purpose...'
                  : 'Specify the reason for your leave...'
              }
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
              minLength={5}
            />
          </div>

          {type === 'expense' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="req-amount">
                Amount ($)
              </label>
              <input
                id="req-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="250.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="req-start">
                  Start Date
                </label>
                <input
                  id="req-start"
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="req-end">
                  End Date
                </label>
                <input
                  id="req-end"
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div
            style={{
              background: 'var(--bg-subtle)',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginBottom: '1rem',
            }}
          >
            <strong>Approval Route:</strong> Step 1 (Manager) &rarr; Step 2 (HR)
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
