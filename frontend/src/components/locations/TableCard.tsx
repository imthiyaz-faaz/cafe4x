import React from "react";
import { Users, MoreVertical, ArrowRight, Armchair } from "lucide-react";
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
    <div className="group rounded-3xl border border-[#EEE5DC] bg-white/95 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 backdrop-blur-xs flex flex-col justify-between">
      <div>
        {/* Top Header: Table Name, Status Badge, and 3-dot menu */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-bold text-[#342219] group-hover:text-[#70452D] transition-colors">
              {table.name}
            </h3>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isOccupied
                  ? "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]"
                  : isPartiallyOccupied
                  ? "bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]"
                  : "bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]"
              }`}
            >
              {isOccupied ? "Occupied" : "Available"}
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
                  className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold text-[#342219] hover:bg-[#FAF8F5] transition cursor-pointer"
                >
                  Edit Table
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleStatus(table);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold text-[#342219] hover:bg-[#FAF8F5] transition cursor-pointer"
                >
                  {table.isActive === 1 ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(table);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  Delete Table
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visual Table Illustration & Stats Container */}
        <div className="grid grid-cols-12 gap-3 items-center py-2">
          {/* Static Table Illustration (Left 5 cols) */}
          <div className="col-span-5 flex items-center justify-center">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
              {/* Rounded wooden tabletop */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#D9A066] to-[#A36D38] border-2 border-[#8C5835] shadow-md flex items-center justify-center p-2">
                <div className="w-4 h-4 rounded-full bg-emerald-600/80 shadow-xs flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                </div>
              </div>

              {/* Perimeter mini chairs */}
              <div className="absolute top-0 w-5 h-3 rounded-t-md bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
              <div className="absolute bottom-0 w-5 h-3 rounded-b-md bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
              <div className="absolute left-0 h-5 w-3 rounded-l-md bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
              <div className="absolute right-0 h-5 w-3 rounded-r-md bg-[#FAF4ED] border border-[#D5C2B1] shadow-2xs" />
            </div>
          </div>

          {/* Stats info (Right 7 cols) */}
          <div className="col-span-7 space-y-2 text-xs text-[#70523E] pl-2">
            <div className="flex items-center gap-2">
              <Armchair className="w-4 h-4 text-[#8C5835] shrink-0" />
              <span className="font-semibold text-[#342219]">
                {table.seatLimit} Seats
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#A8907E] shrink-0" />
              <span className="font-medium text-[#70523E]">
                {table.occupiedSeats} / {table.seatLimit} Occupied
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Open Table Action Button */}
      <div className="mt-4 pt-3 border-t border-[#EEE5DC]">
        <button
          type="button"
          onClick={() => onOpen(table)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#70452D] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#5C3824] transition cursor-pointer active:scale-98"
        >
          <span>Open Table</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TableCard;

