import { Context } from "hono";

export interface WorkingHoursModel {
  openTime: string;
  closeTime: string;
  timezone: string;
  isEmergencyClosed: boolean;
  updatedAt: string;
}

let workingHoursStore: WorkingHoursModel = {
  openTime: "08:00",
  closeTime: "20:00",
  timezone: "Asia/Dubai",
  isEmergencyClosed: false,
  updatedAt: new Date().toISOString(),
};

export const workingHoursController = {
  async getWorkingHours(c: Context) {
    return c.json({ success: true, workingHours: workingHoursStore });
  },

  async updateWorkingHours(c: Context) {
    try {
      const body = await c.req.json();
      workingHoursStore = {
        ...workingHoursStore,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      return c.json({ success: true, workingHours: workingHoursStore });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
