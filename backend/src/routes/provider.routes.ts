import { Hono } from "hono";
import { providerController } from "../controllers/provider.controller";
import { AppEnv } from "../types";

const providerRoutes = new Hono<AppEnv>();

providerRoutes.get("/dashboard", providerController.getDashboard);
providerRoutes.get("/orders", providerController.getOrders);
providerRoutes.patch("/orders/:id/status", providerController.updateOrderStatus);
providerRoutes.get("/locations", providerController.getAssignedLocations);
providerRoutes.get("/location/:locationId/summary", providerController.getLocationSummary);

export default providerRoutes;
