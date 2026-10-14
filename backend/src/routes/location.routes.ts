import { Hono } from "hono";
import { locationController } from "../controllers/location.controller";

const locationRoutes = new Hono();

locationRoutes.get("/", locationController.getLocations);
locationRoutes.get("/:id", locationController.getLocationById);
locationRoutes.post("/", locationController.createLocation);
locationRoutes.put("/:id", locationController.updateLocation);
locationRoutes.post("/:id/assign", locationController.assignProvider);
locationRoutes.delete("/:id", locationController.deleteLocation);

export default locationRoutes;
