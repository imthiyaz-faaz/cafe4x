import { Hono } from "hono";
import { locationController } from "../controllers/location.controller";
import { AppEnv } from "../types";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const locationRoutes = new Hono<AppEnv>();

// Publicly readable locations (for QR order location selector and authenticated users)
locationRoutes.get("/", locationController.getLocations);
locationRoutes.get("/:id", locationController.getLocationById);

// Admin-only location management
locationRoutes.post("/", requireAuth, requireRole("Admin"), locationController.createLocation);
locationRoutes.put("/:id", requireAuth, requireRole("Admin"), locationController.updateLocation);
locationRoutes.post("/:id/assign", requireAuth, requireRole("Admin"), locationController.assignProvider);
locationRoutes.delete("/:id", requireAuth, requireRole("Admin"), locationController.deleteLocation);

// Persistent seating plan endpoints (Admin role required)
locationRoutes.get("/:id/seats", requireAuth, requireRole("Admin"), locationController.getSeats);
locationRoutes.post("/:id/seats", requireAuth, requireRole("Admin"), locationController.saveSeat);
locationRoutes.post("/:id/seats/:seatId/unassign", requireAuth, requireRole("Admin"), locationController.unassignSeat);
locationRoutes.post("/:id/seats/:seatId/assign", requireAuth, requireRole("Admin"), locationController.assignSeat);
locationRoutes.delete("/:id/seats/:seatId", requireAuth, requireRole("Admin"), locationController.deleteSeat);

export default locationRoutes;
