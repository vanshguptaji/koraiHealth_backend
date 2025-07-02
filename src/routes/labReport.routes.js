import { Router } from "express";
import { uploadLabReport } from "../controllers/labReport.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

// Upload lab report - use .any() to accept any field name
router.route("/upload").post(upload.any(), uploadLabReport);

export default router;