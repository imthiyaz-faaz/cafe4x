import React, { useState } from "react";
import { X, Check, AlertCircle, ShieldAlert } from "lucide-react";

interface SetTableLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimit: number;
  currentTablesCount: number;
  locationName: string;
  onSave: (newLimit: number) => Promise<void>;
}

export const SetTableLimitModal: React.FC<SetTableLimitModalProps> = ({
  isOpen,
  onClose,
  currentLimit,
  currentTablesCount,
  locationName,
  onSave,
}) => {
  const [limit, setLimit] = useState(currentLimit);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setLimit(currentLimit);
      setError(null);
    }
  }, [isOpen, currentLimit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(limit) || limit < 1) {
      setError("Table limit must be at least 1.");
      return;
    }

    if (limit < currentTablesCount) {
      setError(
        `Table limit cannot be less than the existing ${currentTablesCount} table${
          currentTablesCount === 1 ? "" : "s"
        } in this location.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(limit);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update table limit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-[28px] border border-[#EEE5DC] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#EEE5DC]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F6DEC9] text-[#A75D28] shadow-xs">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h16" />
                <path d="M4 12h16" />
                <path d="M4 12v6" />
                <path d="M20 12v6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#342219]">Set Table Limit</h3>
              <p className="text-[11px] text-[#8A7667] truncate max-w-[200px]">{locationName}</p>
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
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#342219]">
                Maximum Tables Allowed <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-[#8C5835]">
                {currentTablesCount} existing
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min={Math.max(1, currentTablesCount)}
                max="100"
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10) || 0);
                  if (error) setError(null);
                }}
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-sm font-bold text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
              />
            </div>
            <p className="text-[10px] text-[#8A7667] mt-1.5 leading-relaxed">
              Define how many tables admins can create for this location (min: {currentTablesCount || 1}).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EEE5DC]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-gray-300 bg-white px-5 py-2 text-xs font-bold text-gray-700 hover:bg-[#FAF7F3] hover:border-gray-400 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#6F3F24] via-[#7D4629] to-[#8C5030] px-5 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md hover:brightness-105 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Save Limit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetTableLimitModal;

