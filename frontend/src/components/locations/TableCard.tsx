import React from "react";
import { Users, MoreVertical, Armchair, Edit3, Trash2, ShieldCheck, Power } from "lucide-react";
import type { TableItem } from "../../services/tableService";

interface TableCardProps {
  table: TableItem;
  onOpen: (table: TableItem) => void;
  onEdit: (table: TableItem) => void;
  onToggleStatus: (table: TableItem) => void;
  onDelete: (table: TableItem) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onOpen,
  onEdit,
  onToggleStatus,
  onDelete,
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

  const isOccupied = table.occupiedSeats > 0 && table.occupiedSeats >= table.seatLimit;
  const isPartiallyOccupied = table.occupiedSeats > 0 && table.occupiedSeats < table.seatLimit;

  return (
    <div className="group rounded-3xl border border-[#EEE5DC] bg-white/95 p-5 shadow-xs hover:shadow-md transition-all duration-200 backdrop-blur-xs flex flex-col justify-between">
      <div>
        {/* Top Header: Table Name, Status Badge, and 3-dot menu */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h3
              onClick={() => onOpen(table)}
              className="text-base sm:text-lg font-bold text-[#342219] group-hover:text-[#70452D] transition-colors cursor-pointer"
            >
              {table.name}
            </h3>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isOccupied
                  ? "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]"
                  : isPartiallyOccupied
                  ? "bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]"
                  : "bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]"
              }`}
            >
              {isOccupied ? "Occupied" : "Active"}
            </span>
          </div>

          {/* 3-dot More Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-[#8A7667] hover:text-[#342219] hover:bg-[#FAF8F5] rounded-xl transition cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl border border-[#EEE5DC] bg-white/98 p-1.5 shadow-xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(table);
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-xl text-xs font-semibold text-[#342219] hover:bg-[#FAF8F5] transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#8C5835]" />
                  <span>Edit Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleStatus(table);
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-xl text-xs font-semibold text-[#342219] hover:bg-[#FAF8F5] transition cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5 text-[#8C5835]" />
                  <span>{table.isActive === 1 ? "Deactivate" : "Activate"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(table);
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Table</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visual Table Illustration & Stats Container */}
        <div className="grid grid-cols-12 gap-2 items-center py-1">
          {/* Wooden tabletop illustration matching user design */}
          <div className="col-span-5 flex items-center justify-center">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
              {/* Rounded wooden tabletop */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#A86B3E] border-2 border-[#8C5835] shadow-md flex items-center justify-center p-2">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 shadow-xs flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>

              {/* Perimeter mini chairs */}
              <div className="absolute top-0 w-4 h-2.5 rounded-t-sm bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
              <div className="absolute bottom-0 w-4 h-2.5 rounded-b-sm bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
              <div className="absolute left-0 h-4 w-2.5 rounded-l-sm bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
              <div className="absolute right-0 h-4 w-2.5 rounded-r-sm bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
            </div>
          </div>

          {/* Stats info matching design */}
          <div className="col-span-7 space-y-2 text-xs pl-1">
            {/* Assigned Provider Chip */}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#8C5835] shrink-0" />
              <span
                className="font-semibold text-[#342219] truncate max-w-[130px]"
                title={table.providerName ? `${table.providerName} (${table.providerEmail || ""})` : "No Provider Assigned"}
              >
                {table.providerName || (table.providerId ? "Assigned Provider" : "No Provider")}
              </span>
            </div>

            {/* Total Seats */}
            <div className="flex items-center gap-1.5 text-[#70523E]">
              <Armchair className="w-3.5 h-3.5 text-[#A8907E] shrink-0" />
              <span className="font-medium">{table.seatLimit} Seats</span>
            </div>

            {/* Occupied count */}
            <div className="flex items-center gap-1.5 text-[#70523E]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#A8907E] shrink-0" />
              <span className="font-medium">
                {table.occupiedSeats} / {table.seatLimit} Occupied
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dual action buttons matching UI design: Manage Seats & Edit */}
      <div className="mt-4 pt-3 border-t border-[#EEE5DC] grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpen(table)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E8DED4] bg-white py-2 px-3 text-xs font-bold text-[#342219] shadow-2xs hover:bg-[#FAF8F5] transition cursor-pointer active:scale-98"
        >
          <Armchair className="w-3.5 h-3.5 text-[#8C5835]" />
          <span>Manage Seats</span>
        </button>

        <button
          type="button"
          onClick={() => onEdit(table)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E8DED4] bg-white py-2 px-3 text-xs font-bold text-[#70523E] shadow-2xs hover:bg-[#FAF8F5] transition cursor-pointer active:scale-98"
        >
          <Edit3 className="w-3.5 h-3.5 text-[#8C5835]" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
};

export default TableCard;
