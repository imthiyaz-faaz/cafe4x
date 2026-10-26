import { Hono } from "hono";
import { userController } from "../controllers/user.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const userRoutes = new Hono();

// Public QR token validation endpoint (must be declared before /:id)
userRoutes.get("/qr-token/:token", userController.validateQrToken);

// All subsequent user endpoints require authentication and Admin role
userRoutes.use("/*", requireAuth, requireRole("Admin"));

userRoutes.get("/", userController.getUsers);
userRoutes.get("/:id", userController.getUserById);
userRoutes.post("/", userController.createUser);
userRoutes.put("/:id", userController.updateUser);
userRoutes.delete("/:id", userController.deleteUser);

// Admin QR token management endpoints
userRoutes.post("/:id/qr-token/regenerate", userController.regenerateQrToken);
userRoutes.post("/:id/qr-token/revoke", userController.revokeQrToken);

export default userRoutes;
