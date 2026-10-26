import { Hono } from "hono";
import { organizationController } from "../controllers/organization.controller";
import { requireAuth } from "../middleware/auth.middleware";

const organizationRoutes = new Hono();

// All organization management routes require authenticated user
organizationRoutes.use("/*", requireAuth);

organizationRoutes.get("/", organizationController.getOrganizations);
organizationRoutes.post("/", organizationController.createOrganization);

export default organizationRoutes;
