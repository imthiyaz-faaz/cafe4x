import { Hono } from "hono";
import { orderController } from "../controllers/order.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const orderRoutes = new Hono();

// Order creation: open to public ordering sessions and privileged users (internal validation handles tokens/hours)
orderRoutes.post("/", orderController.createOrder);

// Admin & Provider order viewing and updates (enforce authentication and authorized roles)
orderRoutes.get("/", requireAuth, requireRole("Admin", "Provider"), orderController.getOrders);
orderRoutes.get("/employees", requireAuth, requireRole("Admin", "Provider"), orderController.getOrderEmployees);
orderRoutes.post("/bulk-status", requireAuth, requireRole("Admin", "Provider"), orderController.bulkUpdateStatus);
orderRoutes.get("/:id", requireAuth, requireRole("Admin", "Provider"), orderController.getOrderById);
orderRoutes.put("/:id", requireAuth, requireRole("Admin", "Provider"), orderController.updateOrder);
orderRoutes.patch("/:id", requireAuth, requireRole("Admin", "Provider"), orderController.updateOrder);
orderRoutes.patch("/:id/status", requireAuth, requireRole("Admin", "Provider"), orderController.updateStatus);
orderRoutes.put("/:id/status", requireAuth, requireRole("Admin", "Provider"), orderController.updateStatus);

// Admin-only order deletion
orderRoutes.delete("/:id", requireAuth, requireRole("Admin"), orderController.deleteOrder);

export default orderRoutes;
