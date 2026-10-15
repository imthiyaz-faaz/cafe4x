import { Hono } from "hono";
import { organizationController } from "../controllers/organization.controller";

const organizationRoutes = new Hono();

organizationRoutes.get("/", organizationController.getOrganizations);
organizationRoutes.post("/", organizationController.createOrganization);

export default organizationRoutes;
