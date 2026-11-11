import React from "react";
import { ArrowLeft, Plus, Edit, MoreVertical, Building2 } from "lucide-react";

interface LocationHeaderProps {
  locationName: string;
  isActive: boolean;
  onBack: () => void;
  onCreateTable: () => void;
  onEditLocation: () => void;
  onToggleStatus?: () => void;
  onDeleteLocation?: () => void;
}

export const LocationHeader: React.FC<LocationHeaderProps> = ({
  locationName,
  isActive,
  onBack,
  onCreateTable,
  onEditLocation,
  onToggleStatus,
  onDeleteLocation,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
              Manage tables and seats for this location
            </p>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5 self-start md:self-auto">
        <button
          type="button"
          onClick={onCreateTable}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#754329]/20 hover:shadow-lg transition cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Create Table</span>
        </button>

        <button
          type="button"
          onClick={onEditLocation}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-[#70523E] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
        >
          <Edit className="w-3.5 h-3.5" />
          <span>Edit Location</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2.5 text-[#70523E] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-[#EEE5DC] bg-white/98 p-1.5 shadow-xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95">
              {onToggleStatus && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleStatus();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#342219] hover:bg-[#FAF8F5] transition cursor-pointer"
                >
                  {isActive ? "Deactivate Location" : "Activate Location"}
                </button>
              )}
              {onDeleteLocation && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteLocation();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  Delete Location
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationHeader;

