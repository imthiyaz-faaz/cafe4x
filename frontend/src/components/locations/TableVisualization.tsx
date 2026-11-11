import React from "react";
import { User, ShieldAlert, LayoutGrid, List } from "lucide-react";
import type { SeatItem } from "../../services/tableService";

interface TableVisualizationProps {
  tableName: string;
  seatLimit: number;
  seats: SeatItem[];
  selectedSeatId?: string | null;
  onSelectSeat?: (seat: SeatItem) => void;
  viewLayout?: "grid" | "table";
  onToggleViewLayout?: () => void;
}

export const TableVisualization: React.FC<TableVisualizationProps> = ({
  tableName,
  seatLimit,
  seats,
  selectedSeatId,
  onSelectSeat,
  viewLayout = "table",
  onToggleViewLayout,
}) => {
  // Sort seats by seat number 1..N
  const sortedSeats = React.useMemo(() => {
    return [...seats].sort((a, b) => a.number - b.number);
  }, [seats]);

  const totalSeatsCount = sortedSeats.length;

  /**
   * Adaptive conference table arrangement:
   * For N <= 4:
   *   Top: 2 seats, Bottom: 2 seats (or 1 top, 1 bottom)
   * For N <= 8:
   *   Top: 4 seats, Bottom: 4 seats
   * For N > 8:
   *   Left end: side seats
   *   Top row: top seats
   *   Right end: side seats
   *   Bottom row: bottom seats
   * e.g. for N = 18 (reference screenshot):
   *   Top: 1, 2, 3, 4, 5, 6 (6 seats)
   *   Right: 13, 14, 15 (3 seats)
   *   Bottom: 12, 11, 10, 9, 8, 7 (6 seats)
   *   Left: 18, 17, 16 (3 seats)
   */
  const layout = React.useMemo(() => {
    if (totalSeatsCount <= 8) {
      const half = Math.ceil(totalSeatsCount / 2);
      return {
        top: sortedSeats.slice(0, half),
        right: [],
        bottom: sortedSeats.slice(half).reverse(),
        left: [],
      };
    }

    // Side seat count: 1 for <=12, 2 for <=16, 3 for <=24, 4 for >24
    let sideCount = 1;
    if (totalSeatsCount >= 28) sideCount = 4;
    else if (totalSeatsCount >= 18) sideCount = 3;
    else if (totalSeatsCount >= 14) sideCount = 2;

    const remainingForTopBottom = totalSeatsCount - 2 * sideCount;
    const topCount = Math.ceil(remainingForTopBottom / 2);
    const bottomCount = remainingForTopBottom - topCount;

    // Top: 1 .. topCount
    const top = sortedSeats.slice(0, topCount);

    // Bottom: topCount + 1 .. topCount + bottomCount (reversed for counter-clockwise flow)
    const bottomSlice = sortedSeats.slice(topCount, topCount + bottomCount);
    const bottom = [...bottomSlice].reverse();

    // Right end: next sideCount seats
    const right = sortedSeats.slice(topCount + bottomCount, topCount + bottomCount + sideCount);

    // Left end: remaining sideCount seats (rendered top-to-bottom: N, N-1, N-2)
    const left = sortedSeats.slice(topCount + bottomCount + sideCount).reverse();

    return { top, right, bottom, left };
  }, [sortedSeats, totalSeatsCount]);

  const renderSeatChair = (seat: SeatItem) => {
    const isSelected = selectedSeatId === seat.id;
    const isOccupied =
      seat.status === "occupied" ||
      Boolean(seat.employeeName && seat.employeeName.trim().length > 0) ||
      Boolean(seat.employeeEmail && seat.employeeEmail.trim().length > 0);
    const isBlocked = seat.status === "blocked";

    // Cushion styling matching reference image:
    // Available: crisp off-white/light-grey cushion, subtle border, dark grey number & user icon
    // Occupied: fresh mint-green cushion (#A8F5CB / #34D399), dark green border (#059669), green text
    // Blocked: soft rose cushion, red border, red text
    let bgClasses = "bg-[#FAF7F2] border-[#E8DFD5] text-[#5C4D44]";
    if (isBlocked) {
      bgClasses = isSelected
        ? "bg-rose-500 text-white border-rose-600 ring-4 ring-rose-300"
        : "bg-rose-100 border-rose-300 text-rose-800 shadow-xs";
    } else if (isOccupied) {
      bgClasses = isSelected
        ? "bg-[#34D399] text-white border-[#059669] ring-4 ring-emerald-300"
        : "bg-[#D1F7DE] border-[#86EFAC] text-[#065F46] shadow-xs";
    } else {
      if (isSelected) {
        bgClasses = "bg-[#FAF0E6] text-[#70452D] border-[#8C5835] ring-4 ring-[#DDB48C]";
      }
    }

    return (
      <button
        key={seat.id}
        type="button"
        onClick={() => onSelectSeat?.(seat)}
        className={`group relative flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-2xl border transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 focus:outline-none shrink-0 ${bgClasses} ${
          isSelected ? "scale-105 shadow-md" : "shadow-2xs"
        }`}
        style={{ minWidth: "2.75rem", minHeight: "3.25rem" }}
        title={`Seat ${seat.number}: ${
          isBlocked ? "Blocked" : isOccupied ? `Occupied by ${seat.employeeName}` : "Available"
        }`}
      >
        {isBlocked ? (
          <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5" />
        ) : (
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5 opacity-90" />
        )}
        <span className="text-[10px] sm:text-[11px] font-black leading-none">{seat.number}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-3xl border border-[#EEE5DC] bg-white/95 shadow-sm backdrop-blur-md relative">
      {/* Top Header: Legend on Left, Layout Mode Switcher on Right */}
      <div className="w-full flex items-center justify-between mb-5 flex-wrap gap-3">
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span className="text-[#342219]">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB] border border-[#D1D5DB]" />
            <span className="text-[#70523E]">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span className="text-rose-700">Blocked</span>
          </div>
        </div>

        {/* View Layout Toggle (Grid vs Table) */}
        {onToggleViewLayout && (
          <div className="flex items-center p-1 rounded-xl bg-[#FAF6F1] border border-[#EEE5DC]">
            <button
              type="button"
              onClick={onToggleViewLayout}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewLayout === "table" ? "bg-[#70452D] text-white shadow-2xs" : "text-[#70452D] hover:bg-white"
              }`}
              title="Table View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleViewLayout}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewLayout === "grid" ? "bg-[#70452D] text-white shadow-2xs" : "text-[#70452D] hover:bg-white"
              }`}
              title="Grid View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Interactive Seating Area */}
      {viewLayout === "grid" ? (
        // Grid View of Seats
        <div className="w-full grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 py-4">
          {sortedSeats.map(renderSeatChair)}
        </div>
      ) : (
        // Real Conference Table Seating Layout (Matching Screenshot)
        <div className="w-full max-w-xl flex flex-col items-center select-none py-2 overflow-x-auto">
          {/* Top Row Seats */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 w-full mb-3 px-8">
            {layout.top.map(renderSeatChair)}
          </div>

          {/* Middle Row: Left Seats, Center Table, Right Seats */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Left End Seats */}
            {layout.left.length > 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                {layout.left.map(renderSeatChair)}
              </div>
            ) : null}

            {/* Center Wooden Conference Table */}
            <div className="flex-1 min-w-[200px] sm:min-w-[260px] h-28 sm:h-36 rounded-3xl sm:rounded-4xl bg-gradient-to-r from-[#C2854E] via-[#A76D3A] to-[#8C5528] border-4 border-[#7A451E] shadow-2xl flex flex-col items-center justify-center text-white px-4 relative overflow-hidden">
              {/* Subtle sheen highlight */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

              {/* Plant Centerpiece */}
              <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-md flex items-center justify-center mb-1.5 border-2 border-emerald-400/60">
                <span className="text-sm sm:text-base select-none">🌿</span>
              </div>

              <h4 className="relative z-10 text-sm sm:text-base font-black tracking-wide drop-shadow-md truncate max-w-full">
                {tableName}
              </h4>
              <span className="relative z-10 text-[10px] sm:text-[11px] font-semibold opacity-95 drop-shadow-sm flex items-center gap-1 mt-0.5">
                <span>🪑</span> {seatLimit} Seats
              </span>
            </div>

            {/* Right End Seats */}
            {layout.right.length > 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                {layout.right.map(renderSeatChair)}
              </div>
            ) : null}
          </div>

          {/* Bottom Row Seats */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 w-full mt-3 px-8">
            {layout.bottom.map(renderSeatChair)}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableVisualization;
