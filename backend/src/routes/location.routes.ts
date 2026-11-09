import { Hono } from "hono";
import { locationController } from "../controllers/location.controller";
import { AppEnv } from "../types";

const locationRoutes = new Hono<AppEnv>();

locationRoutes.get("/check-name", locationController.checkLocationName);
locationRoutes.get("/", locationController.getLocations);
locationRoutes.get("/:id", locationController.getLocationById);
locationRoutes.post("/", locationController.createLocation);
locationRoutes.put("/:id", locationController.updateLocation);
locationRoutes.post("/:id/assign", locationController.assignProvider);
locationRoutes.delete("/:id", locationController.deleteLocation);

// Persistent seating plan endpoints
locationRoutes.get("/:id/seats/check-employee-email", locationController.checkEmployeeEmail);
locationRoutes.get("/:id/seats", locationController.getSeats);
locationRoutes.post("/:id/seats", locationController.saveSeat);
locationRoutes.post("/:id/seats/:seatId/unassign", locationController.unassignSeat);
locationRoutes.post("/:id/seats/:seatId/assign", locationController.assignSeat);
locationRoutes.delete("/:id/seats/:seatId", locationController.deleteSeat);

// Employee seat assignment table endpoints
locationRoutes.get("/:id/assignments", locationController.getAssignments);
locationRoutes.delete("/:id/assignments/:assignmentId", locationController.removeAssignment);

export default locationRoutes;
