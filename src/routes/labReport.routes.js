import { Router } from "express";
import { 
  uploadLabReport, 
  getUserLabReports, 
  getFileText,
  retryTextExtraction,
  getAllFileTypes,
  deleteLabReport 
} from "../controllers/labReport.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/upload").post(
  upload.single("file"), 
  uploadLabReport
);
router.route("/").get(getUserLabReports);
router.route("/types").get(getAllFileTypes);
router.route("/:reportId/text").get(getFileText);
router.route("/:reportId/retry-extraction").post(retryTextExtraction);
router.route("/:reportId").delete(deleteLabReport);

export default router;