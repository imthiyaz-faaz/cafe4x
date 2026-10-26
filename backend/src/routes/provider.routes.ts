import { Hono } from "hono";
import { providerController } from "../controllers/provider.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const providerRoutes = new Hono();

// All provider endpoints require an authenticated user with Admin or Provider role
providerRoutes.use("/*", requireAuth, requireRole("Admin", "Provider"));

providerRoutes.get("/dashboard", providerController.getDashboard);
providerRoutes.get("/orders", providerController.getOrders);
providerRoutes.patch("/orders/:id/status", providerController.updateOrderStatus);
providerRoutes.get("/locations", providerController.getAssignedLocations);

export default providerRoutes;
