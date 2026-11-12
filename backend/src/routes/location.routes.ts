import { Hono } from "hono";
import { locationController } from "../controllers/location.controller";
import { tableController } from "../controllers/table.controller";
import { AppEnv } from "../types";

const locationRoutes = new Hono<AppEnv>();

locationRoutes.get("/check-name", locationController.checkLocationName);
locationRoutes.get("/", locationController.getLocations);
locationRoutes.get("/:id", locationController.getLocationById);
locationRoutes.get("/:id/statistics", locationController.getLocationStatistics);
locationRoutes.get("/:id/providers", locationController.getLocationProviders);
locationRoutes.delete("/:id/providers/:providerId", locationController.removeProviderFromLocation);
locationRoutes.put("/:id", locationController.updateLocation);
locationRoutes.post("/", locationController.createLocation);
locationRoutes.post("/:id/assign", locationController.assignProvider);
locationRoutes.delete("/:id", locationController.deleteLocation);

// Tables per location endpoints
locationRoutes.get("/:locationId/tables", tableController.getTablesByLocation);
locationRoutes.get("/:locationId/occupied-employees", tableController.getLocationOccupiedEmployees);
locationRoutes.post("/:locationId/tables", tableController.createTable);
locationRoutes.put("/:locationId/tables/:tableId", tableController.updateTable);
locationRoutes.delete("/:locationId/tables/:tableId", tableController.deleteTable);

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
