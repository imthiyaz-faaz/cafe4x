import { Context } from "hono";
import { orderController } from "./order.controller";
import { locationController } from "./location.controller";

export const providerController = {
  // GET /api/provider/dashboard?providerId=xxx
  async getDashboard(c: Context) {
    try {
      const providerId = c.req.query("providerId");
      return c.json({
        success: true,
        message: "Provider dashboard active",
        providerId,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/provider/orders
  getOrders: orderController.getOrders,

  // PATCH /api/provider/orders/:id/status
  updateOrderStatus: orderController.updateStatus,

  // GET /api/provider/locations
  getAssignedLocations: locationController.getLocations,
};
