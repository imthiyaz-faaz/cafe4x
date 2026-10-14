import { Hono } from "hono";
import { orderController } from "../controllers/order.controller";

const orderRoutes = new Hono();

orderRoutes.get("/", orderController.getOrders);
orderRoutes.get("/:id", orderController.getOrderById);
orderRoutes.post("/", orderController.createOrder);
orderRoutes.patch("/:id/status", orderController.updateStatus);
orderRoutes.put("/:id/status", orderController.updateStatus);
orderRoutes.delete("/:id", orderController.deleteOrder);

export default orderRoutes;
