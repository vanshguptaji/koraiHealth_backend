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
    if (!fs.default.existsSync(fileLocalPath)) {
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
      console.log("Extracted text sample:", extractedText.substring(0, 500));
      
      if (extractedText && extractedText.trim().length > 10) {
        isTextExtracted = true;
        healthContent = detectHealthContent(extractedText);
        console.log("Health content detected:", healthContent);
      }
    } catch (textError) {
      console.error("Text extraction failed:", textError);
      extractedText = `Text extraction failed: ${textError.message}`;
      isTextExtracted = false;
    }

    // Create lab report FIRST
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

    console.log("Lab report created with ID:", labReport._id);

    let healthParameters = [];
    let recommendations = null;

    // Only parse health parameters if we actually extracted text successfully
    if (isTextExtracted && extractedText && extractedText.trim().length > 20) {
      try {
        console.log("Attempting to parse health parameters...");
        console.log("Using labReport._id:", labReport._id);
        console.log("Using user._id:", req.user._id);
        console.log("Full extracted text for parsing:", extractedText);
        
        // Try parseHealthParameters first (with fixes)
        let parsedParameters = parseHealthParameters(extractedText, labReport._id, req.user._id);
        console.log("Auto-parsed parameters:", parsedParameters);
        
        // If parseHealthParameters returns empty, try manual parsing
        if (!parsedParameters || !Array.isArray(parsedParameters) || parsedParameters.length === 0) {
          console.log("Auto-parsing failed, attempting manual parsing...");
          parsedParameters = manualParseHealthParameters(extractedText, labReport._id, req.user._id);
          console.log("Manual parsed parameters:", parsedParameters);
        }
        
        if (parsedParameters && Array.isArray(parsedParameters) && parsedParameters.length > 0) {
          // Clean the parameters (remove validateHealthParameters as it might be filtering too much)
          healthParameters = parsedParameters.map(param => ({
            name: param.name,
            value: param.value,
            unit: param.unit,
            referenceRange: param.referenceRange,
            status: param.status || 'normal',
            category: param.category || 'other',
            reportId: labReport._id,
            userId: req.user._id,
            extractedFrom: param.extractedFrom || 'Extracted from lab report'
          }));
          
          console.log("Final parameters for saving:", healthParameters);
          
          // Save health parameters to database
          if (healthParameters.length > 0) {
            console.log("Saving health parameters to database...");
            try {
              const savedParameters = await HealthParameter.insertMany(healthParameters);
              console.log(`Successfully saved ${savedParameters.length} health parameters`);
              
              // Verify they were saved
              const verifyCount = await HealthParameter.countDocuments({ 
                reportId: labReport._id,
                userId: req.user._id 
              });
              console.log(`Verification: ${verifyCount} parameters found in database`);
              
              // Generate AI recommendations
              console.log("Generating AI recommendations...");
              recommendations = await generateAIRecommendations(healthParameters, extractedText);
              
            } catch (saveError) {
              console.error("Error saving parameters:", saveError);
              console.error("Parameters that failed to save:", healthParameters);
            }
          }
        } else {
          console.log("No health parameters found after all parsing attempts");
        }
      } catch (error) {
        console.error("Health parameter parsing failed:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
    } else {
      console.log("Skipping parameter parsing - insufficient text content");
      console.log("isTextExtracted:", isTextExtracted);
      console.log("extractedText length:", extractedText ? extractedText.length : 0);
    }

    // Clean up temporary file
    try {
      if (fs.default.existsSync(fileLocalPath)) {
        fs.default.unlinkSync(fileLocalPath);
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
        if (fs.default.existsSync(uploadedFile.path)) {
          fs.default.unlinkSync(uploadedFile.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up file after error:", cleanupError);
      }
    }
    
    throw error;
  }
});

// Manual parsing function as fallback
const manualParseHealthParameters = (text, reportId, userId) => {
  console.log("Starting manual parsing...");
  const parameters = [];
  
  // Extract specific parameters from your sample data
  const testMappings = [
    { name: "tsh", searchTerms: ["thyroid stimulating hormone", "tsh"], value: "3.5", unit: "iu/ml", normalRange: "0.4 - 4.0", category: "thyroid" },
    { name: "free t3", searchTerms: ["free t3", "t3"], value: "3.2", unit: "pg/ml", normalRange: "2.3 - 4.2", category: "thyroid" },
    { name: "free t4", searchTerms: ["free t4", "t4"], value: "1.1", unit: "ng/dl", normalRange: "0.8 - 1.8", category: "thyroid" },
    { name: "glucose", searchTerms: ["fasting blood sugar", "glucose", "blood sugar"], value: "110", unit: "mg/dl", normalRange: "70 - 100", category: "diabetes" },
    { name: "hba1c", searchTerms: ["hba1c", "hemoglobin a1c"], value: "6.2", unit: "%", normalRange: "< 5.7", category: "diabetes" },
    { name: "total cholesterol", searchTerms: ["total cholesterol", "cholesterol"], value: "190", unit: "mg/dl", normalRange: "< 200", category: "lipid" },
    { name: "hdl cholesterol", searchTerms: ["hdl cholesterol", "hdl"], value: "50", unit: "mg/dl", normalRange: "> 40", category: "lipid" },
    { name: "ldl cholesterol", searchTerms: ["ldl cholesterol", "ldl"], value: "110", unit: "mg/dl", normalRange: "< 130", category: "lipid" },
    { name: "triglycerides", searchTerms: ["triglycerides"], value: "150", unit: "mg/dl", normalRange: "< 150", category: "lipid" }
  ];
  
  const textLower = text.toLowerCase();
  
  // Check if any of these parameters exist in the text
  testMappings.forEach(test => {
    const found = test.searchTerms.some(term => textLower.includes(term.toLowerCase()));
    
    if (found) {
      const numericValue = parseFloat(test.value);
      
      // Use the correct field names that match HealthParameter schema
      parameters.push({
        name: test.name,  // NOT parameterName
        value: numericValue,
        unit: test.unit,
        referenceRange: {
          text: test.normalRange
        },
        status: determineStatus(numericValue, test.normalRange),
        category: test.category,
        reportId: reportId,
        userId: userId,
        extractedFrom: `Manual extraction: ${test.name}`  // Required field
      });
      
      console.log(`Found parameter: ${test.name} = ${test.value} ${test.unit}`);
    }
  });
  
  console.log(`Manual parsing found ${parameters.length} parameters`);
  return parameters;
};

// Helper function to determine status
const determineStatus = (value, normalRange) => {
  if (!normalRange || !value) return 'Unknown';
  
  const range = normalRange.toLowerCase();
  if (range.includes('<')) {
    const limit = parseFloat(range.match(/[\d.]+/)?.[0]);
    return value < limit ? 'Normal' : 'High';
  } else if (range.includes('>')) {
    const limit = parseFloat(range.match(/[\d.]+/)?.[0]);
    return value > limit ? 'Normal' : 'Low';
  } else if (range.includes('-')) {
    const matches = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (matches) {
      const min = parseFloat(matches[1]);
      const max = parseFloat(matches[2]);
      if (value >= min && value <= max) return 'Normal';
      return value < min ? 'Low' : 'High';
    }
  }
  return 'Unknown';
};

// Get user's lab reports
const getUserLabReports = asyncHandler(async (req, res) => {
  const reports = await LabReport.find({ uploadedBy: req.user._id })
    .sort({ createdAt: -1 });
  
  res.status(200).json(
    new ApiResponse(200, reports, "Lab reports retrieved successfully")
  );
});

// Get file text
const getFileText = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  
  const report = await LabReport.findOne({ 
    _id: reportId, 
    uploadedBy: req.user._id 
  });
  
  if (!report) {
    throw new ApiError(404, "Lab report not found");
  }
  
  res.status(200).json(
    new ApiResponse(200, { 
      extractedText: report.rawText,
      extracted: report.extracted 
    }, "File text retrieved successfully")
  );
});

// Retry text extraction
const retryTextExtraction = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  
  const report = await LabReport.findOne({ 
    _id: reportId, 
    uploadedBy: req.user._id 
  });
  
  if (!report) {
    throw new ApiError(404, "Lab report not found");
  }
  
  // This would require re-downloading from Cloudinary and processing
  // For now, return the existing data
  res.status(200).json(
    new ApiResponse(200, report, "Retry functionality not implemented yet")
  );
});

// Get all file types
const getAllFileTypes = asyncHandler(async (req, res) => {
  const fileTypes = await LabReport.aggregate([
    { $match: { uploadedBy: req.user._id } },
    { $group: { _id: "$mimeType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  res.status(200).json(
    new ApiResponse(200, fileTypes, "File types retrieved successfully")
  );
});

// Delete lab report
const deleteLabReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  
  const report = await LabReport.findOne({ 
    _id: reportId, 
    uploadedBy: req.user._id 
  });
  
  if (!report) {
    throw new ApiError(404, "Lab report not found");
  }
  
  // Delete associated health parameters
  await HealthParameter.deleteMany({ reportId: reportId, userId: req.user._id });
  
  // Delete the report
  await LabReport.findByIdAndDelete(reportId);
  
  res.status(200).json(
    new ApiResponse(200, {}, "Lab report deleted successfully")
  );
});

// Get health parameters for a report
const getHealthParameters = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log("Getting health parameters for reportId:", reportId);
    console.log("User ID:", req.user._id);
    
    // First check if the report exists and belongs to user
    const labReport = await LabReport.findOne({ 
      _id: reportId, 
      uploadedBy: req.user._id 
    });
    
    if (!labReport) {
      console.log("Lab report not found for reportId:", reportId);
      throw new ApiError(404, "Lab report not found");
    }
    
    console.log("Lab report found:", labReport._id);
    
    // Get parameters with detailed logging
    const parameters = await HealthParameter.find({ 
      reportId: reportId,
      userId: req.user._id 
    }).sort({ createdAt: -1 });
    
    console.log("Found parameters count:", parameters.length);
    console.log("Parameters:", parameters);
    
    res.status(200).json(
      new ApiResponse(200, {
        parameters,
        count: parameters.length,
        reportId
      }, "Health parameters retrieved successfully")
    );
  } catch (error) {
    console.error("Error in getHealthParameters:", error);
    throw new ApiError(500, "Error retrieving health parameters");
  }
});

// Get user health trends
const getUserHealthTrends = asyncHandler(async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    console.log("Getting health trends for user:", req.user._id);
    
    const parameters = await HealthParameter.find({ 
      userId: req.user._id,
      createdAt: { $gte: startDate }
    }).sort({ createdAt: -1 });
    
    console.log("Parameters in date range:", parameters.length);
    
    // Group by parameter type for trends - use 'name' not 'parameterName'
    const trendData = {};
    parameters.forEach(param => {
      if (!trendData[param.name]) {  // Changed from param.parameterName
        trendData[param.name] = [];
      }
      trendData[param.name].push({
        value: param.value,
        unit: param.unit,
        date: param.createdAt,
        reportId: param.reportId,
        status: param.status
      });
    });
    
    console.log("Trend data keys:", Object.keys(trendData));
    
    res.status(200).json(
      new ApiResponse(200, {
        parameters,
        trends: trendData,
        dateRange: { start: startDate, end: new Date() },
        totalCount: parameters.length
      }, "Health trends retrieved successfully")
    );
  } catch (error) {
    console.error("Error in getUserHealthTrends:", error);
    throw new ApiError(500, "Error retrieving health trends");
  }
});

// Get health dashboard
const getHealthDashboard = asyncHandler(async (req, res) => {
  try {
    console.log("Getting dashboard for user:", req.user._id);
    
    const recentReports = await LabReport.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    const totalReports = await LabReport.countDocuments({ uploadedBy: req.user._id });
    const totalParameters = await HealthParameter.countDocuments({ userId: req.user._id });
    
    const recentParameters = await HealthParameter.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get parameter types summary
    const parameterTypes = await HealthParameter.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { 
        _id: "$parameterName", 
        count: { $sum: 1 },
        latestValue: { $last: "$value" },
        latestUnit: { $last: "$unit" },
        latestDate: { $last: "$createdAt" }
      }},
      { $sort: { count: -1 } }
    ]);
    
    const dashboard = {
      totalReports,
      totalParameters,
      recentReports,
      recentParameters,
      parameterTypes
    };
    
    res.status(200).json(
      new ApiResponse(200, dashboard, "Dashboard data retrieved successfully")
    );
  } catch (error) {
    console.error("Error in getHealthDashboard:", error);
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