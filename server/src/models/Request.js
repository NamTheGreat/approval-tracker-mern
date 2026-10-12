import mongoose from 'mongoose';

const approvalStepSchema = new mongoose.Schema(
  {
    step: {
      type: Number,
      required: true,
      enum: [1, 2], // 1 = Manager, 2 = HR
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    decision: {
      type: String,
      required: true,
      enum: ['approved', 'rejected'],
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    decidedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Request type is required'],
      enum: {
        values: ['leave', 'expense'],
        message: "Request type must be either 'leave' or 'expense'",
      },
    },
    details: {
      type: String,
      required: [true, 'Details are required'],
      trim: true,
      maxlength: [1000, 'Details cannot exceed 1000 characters'],
    },
    amount: {
      type: Number,
      min: [0, 'Amount cannot be negative'],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Request creator is required'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['pending', 'approved', 'rejected', 'cancelled'],
        message: 'Status must be pending, approved, rejected, or cancelled',
      },
      default: 'pending',
      index: true,
    },
    currentStep: {
      type: Number,
      required: true,
      enum: [1, 2],
      default: 1,
      index: true,
    },
    steps: {
      type: [approvalStepSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal queries and atomic locking
requestSchema.index({ status: 1, currentStep: 1 });
requestSchema.index({ createdBy: 1, createdAt: -1 });

export const Request = mongoose.model('Request', requestSchema);
