import mongoose, { Schema } from "mongoose";

const healthParameterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    referenceRange: {
      min: { type: Number },
      max: { type: Number },
      text: { type: String } 
    },
    status: {
      type: String,
      enum: ['normal', 'high', 'low', 'critical_high', 'critical_low', 'abnormal'],
      default: 'normal'
    },
    category: {
      type: String,
      enum: ['blood', 'urine', 'lipid', 'liver', 'kidney', 'diabetes', 'thyroid', 'cardiac', 'other'],
      default: 'other'
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabReport",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    extractedFrom: {
      type: String, // The original text line where this was extracted
      required: true
    }
  },
  { timestamps: true }
);

// Index for efficient queries
healthParameterSchema.index({ userId: 1, name: 1, createdAt: -1 });

export const HealthParameter = mongoose.model("HealthParameter", healthParameterSchema);