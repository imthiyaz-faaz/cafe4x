import { Hono } from "hono";
import { tableController } from "../controllers/table.controller";
import { AppEnv } from "../types";

const tableRoutes = new Hono<AppEnv>();

// Tables endpoints
tableRoutes.get("/:tableId", tableController.getTableById);
tableRoutes.put("/:tableId", tableController.updateTable);
tableRoutes.delete("/:tableId", tableController.deleteTable);
tableRoutes.patch("/:tableId/status", tableController.toggleTableStatus);
tableRoutes.post("/:tableId/seats", tableController.addSeatsToTable);
tableRoutes.get("/:tableId/seats", tableController.getTableSeats);
tableRoutes.get("/:tableId/employees", tableController.getTableEmployees);
tableRoutes.get("/:tableId/orders", tableController.getTableOrders);
tableRoutes.get("/:tableId/statistics", tableController.getTableStatistics);

export default tableRoutes;

