import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { LabReport } from "../models/labReport.model.js";
import { User } from "../models/user.model.js";
import { extractTextFromFile } from "../utils/ocrProcessor.js";
const uploadLabReport = asyncHandler(async (req, res) => {

  if (!req.file) {
    throw new ApiError(400, "File is required");
  }

  const fileLocalPath = req.file.path;
  
  // Upload to cloudinary
  const uploadResult = await uploadOnCloudinary(fileLocalPath);
  
  if (!uploadResult) {
    throw new ApiError(500, "Failed to upload file to cloudinary");
  }

  // Try to extract text for supported file types
  let extractedText = "";
  let isTextExtracted = false;
  
  try {
    // Check if file type supports text extraction
    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp'
    ];

    if (supportedTypes.includes(req.file.mimetype)) {
      extractedText = await extractTextFromFile(fileLocalPath, req.file.mimetype);
      isTextExtracted = true;
      console.log("Text extraction successful for:", req.file.originalname);
    } else {
      console.log("File type not supported for text extraction:", req.file.mimetype);
    }
  } catch (error) {
    console.error("OCR extraction failed:", error.message);
    // Continue without extracted text if OCR fails
    isTextExtracted = false;
  }

  // Create lab report document
  const labReport = await LabReport.create({
    fileName: uploadResult.public_id,
    originalName: req.file.originalname,
    fileUrl: uploadResult.secure_url,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedBy: req.user._id,
    extracted: isTextExtracted,
    rawText: extractedText,
  });

  // Add lab report to user's FilesUploaded array
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $push: { FilesUploaded: labReport._id }
    },
    { new: true }
  );

  return res
    .status(201)
    .json(new ApiResponse(201, {
      ...labReport.toObject(),
      textExtractionSupported: isTextExtracted,
      extractedText: extractedText || null
    }, `File uploaded successfully${isTextExtracted ? ' with text extraction' : ''}`));
});

const getUserLabReports = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: "FilesUploaded",
      select: "fileName originalName fileUrl fileSize mimeType createdAt extracted rawText"
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user.FilesUploaded, "Files fetched successfully"));
});

const getFileText = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const labReport = await LabReport.findOne({
    _id: reportId,
    uploadedBy: req.user._id
  }).select("rawText extracted originalName mimeType");

  if (!labReport) {
    throw new ApiError(404, "File not found or unauthorized");
  }

  if (!labReport.extracted) {
    return res
      .status(200)
      .json(new ApiResponse(200, {
        reportId: labReport._id,
        originalName: labReport.originalName,
        mimeType: labReport.mimeType,
        extracted: false,
        text: null,
        message: "Text extraction not available for this file type"
      }, "File info fetched successfully"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {
      reportId: labReport._id,
      originalName: labReport.originalName,
      mimeType: labReport.mimeType,
      extracted: labReport.extracted,
      text: labReport.rawText
    }, "File text fetched successfully"));
});

const retryTextExtraction = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const labReport = await LabReport.findOne({
    _id: reportId,
    uploadedBy: req.user._id
  });

  if (!labReport) {
    throw new ApiError(404, "File not found or unauthorized");
  }

  // Check if file type supports text extraction
  const supportedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp'
  ];

  if (!supportedTypes.includes(labReport.mimeType)) {
    throw new ApiError(400, "File type does not support text extraction");
  }

  // For retry, we would need to download from Cloudinary and process
  // This is a simplified response - in production, you'd download and reprocess
  return res
    .status(200)
    .json(new ApiResponse(200, {
      message: "To retry text extraction, please re-upload the file"
    }, "Retry extraction info"));
});

const getAllFileTypes = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: "FilesUploaded",
      select: "originalName mimeType fileSize extracted createdAt"
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Group files by type
  const filesByType = user.FilesUploaded.reduce((acc, file) => {
    const type = file.mimeType.split('/')[0]; // 'image', 'application', etc.
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push({
      id: file._id,
      name: file.originalName,
      mimeType: file.mimeType,
      size: file.fileSize,
      hasText: file.extracted,
      uploadedAt: file.createdAt
    });
    return acc;
  }, {});

  return res
    .status(200)
    .json(new ApiResponse(200, {
      totalFiles: user.FilesUploaded.length,
      filesByType: filesByType,
      supportedTextExtraction: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/webp'
      ]
    }, "File types summary fetched successfully"));
});

const deleteLabReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  // Find and delete the lab report
  const labReport = await LabReport.findOneAndDelete({
    _id: reportId,
    uploadedBy: req.user._id
  });

  if (!labReport) {
    throw new ApiError(404, "File not found or unauthorized");
  }

  // Remove from user's FilesUploaded array
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $pull: { FilesUploaded: reportId }
    }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "File deleted successfully"));
});

export {
  uploadLabReport,
  getUserLabReports,
  getFileText,
  retryTextExtraction,
  getAllFileTypes,
  deleteLabReport
};