import { Hono } from "hono";
import { authController } from "../controllers/auth.controller";

const authRoutes = new Hono();

authRoutes.post("/login", authController.login);
authRoutes.post("/signup", authController.signup);
authRoutes.get("/check-username", authController.checkUsername);
authRoutes.get("/check-email", authController.checkEmail);
authRoutes.get("/me", authController.me);
authRoutes.post("/logout", authController.logout);

export default authRoutes;

