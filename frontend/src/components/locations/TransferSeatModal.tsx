import React, { useState } from "react";
import { X, ArrowRightLeft, AlertCircle, Loader2 } from "lucide-react";
import type { SeatItem } from "../../services/tableService";

interface TransferSeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceSeat: SeatItem | null;
  seats: SeatItem[];
  onTransfer: (sourceSeatId: string, targetSeatId: string) => Promise<void>;
}

export const TransferSeatModal: React.FC<TransferSeatModalProps> = ({
  isOpen,
  onClose,
  sourceSeat,
  seats,
  onTransfer,
}) => {
  const [targetSeatId, setTargetSeatId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available candidate seats for transfer: must not be the source seat, must not be blocked, and must not be occupied
  const availableTargetSeats = React.useMemo(() => {
    if (!sourceSeat) return [];
    return seats.filter(
      (s) =>
        s.id !== sourceSeat.id &&
        s.status === "available" &&
        (!s.employeeName || s.employeeName.trim().length === 0)
    );
  }, [seats, sourceSeat]);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setTargetSeatId(availableTargetSeats[0]?.id || "");
    }
  }, [isOpen, availableTargetSeats]);

  if (!isOpen || !sourceSeat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetSeatId) {
      setError("Please select a target seat to transfer this employee to.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onTransfer(sourceSeat.id, targetSeatId);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to transfer employee.");
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
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#342219]">Transfer Employee</h2>
              <p className="text-[11px] text-[#8A7667]">
                Move {sourceSeat.employeeName || "Employee"} from Seat {sourceSeat.number}
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
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DED4] text-xs text-[#70523E] space-y-1.5">
            <div className="flex justify-between">
              <span>Employee:</span>
              <span className="font-bold text-[#342219]">{sourceSeat.employeeName || "Employee"}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Seat:</span>
              <span className="font-bold text-[#8C5835]">Seat {sourceSeat.number}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Select New Target Seat
            </label>
            {availableTargetSeats.length === 0 ? (
              <p className="p-3 text-xs text-rose-600 bg-rose-50 rounded-2xl border border-rose-200">
                No available empty seats at this table to transfer to. Add more seats or make a seat available first.
              </p>
            ) : (
              <select
                value={targetSeatId}
                onChange={(e) => setTargetSeatId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
              >
                {availableTargetSeats.map((s) => (
                  <option key={s.id} value={s.id}>
                    Seat {s.number} (Available)
                  </option>
                ))}
              </select>
            )}
          </div>

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
              disabled={isSubmitting || availableTargetSeats.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] rounded-2xl hover:shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferSeatModal;

