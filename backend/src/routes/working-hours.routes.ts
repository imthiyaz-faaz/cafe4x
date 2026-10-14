import { Hono } from "hono";
import { workingHoursController } from "../controllers/working-hours.controller";

const workingHoursRoutes = new Hono();

workingHoursRoutes.get("/", workingHoursController.getWorkingHours);
workingHoursRoutes.put("/", workingHoursController.updateWorkingHours);
workingHoursRoutes.post("/", workingHoursController.updateWorkingHours);

export default workingHoursRoutes;
