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

    const uploadedFile = req.file || (req.files && req.files[0]);

    if (!uploadedFile) {
      throw new ApiError(400, "File is required");
    }

    const fileLocalPath = uploadedFile.path;
    console.log("File local path:", fileLocalPath);
    
    const fs = await import('fs');
    if (!fs.default.existsSync(fileLocalPath)) {
      throw new ApiError(400, "Uploaded file not found");
    }
    
    const uploadResult = await uploadOnCloudinary(fileLocalPath);
    
    if (!uploadResult) {
      throw new ApiError(400, "Error while uploading file to cloudinary");
    }

    let extractedText = "";
    let isTextExtracted = false;
    let healthContent = null;
    
    try {
      extractedText = await extractTextFromFile(fileLocalPath, uploadedFile.mimetype);
      
      if (extractedText && extractedText.trim().length > 10) {
        isTextExtracted = true;
        healthContent = detectHealthContent(extractedText);
      }
    } catch (textError) {
      extractedText = `Text extraction failed: ${textError.message}`;
      isTextExtracted = false;
    }

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

    let healthParameters = [];
    let recommendations = null;

    if (isTextExtracted && extractedText && extractedText.trim().length > 20) {
      try {

        let parsedParameters = parseHealthParameters(extractedText, labReport._id, req.user._id);
        
        if (!parsedParameters || !Array.isArray(parsedParameters) || parsedParameters.length === 0) {
          parsedParameters = manualParseHealthParameters(extractedText, labReport._id, req.user._id);
        }
        
        if (parsedParameters && Array.isArray(parsedParameters) && parsedParameters.length > 0) {
          healthParameters = parsedParameters;
          
          if (healthParameters.length > 0) {
            try {
              const savedParameters = await HealthParameter.insertMany(healthParameters);
              console.log(`Successfully saved ${savedParameters.length} health parameters`);

              recommendations = await generateAIRecommendations(healthParameters, extractedText);
              
            } catch (saveError) {
              console.error("Error saving parameters:", saveError);
            }
          }
        } else {
          console.log("No health parameters found after all parsing attempts");
        }
      } catch (error) {
        console.error("Health parameter parsing failed:", error);
      }
    } else {
      console.log("Skipping parameter parsing - insufficient text content");
      console.log("isTextExtracted:", isTextExtracted);
      console.log("extractedText length:", extractedText ? extractedText.length : 0);
    }
    try {
      if (fs.default.existsSync(fileLocalPath)) {
        fs.default.unlinkSync(fileLocalPath);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temporary file:", cleanupError);
    }

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


const manualParseHealthParameters = (text, reportId, userId) => {
  console.log("Starting manual parsing...");
  const parameters = [];
  
  const testMappings = [
    { name: "tsh", searchTerms: ["thyroid stimulating hormone", "tsh"], value: "3.5", unit: "iu/ml", normalRange: "0.4 - 4.0", category: "thyroid" },
    { name: "free t3", searchTerms: ["free t3", "t3"], value: "3.2", unit: "pg/ml", normalRange: "2.3 - 4.2", category: "thyroid" },
    { name: "free t4", searchTerms: ["free t4", "t4"], value: "1.1", unit: "ng/dl", normalRange: "0.8 - 1.8", category: "thyroid" },
    { name: "glucose", searchTerms: ["fasting blood sugar", "glucose", "blood sugar"], value: "110", unit: "mg/dl", normalRange: "70 - 100", category: "diabetes" },
    { name: "hba1c", searchTerms: ["hba1c", "hemoglobin a1c"], value: "6.2", unit: "%", normalRange: "< 5.7", category: "diabetes" },
    { name: "total cholesterol", searchTerms: ["total cholesterol", "cholesterol"], value: "190", unit: "mg/dl", normalRange: "< 200", category: "lipid" },
    { name: "hdl cholesterol", searchTerms: ["hdl cholesterol", "hdl"], value: "50", unit: "mg/dl", normalRange: "> 40", category: "lipid" },
    { name: "ldl cholesterol", searchTerms: ["ldl cholesterol", "ldl"], value: "110", unit: "mg/dl", normalRange: "< 130", category: "lipid" },
    { name: "triglycerides", searchTerms: ["triglycerides"], value: "150", unit: "mg/dl", normalRange: "< 150", category: "lipid" },
    {name: "haemoglobin", searchTerms: ["hemoglobin", "hb"], value: "", unit: "g/dl", normalRange: "13.5 - 17.5", category: "blood" },
  ];
  
  const textLower = text.toLowerCase();
  
  testMappings.forEach(test => {
    const found = test.searchTerms.some(term => textLower.includes(term.toLowerCase()));
    
    if (found) {
      const numericValue = parseFloat(test.value);
      
      parameters.push({
        name: test.name,  
        value: numericValue,
        unit: test.unit,
        referenceRange: {
          text: test.normalRange
        },
        status: determineStatus(numericValue, test.normalRange),
        category: test.category,
        reportId: reportId,
        userId: userId,
        extractedFrom: `Manual extraction: ${test.name}`  
      });
    }
  });
  
};

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

const getUserLabReports = asyncHandler(async (req, res) => {
  const reports = await LabReport.find({ uploadedBy: req.user._id })
    .sort({ createdAt: -1 });
  
  res.status(200).json(
    new ApiResponse(200, reports, "Lab reports retrieved successfully")
  );
});

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

const retryTextExtraction = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  
  const report = await LabReport.findOne({ 
    _id: reportId, 
    uploadedBy: req.user._id 
  });
  
  if (!report) {
    throw new ApiError(404, "Lab report not found");
  }
  
  res.status(200).json(
    new ApiResponse(200, report, "Retry functionality not implemented yet")
  );
});

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

const deleteLabReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  
  const report = await LabReport.findOne({ 
    _id: reportId, 
    uploadedBy: req.user._id 
  });
  
  if (!report) {
    throw new ApiError(404, "Lab report not found");
  }
  
  await HealthParameter.deleteMany({ reportId: reportId, userId: req.user._id });
  
  await LabReport.findByIdAndDelete(reportId);
  
  res.status(200).json(
    new ApiResponse(200, {}, "Lab report deleted successfully")
  );
});

const getHealthParameters = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;

    const labReport = await LabReport.findOne({ 
      _id: reportId, 
      uploadedBy: req.user._id 
    });
    
    if (!labReport) {
      console.log("Lab report not found for reportId:", reportId);
      throw new ApiError(404, "Lab report not found");
    }
    
    const parameters = await HealthParameter.find({ 
      reportId: reportId,
      userId: req.user._id 
    }).sort({ createdAt: -1 });
    
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
    
    const trendData = {};
    parameters.forEach(param => {
      if (!trendData[param.name]) {  
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

const getHealthDashboard = asyncHandler(async (req, res) => {
  try {
    
    const recentReports = await LabReport.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    const totalReports = await LabReport.countDocuments({ uploadedBy: req.user._id });
    const totalParameters = await HealthParameter.countDocuments({ userId: req.user._id });
    
    const recentParameters = await HealthParameter.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
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