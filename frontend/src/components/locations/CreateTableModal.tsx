import React, { useState, useEffect, useRef } from "react";
import { X, Plus, AlertCircle, Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { TableItem } from "../../services/tableService";
import type { LocationProviderSummary } from "../../services/locations";

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; seatLimit: number; isActive: boolean; providerId: string }) => Promise<void>;
  existingTables: TableItem[];
  tableLimit: number;
  locationProviders: LocationProviderSummary[];
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingTables,
  tableLimit,
  locationProviders = [],
}) => {
  const [name, setName] = useState("");
  const [seatLimit, setSeatLimit] = useState(8);
  const [providerId, setProviderId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Suggest table name and default provider
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNameError(null);
    setIsDropdownOpen(false);

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

    if (locationProviders.length > 0) {
      setProviderId(locationProviders[0].id);
    } else {
      setProviderId("");
    }
  }, [isOpen, existingTables, locationProviders]);

  if (!isOpen) return null;

  const selectedProvider = locationProviders.find((p) => p.id === providerId);

  const badgePalette = [
    { pill: "bg-[#8C5835] text-white" },
    { pill: "bg-[#28A745] text-white" },
    { pill: "bg-[#7C3AED] text-white" },
    { pill: "bg-[#D97706] text-white" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNameError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Table name is required.");
      return;
    }

    const isDup = existingTables.some(
      (t) => t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDup) {
      setNameError("This table name is already used in this location.");
      return;
    }

    if (seatLimit <= 0 || !Number.isInteger(seatLimit)) {
      setError("Seat limit must be a positive integer.");
      return;
    }

    if (!providerId) {
      setError("Please assign a provider to this table.");
      return;
    }

    if (existingTables.length >= tableLimit) {
      setError(`Cannot create more tables. Location table limit is ${tableLimit}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: trimmed, seatLimit, isActive, providerId });
      onClose();
    } catch (err: any) {
      const respMsg = err?.response?.data?.message || err?.message || "";
      if (err?.response?.status === 409 || respMsg.toLowerCase().includes("already exists")) {
        setNameError("This table name is already used in this location.");
      } else {
        setError(respMsg || "Failed to create table.");
      }
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
              <h2 className="text-base font-extrabold text-[#342219]">Create Table</h2>
              <p className="text-[11px] text-[#8A7667]">Add a new table to this location</p>
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

        {locationProviders.length === 0 && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              This location has no assigned providers yet. Please assign at least one provider to the location before creating a table.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Table Name */}
          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Table Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. Table 5"
              required
              className={`w-full px-3.5 py-2.5 bg-[#FAF8F5] border rounded-2xl text-xs sm:text-sm text-[#342219] placeholder:text-[#B5A496] focus:outline-none transition ${
                nameError
                  ? "border-rose-500 ring-1 ring-rose-500 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                  : "border-[#E8DED4] focus:ring-2 focus:ring-[#8C5835] focus:bg-white"
              }`}
            />
            {nameError && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nameError}</span>
              </p>
            )}
          </div>

          {/* Seat Limit */}
          <div>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Seat Limit <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={seatLimit}
              onChange={(e) => setSeatLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-2xl text-xs sm:text-sm text-[#342219] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:bg-white transition"
            />
            <p className="text-[10px] text-[#8A7667] mt-1">
              Supports 2, 4, 8, 15, 20, 30 and up to 50 seats dynamically.
            </p>
          </div>

          {/* Assigned Provider (Mandatory) */}
          <div ref={dropdownRef}>
            <label className="block text-xs font-bold text-[#342219] mb-1.5">
              Assigned Provider <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={locationProviders.length === 0}
                className="flex w-full items-center justify-between rounded-2xl border border-[#E8DED4] bg-[#FAF8F5] px-3.5 py-2.5 text-left text-xs text-[#342219] shadow-2xs hover:border-[#8C5835] focus:outline-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedProvider ? (
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#8C5835] text-white text-[9px] font-bold flex items-center justify-center">
                        P{Math.max(1, locationProviders.findIndex((p) => p.id === selectedProvider.id) + 1)}
                      </span>
                      <span className="font-semibold text-[#342219]">{selectedProvider.name}</span>
                      <span className="text-[11px] text-[#8A7667]">({selectedProvider.email})</span>
                    </div>
                  ) : (
                    <span className="text-[#B5A496]">Select Provider</span>
                  )}
                </div>
                {isDropdownOpen ? (
                  <ChevronUp size={15} className="text-[#8A7667] shrink-0" />
                ) : (
                  <ChevronDown size={15} className="text-[#8A7667] shrink-0" />
                )}
              </button>

              {/* Dropdown popup */}
              {isDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-2xl border border-[#EEE5DC] bg-white shadow-xl overflow-hidden animate-in fade-in duration-150">
                  <div className="max-h-48 overflow-y-auto py-1">
                    {locationProviders.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-[#8A7667] text-center">
                        No providers assigned to this location
                      </div>
                    ) : (
                      locationProviders.map((p, idx) => {
                        const isSelected = p.id === providerId;
                        const style = badgePalette[idx % badgePalette.length];
                        const initial = `P${idx + 1}`;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setProviderId(p.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition cursor-pointer hover:bg-[#FAF4ED] ${
                              isSelected ? "bg-[#FAF4ED] font-semibold text-[#8C5835]" : "text-[#342219]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${style.pill}`}>
                                {initial}
                              </span>
                              <div>
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-[10px] text-[#8A7667]">{p.email}</div>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="text-[#8C5835]" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#8A7667] mt-1">
              Select one provider responsible for this table.
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
              disabled={isSubmitting || locationProviders.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] rounded-2xl hover:shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
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
