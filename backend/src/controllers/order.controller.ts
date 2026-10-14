import { Context } from "hono";

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface OrderModel {
  id: string;
  seat: string;
  locationName: string;
  locationId?: string;
  employeeName: string;
  items: OrderItem[];
  total: number;
  time: string;
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Live orders store (starts clean, orders placed by employees will populate here)
let ordersStore: OrderModel[] = [];

export const orderController = {
  // GET /api/orders or /api/orders?location=office or /api/orders?status=Pending
  async getOrders(c: Context) {
    try {
      const location = c.req.query("location");
      const status = c.req.query("status");
      let list = [...ordersStore];

      if (location) {
        const locLower = location.toLowerCase();
        list = list.filter(
          (o) =>
            o.locationName.toLowerCase() === locLower ||
            (o.locationId && o.locationId.toLowerCase() === locLower)
        );
      }

      if (status) {
        list = list.filter((o) => o.status === status);
      }

      // Return recent first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return c.json({ success: true, orders: list });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/orders/:id
  async getOrderById(c: Context) {
    try {
      const id = c.req.param("id");
      const order = ordersStore.find((o) => o.id === id);
      if (!order) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }
      return c.json({ success: true, order });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/orders (Created when employee places an order)
  async createOrder(c: Context) {
    try {
      const body = await c.req.json();
      const now = new Date();
      const orderIdNum = Math.floor(1000 + Math.random() * 9000);

      const newOrder: OrderModel = {
        id: body.id || `#ORD-${orderIdNum}`,
        seat: String(body.seat || "01").padStart(2, "0"),
        locationName: body.locationName || "Office",
        locationId: body.locationId || undefined,
        employeeName: body.employeeName || `Seat ${body.seat || "01"} Guest`,
        items: Array.isArray(body.items) ? body.items : [],
        total: Number(body.total) || 0,
        time: "Just now",
        status: "Pending",
        notes: body.notes || undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      ordersStore.unshift(newOrder);
      return c.json({ success: true, order: newOrder }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PATCH /api/orders/:id/status
  async updateStatus(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const index = ordersStore.findIndex((o) => o.id === id);

      if (index === -1) {
        // If order was generated client-side first and not yet on backend, create it with new status
        const created: OrderModel = {
          id: id || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          seat: String(body.seat || "01").padStart(2, "0"),
          locationName: body.locationName || "Office",
          employeeName: body.employeeName || "Employee",
          items: body.items || [],
          total: Number(body.total) || 0,
          time: "Just now",
          status: body.status || "Pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        ordersStore.unshift(created);
        return c.json({ success: true, order: created });
      }

      ordersStore[index] = {
        ...ordersStore[index],
        status: body.status,
        updatedAt: new Date().toISOString(),
      };

      return c.json({ success: true, order: ordersStore[index] });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/orders/:id
  async deleteOrder(c: Context) {
    try {
      const id = c.req.param("id");
      ordersStore = ordersStore.filter((o) => o.id !== id);
      return c.json({ success: true, message: "Order removed" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
