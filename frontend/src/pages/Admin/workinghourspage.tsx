import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Plus,
  Trash2,
  GripVertical,
  Coffee,
  Info,
  RotateCw,
  X,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import {
  workingHoursService,
  type BreakSession,
} from "../../services/working-hours";

const popularTimezones = [
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

// Break badge color styles matching reference UI (cycles for unlimited breaks)
const breakBadgeColors: Array<{ bg: string; text: string; border: string }> = [
  { bg: "bg-[#FDF1EE]", text: "text-[#D94F3D]", border: "border-[#FADBD6]" }, // Break 1 (Pink/Reddish)
  { bg: "bg-[#FEF7E6]", text: "text-[#D99A1A]", border: "border-[#FCEBC1]" }, // Break 2 (Yellow/Orange)
  { bg: "bg-[#EEF4FF]", text: "text-[#3D6BD9]", border: "border-[#D6E3FA]" }, // Break 3 (Blue)
  { bg: "bg-[#F3EEFE]", text: "text-[#7B3DD9]", border: "border-[#E1D6FA]" }, // Break 4 (Purple)
  { bg: "bg-[#EDF8F1]", text: "text-[#2E9B56]", border: "border-[#CEF0DA]" }, // Break 5 (Green)
  { bg: "bg-[#FFF4E5]", text: "text-[#D97706]", border: "border-[#FED7AA]" }, // Break 6 (Amber)
  { bg: "bg-[#F0FDF4]", text: "text-[#15803D]", border: "border-[#BBF7D0]" }, // Break 7 (Emerald)
  { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]" }, // Break 8 (Violet)
];

/**
 * Calculates duration in minutes between start time and end time (HH:MM format)
 */
function calculateDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins >= startMins) {
    return endMins - startMins;
  }
  return 24 * 60 - startMins + endMins;
}

/**
 * Formats 24-hour time "HH:MM" to 12-hour "hh:mm AM/PM"
 */
function formatTime12(time24: string): string {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const displayHours = h % 12 === 0 ? 12 : h % 12;
  const padHours = String(displayHours).padStart(2, "0");
  const padMins = String(m).padStart(2, "0");
  return `${padHours}:${padMins} ${period}`;
}
function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 minutes";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours} hr ${mins} min`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${mins} minutes`;
}

export default function WorkingHoursPage() {
  const params = useParams();
  const shortCode = params.shortCode;

  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  const [isEmergencyClosed, setIsEmergencyClosed] = useState(false);
  const [breakSessions, setBreakSessions] = useState<BreakSession[]>([]);

  // Modal State for Manual Break Creation
  const [isAddBreakModalOpen, setIsAddBreakModalOpen] = useState(false);
  const [newBreakName, setNewBreakName] = useState("");
  const [newBreakStartTime, setNewBreakStartTime] = useState("");
  const [newBreakEndTime, setNewBreakEndTime] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live real-time clock ticker updated every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load configured working hours on mount or when organization shortCode changes
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    workingHoursService
      .getWorkingHours({ signal: controller.signal })
      .then((res) => {
        if (res && res.workingHours) {
          const wh = res.workingHours;
          if (wh.openTime) setOpenTime(wh.openTime);
          if (wh.closeTime) setCloseTime(wh.closeTime);
          if (wh.timezone) setTimezone(wh.timezone);
          if (typeof wh.isEmergencyClosed === "boolean") {
            setIsEmergencyClosed(wh.isEmergencyClosed);
          }
          if (Array.isArray(wh.breakSessions)) {
            setBreakSessions(wh.breakSessions);
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("Could not load working hours:", err);
          setErrorMessage(err.message || "Failed to load working hours.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [shortCode]);

  // Break session modifications
  const handleTimeChange = (id: string, field: "startTime" | "endTime", value: string) => {
    setBreakSessions((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b, [field]: value };
        updated.durationMinutes = calculateDuration(updated.startTime, updated.endTime);
        return updated;
      })
    );
  };

  const handleToggleBreak = (id: string) => {
    setBreakSessions((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isEnabled: !b.isEnabled } : b))
    );
  };

  const handleDeleteBreak = (id: string) => {
    setBreakSessions((prev) => prev.filter((b) => b.id !== id));
  };

  const handleOpenAddBreakModal = () => {
    setNewBreakName("");
    setNewBreakStartTime("");
    setNewBreakEndTime("");
    setModalError(null);
    setIsAddBreakModalOpen(true);
  };

  const handleCloseAddBreakModal = () => {
    setIsAddBreakModalOpen(false);
    setNewBreakName("");
    setNewBreakStartTime("");
    setNewBreakEndTime("");
    setModalError(null);
  };

  const handleSaveNewBreak = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const trimmedName = newBreakName.trim();
    if (!trimmedName) {
      setModalError("Break name cannot be empty.");
      return;
    }

    if (!newBreakStartTime) {
      setModalError("Start time is required.");
      return;
    }

    if (!newBreakEndTime) {
      setModalError("End time is required.");
      return;
    }

    if (newBreakStartTime >= newBreakEndTime) {
      setModalError("End time must be later than start time.");
      return;
    }

    // Check duplicate break name (case-insensitive)
    const duplicateName = breakSessions.some(
      (b) => b.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      setModalError(`A break session named "${trimmedName}" already exists.`);
      return;
    }

    // Check overlap with existing enabled sessions
    for (const b of breakSessions) {
      if (b.isEnabled) {
        if (newBreakStartTime < b.endTime && b.startTime < newBreakEndTime) {
          setModalError(
            `Break time conflicts with "${b.name}" (${b.startTime} - ${b.endTime}). Sessions must not overlap.`
          );
          return;
        }
      }
    }

    const createdBreak: BreakSession = {
      id: `break_${Date.now()}`,
      name: trimmedName,
      startTime: newBreakStartTime,
      endTime: newBreakEndTime,
      durationMinutes: calculateDuration(newBreakStartTime, newBreakEndTime),
      isEnabled: true,
    };

    setBreakSessions((prev) => [...prev, createdBreak]);
    handleCloseAddBreakModal();
  };

  // Validation function
  const validateSettings = (): string | null => {
    if (!openTime.trim()) return "Open time is required.";
    if (!closeTime.trim()) return "Close time is required.";
    if (openTime === closeTime) return "Open time and close time cannot be the same.";

    // Validate each break session
    for (const b of breakSessions) {
      if (!b.name || !b.name.trim()) {
        return "Break name cannot be empty.";
      }
      if (!b.startTime || !b.endTime) {
        return `Please specify both start and end time for ${b.name}.`;
      }
      if (b.startTime >= b.endTime) {
        return `End time must be later than start time for ${b.name}.`;
      }
    }

    // Check overlap among enabled sessions
    const enabled = breakSessions.filter((b) => b.isEnabled);
    for (let i = 0; i < enabled.length; i++) {
      for (let j = i + 1; j < enabled.length; j++) {
        const b1 = enabled[i];
        const b2 = enabled[j];
        if (b1.startTime < b2.endTime && b2.startTime < b1.endTime) {
          return `Overlap detected: "${b1.name}" (${b1.startTime} - ${b1.endTime}) conflicts with "${b2.name}" (${b2.startTime} - ${b2.endTime}).`;
        }
      }
    }

    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErr = validateSettings();
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    try {
      setIsSaving(true);
      const res = await workingHoursService.updateWorkingHours({
        openTime,
        closeTime,
        timezone,
        isEmergencyClosed,
        breakSessions,
      });

      // Synchronize component state with verified persisted data from server response
      if (res?.workingHours) {
        if (res.workingHours.openTime) setOpenTime(res.workingHours.openTime);
        if (res.workingHours.closeTime) setCloseTime(res.workingHours.closeTime);
        if (res.workingHours.timezone) setTimezone(res.workingHours.timezone);
        if (typeof res.workingHours.isEmergencyClosed === "boolean") {
          setIsEmergencyClosed(res.workingHours.isEmergencyClosed);
        }
        if (Array.isArray(res.workingHours.breakSessions)) {
          setBreakSessions(res.workingHours.breakSessions);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Timeline computation encompassing full span of operating hours and breaks
  const { timelineSegments, timelineStartLabel, timelineEndLabel } = useMemo(() => {
    const toMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
    };

    const toTimeStr = (totalMins: number) => {
      const normalized = ((totalMins % 1440) + 1440) % 1440;
      const h = Math.floor(normalized / 60);
      const m = normalized % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const openMins = toMinutes(openTime || "08:00");
    let closeMins = toMinutes(closeTime || "20:00");
    if (closeMins <= openMins) {
      closeMins += 24 * 60; // overnight operating window
    }

    const enabledBreaks = breakSessions.filter((b) => b.isEnabled && b.startTime && b.endTime);

    // Calculate dynamic span encompassing openTime, closeTime, and all break boundaries
    let minMinute = openMins;
    let maxMinute = closeMins;

    for (const b of enabledBreaks) {
      const bStart = toMinutes(b.startTime);
      let bEnd = toMinutes(b.endTime);
      if (bEnd <= bStart) bEnd += 24 * 60;

      if (bStart < minMinute) minMinute = bStart;
      if (bEnd > maxMinute) maxMinute = bEnd;
    }

    const totalSpan = Math.max(maxMinute - minMinute, 60);

    // Sort enabled breaks in ascending start time
    const sortedBreaks = [...enabledBreaks].sort((a, b) => a.startTime.localeCompare(b.startTime));

    const segments: Array<{
      type: "order" | "closed";
      startPct: number;
      widthPct: number;
      label?: string;
      timeRange?: string;
    }> = [];

    let currentCursor = minMinute;

    for (const b of sortedBreaks) {
      const bStart = toMinutes(b.startTime);
      let bEnd = toMinutes(b.endTime);
      if (bEnd <= bStart) bEnd += 24 * 60;

      // Closed segment prior to break
      if (bStart > currentCursor) {
        const closedMins = bStart - currentCursor;
        segments.push({
          type: "closed",
          startPct: ((currentCursor - minMinute) / totalSpan) * 100,
          widthPct: (closedMins / totalSpan) * 100,
        });
      }

      // Active Break (Ordering Allowed)
      const breakMins = bEnd - bStart;
      segments.push({
        type: "order",
        startPct: ((bStart - minMinute) / totalSpan) * 100,
        widthPct: (breakMins / totalSpan) * 100,
        label: b.name,
        timeRange: `${formatTime12(b.startTime)} - ${formatTime12(b.endTime)}`,
      });

      currentCursor = Math.max(currentCursor, bEnd);
    }

    if (currentCursor < maxMinute) {
      segments.push({
        type: "closed",
        startPct: ((currentCursor - minMinute) / totalSpan) * 100,
        widthPct: ((maxMinute - currentCursor) / totalSpan) * 100,
      });
    }

    return {
      timelineSegments: segments,
      timelineStartLabel: toTimeStr(minMinute),
      timelineEndLabel: toTimeStr(maxMinute),
    };
  }, [openTime, closeTime, breakSessions]);

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          {/* Centered Working Hours Configuration Card */}
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-xl shadow-[#70452D]/5">
                
                {/* Header Banner matching reference design */}
                <div className="flex items-center gap-3 bg-[#8E6548] px-6 py-4.5 text-white">
                  <div className="rounded-full bg-white/10 p-1.5">
                    <Clock size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight">
                      Working Hours Settings
                    </h2>
                    <p className="text-xs text-white/80 font-normal">
                      Set your cafe open hours and employee break sessions for ordering
                    </p>
                  </div>
                </div>

                {/* Form Body */}
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <RotateCw size={28} className="animate-spin text-[#8E6548] mb-3" />
                    <p className="text-sm font-semibold text-gray-700">Loading working hours...</p>
                    <p className="text-xs text-gray-400 mt-1">Fetching cafe schedules and break sessions</p>
                  </div>
                ) : (
                <form onSubmit={handleSave} className="p-6 sm:p-7 space-y-7">
                  
                  {/* Success Alert */}
                  {saveSuccess && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span>Working hours and break sessions saved successfully!</span>
                    </div>
                  )}

                  {/* Error Notification Alert */}
                  {errorMessage && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-800 animate-in fade-in">
                      <AlertCircle size={18} className="text-red-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* 1. Cafe Working Hours & Timezone */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    {/* Open Time */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-800">
                        Open Time
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          value={openTime}
                          onChange={(e) => setOpenTime(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20 bg-white"
                        />
                      </div>
                    </div>

                    {/* Close Time */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-800">
                        Close Time
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          value={closeTime}
                          onChange={(e) => setCloseTime(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20 bg-white"
                        />
                      </div>
                    </div>

                    {/* Timezone */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-gray-800">
                          Timezone
                        </label>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#8E6548] bg-[#F8F2EC] px-2 py-0.5 rounded-full border border-[#8E6548]/15 shadow-xs">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          <span>
                            Live: {(() => {
                              try {
                                return new Intl.DateTimeFormat("en-GB", {
                                  timeZone: timezone,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: false,
                                }).format(currentTime);
                              } catch {
                                return "--:--:--";
                              }
                            })()}
                          </span>
                        </span>
                      </div>
                      <div className="relative">
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20 cursor-pointer"
                        >
                          {popularTimezones.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 2. Employee Break Sessions Header & Info Box */}
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Coffee size={18} className="text-[#8E6548]" />
                          <h3 className="text-sm font-bold text-gray-900">
                            Employee Break Sessions
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Employees can place orders only during these break sessions. Outside these times, only admin/provider can order.
                        </p>
                      </div>

                      {/* Add Break Button */}
                      <button
                        type="button"
                        onClick={handleOpenAddBreakModal}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#8E6548] bg-[#FDF9F6] px-3.5 py-1.5 text-xs font-semibold text-[#8E6548] hover:bg-[#8E6548] hover:text-white transition shadow-sm self-start sm:self-auto cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add Break</span>
                      </button>
                    </div>

                    {/* Blue Info Notice matching reference */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-2.5 text-xs text-sky-800">
                      <Info size={16} className="text-sky-600 shrink-0" />
                      <span>
                        Employees can only place orders during active break sessions. Outside these hours, orders are restricted to admin/provider.
                      </span>
                    </div>

                    {/* Break Sessions List / Table */}
                    <div className="space-y-3">
                      {breakSessions.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#D5C2B1] bg-[#FAF8F5] p-8 text-center text-xs text-gray-500 space-y-3">
                          <Coffee size={24} className="mx-auto text-[#B39B88]" />
                          <p className="font-semibold text-gray-700">No break sessions configured yet.</p>
                          <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                            Click &quot;+ Add Break&quot; to configure scheduled employee ordering windows.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenAddBreakModal}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8E6548] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#785339] transition cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>Add Break</span>
                          </button>
                        </div>
                      ) : (
                        breakSessions.map((b, index) => {
                          const badgeColor = breakBadgeColors[index % breakBadgeColors.length];
                          return (
                            <div
                              key={b.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:px-4 sm:py-3 transition hover:border-gray-300 shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                {/* Drag handle dots */}
                                <GripVertical size={16} className="text-gray-400 cursor-grab" />

                                {/* Break Label Badge */}
                                <span
                                  className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-bold ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}
                                >
                                  {b.name}
                                </span>
                              </div>

                              {/* Start Time - End Time Display & Inputs */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={b.startTime}
                                  onChange={(e) => handleTimeChange(b.id, "startTime", e.target.value)}
                                  className="w-28 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-800 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20"
                                />
                                <span className="text-xs text-gray-400 font-bold">-</span>
                                <input
                                  type="time"
                                  value={b.endTime}
                                  onChange={(e) => handleTimeChange(b.id, "endTime", e.target.value)}
                                  className="w-28 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-800 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20"
                                />
                                <span className="hidden sm:inline-block text-[11px] font-medium text-gray-500 ml-1">
                                  ({formatTime12(b.startTime)} – {formatTime12(b.endTime)})
                                </span>
                              </div>

                              {/* Calculated Duration Display */}
                              <div className="w-24 text-right sm:text-center">
                                <span className="text-xs font-medium text-gray-600">
                                  {formatDuration(b.durationMinutes)}
                                </span>
                              </div>

                              {/* Enabled Toggle & Delete Button */}
                              <div className="flex items-center gap-3">
                                {/* Toggle switch with "Enabled" label */}
                                <div
                                  onClick={() => handleToggleBreak(b.id)}
                                  className="flex items-center gap-2 cursor-pointer select-none"
                                >
                                  <div
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                      b.isEnabled ? "bg-emerald-600" : "bg-gray-300"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        b.isEnabled ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">
                                    {b.isEnabled ? "Enabled" : "Disabled"}
                                  </span>
                                </div>

                                {/* Delete Break Icon */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBreak(b.id)}
                                  className="text-gray-400 hover:text-red-500 transition p-1 cursor-pointer"
                                  title="Delete break session"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 3. Emergency Override Box & Save Settings Action */}
                  <div className="pt-2 space-y-4">
                    <div
                      onClick={() => setIsEmergencyClosed(!isEmergencyClosed)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 select-none ${
                        isEmergencyClosed
                          ? "border-red-300 bg-red-50/70"
                          : "border-red-100 bg-[#FFFBF8] hover:bg-red-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle
                            size={18}
                            className={`mt-0.5 shrink-0 ${
                              isEmergencyClosed ? "text-red-600" : "text-red-500"
                            }`}
                          />
                          <div>
                            <h4
                              className={`text-xs font-bold ${
                                isEmergencyClosed ? "text-red-700" : "text-red-600"
                              }`}
                            >
                              Emergency Override
                            </h4>
                            <p className="mt-0.5 text-xs text-gray-600">
                              Temporarily close the cafe to stop accepting orders immediately.
                            </p>
                          </div>
                        </div>

                        {/* Switch */}
                        <div
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            isEmergencyClosed ? "bg-red-600" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isEmergencyClosed ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Save Settings Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-xl bg-[#8E6548] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#8E6548]/25 transition duration-150 hover:bg-[#785339] active:scale-95 disabled:opacity-60 cursor-pointer"
                      >
                        <Save size={16} />
                        <span>{isSaving ? "Saving..." : "Save Settings"}</span>
                      </button>
                    </div>
                  </div>
                </form>
                )}
              </div>

              {/* Bottom Card: Visual Cafe Ordering Timeline */}
              <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-[#FFFBF7] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h3 className="text-sm font-bold text-gray-900">
               Cafe Ordering Timeline
              </h3>

              {/* Legend */}
              <div className="flex items-center gap-5 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#2E9B56]" />
                  <span>Employees can order</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#BA8462]" />
                  <span>Employees cannot order</span>
                </div>
              </div>
            </div>

            {/* Timeline Bar Container */}
            <div className="relative pt-8 pb-6">
              {/* Break Session Labels pinned above active segments */}
              <div className="relative h-6 w-full mb-2">
                {timelineSegments
                  .filter((s) => s.type === "order")
                  .map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        left: `${s.startPct}%`,
                        width: `${Math.max(s.widthPct, 6)}%`,
                      }}
                      className="absolute -top-6 -translate-x-1/2 text-center select-none"
                    >
                      <div className="text-[11px] font-bold text-gray-900 whitespace-nowrap">
                        {s.timeRange}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                        {s.label}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Colored Segments Bar */}
              <div className="flex h-5 w-full overflow-hidden rounded-full shadow-inner bg-gray-200">
                {timelineSegments.map((segment, idx) => {
                  const isOrder = segment.type === "order";
                  return (
                    <div
                      key={idx}
                      style={{ width: `${segment.widthPct}%` }}
                      className={`h-full transition-all duration-300 ${
                        isOrder ? "bg-[#2E9B56]" : "bg-[#BA8462]"
                      }`}
                      title={`${isOrder ? "Ordering Open" : "Ordering Closed"} (${segment.widthPct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>

              {/* Time markers beneath the timeline */}
              <div className="relative mt-2 text-[11px] font-medium text-gray-600 flex justify-between">
                <span>{timelineStartLabel || openTime}</span>
                {timelineSegments
                  .filter((s) => s.type === "order")
                  .map((s, idx) => (
                    <span
                      key={idx}
                      style={{ left: `${s.startPct}%` }}
                      className="absolute -translate-x-1/2 whitespace-nowrap text-[10px]"
                    >
                      {s.timeRange?.split(" - ")[0]}
                    </span>
                  ))}
                <span>{timelineEndLabel || closeTime}</span>
              </div>
            </div>
          </div>
          </div>
        </main>

        {/* Modal: + Add Break */}
        {isAddBreakModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8F2EC] text-[#8E6548]">
                    <Coffee size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#342219]">Add Break Session</h3>
                    <p className="text-[11px] text-gray-500">Configure a scheduled ordering time window</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAddBreakModal}
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveNewBreak} className="mt-4 space-y-4">
                {modalError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-800">
                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Field 1: Break Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Break Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Breakfast Break, Lunch Break, Tea Break"
                    value={newBreakName}
                    onChange={(e) => setNewBreakName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20 bg-white placeholder:text-gray-400"
                    autoFocus
                  />
                </div>

                {/* Field 2 & 3: From Time and To Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      From Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={newBreakStartTime}
                      onChange={(e) => setNewBreakStartTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20 bg-white"
                    />
                    {newBreakStartTime && (
                      <p className="text-[10px] text-gray-500 mt-1 font-medium">
                        {formatTime12(newBreakStartTime)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      To Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={newBreakEndTime}
                      onChange={(e) => setNewBreakEndTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none transition focus:border-[#8E6548] focus:ring-1 focus:ring-[#8E6548]/20 bg-white"
                    />
                    {newBreakEndTime && (
                      <p className="text-[10px] text-gray-500 mt-1 font-medium">
                        {formatTime12(newBreakEndTime)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Duration Preview */}
                {newBreakStartTime && newBreakEndTime && (
                  <div className="rounded-xl border border-[#EEE5DC] bg-[#FAF8F5] p-2.5 flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-medium">Estimated Duration:</span>
                    <span className="font-bold text-[#8E6548]">
                      {formatDuration(calculateDuration(newBreakStartTime, newBreakEndTime))}
                    </span>
                  </div>
                )}

                {/* Buttons: Cancel & Save Break */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleCloseAddBreakModal}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-[#8E6548] px-5 py-2 text-xs font-bold text-white shadow-md shadow-[#8E6548]/20 hover:bg-[#785339] transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Save Break</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto px-4 py-6 text-center text-xs text-[#9A8778]">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
            <ShieldCheck size={15} />
            <span>Good Food. Better Days. © {new Date().getFullYear()} Cafe4X. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </Background>
  );
}
