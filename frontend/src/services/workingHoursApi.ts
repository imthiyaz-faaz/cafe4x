import { apiFetch } from "./apiClient";

export interface WorkingHoursModel {
  openTime: string;
  closeTime: string;
  timezone: string;
  isEmergencyClosed: boolean;
}

export const workingHoursApi = {
  async getWorkingHours(): Promise<WorkingHoursModel> {
    const res = await apiFetch<{ success: boolean; workingHours: WorkingHoursModel }>("/api/working-hours");
    return res.workingHours;
  },

  async updateWorkingHours(data: Partial<WorkingHoursModel>): Promise<WorkingHoursModel> {
    const res = await apiFetch<{ success: boolean; workingHours: WorkingHoursModel }>("/api/working-hours", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.workingHours;
  },
};
