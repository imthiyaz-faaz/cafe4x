import { Context } from "hono";

export const itemsController = {
  async getItems(c: Context) {
    return c.json({ success: true, items: [] });
  },

  async getItemById(c: Context) {
    const id = c.req.param("id");
    return c.json({ success: true, item: { id } });
  },

  async createItem(c: Context) {
    const body = await c.req.json();
    return c.json({ success: true, item: { id: Date.now().toString(), ...body } }, 201);
  },

  async updateItem(c: Context) {
    const id = c.req.param("id");
    const body = await c.req.json();
    return c.json({ success: true, item: { id, ...body } });
  },

  async deleteItem(c: Context) {
    return c.json({ success: true, message: "Item deleted" });
  },

  async toggleLike(c: Context) {
    const id = c.req.param("id");
    return c.json({ success: true, id, isLiked: true });
  },
};
