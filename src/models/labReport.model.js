import mongoose, { Schema } from "mongoose";

const labReportSchema = new Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    extracted: {
      type: Boolean,
      default: false,
    },
    rawText: {
      type: String,
      default: "",
    },
    parameters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthParameterLog"
    }]
  },
  { timestamps: true }
);

export const LabReport = mongoose.model("LabReport", labReportSchema);