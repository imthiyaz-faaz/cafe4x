import { api } from "../apiClient";

export interface BreakSession {
  id: string; // e.g. "break_1"
  name: string; // e.g. "Break 1"
  startTime: string; // "09:30"
  endTime: string; // "09:45"
  durationMinutes: number; // 15
  isEnabled: boolean;
}

export interface OrderingWindowStatus {
  allowed: boolean;
  reason?: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  currentTimeInTz: string;
  isEmergencyClosed: boolean;
  currentBreak?: BreakSession | null;
  nextBreak?: BreakSession | null;
  breakSessions: BreakSession[];
}

export interface WorkingHoursModel {
  openTime: string;
  closeTime: string;
  timezone: string;
  isEmergencyClosed: boolean;
  breakSessions: BreakSession[];
  updatedAt?: string;
}

export const workingHoursApi = {
  async getWorkingHours(options?: { signal?: AbortSignal }): Promise<{
    workingHours: WorkingHoursModel;
    windowStatus?: OrderingWindowStatus;
  }> {
    const res = await api.get<{
      success: boolean;
      workingHours: WorkingHoursModel;
      windowStatus?: OrderingWindowStatus;
    }>("/api/working-hours", undefined, { signal: options?.signal, cache: "no-store" });

    // Guarantee complete working hours with empty breaks if configuration missing
    const defaultWH: WorkingHoursModel = {
      openTime: "08:00",
      closeTime: "20:00",
      timezone: "Asia/Dubai",
      isEmergencyClosed: false,
      breakSessions: [],
    };

    const wh: WorkingHoursModel = res.workingHours
      ? {
          ...defaultWH,
          ...res.workingHours,
          breakSessions: Array.isArray(res.workingHours.breakSessions)
            ? res.workingHours.breakSessions
            : [],
        }
      : defaultWH;

    return {
      workingHours: wh,
      windowStatus: res.windowStatus,
    };
  },

  async updateWorkingHours(data: Partial<WorkingHoursModel>): Promise<{
    workingHours: WorkingHoursModel;
    windowStatus?: OrderingWindowStatus;
  }> {
    const res = await api.put<{
      success: boolean;
      message?: string;
      workingHours: WorkingHoursModel;
      windowStatus?: OrderingWindowStatus;
    }>("/api/working-hours", data);

    if (res && res.success === false) {
      throw new Error(res.message || "Failed to save working hours settings.");
    }

    if (!res || !res.workingHours) {
      throw new Error("Invalid response from server. Working hours could not be confirmed.");
    }

    return {
      workingHours: res.workingHours,
      windowStatus: res.windowStatus,
    };
  },
};

export const workingHoursService = workingHoursApi;
export default workingHoursService;
