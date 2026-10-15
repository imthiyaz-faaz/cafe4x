import { OrderModel } from "../controllers/order.controller";

let ordersStore: OrderModel[] = [];

export const orderBackendService = {
  getOrders(location?: string, status?: string): OrderModel[] {
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

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  },

  getOrderById(id: string): OrderModel | undefined {
    return ordersStore.find((o) => o.id === id);
  },

  createOrder(body: Partial<OrderModel>): OrderModel {
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
    return newOrder;
  },

  updateStatus(id: string, status: OrderModel["status"], fallbackData?: any): OrderModel {
    const index = ordersStore.findIndex((o) => o.id === id);

    if (index === -1) {
      const created: OrderModel = {
        id: id || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        seat: String(fallbackData?.seat || "01").padStart(2, "0"),
        locationName: fallbackData?.locationName || "Office",
        employeeName: fallbackData?.employeeName || "Employee",
        items: fallbackData?.items || [],
        total: Number(fallbackData?.total) || 0,
        time: "Just now",
        status: status || "Pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      ordersStore.unshift(created);
      return created;
    }

    ordersStore[index] = {
      ...ordersStore[index],
      status,
      updatedAt: new Date().toISOString(),
    };

    return ordersStore[index];
  },

  deleteOrder(id: string): boolean {
    const initLen = ordersStore.length;
    ordersStore = ordersStore.filter((o) => o.id !== id);
    return ordersStore.length !== initLen;
  },
};

export default orderBackendService;
