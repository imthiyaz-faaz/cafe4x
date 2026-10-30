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

export const DEFAULT_BREAK_SESSIONS: BreakSession[] = [
  { id: "break_1", name: "Break 1", startTime: "09:30", endTime: "09:45", durationMinutes: 15, isEnabled: true },
  { id: "break_2", name: "Break 2", startTime: "11:30", endTime: "11:45", durationMinutes: 15, isEnabled: true },
  { id: "break_3", name: "Break 3", startTime: "13:30", endTime: "14:00", durationMinutes: 30, isEnabled: true },
  { id: "break_4", name: "Break 4", startTime: "16:00", endTime: "16:15", durationMinutes: 15, isEnabled: true },
  { id: "break_5", name: "Break 5", startTime: "18:00", endTime: "18:15", durationMinutes: 15, isEnabled: true },
];

export const workingHoursApi = {
  async getWorkingHours(options?: { signal?: AbortSignal }): Promise<{
    workingHours: WorkingHoursModel;
    windowStatus?: OrderingWindowStatus;
  }> {
    const res = await api.get<{
      success: boolean;
      workingHours: WorkingHoursModel;
      windowStatus?: OrderingWindowStatus;
    }>("/api/working-hours", undefined, { signal: options?.signal });

    // Guarantee complete working hours with default breaks if missing
    const defaultWH: WorkingHoursModel = {
      openTime: "08:00",
      closeTime: "20:00",
      timezone: "Asia/Dubai",
      isEmergencyClosed: false,
      breakSessions: DEFAULT_BREAK_SESSIONS,
    };

    const wh: WorkingHoursModel = res.workingHours
      ? {
          ...defaultWH,
          ...res.workingHours,
          breakSessions:
            Array.isArray(res.workingHours.breakSessions) && res.workingHours.breakSessions.length > 0
              ? res.workingHours.breakSessions
              : DEFAULT_BREAK_SESSIONS,
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
      workingHours: WorkingHoursModel;
      windowStatus?: OrderingWindowStatus;
    }>("/api/working-hours", data);

    return {
      workingHours: res.workingHours,
      windowStatus: res.windowStatus,
    };
  },
};

export const workingHoursService = workingHoursApi;
export default workingHoursService;
