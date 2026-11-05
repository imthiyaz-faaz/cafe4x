import { Hono } from "hono";
import { organizationController } from "../controllers/organization.controller";

const organizationRoutes = new Hono();

organizationRoutes.get("/", organizationController.getOrganizations);
organizationRoutes.post("/", organizationController.createOrganization);
organizationRoutes.get("/check-name", organizationController.checkName);
organizationRoutes.get("/check-code", organizationController.checkCode);
organizationRoutes.get("/:id", organizationController.getOrganization);

export default organizationRoutes;
