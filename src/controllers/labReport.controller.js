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
import { 
  parseHealthParameters, 
  generateAIRecommendations,
  validateHealthParameters 
} from "../utils/healthAnalyzer.js";

const uploadLabReport = asyncHandler(async (req, res) => {
  try {
    console.log("Upload request received");
    console.log("Files:", req.files);
    console.log("File:", req.file);
    console.log("User:", req.user);

    // Handle both req.file and req.files
    const uploadedFile = req.file || (req.files && req.files[0]);

    if (!uploadedFile) {
      throw new ApiError(400, "File is required");
    }

    const fileLocalPath = uploadedFile.path;
    console.log("File local path:", fileLocalPath);
    
    // Check if file exists before processing
    const fs = await import('fs');
    if (!fs.existsSync(fileLocalPath)) {
      console.error("File not found at path:", fileLocalPath);
      throw new ApiError(400, "Uploaded file not found");
    }
    
    // Upload to cloudinary
    console.log("Uploading to Cloudinary...");
    const uploadResult = await uploadOnCloudinary(fileLocalPath);
    
    if (!uploadResult) {
      throw new ApiError(400, "Error while uploading file to cloudinary");
    }

    console.log("Cloudinary upload successful:", uploadResult.secure_url);

    // Extract text from file
    console.log("Starting text extraction...");
    let extractedText = "";
    let isTextExtracted = false;
    let healthContent = null;
    
    try {
      extractedText = await extractTextFromFile(fileLocalPath, uploadedFile.mimetype);
      console.log("Text extraction completed. Length:", extractedText.length);
      
      if (extractedText && extractedText.length > 10) {
        isTextExtracted = true;
        healthContent = detectHealthContent(extractedText);
        console.log("Health content detected:", healthContent);
      }
    } catch (textError) {
      console.error("Text extraction failed:", textError);
      extractedText = `Text extraction failed: ${textError.message}`;
      isTextExtracted = false;
    }

    // Create lab report
    console.log("Creating lab report in database...");
    const labReport = await LabReport.create({
      fileName: uploadResult.public_id,
      originalName: uploadedFile.originalname,
      fileUrl: uploadResult.secure_url,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      uploadedBy: req.user._id,
      extracted: isTextExtracted,
      rawText: extractedText,
    });

    console.log("Lab report created:", labReport._id);

    let healthParameters = [];
    let recommendations = null;

    // Only parse health parameters if we actually extracted text successfully
    if (isTextExtracted && extractedText && extractedText.length > 20) {
      try {
        console.log("Attempting to parse health parameters...");
        healthParameters = parseHealthParameters(extractedText, labReport._id, req.user._id);
        
        // Validate and clean the parameters
        healthParameters = validateHealthParameters(healthParameters);
        
        // Save health parameters to database
        if (healthParameters && healthParameters.length > 0) {
          console.log("Saving health parameters to database...");
          await HealthParameter.insertMany(healthParameters);
          
          // Generate AI recommendations
          console.log("Generating AI recommendations...");
          recommendations = generateAIRecommendations(healthParameters, extractedText);
          
          console.log(`Successfully extracted ${healthParameters.length} health parameters`);
        } else {
          console.log("No health parameters found in extracted text");
        }
      } catch (error) {
        console.error("Health parameter parsing failed:", error);
      }
    }

    // Clean up temporary file
    try {
      if (fs.existsSync(fileLocalPath)) {
        fs.unlinkSync(fileLocalPath);
        console.log("Temporary file cleaned up");
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temporary file:", cleanupError);
    }

    console.log("Sending response...");
    res.status(201).json(
      new ApiResponse(201, {
        labReport,
        healthParameters,
        recommendations,
        healthContent,
        extractedText: isTextExtracted ? extractedText.substring(0, 1000) : extractedText
      }, "Lab report uploaded and processed successfully")
    );

  } catch (error) {
    console.error("Upload lab report error:", error);
    
    // Clean up temporary file if it exists
    const uploadedFile = req.file || (req.files && req.files[0]);
    if (uploadedFile && uploadedFile.path) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(uploadedFile.path)) {
          fs.unlinkSync(uploadedFile.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up file after error:", cleanupError);
      }
    }
    
    throw error;
  }
});

const getUserLabReports = asyncHandler(async (req, res) => {
  try {
    const labReports = await LabReport.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 });
    
    res.status(200).json(
      new ApiResponse(200, labReports, "Lab reports retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving lab reports");
  }
});

const getFileText = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    const labReport = await LabReport.findOne({ 
      _id: reportId, 
      uploadedBy: req.user._id 
    });
    
    if (!labReport) {
      throw new ApiError(404, "Lab report not found");
    }
    
    res.status(200).json(
      new ApiResponse(200, { 
        text: labReport.rawText,
        extracted: labReport.extracted 
      }, "Text retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving text");
  }
});

const retryTextExtraction = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    const labReport = await LabReport.findOne({ 
      _id: reportId, 
      uploadedBy: req.user._id 
    });
    
    if (!labReport) {
      throw new ApiError(404, "Lab report not found");
    }
    
    // For now, just return the existing text
    res.status(200).json(
      new ApiResponse(200, labReport, "Text extraction retry completed")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrying text extraction");
  }
});

const getAllFileTypes = asyncHandler(async (req, res) => {
  try {
    const fileTypes = await LabReport.aggregate([
      { $match: { uploadedBy: req.user._id } },
      { $group: { _id: "$mimeType", count: { $sum: 1 } } }
    ]);
    
    res.status(200).json(
      new ApiResponse(200, fileTypes, "File types retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving file types");
  }
});

const deleteLabReport = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    const labReport = await LabReport.findOneAndDelete({ 
      _id: reportId, 
      uploadedBy: req.user._id 
    });
    
    if (!labReport) {
      throw new ApiError(404, "Lab report not found");
    }
    
    // Also delete associated health parameters
    await HealthParameter.deleteMany({ reportId: reportId });
    
    res.status(200).json(
      new ApiResponse(200, {}, "Lab report deleted successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error deleting lab report");
  }
});

const getHealthParameters = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    const parameters = await HealthParameter.find({ 
      reportId: reportId,
      userId: req.user._id 
    });
    
    res.status(200).json(
      new ApiResponse(200, parameters, "Health parameters retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving health parameters");
  }
});

const getUserHealthTrends = asyncHandler(async (req, res) => {
  try {
    const parameters = await HealthParameter.find({ 
      userId: req.user._id 
    }).sort({ createdAt: -1 });
    
    res.status(200).json(
      new ApiResponse(200, parameters, "Health trends retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving health trends");
  }
});

const getHealthDashboard = asyncHandler(async (req, res) => {
  try {
    const recentReports = await LabReport.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    const totalReports = await LabReport.countDocuments({ uploadedBy: req.user._id });
    const totalParameters = await HealthParameter.countDocuments({ userId: req.user._id });
    
    const dashboard = {
      totalReports,
      totalParameters,
      recentReports
    };
    
    res.status(200).json(
      new ApiResponse(200, dashboard, "Dashboard data retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving dashboard data");
  }
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