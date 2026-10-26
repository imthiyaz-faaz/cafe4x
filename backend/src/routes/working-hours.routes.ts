import { Hono } from "hono";
import { workingHoursController } from "../controllers/working-hours.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const workingHoursRoutes = new Hono();

// Publicly readable working hours / break schedules (for user order validation and customer display)
workingHoursRoutes.get("/", workingHoursController.getWorkingHours);

// Updating working hours requires authenticated Admin
workingHoursRoutes.put("/", requireAuth, requireRole("Admin"), workingHoursController.updateWorkingHours);
workingHoursRoutes.post("/", requireAuth, requireRole("Admin"), workingHoursController.updateWorkingHours);

export default workingHoursRoutes;
