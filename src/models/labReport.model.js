import mongoose from "mongoose";

const labReportSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: 
  { 
    type: mongoose.Schema.Types.ObjectId, ref: "User" 
  }, 
  fileUrl: { 
    type: String, required: true 
  },   
  uploadedAt: { 
    type: Date, default: Date.now 
  },   // date of upload
  extracted: { 
    type: Boolean, default: false 
  },   // true if OCR completed
  rawText: { 
    type: String, default: "" 
  },   // optional - OCR dump
  parameters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "HealthParameterLog"
  }]
})

const LabReport = mongoose.model("LabReport", labReportSchema);
export default LabReport;