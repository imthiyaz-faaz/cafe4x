import { Hono } from "hono";
import { providerController } from "../controllers/provider.controller";

const providerRoutes = new Hono();

providerRoutes.get("/dashboard", providerController.getDashboard);
providerRoutes.get("/orders", providerController.getOrders);
providerRoutes.patch("/orders/:id/status", providerController.updateOrderStatus);
providerRoutes.get("/locations", providerController.getAssignedLocations);

export default providerRoutes;
