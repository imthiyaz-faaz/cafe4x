import { Hono } from "hono";
import { tableController } from "../controllers/table.controller";
import { AppEnv } from "../types";

const seatRoutes = new Hono<AppEnv>();

seatRoutes.get("/:seatId/details", tableController.getSeatDetails);
seatRoutes.patch("/:seatId/assign", tableController.assignSeat);
seatRoutes.post("/:seatId/assign", tableController.assignSeat);
seatRoutes.put("/:seatId/transfer", tableController.transferSeat);
seatRoutes.post("/:seatId/transfer", tableController.transferSeat);
seatRoutes.patch("/:seatId/unassign", tableController.unassignSeat);
seatRoutes.delete("/:seatId/assignment", tableController.unassignSeat);
seatRoutes.delete("/:seatId", tableController.unassignSeat);
seatRoutes.patch("/:seatId/status", tableController.updateSeatStatus);
seatRoutes.put("/:seatId", tableController.updateSeatStatus);

export default seatRoutes;

