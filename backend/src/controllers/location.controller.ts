import { Context } from "hono";

export interface LocationModel {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
  createdAt?: string;
  updatedAt?: string;
}

// In-memory store (initialized with default locations, excluding removed Workspace & Meeting Room)
let locationsStore: LocationModel[] = [
  {
    id: "3",
    name: "office",
    status: "Active",
    totalSeats: 10,
    assignedProviderId: "3",
    assignedProviderEmail: "provider@cafe4x.com",
    assignedProviderName: "Cafe Provider",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const locationController = {
  // GET /api/locations or /api/locations?providerId=xxx
  async getLocations(c: Context) {
    try {
      const providerId = c.req.query("providerId");
      let result = [...locationsStore];

      if (providerId) {
        result = result.filter((loc) => loc.assignedProviderId === providerId);
      }

      return c.json({
        success: true,
        locations: result,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id
  async getLocationById(c: Context) {
    try {
      const id = c.req.param("id");
      const found = locationsStore.find((l) => l.id === id);
      if (!found) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }
      return c.json({ success: true, location: found });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations
  async createLocation(c: Context) {
    try {
      const body = await c.req.json();
      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Location name is required" }, 400);
      }

      const newLoc: LocationModel = {
        id: body.id ? String(body.id) : Date.now().toString(),
        name: body.name.trim(),
        status: body.status || "Active",
        totalSeats: Number(body.totalSeats) || 10,
        assignedProviderId: body.assignedProviderId || undefined,
        assignedProviderEmail: body.assignedProviderEmail || undefined,
        assignedProviderName: body.assignedProviderName || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      locationsStore.push(newLoc);
      return c.json({ success: true, location: newLoc }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/locations/:id
  async updateLocation(c: Context) {
    try {
      const id = c.req.param("id") || Date.now().toString();
      const body = await c.req.json();
      const index = locationsStore.findIndex((l) => l.id === id);

      if (index === -1) {
        // If not found, create or add it
        const created: LocationModel = {
          id,
          name: body.name || "Location",

          status: body.status || "Active",
          totalSeats: Number(body.totalSeats) || 10,
          assignedProviderId: body.assignedProviderId,
          assignedProviderEmail: body.assignedProviderEmail,
          assignedProviderName: body.assignedProviderName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        locationsStore.push(created);
        return c.json({ success: true, location: created });
      }

      locationsStore[index] = {
        ...locationsStore[index],
        ...body,
        updatedAt: new Date().toISOString(),
      };

      return c.json({ success: true, location: locationsStore[index] });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/assign
  async assignProvider(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const index = locationsStore.findIndex((l) => l.id === id);

      if (index === -1) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }

      locationsStore[index] = {
        ...locationsStore[index],
        assignedProviderId: body.assignedProviderId || undefined,
        assignedProviderEmail: body.assignedProviderEmail || undefined,
        assignedProviderName: body.assignedProviderName || undefined,
        updatedAt: new Date().toISOString(),
      };

      return c.json({ success: true, location: locationsStore[index] });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id
  async deleteLocation(c: Context) {
    try {
      const id = c.req.param("id");
      locationsStore = locationsStore.filter((l) => l.id !== id);
      return c.json({ success: true, message: "Location deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
