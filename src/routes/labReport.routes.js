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
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

// File operations
router.route("/upload").post(upload.single("file"), uploadLabReport);
router.route("/").get(getUserLabReports);
router.route("/types").get(getAllFileTypes);
router.route("/:reportId/text").get(getFileText);
router.route("/:reportId/retry-extraction").post(retryTextExtraction);
router.route("/:reportId").delete(deleteLabReport);

router.route("/:reportId/parameters").get(getHealthParameters);
router.route("/health/trends").get(getUserHealthTrends);
router.route("/health/dashboard").get(getHealthDashboard);

export default router;