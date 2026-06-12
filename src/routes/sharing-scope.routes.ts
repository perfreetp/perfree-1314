import { Router } from "express";
import {
  createSharingScope,
  getSharingScope,
  updateSharingScope,
  deleteSharingScope,
  listSharingScopes,
  shareToDepartment,
  shareToUser,
  revokeSharing,
  checkPermission,
  getAccessibleEntities,
  getEntitySharings,
  updateSharingPermissions,
  getSharingStatistics,
} from "../controllers/sharingScope.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware());

router.get("/", listSharingScopes);
router.post("/", createSharingScope);
router.get("/statistics", getSharingStatistics);
router.post("/share-to-department", shareToDepartment);
router.post("/share-to-user", shareToUser);
router.post("/check-permission", checkPermission);
router.get("/accessible/:entityType", getAccessibleEntities);
router.get("/:id", getSharingScope);
router.put("/:id", updateSharingScope);
router.delete("/:id", deleteSharingScope);
router.post("/:id/revoke", revokeSharing);
router.put("/:id/permissions", updateSharingPermissions);
router.get("/:entityType/:entityId", getEntitySharings);

export default router;
