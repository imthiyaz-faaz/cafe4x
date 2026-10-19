import { Hono } from "hono";
import { orderController } from "../controllers/order.controller";

const orderRoutes = new Hono();

orderRoutes.get("/", orderController.getOrders);
orderRoutes.get("/employees", orderController.getOrderEmployees);
orderRoutes.post("/bulk-status", orderController.bulkUpdateStatus);
orderRoutes.get("/:id", orderController.getOrderById);
orderRoutes.post("/", orderController.createOrder);
orderRoutes.put("/:id", orderController.updateOrder);
orderRoutes.patch("/:id", orderController.updateOrder);
orderRoutes.patch("/:id/status", orderController.updateStatus);
orderRoutes.put("/:id/status", orderController.updateStatus);
orderRoutes.delete("/:id", orderController.deleteOrder);

export default orderRoutes;
