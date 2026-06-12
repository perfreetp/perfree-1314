import { Router } from "express";
import {
  createDepartmentHandler,
  getDepartmentHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
  listDepartmentsHandler,
  getDepartmentTreeHandler,
  getUsersByDepartmentTreeHandler,
} from "../controllers/department.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware());

router.get("/", listDepartmentsHandler);
router.post("/", createDepartmentHandler);
router.get("/:id", getDepartmentHandler);
router.put("/:id", updateDepartmentHandler);
router.delete("/:id", deleteDepartmentHandler);
router.get("/:id/tree", getDepartmentTreeHandler);
router.get("/:id/users", getUsersByDepartmentTreeHandler);

export default router;
