import React, { useState, useEffect } from "react";
import { X, Check, Users, ShieldAlert, AlertCircle, Trash2 } from "lucide-react";
import type { LocationProviderSummary } from "../../services/locations/locationService";
import type { TableItem } from "../../services/tableService";

interface ManageTableProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: TableItem | null;
  locationName: string;
  locationProviders: LocationProviderSummary[];
  onSave: (tableId: number, providerId: string | null) => Promise<void>;
}

export const ManageTableProviderModal: React.FC<ManageTableProviderModalProps> = ({
  isOpen,
  onClose,
  table,
  locationName,
  locationProviders = [],
  onSave,
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && table) {
      setSelectedProviderId(table.providerId || null);
      setError(null);
    }
  }, [isOpen, table]);

  if (!isOpen || !table) return null;

  const getInitials = (name?: string, userName?: string) => {
    const target = (name || userName || "PR").trim();
    const parts = target.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return target.slice(0, 2).toUpperCase();
  };

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSave(table.id, selectedProviderId);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update provider assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanged = (selectedProviderId || null) !== (table.providerId || null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-[28px] border border-[#EEE5DC] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EEE5DC]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835] shadow-xs">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#342219]">
                Manage Provider – {table.name}
              </h3>
              <p className="text-xs text-[#8A7667]">{locationName} • One provider per table</p>
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
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#342219]">
              Available Providers in this Location ({locationProviders.length})
            </label>
            {selectedProviderId && (
              <button
                type="button"
                onClick={() => setSelectedProviderId(null)}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove Provider</span>
              </button>
            )}
          </div>

          {locationProviders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#EEE5DC] bg-[#FAF8F5] p-5 text-center">
              <ShieldAlert className="w-6 h-6 text-[#A8907E] mx-auto mb-1.5" />
              <p className="text-xs font-bold text-[#342219]">No Providers in Location</p>
              <p className="text-[11px] text-[#8A7667] mt-0.5">
                Assign providers to this location first before allocating one to this table.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {locationProviders.map((prov) => {
                const isSelected = selectedProviderId === prov.id;
                const initials = getInitials(prov.name, prov.userName);

                return (
                  <div
                    key={prov.id}
                    onClick={() => setSelectedProviderId(prov.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      isSelected
                        ? "bg-[#FAF3EB] border-[#8C5835] shadow-xs"
                        : "bg-white border-[#E8DED4] hover:bg-[#FAF8F5] hover:border-[#D5C2B1]"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {/* Radio button (One provider per table) */}
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? "border-[#8C5835] bg-[#8C5835]"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>

                      {/* Avatar */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6ECE2] text-xs font-bold text-[#8C5835]">
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#342219] truncate">
                          {prov.name || prov.userName}
                        </div>
                        <div className="text-[11px] text-[#8A7667] truncate">{prov.email}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="shrink-0 text-[10px] font-bold text-[#8C5835] bg-white px-2 py-0.5 rounded-full border border-[#E8DED4]">
                        Assigned
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-[#EEE5DC]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-gray-300 bg-white px-5 py-2 text-xs font-bold text-gray-700 hover:bg-[#FAF7F3] hover:border-gray-400 active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !hasChanged}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition cursor-pointer ${
              isSubmitting || !hasChanged
                ? "bg-gray-300 cursor-not-allowed opacity-60 shadow-none"
                : "bg-gradient-to-r from-[#6F3F24] via-[#7D4629] to-[#8C5030] hover:shadow-md hover:brightness-105"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Save Assignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageTableProviderModal;

