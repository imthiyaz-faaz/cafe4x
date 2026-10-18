import { Hono } from "hono";
import { locationController } from "../controllers/location.controller";
import { AppEnv } from "../types";

const locationRoutes = new Hono<AppEnv>();

locationRoutes.get("/", locationController.getLocations);
locationRoutes.get("/:id", locationController.getLocationById);
locationRoutes.post("/", locationController.createLocation);
locationRoutes.put("/:id", locationController.updateLocation);
locationRoutes.post("/:id/assign", locationController.assignProvider);
locationRoutes.delete("/:id", locationController.deleteLocation);

// Persistent seating plan endpoints
locationRoutes.get("/:id/seats", locationController.getSeats);
locationRoutes.post("/:id/seats", locationController.saveSeat);

export default locationRoutes;
