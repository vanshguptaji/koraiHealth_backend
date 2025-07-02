import { Router } from "express";
import { 
  uploadLabReport, 
  getUserLabReports, 
  getFileText,
  retryTextExtraction,
  getAllFileTypes,
  deleteLabReport,
  getHealthParameters,
  getUserHealthTrends,
  getHealthDashboard
} from "../controllers/labReport.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

// Upload lab report
router.route("/upload").post(upload.any(), uploadLabReport);

// Get user's lab reports
router.route("/").get(getUserLabReports);

// Get text from specific file
router.route("/:reportId/text").get(getFileText);

// Retry text extraction
router.route("/:reportId/retry").post(retryTextExtraction);

// Get all file types summary
router.route("/types").get(getAllFileTypes);

// Delete lab report
router.route("/:reportId").delete(deleteLabReport);

// Get health parameters for a report
router.route("/:reportId/parameters").get(getHealthParameters);

// FIXED ROUTES - Match frontend expectations
router.route("/dashboard").get(getHealthDashboard);
router.route("/trends").get(getUserHealthTrends);

export default router;