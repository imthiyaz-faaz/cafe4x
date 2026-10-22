import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import {
  workingHoursService,
  type BreakSession,
  DEFAULT_BREAK_SESSIONS,
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

// Break badge color styles matching reference UI
const breakBadgeColors: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "bg-[#FDF1EE]", text: "text-[#D94F3D]", border: "border-[#FADBD6]" }, // Break 1 (Pink/Reddish)
  1: { bg: "bg-[#FEF7E6]", text: "text-[#D99A1A]", border: "border-[#FCEBC1]" }, // Break 2 (Yellow/Orange)
  2: { bg: "bg-[#EEF4FF]", text: "text-[#3D6BD9]", border: "border-[#D6E3FA]" }, // Break 3 (Blue)
  3: { bg: "bg-[#F3EEFE]", text: "text-[#7B3DD9]", border: "border-[#E1D6FA]" }, // Break 4 (Purple)
  4: { bg: "bg-[#EDF8F1]", text: "text-[#2E9B56]", border: "border-[#CEF0DA]" }, // Break 5 (Green)
};

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
 * Formats duration into human readable string e.g. "15 minutes" or "1 hour"
 */
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
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  const [isEmergencyClosed, setIsEmergencyClosed] = useState(false);
  const [breakSessions, setBreakSessions] = useState<BreakSession[]>(DEFAULT_BREAK_SESSIONS);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live real-time clock ticker updated every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load configured working hours on mount
  useEffect(() => {
    workingHoursService
      .getWorkingHours()
      .then((res) => {
        if (res && res.workingHours) {
          const wh = res.workingHours;
          if (wh.openTime) setOpenTime(wh.openTime);
          if (wh.closeTime) setCloseTime(wh.closeTime);
          if (wh.timezone) setTimezone(wh.timezone);
          if (typeof wh.isEmergencyClosed === "boolean") {
            setIsEmergencyClosed(wh.isEmergencyClosed);
          }
          if (Array.isArray(wh.breakSessions) && wh.breakSessions.length > 0) {
            setBreakSessions(wh.breakSessions);
          }
        }
      })
      .catch((err) => {
        console.warn("Could not load working hours:", err);
      });
  }, []);

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
    setBreakSessions((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      // Renumber break names e.g. Break 1, Break 2...
      return filtered.map((b, idx) => ({
        ...b,
        name: `Break ${idx + 1}`,
      }));
    });
  };

  const handleAddBreak = () => {
    if (breakSessions.length >= 5) return;
    const nextIndex = breakSessions.length + 1;
    // Suggest a smart default start and end time after the last break
    let suggestedStart = "18:30";
    let suggestedEnd = "18:45";

    if (breakSessions.length > 0) {
      const last = breakSessions[breakSessions.length - 1];
      const [lh, lm] = last.endTime.split(":").map(Number);
      if (!isNaN(lh) && !isNaN(lm)) {
        const nextStartMins = (lh * 60 + lm + 90) % (24 * 60);
        const nextEndMins = (nextStartMins + 15) % (24 * 60);
        suggestedStart = `${String(Math.floor(nextStartMins / 60)).padStart(2, "0")}:${String(
          nextStartMins % 60
        ).padStart(2, "0")}`;
        suggestedEnd = `${String(Math.floor(nextEndMins / 60)).padStart(2, "0")}:${String(
          nextEndMins % 60
        ).padStart(2, "0")}`;
      }
    }

    const newBreak: BreakSession = {
      id: `break_${Date.now()}`,
      name: `Break ${nextIndex}`,
      startTime: suggestedStart,
      endTime: suggestedEnd,
      durationMinutes: calculateDuration(suggestedStart, suggestedEnd),
      isEnabled: true,
    };

    setBreakSessions((prev) => [...prev, newBreak]);
  };

  // Validation function
  const validateSettings = (): string | null => {
    if (!openTime.trim()) return "Open time is required.";
    if (!closeTime.trim()) return "Close time is required.";
    if (openTime === closeTime) return "Open time and close time cannot be the same.";

    // Validate each break session
    for (const b of breakSessions) {
      if (!b.startTime || !b.endTime) {
        return `Please specify both start and end time for ${b.name}.`;
      }
      if (b.startTime === b.endTime) {
        return `${b.name} start and end time cannot be identical.`;
      }
      if (openTime <= closeTime) {
        if (b.startTime < openTime || b.endTime > closeTime) {
          return `${b.name} (${b.startTime} - ${b.endTime}) must be within cafe open hours (${openTime} - ${closeTime}).`;
        }
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
      await workingHoursService.updateWorkingHours({
        openTime,
        closeTime,
        timezone,
        isEmergencyClosed,
        breakSessions,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Timeline computation (08:00 to 20:00 normalized to percentages)
  const timelineSegments = useMemo(() => {
    const [oh, om] = openTime.split(":").map(Number);
    const [ch, cm] = closeTime.split(":").map(Number);
    if (isNaN(oh) || isNaN(om) || isNaN(ch) || isNaN(cm)) return [];

    let totalDayMinutes = ch * 60 + cm - (oh * 60 + om);
    if (totalDayMinutes <= 0) totalDayMinutes += 24 * 60; // overnight handling
    if (totalDayMinutes <= 0) totalDayMinutes = 12 * 60;

    const startMinutes = oh * 60 + om;

    // Filter and sort enabled break sessions that fall inside open hours
    const sortedBreaks = [...breakSessions]
      .filter((b) => b.isEnabled)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const segments: Array<{
      type: "order" | "closed";
      startPct: number;
      widthPct: number;
      label?: string;
      timeRange?: string;
    }> = [];

    let currentCursorMinutes = startMinutes;

    for (const b of sortedBreaks) {
      const [bsh, bsm] = b.startTime.split(":").map(Number);
      const [beh, bem] = b.endTime.split(":").map(Number);
      if (isNaN(bsh) || isNaN(bsm) || isNaN(beh) || isNaN(bem)) continue;

      let bStart = bsh * 60 + bsm;
      let bEnd = beh * 60 + bem;
      if (bStart < startMinutes) bStart += 24 * 60;
      if (bEnd < bStart) bEnd += 24 * 60;

      // Closed segment prior to break
      if (bStart > currentCursorMinutes) {
        const closedMins = bStart - currentCursorMinutes;
        segments.push({
          type: "closed",
          startPct: ((currentCursorMinutes - startMinutes) / totalDayMinutes) * 100,
          widthPct: (closedMins / totalDayMinutes) * 100,
        });
      }

      // Active Break (Ordering Allowed)
      const breakMins = bEnd - bStart;
      segments.push({
        type: "order",
        startPct: ((bStart - startMinutes) / totalDayMinutes) * 100,
        widthPct: (breakMins / totalDayMinutes) * 100,
        label: b.name,
        timeRange: `${b.startTime} - ${b.endTime}`,
      });

      currentCursorMinutes = Math.max(currentCursorMinutes, bEnd);
    }

    const endMinutes = startMinutes + totalDayMinutes;
    if (currentCursorMinutes < endMinutes) {
      segments.push({
        type: "closed",
        startPct: ((currentCursorMinutes - startMinutes) / totalDayMinutes) * 100,
        widthPct: ((endMinutes - currentCursorMinutes) / totalDayMinutes) * 100,
      });
    }

    return segments;
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

                      {/* Add Break Button if < 5 */}
                      {breakSessions.length < 5 && (
                        <button
                          type="button"
                          onClick={handleAddBreak}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#8E6548] bg-[#FDF9F6] px-3 py-1.5 text-xs font-semibold text-[#8E6548] hover:bg-[#8E6548] hover:text-white transition shadow-sm self-start sm:self-auto"
                        >
                          <Plus size={14} />
                          <span>Add Break</span>
                        </button>
                      )}
                    </div>

                    {/* Blue Info Notice matching reference */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-2.5 text-xs text-sky-800">
                      <Info size={16} className="text-sky-600 shrink-0" />
                      <span>
                        You can set up to 5 break sessions. Only employees can order during these times.
                      </span>
                    </div>

                    {/* Break Sessions List */}
                    <div className="space-y-3">
                      {breakSessions.map((b, index) => {
                        const badgeColor = breakBadgeColors[index % 5];
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

                            {/* Start Time - End Time Inputs */}
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
                                className="text-gray-400 hover:text-red-500 transition p-1"
                                title="Delete break session"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
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
              </div>

              {/* Bottom Card: Visual Cafe Ordering Timeline (matching screenshot) */}
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
                <span>{openTime}</span>
                {timelineSegments
                  .filter((s) => s.type === "order")
                  .map((s, idx) => (
                    <span
                      key={idx}
                      style={{ left: `${s.startPct}%` }}
                      className="absolute -translate-x-1/2"
                    >
                      {s.timeRange?.split(" - ")[0]}
                    </span>
                  ))}
                <span>{closeTime}</span>
              </div>
            </div>
          </div>
          </div>
        </main>

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
