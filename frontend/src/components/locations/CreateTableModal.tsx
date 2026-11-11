import React, { useState, useEffect } from "react";
import { X, Plus, AlertCircle, Loader2 } from "lucide-react";
import type { TableItem } from "../../services/tableService";

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; seatLimit: number; isActive: boolean }) => Promise<void>;
  existingTables: TableItem[];
  tableLimit: number;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingTables,
  tableLimit,
}) => {
  const [name, setName] = useState("");
  const [seatLimit, setSeatLimit] = useState(8);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Automatically suggest next available table name (e.g. Table 1, Table 2...)
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    const usedNumbers = new Set<number>();
    existingTables.forEach((t) => {
      const match = t.name.match(/\b(\d+)\b/);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    let candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }

    setName(`Table ${candidate}`);
    setSeatLimit(8);
    setIsActive(true);
  }, [isOpen, existingTables]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Table name is required.");
      return;
    }

    if (seatLimit <= 0 || !Number.isInteger(seatLimit)) {
      setError("Seat limit must be a positive integer.");
      return;
    }

    // Check table limit
    if (existingTables.length >= tableLimit) {
      setError(`Cannot create more tables. Location table limit is ${tableLimit}.`);
      return;
    }

    // Check duplicate name
    const isDup = existingTables.some(
      (t) => t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDup) {
      setError(`A table named '${trimmed}' already exists in this location.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: trimmed, seatLimit, isActive });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to create table.");
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
            <h2 className="text-base font-extrabold text-[#342219]">Create Table</h2>
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
          {/* Table Name */}
          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Table Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Table 1"
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
            />
            <p className="text-[11px] text-[#8A7667] mt-1">
              Automatically suggested. You can edit this name.
            </p>
          </div>

          {/* Seat Limit */}
          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Seat Limit
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={seatLimit}
              onChange={(e) => setSeatLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
            />
            <p className="text-[11px] text-[#8A7667] mt-1">
              Number of seats to automatically generate for this table.
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Status
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer border ${
                  isActive
                    ? "bg-[#70452D] text-white border-[#70452D]"
                    : "bg-[#FAF8F5] text-[#70523E] border-[#E8DED4] hover:bg-[#F2ECE4]"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer border ${
                  !isActive
                    ? "bg-[#70452D] text-white border-[#70452D]"
                    : "bg-[#FAF8F5] text-[#70523E] border-[#E8DED4] hover:bg-[#F2ECE4]"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

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
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] rounded-2xl hover:shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Table</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTableModal;

