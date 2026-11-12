import React, { useState, useEffect } from "react";
import { X, UserPlus, AlertCircle, Loader2, User, Mail } from "lucide-react";
import type { SeatItem } from "../../services/tableService";

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  seat: SeatItem | null;
  onAssign: (
    seatId: string,
    employee: { employeeId?: string; employeeName: string; employeeEmail: string; mobileNumber?: string }
  ) => Promise<void>;
  shortCode?: string;
}

export const AssignEmployeeModal: React.FC<AssignEmployeeModalProps> = ({
  isOpen,
  onClose,
  seat,
  onAssign,
}) => {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !seat) return;
    setError(null);
    setEmployeeName(seat.employeeName || "");
    setEmployeeEmail(seat.employeeEmail || "");
  }, [isOpen, seat]);

  if (!isOpen || !seat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = employeeName.trim();
    const email = employeeEmail.trim().toLowerCase();

    if (!name) {
      setError("Employee Name is required.");
      return;
    }

    if (!email) {
      setError("Employee Email is required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please provide a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssign(seat.id, {
        employeeName: name,
        employeeEmail: email,
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
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EEE5DC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#342219]">Assign Employee</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                  Seat {seat.number}
                </span>
              </div>
              <p className="text-[11px] text-[#8A7667]">
                Enter employee credentials to allocate this seat.
              </p>
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
          {/* Employee Name */}
          <div>
            <label className="text-xs font-bold text-[#342219] mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#8C5835]" />
              Employee Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="e.g. Yusuf A."
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] placeholder:text-[#B5A496] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
            />
          </div>

          {/* Employee Email */}
          <div>
            <label className="text-xs font-bold text-[#342219] mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#8C5835]" />
              Employee Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={employeeEmail}
              onChange={(e) => setEmployeeEmail(e.target.value)}
              placeholder="e.g. yusuf@faaz.com"
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] placeholder:text-[#B5A496] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
            />
            <p className="text-[10px] text-[#8A7667] mt-1">
              Used for QR code ordering link and unique assignment.
            </p>
          </div>

          {/* Action buttons */}
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
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] rounded-2xl hover:shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50"
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
