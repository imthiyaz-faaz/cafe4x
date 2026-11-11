import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Plus,
  MoreVertical,
  RotateCw,
  Armchair,
  Users,
  ChevronRight,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import TableVisualization from "../../components/locations/TableVisualization";
import SeatDetailPanel from "../../components/locations/SeatDetailPanel";
import AddSeatsModal from "../../components/locations/AddSeatsModal";
import AssignEmployeeModal from "../../components/locations/AssignEmployeeModal";
import EditTableModal from "../../components/locations/EditTableModal";
import TransferSeatModal from "../../components/locations/TransferSeatModal";
import EmployeeDetailsModal from "../../components/locations/EmployeeDetailsModal";
import { tableService, type TableDetailsData, type SeatItem } from "../../services/tableService";

export const TableDetails: React.FC = () => {
  const { locationId, tableId, shortCode } = useParams();
  const navigate = useNavigate();

  const [tableData, setTableData] = useState<TableDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [viewLayout, setViewLayout] = useState<"table" | "grid">("table");

  // Modals
  const [isAddSeatsOpen, setIsAddSeatsOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isEditTableOpen, setIsEditTableOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isEmployeeDetailsOpen, setIsEmployeeDetailsOpen] = useState(false);
  const [viewEmployeeSeatId, setViewEmployeeSeatId] = useState<string | null>(null);
  const [targetSeatForAssign, setTargetSeatForAssign] = useState<SeatItem | null>(null);
  const [sourceSeatForTransfer, setSourceSeatForTransfer] = useState<SeatItem | null>(null);

  // More Actions dropdown menu
  const [menuOpen, setMenuOpen] = useState(false);
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

  const loadData = async () => {
    if (!tableId) return;
    setIsLoading(true);
    try {
      const data = await tableService.getTableDetails(tableId);
      setTableData(data);
      // Auto-keep selected seat updated if previously selected
      setSelectedSeat((prev) => {
        if (!prev || !data?.seats) return null;
        return data.seats.find((s) => s.id === prev.id) || null;
      });
    } catch (err) {
      console.error("Failed to load table details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tableId]);

  const handleBackToTables = () => {
    if (shortCode) {
      navigate(`/${shortCode}/admin/locationseats/${locationId}`);
    } else {
      navigate(`/admin/locationseats/${locationId}`);
    }
  };

  const handleAddSeats = async (tblId: number, newLimit: number) => {
    await tableService.addSeats(tblId, newLimit);
    await loadData();
  };

  const handleAssignEmployee = async (
    seatId: string,
    emp: { employeeId?: string; employeeName: string; employeeEmail: string }
  ) => {
    await tableService.assignSeat(seatId, emp);
    await loadData();
  };

  const handleTransferEmployee = async (sourceSeatId: string, targetSeatId: string) => {
    await tableService.transferSeat(sourceSeatId, targetSeatId);
    await loadData();
  };

  const handleUnassignSeat = async (seat: SeatItem) => {
    if (!window.confirm(`Unassign ${seat.employeeName || "employee"} from Seat ${seat.number}?`)) return;
    try {
      await tableService.unassignSeat(seat.id);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to unassign seat.");
    }
  };

  const handleToggleSeatStatus = async (seat: SeatItem) => {
    const nextStatus = seat.status === "blocked" ? "available" : "blocked";
    try {
      await tableService.updateSeatStatus(seat.id, nextStatus as "available" | "blocked");
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to update seat status.");
    }
  };

  const handleToggleTableActive = async () => {
    if (!tableData) return;
    setMenuOpen(false);
    try {
      await tableService.toggleTableStatus(tableData.id);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to toggle status.");
    }
  };

  const handleDeleteTable = async () => {
    if (!tableData) return;
    setMenuOpen(false);
    if (tableData.occupiedSeats > 0) {
      alert(`Cannot delete table with ${tableData.occupiedSeats} assigned employee(s). Please unassign them first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete '${tableData.name}'?`)) return;
    try {
      await tableService.deleteTable(tableData.id);
      handleBackToTables();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete table.");
    }
  };

  const handleDownloadQRs = () => {
    setMenuOpen(false);
    alert(`Downloading QR codes for all seats in ${tableData?.name || "Table"}...`);
  };

  if (isLoading && !tableData) {
    return (
      <Background>
        <div className="flex min-h-screen flex-col pt-20 text-[#4A3E3D]">
          <Navbar />
          <div className="flex-1 flex items-center justify-center py-24">
            <RotateCw className="w-8 h-8 animate-spin text-[#8C5835]" />
          </div>
        </div>
      </Background>
    );
  }

  const seats = tableData?.seats || [];
  const occupiedCount = tableData?.occupiedSeats || 0;
  const availableCount = tableData?.availableSeats || 0;
  const seatLimit = tableData?.seatLimit || 0;
  const occupancyPercentage = tableData?.occupancyPercentage || (seatLimit > 0 ? Math.round((occupiedCount / seatLimit) * 100) : 0);

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-16 text-[#4A3E3D]">
        <Navbar />

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Breadcrumb Navigation matching reference */}
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8A7667]">
            <button
              type="button"
              onClick={handleBackToTables}
              className="hover:text-[#342219] transition cursor-pointer"
            >
              Locations
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#BBA697]" />
            <button
              type="button"
              onClick={handleBackToTables}
              className="hover:text-[#342219] transition cursor-pointer"
            >
              {tableData?.locationName || "Location"}
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#BBA697]" />
            <span className="font-bold text-[#342219]">{tableData?.name || "Table Details"}</span>
          </div>

          {/* Top Bar: Back button, Title, Status & Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToTables}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-[#EEE5DC] text-xs font-bold text-[#70452D] hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Tables</span>
              </button>

              <div className="w-9 h-9 rounded-2xl bg-[#FAF0E6] text-[#70452D] flex items-center justify-center shadow-2xs shrink-0">
                <Armchair className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-[#342219] tracking-tight">
                    {tableData?.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tableData?.isActive === 1
                        ? "bg-[#D1F2D9] text-[#0E7A38] border border-[#A7E5B5]"
                        : "bg-stone-200 text-stone-700 border border-stone-300"
                    }`}
                  >
                    {tableData?.isActive === 1 ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-[#8A7667] mt-0.5">
                  Manage seats, assign employees, and view table details.
                </p>
              </div>
            </div>

            {/* Action Buttons matching screenshot */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsEditTableOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white border border-[#EEE5DC] text-xs font-bold text-[#342219] hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Table</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddSeatsOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#70452D] text-white text-xs font-bold shadow-xs hover:bg-[#5C3824] transition cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Add Seats</span>
              </button>

              {/* More Actions Dropdown Menu */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-2xl bg-white border border-[#EEE5DC] text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#EEE5DC] bg-white p-1.5 shadow-xl z-20 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={handleToggleTableActive}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#342219] hover:bg-[#FAF6F1] rounded-xl transition cursor-pointer"
                    >
                      {tableData?.isActive === 1 ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Deactivate Table</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Activate Table</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadQRs}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#342219] hover:bg-[#FAF6F1] rounded-xl transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#70452D]" />
                      <span>Download QR Codes</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteTable}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Table</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4 Overview Statistics Cards (Exact match to reference screenshot) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Seat Limit */}
            <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 p-4 sm:p-5 shadow-2xs backdrop-blur-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FAF0E6] text-[#70452D] flex items-center justify-center shrink-0">
                <Armchair className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#8A7667] block uppercase tracking-wider">
                  Seat Limit
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#342219] leading-tight">
                  {seatLimit}
                </span>
              </div>
            </div>

            {/* Card 2: Occupied */}
            <div className="rounded-3xl border border-[#D5EFE0] bg-[#F2FBF6]/90 p-4 sm:p-5 shadow-2xs backdrop-blur-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#D6F4E1] text-[#0E7A38] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#0E7A38] block uppercase tracking-wider">
                  Occupied
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#0E7A38] leading-tight">
                  {occupiedCount}
                </span>
              </div>
            </div>

            {/* Card 3: Available */}
            <div className="rounded-3xl border border-[#FDEBCC] bg-[#FFFBF2]/90 p-4 sm:p-5 shadow-2xs backdrop-blur-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FEF2DA] text-[#D97706] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#B45309] block uppercase tracking-wider">
                  Available
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#B45309] leading-tight">
                  {availableCount}
                </span>
              </div>
            </div>

            {/* Card 4: Occupancy Radial / Progress */}
            <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 p-4 sm:p-5 shadow-2xs backdrop-blur-sm flex items-center gap-3.5">
              {/* Circular Gauge */}
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#EFEBE6"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#8C5835"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={
                      2 * Math.PI * 20 * (1 - occupancyPercentage / 100)
                    }
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-[#342219]">
                  {occupancyPercentage}%
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#8A7667] block uppercase tracking-wider">
                  Occupancy
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#342219] block">
                  {occupiedCount} / {seatLimit} Seats
                </span>
              </div>
            </div>
          </div>

          {/* Main Content: Left Interactive Seating Layout & Right Seat Detail Panel */}
          <div
            className={`grid grid-cols-1 ${
              selectedSeat ? "lg:grid-cols-12" : "grid-cols-1"
            } gap-6 items-start transition-all duration-300`}
          >
            {/* Left Section: Interactive Seating Layout */}
            <div className={selectedSeat ? "lg:col-span-7" : "w-full"}>
              <TableVisualization
                tableName={tableData?.name || "Table"}
                seatLimit={seatLimit}
                seats={seats}
                selectedSeatId={selectedSeat?.id}
                onSelectSeat={(seat) => {
                  setSelectedSeat(seat);
                }}
                viewLayout={viewLayout}
                onToggleViewLayout={() => setViewLayout((v) => (v === "table" ? "grid" : "table"))}
              />
            </div>

            {/* Right Section: Dynamic Seat Detail Panel (Rendered ONLY when a seat is selected) */}
            {selectedSeat && (
              <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-4 duration-200">
                <SeatDetailPanel
                  seat={selectedSeat}
                  tableName={tableData?.name || "Table"}
                  locationName={tableData?.locationName || "Location"}
                  shortCode={shortCode}
                  onClose={() => setSelectedSeat(null)}
                  onAssignEmployee={(seat) => {
                    setTargetSeatForAssign(seat);
                    setIsAssignOpen(true);
                  }}
                  onChangeEmployee={(seat) => {
                    setTargetSeatForAssign(seat);
                    setIsAssignOpen(true);
                  }}
                  onTransferSeat={(seat) => {
                    setSourceSeatForTransfer(seat);
                    setIsTransferOpen(true);
                  }}
                  onUnassignSeat={handleUnassignSeat}
                  onToggleStatus={handleToggleSeatStatus}
                  onViewEmployeeFullModal={(seat) => {
                    setViewEmployeeSeatId(seat.id);
                    setIsEmployeeDetailsOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <AddSeatsModal
        isOpen={isAddSeatsOpen}
        onClose={() => setIsAddSeatsOpen(false)}
        table={tableData}
        onAddSeats={handleAddSeats}
      />

      <AssignEmployeeModal
        isOpen={isAssignOpen}
        onClose={() => {
          setIsAssignOpen(false);
          setTargetSeatForAssign(null);
        }}
        seat={targetSeatForAssign}
        onAssign={handleAssignEmployee}
        shortCode={shortCode}
      />

      <TransferSeatModal
        isOpen={isTransferOpen}
        onClose={() => {
          setIsTransferOpen(false);
          setSourceSeatForTransfer(null);
        }}
        sourceSeat={sourceSeatForTransfer}
        seats={seats}
        onTransfer={handleTransferEmployee}
      />

      <EditTableModal
        isOpen={isEditTableOpen}
        onClose={() => setIsEditTableOpen(false)}
        table={tableData}
        onUpdate={async (tblId, payload) => {
          await tableService.updateTable(tblId, payload);
          await loadData();
        }}
        existingTables={[]}
      />

      <EmployeeDetailsModal
        isOpen={isEmployeeDetailsOpen}
        onClose={() => {
          setIsEmployeeDetailsOpen(false);
          setViewEmployeeSeatId(null);
        }}
        seatId={viewEmployeeSeatId}
        onEditAssignment={(seat) => {
          setTargetSeatForAssign(seat);
          setIsAssignOpen(true);
        }}
        onTransferSeat={(seat) => {
          setSourceSeatForTransfer(seat);
          setIsTransferOpen(true);
        }}
        onUnassignSeat={handleUnassignSeat}
      />
    </Background>
  );
};

export default TableDetails;
