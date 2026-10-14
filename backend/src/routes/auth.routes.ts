import { Hono } from "hono";
import { authController } from "../controllers/auth.controller";

const authRoutes = new Hono();

authRoutes.post("/login", authController.login);
authRoutes.post("/signup", authController.signup);
authRoutes.get("/me", authController.me);

export default authRoutes;

