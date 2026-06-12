import { Router } from "express";
import {
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
  getUsersByDepartmentHandler,
  assignRoleHandler,
  toggleUserStatusHandler,
  getUserPermissionsHandler,
} from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware());

router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.get("/department/:departmentId", getUsersByDepartmentHandler);
router.get("/:id", getUserHandler);
router.put("/:id", updateUserHandler);
router.delete("/:id", deleteUserHandler);
router.post("/:id/role", assignRoleHandler);
router.post("/:id/toggle-status", toggleUserStatusHandler);
router.get("/:id/permissions", getUserPermissionsHandler);

export default router;
