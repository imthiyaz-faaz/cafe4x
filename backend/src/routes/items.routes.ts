import { Hono } from "hono";
import { itemsController } from "../controllers/items.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const itemsRoutes = new Hono();

// Publicly viewable menu items (scoped to organization for QR orderers or authenticated users)
itemsRoutes.get("/", itemsController.getItems);
itemsRoutes.get("/:id", itemsController.getItemById);

// Creating, updating, and deleting items requires authenticated Admin
itemsRoutes.post("/", requireAuth, requireRole("Admin"), itemsController.createItem);
itemsRoutes.put("/:id", requireAuth, requireRole("Admin"), itemsController.updateItem);
itemsRoutes.delete("/:id", requireAuth, requireRole("Admin"), itemsController.deleteItem);

// Liking items
itemsRoutes.post("/:id/like", itemsController.toggleLike);

export default itemsRoutes;
