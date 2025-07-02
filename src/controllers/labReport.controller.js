import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { LabReport } from "../models/labReport.model.js";
import { User } from "../models/user.model.js";
import { HealthParameter } from "../models/healthParameter.model.js";
import { 
  extractTextFromFileSimple as extractTextFromFile,
  detectHealthContent 
} from "../utils/ocrProcessor.js";
import { parseHealthParameters, generateAIRecommendations } from "../utils/healthAnalyzer.js";

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
  let healthParameters = [];
  let recommendations = null;

  try {
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
      
      // Check if extraction was actually successful
      if (extractedText && !extractedText.includes('failed') && !extractedText.includes('error') && extractedText.length > 20) {
        const healthContent = detectHealthContent(extractedText);
        isTextExtracted = true;
        console.log("Text extraction successful for:", req.file.originalname);
        console.log("Health content detected:", healthContent);
        console.log("Extracted text preview:", extractedText.substring(0, 200));
      } else {
        isTextExtracted = false;
        console.log("Text extraction returned error or no content:", extractedText?.substring(0, 100));
      }
    } else {
      console.log("File type not supported for text extraction:", req.file.mimetype);
      extractedText = `File type ${req.file.mimetype} does not support text extraction.`;
    }
  } catch (error) {
    console.error("OCR extraction failed:", error.message);
    extractedText = `Text extraction failed: ${error.message}`;
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

  // Only parse health parameters if we actually extracted text successfully
  if (isTextExtracted && extractedText && extractedText.length > 20) {
    try {
      console.log("Attempting to parse health parameters...");
      let healthParameters = parseHealthParameters(extractedText, labReport._id, req.user._id);
      
      // Validate and clean the parameters
      healthParameters = validateHealthParameters(healthParameters);
      
      // Save health parameters to database
      if (healthParameters && healthParameters.length > 0) {
        await HealthParameter.insertMany(healthParameters);
        
        // Generate AI recommendations
        recommendations = generateAIRecommendations(healthParameters, extractedText);
        
        console.log(`Successfully extracted ${healthParameters.length} health parameters`);
        console.log("Categories found:", [...new Set(healthParameters.map(p => p.category))]);
        
        // Log the extracted parameters for debugging
        healthParameters.forEach(param => {
          console.log(`- ${param.name}: ${param.value} ${param.unit} (${param.status})`);
        });
      } else {
        console.log("No health parameters found in extracted text");
        console.log("Text sample for debugging:", extractedText.substring(0, 500));
      }
    } catch (error) {
      console.error("Health parameter parsing failed:", error);
    }
  }

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
      extractedText: isTextExtracted ? extractedText : null,
      healthParameters: healthParameters || [],
      recommendations: recommendations,
      parametersFound: (healthParameters && healthParameters.length) || 0
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

const getHealthParameters = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const parameters = await HealthParameter.find({
    reportId: reportId,
    userId: req.user._id
  }).sort({ createdAt: -1 });

  if (parameters.length === 0) {
    throw new ApiError(404, "No health parameters found for this report");
  }

  // Generate recommendations for these parameters
  const recommendations = generateAIRecommendations(parameters, "");

  return res
    .status(200)
    .json(new ApiResponse(200, {
      parameters: parameters,
      recommendations: recommendations,
      totalParameters: parameters.length
    }, "Health parameters fetched successfully"));
});

const getUserHealthTrends = asyncHandler(async (req, res) => {
  const { parameterName, days = 30 } = req.query;
  
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - parseInt(days));

  let query = {
    userId: req.user._id,
    createdAt: { $gte: dateLimit }
  };

  if (parameterName) {
    query.name = parameterName.toLowerCase();
  }

  const parameters = await HealthParameter.find(query)
    .sort({ createdAt: 1 })
    .populate('reportId', 'originalName createdAt');

  // Group by parameter name for trending
  const trendData = parameters.reduce((acc, param) => {
    if (!acc[param.name]) {
      acc[param.name] = [];
    }
    acc[param.name].push({
      value: param.value,
      unit: param.unit,
      status: param.status,
      date: param.createdAt,
      reportName: param.reportId?.originalName
    });
    return acc;
  }, {});

  return res
    .status(200)
    .json(new ApiResponse(200, {
      trendData: trendData,
      totalDataPoints: parameters.length,
      dateRange: {
        from: dateLimit,
        to: new Date()
      }
    }, "Health trends fetched successfully"));
});

const getHealthDashboard = asyncHandler(async (req, res) => {
  // Get latest parameters for each type
  const latestParameters = await HealthParameter.aggregate([
    { $match: { userId: req.user._id } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$name",
        latest: { $first: "$$ROOT" }
      }
    },
    { $replaceRoot: { newRoot: "$latest" } }
  ]);

  // Generate overall recommendations
  const recommendations = generateAIRecommendations(latestParameters, "");

  // Get parameter categories summary
  const categorySummary = latestParameters.reduce((acc, param) => {
    if (!acc[param.category]) {
      acc[param.category] = { normal: 0, abnormal: 0, critical: 0 };
    }
    
    if (param.status.includes('critical')) {
      acc[param.category].critical++;
    } else if (['high', 'low'].includes(param.status)) {
      acc[param.category].abnormal++;
    } else {
      acc[param.category].normal++;
    }
    
    return acc;
  }, {});

  return res
    .status(200)
    .json(new ApiResponse(200, {
      latestParameters: latestParameters,
      recommendations: recommendations,
      categorySummary: categorySummary,
      totalParameters: latestParameters.length
    }, "Health dashboard data fetched successfully"));
});

export {
  uploadLabReport,
  getUserLabReports,
  getFileText,
  retryTextExtraction,
  getAllFileTypes,
  deleteLabReport,
  getHealthParameters,
  getUserHealthTrends,
  getHealthDashboard
};