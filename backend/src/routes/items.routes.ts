import { Hono } from "hono";
import { itemsController } from "../controllers/items.controller";

const itemsRoutes = new Hono();

itemsRoutes.get("/", itemsController.getItems);
itemsRoutes.get("/:id", itemsController.getItemById);
itemsRoutes.post("/", itemsController.createItem);
itemsRoutes.put("/:id", itemsController.updateItem);
itemsRoutes.delete("/:id", itemsController.deleteItem);
itemsRoutes.post("/:id/like", itemsController.toggleLike);

export default itemsRoutes;
