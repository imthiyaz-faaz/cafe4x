import React from "react";
import { Search } from "lucide-react";

export type FilterStatus = "all" | "available" | "occupied";

interface LocationFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: FilterStatus;
  onStatusFilterChange: (status: FilterStatus) => void;
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
  counts,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      {/* Left: Search input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8907E]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search table (e.g. Table 1)"
          className="w-full pl-10 pr-4 py-2 bg-white/95 border border-[#EEE5DC] rounded-2xl text-xs sm:text-sm text-[#342219] placeholder-[#A8907E] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:border-transparent shadow-2xs"
        />
      </div>

      {/* Right: Status Filter Buttons */}
      <div className="flex items-center gap-3 self-end sm:self-auto">
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
