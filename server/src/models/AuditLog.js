import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required'],
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required'],
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: {
        values: [
          'CREATED',
          'APPROVED_STEP_1',
          'APPROVED_STEP_2',
          'REJECTED',
          'CANCELLED',
        ],
        message: 'Invalid audit action',
      },
    },
    fromStatus: {
      type: String,
      required: true,
    },
    toStatus: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

// Fast chronological retrieval for a specific request's audit trail
auditLogSchema.index({ requestId: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
