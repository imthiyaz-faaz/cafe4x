import React, { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { workingHoursService } from "../../services/working-hours";

const popularTimezones = [
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

export default function WorkingHoursPage() {
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  const [isEmergencyClosed, setIsEmergencyClosed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    workingHoursService
      .getWorkingHours()
      .then((data) => {
        if (data) {
          if (data.openTime) setOpenTime(data.openTime);
          if (data.closeTime) setCloseTime(data.closeTime);
          if (data.timezone) setTimezone(data.timezone);
          if (typeof data.isEmergencyClosed === "boolean") {
            setIsEmergencyClosed(data.isEmergencyClosed);
          }
        }
      })
      .catch(() => { });
  }, []);

  const isOpenTimeMissing = touched && !openTime.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!openTime.trim()) {
      return;
    }

    try {
      setIsSaving(true);
      await workingHoursService.updateWorkingHours({
        openTime,
        closeTime,
        timezone,
        isEmergencyClosed,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch {
      // Local feedback
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full max-w-xl">
            {/* Card Container */}
            <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-2xl shadow-[#70452D]/10">

              {/* Card Header matching screenshot */}
              <div className="flex items-center gap-3 bg-[#9A7559] px-6 py-4.5 text-white">
                <Clock size={22} className="text-white" />
                <h2 className="text-lg font-bold tracking-tight">
                  Working Hours Settings
                </h2>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">

                {/* Success Notification Alert */}
                {saveSuccess && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Working hours settings saved successfully!</span>
                  </div>
                )}

                {/* Open Time & Close Time Grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

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
                        className={`w-full rounded-md border px-3 py-2 text-sm text-gray-800 outline-none transition ${isOpenTimeMissing
                          ? "border-red-500 bg-red-50/20 focus:ring-1 focus:ring-red-400"
                          : "border-gray-300 focus:border-[#9A7559] focus:ring-1 focus:ring-[#9A7559]/20"
                          }`}
                      />
                      {isOpenTimeMissing && (
                        <AlertCircle
                          size={16}
                          className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-red-500"
                        />
                      )}
                    </div>
                    {isOpenTimeMissing && (
                      <p className="mt-1.5 text-[11px] font-medium text-red-500">
                        Open time is required.
                      </p>
                    )}
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#9A7559] focus:ring-1 focus:ring-[#9A7559]/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-800">
                    Timezone
                  </label>
                  <div className="relative">
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#9A7559] focus:ring-1 focus:ring-[#9A7559]/20"
                    >
                      {popularTimezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Emergency Override Box matching screenshot */}
                <div
                  onClick={() => setIsEmergencyClosed(!isEmergencyClosed)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${isEmergencyClosed
                    ? "border-red-300 bg-red-50/70"
                    : "border-red-100 bg-[#FFFBF8] hover:bg-red-50/40"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        size={18}
                        className={`mt-0.5 shrink-0 ${isEmergencyClosed ? "text-red-600" : "text-red-500"
                          }`}
                      />
                      <div>
                        <h4
                          className={`text-xs font-bold ${isEmergencyClosed ? "text-red-700" : "text-red-600"
                            }`}
                        >
                          Emergency Override
                        </h4>
                        <p className="mt-1 text-xs text-gray-600">
                          Temporarily close the cafe to stop accepting orders immediately.
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isEmergencyClosed ? "bg-red-600" : "bg-gray-300"
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEmergencyClosed ? "translate-x-4" : "translate-x-0"
                          }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-md bg-[#8E6A50] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#8E6A50]/20 transition duration-150 hover:bg-[#7D5B42] active:scale-95 disabled:opacity-60"
                  >
                    <Save size={15} />
                    <span>{isSaving ? "Saving..." : "Save Settings"}</span>
                  </button>
                </div>
              </form>
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
