import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, Check, Users } from "lucide-react";
import type { LocationProviderSummary } from "../../services/locations/locationService";

export type FilterStatus = "all" | "available" | "occupied";

interface LocationFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: FilterStatus;
  onStatusFilterChange: (status: FilterStatus) => void;
  providerFilter?: string;
  onProviderFilterChange?: (provId: string) => void;
  providers?: LocationProviderSummary[];
  counts: {
    all: number;
    available: number;
    occupied: number;
  };
}

export const LocationFilters: React.FC<LocationFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  providerFilter = "all",
  onProviderFilterChange,
  providers = [],
  counts,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const selectedProvider = providers.find((p) => p.id === providerFilter);
  const selectedLabel = providerFilter === "all" ? "All Providers" : (selectedProvider?.name || selectedProvider?.userName || "Provider");

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
      {/* Left: Search input & Custom Providers Dropdown */}
      <div className="flex items-center gap-2.5 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8907E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search table (e.g. Table 1)"
            className="w-full pl-10 pr-4 py-2 bg-white/95 border border-[#EEE5DC] rounded-2xl text-xs sm:text-sm text-[#342219] placeholder-[#A8907E] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:border-transparent shadow-2xs"
          />
        </div>

        {/* Custom Themed Provider Filter Dropdown */}
        {providers.length > 0 && onProviderFilterChange && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                dropdownOpen
                  ? "bg-[#FAF4ED] border-[#8C5835] text-[#70452D] ring-2 ring-[#8C5835]/15"
                  : providerFilter !== "all"
                  ? "bg-[#FAF4ED] border-[#E8DED4] text-[#70452D]"
                  : "bg-white/95 border-[#EEE5DC] text-[#70523E] hover:bg-[#FAF6F1] hover:border-[#E8DED4]"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#8C5835]" />
              <span className="truncate max-w-[120px]">{selectedLabel}</span>
              {dropdownOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#8C5835] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#8C5835] shrink-0" />
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full z-30 mt-2 min-w-[190px] rounded-2xl border border-[#EEE5DC] bg-white/98 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                {/* Option: All Providers */}
                <div
                  onClick={() => {
                    onProviderFilterChange("all");
                    setDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                    providerFilter === "all"
                      ? "bg-[#FAF4ED] text-[#70452D] font-bold"
                      : "text-[#342219] hover:bg-[#FAF8F5]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8C5835]" />
                    <span>All Providers</span>
                  </div>
                  {providerFilter === "all" && (
                    <Check className="w-3.5 h-3.5 text-[#8C5835] stroke-[2.5]" />
                  )}
                </div>

                <div className="my-1 border-t border-[#F0E8DF]" />

                {/* Individual Providers */}
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {providers.map((p, idx) => {
                    const isSelected = providerFilter === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          onProviderFilterChange(p.id);
                          setDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                          isSelected
                            ? "bg-[#FAF4ED] text-[#70452D] font-bold"
                            : "text-[#342219] hover:bg-[#FAF8F5]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-4 h-4 rounded-full bg-[#EFE3D7] text-[#704225] text-[9px] font-black flex items-center justify-center shrink-0">
                            P{idx + 1}
                          </span>
                          <span className="truncate">{p.name || p.userName}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#8C5835] stroke-[2.5] shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Status Filter Buttons */}
      <div className="flex items-center gap-3 self-end md:self-auto">
        <div className="inline-flex rounded-2xl bg-white p-1 border border-[#EEE5DC] shadow-2xs">
          <button
            type="button"
            onClick={() => onStatusFilterChange("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "all"
                ? "bg-[#70452D] text-white shadow-xs"
                : "text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1]"
            }`}
          >
            <span>All Tables</span>
            <span className="text-[10px] opacity-80">({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange("available")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "available"
                ? "bg-[#70452D] text-white shadow-xs"
                : "text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Available</span>
            <span className="text-[10px] opacity-80">({counts.available})</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange("occupied")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "occupied"
                ? "bg-[#70452D] text-white shadow-xs"
                : "text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Occupied</span>
            <span className="text-[10px] opacity-80">({counts.occupied})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationFilters;
