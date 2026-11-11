import React, { useState, useEffect } from "react";
import { X, Plus, AlertCircle, Loader2 } from "lucide-react";
import type { TableItem } from "../../services/tableService";

interface AddSeatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: TableItem | null;
  onAddSeats: (tableId: number, newLimit: number) => Promise<void>;
}

export const AddSeatsModal: React.FC<AddSeatsModalProps> = ({
  isOpen,
  onClose,
  table,
  onAddSeats,
}) => {
  const currentLimit = table?.seatLimit || 0;
  const currentSeatsCount = table?.seatLimit || 0;
  const [additionalSeats, setAdditionalSeats] = useState<number>(4);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAdditionalSeats(4);
      setError(null);
    }
  }, [isOpen, table]);

  if (!isOpen || !table) return null;

  const newTotalSeatLimit = currentLimit + additionalSeats;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!additionalSeats || additionalSeats < 1 || !Number.isInteger(additionalSeats)) {
      setError("Number of additional seats must be a positive integer.");
      return;
    }

    if (newTotalSeatLimit <= currentLimit) {
      setError(`New seat limit must be greater than current seat limit (${currentLimit}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddSeats(table.id, newTotalSeatLimit);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to add seats.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EEE5DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#342219]">Add Seats</h2>
              <p className="text-[11px] text-[#8A7667]">{table.name}</p>
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

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Capacity Stats Card */}
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DED4] text-xs text-[#70523E] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[#8A7667]">Current Seat Limit:</span>
              <span className="font-bold text-[#342219]">{currentLimit} Seats</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8A7667]">Current Number of Seats:</span>
              <span className="font-bold text-[#342219]">{currentSeatsCount} Seats</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8A7667]">Occupied Seats:</span>
              <span className="font-bold text-[#1D3B2E]">{table.occupiedSeats || 0} Seats</span>
            </div>
          </div>

          {/* Number of Additional Seats */}
          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Number of Additional Seats
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={additionalSeats}
              onChange={(e) => setAdditionalSeats(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
            />
          </div>

          {/* New Total Seat Limit Preview */}
          <div className="p-3 rounded-2xl bg-[#F6ECE2]/60 border border-[#EADBCE] flex items-center justify-between">
            <span className="text-xs font-bold text-[#70452D]">New Seat Limit:</span>
            <span className="text-sm font-black text-[#70452D]">{newTotalSeatLimit} Seats</span>
          </div>

          <p className="text-[11px] text-[#8C5835] font-semibold leading-relaxed">
            +{additionalSeats} new seats will be generated (Seats {currentLimit + 1} to {newTotalSeatLimit}). Existing assigned employees and QR tokens are preserved.
          </p>

          {/* Footer Buttons */}
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
              disabled={isSubmitting || additionalSeats < 1}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] rounded-2xl hover:shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Add Seats</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSeatsModal;
