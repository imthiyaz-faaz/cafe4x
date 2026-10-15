import { api } from "../apiClient";

export interface WorkingHoursModel {
  openTime: string;
  closeTime: string;
  timezone: string;
  isEmergencyClosed: boolean;
  updatedAt?: string;
}

export const workingHoursApi = {
  async getWorkingHours(): Promise<WorkingHoursModel> {
    const res = await api.get<{ success: boolean; workingHours: WorkingHoursModel }>(
      "/api/working-hours"
    );
    return res.workingHours;
  },

  async updateWorkingHours(data: Partial<WorkingHoursModel>): Promise<WorkingHoursModel> {
    const res = await api.put<{ success: boolean; workingHours: WorkingHoursModel }>(
      "/api/working-hours",
      data
    );
    return res.workingHours;
  },
};

export const workingHoursService = workingHoursApi;
export default workingHoursService;
