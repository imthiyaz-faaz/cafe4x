import React, { useState, useEffect } from "react";
import { X, UserPlus, AlertCircle, Loader2 } from "lucide-react";
import { userApi, type UserItem } from "../../services/userApi";
import type { SeatItem } from "../../services/tableService";

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  seat: SeatItem | null;
  onAssign: (seatId: string, employee: { employeeId?: string; employeeName: string; employeeEmail: string }) => Promise<void>;
  shortCode?: string;
}

export const AssignEmployeeModal: React.FC<AssignEmployeeModalProps> = ({
  isOpen,
  onClose,
  seat,
  onAssign,
  shortCode,
}) => {
  const [employees, setEmployees] = useState<UserItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsManual(false);
    setSelectedEmpId(seat?.employeeId || "");
    setCustomName(seat?.employeeName || "");
    setCustomEmail(seat?.employeeEmail || "");

    setIsLoadingUsers(true);
    userApi
      .getUsers("Employee", shortCode)
      .then((users) => {
        setEmployees(Array.isArray(users) ? users : []);
      })
      .catch((err) => {
        console.error("Failed to load employees:", err);
      })
      .finally(() => {
        setIsLoadingUsers(false);
      });
  }, [isOpen, seat, shortCode]);

  if (!isOpen || !seat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let empName = "";
    let empEmail = "";
    let empId: string | undefined = undefined;

    if (isManual) {
      empName = customName.trim();
      empEmail = customEmail.trim().toLowerCase();
      if (!empName || !empEmail) {
        setError("Both employee name and valid email are required.");
        return;
      }
    } else {
      const selected = employees.find((u) => u.id === selectedEmpId);
      if (!selected) {
        setError("Please select an employee.");
        return;
      }
      empName = selected.name || selected.userName || selected.email;
      empEmail = selected.email;
      empId = selected.id;
    }

    setIsSubmitting(true);
    try {
      await onAssign(seat.id, {
        employeeId: empId,
        employeeName: empName,
        employeeEmail: empEmail,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to assign employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-[#EEE5DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#342219]">Assign Employee</h2>
              <p className="text-[11px] text-[#8A7667]">Seat {seat.number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8A7667] hover:text-[#342219] hover:bg-[#FAF8F5] rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Toggle between select from org and manual entry */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#342219]">Employee Source</span>
            <button
              type="button"
              onClick={() => setIsManual(!isManual)}
              className="text-[11px] font-bold text-[#8C5835] hover:underline cursor-pointer"
            >
              {isManual ? "Select from Organization" : "Enter Manually"}
            </button>
          </div>

          {!isManual ? (
            <div>
              <label className="block text-xs font-bold text-[#342219] mb-1.5">
                Select Employee
              </label>
              {isLoadingUsers ? (
                <div className="p-3 text-xs text-[#8A7667] text-center">Loading employees...</div>
              ) : (
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
                >
                  <option value="">-- Choose an employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.userName} ({emp.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#342219] mb-1.5">
                  Employee Full Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Mohamed A."
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#342219] mb-1.5">
                  Employee Email
                </label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="e.g. mohamed@example.com"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
                />
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#EEE5DC]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-[#70523E] bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl hover:bg-[#F2ECE4] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] rounded-2xl hover:shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Assignment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignEmployeeModal;

