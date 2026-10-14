import { Hono } from "hono";
import { userController } from "../controllers/user.controller";

const userRoutes = new Hono();

userRoutes.get("/", userController.getUsers);
userRoutes.get("/:id", userController.getUserById);
userRoutes.post("/", userController.createUser);
userRoutes.put("/:id", userController.updateUser);
userRoutes.delete("/:id", userController.deleteUser);

export default userRoutes;
