import { Router } from "express";
import {
  loginHandler,
  registerHandler,
  logoutHandler,
  refreshTokenHandler,
  changePasswordHandler,
  getCurrentUserHandler,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", loginHandler);
router.post("/register", registerHandler);
router.post("/logout", authMiddleware(), logoutHandler);
router.post("/refresh-token", refreshTokenHandler);
router.post("/change-password", authMiddleware(), changePasswordHandler);
router.get("/me", authMiddleware(), getCurrentUserHandler);

export default router;
