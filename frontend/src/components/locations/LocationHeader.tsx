import React from "react";
import { ArrowLeft, Plus, Building2, Users, ChevronRight } from "lucide-react";
import type { LocationProviderSummary } from "../../services/locations/locationService";

interface LocationHeaderProps {
  locationName: string;
  isActive: boolean;
  assignedProviders?: LocationProviderSummary[];
  onBack: () => void;
  onCreateTable: () => void;
  onOpenAssignProviders?: () => void;
}

export const LocationHeader: React.FC<LocationHeaderProps> = ({
  locationName,
  isActive,
  assignedProviders = [],
  onBack,
  onCreateTable,
  onOpenAssignProviders,
}) => {
  const badgePalette = [
    { bg: "bg-[#F3E8DF]", text: "text-[#8C5835]", pill: "bg-[#8C5835] text-white" },
    { bg: "bg-[#E1F3E9]", text: "text-[#1E7E34]", pill: "bg-[#28A745] text-white" },
    { bg: "bg-[#EDE9FE]", text: "text-[#6D28D9]", pill: "bg-[#7C3AED] text-white" },
    { bg: "bg-[#FEF3C7]", text: "text-[#B45309]", pill: "bg-[#D97706] text-white" },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
      {/* Left: Back button, Name, and Status */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#70452D] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Locations</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-[#342219] tracking-tight">
                {locationName}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isActive
                    ? "bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]"
                    : "bg-[#F3EFEA] text-[#8A7667] border border-[#E5DDD4]"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-[#8A7667] mt-0.5">
              Manage tables, seats and providers for this location
            </p>
          </div>
        </div>
      </div>

      {/* Center/Right: Assigned Providers Card */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          onClick={onOpenAssignProviders}
          className={`flex items-center gap-3 rounded-2xl border border-[#EEE5DC] bg-white/95 px-4 py-2.5 shadow-2xs transition-all ${
            onOpenAssignProviders ? "hover:border-[#8C5835] hover:shadow-xs cursor-pointer" : ""
          }`}
          title="Click to manage assigned providers for this location"
        >
          <div className="w-8 h-8 rounded-xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#342219]">
              Assigned Providers ({assignedProviders.length})
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {assignedProviders.length === 0 ? (
                <span className="text-[10px] text-[#A8907E] italic">
                  No providers assigned
                </span>
              ) : (
                assignedProviders.slice(0, 3).map((p, idx) => {
                  const style = badgePalette[idx % badgePalette.length];
                  return (
                    <span
                      key={p.id || idx}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black ${style.pill}`}>
                        P{idx + 1}
                      </span>
                      <span>{p.name || p.userName}</span>
                    </span>
                  );
                })
              )}
              {assignedProviders.length > 3 && (
                <span className="text-[10px] font-bold text-[#8C5835] bg-[#F5ECE1] px-1.5 py-0.5 rounded-md">
                  +{assignedProviders.length - 3}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#A8907E] shrink-0" />
        </div>

        {/* Action Button: Create Table */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateTable}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#754329]/20 hover:shadow-lg transition cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Create Table</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationHeader;
