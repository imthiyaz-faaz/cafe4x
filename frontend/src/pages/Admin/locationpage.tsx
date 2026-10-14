import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Upload,
  Download,
  RotateCw,
  Edit,
  Trash2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Armchair,
  QrCode,
  Copy,
  Check,
  User,
  ShieldCheck,
  Building2,
  ArrowLeft,
  UserCheck,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import AssignCard, { type LocationItem } from "../../components/locations/assigncard";
import { locationApi } from "../../services/locationApi";


interface SeatItem {
  number: string;
  id: string;
  employee?: string;
  orderUrl: string;
}

const initialLocationsList: LocationItem[] = [
  { id: "3", name: "office", status: "Active", totalSeats: 10, assignedProviderId: "3", assignedProviderEmail: "provider@cafe4x.com", assignedProviderName: "Cafe Provider" },
];


const defaultSeats: SeatItem[] = [
  { number: "01", id: "S001-F1-01", orderUrl: "https://cafe4x.com/order/738/1" },
  { number: "02", id: "S001-F1-02", orderUrl: "https://cafe4x.com/order/738/2" },
  { number: "03", id: "S001-F1-03", employee: "arjun.kumar@office.com", orderUrl: "https://cafe4x.com/order/738/3" },
  { number: "04", id: "S001-F1-04", orderUrl: "https://cafe4x.com/order/738/4" },
  { number: "05", id: "S001-F1-05", orderUrl: "https://cafe4x.com/order/738/5" },
  { number: "06", id: "S001-F1-06", orderUrl: "https://cafe4x.com/order/738/6" },
  { number: "07", id: "S001-F1-07", employee: "priya.sharma@office.com", orderUrl: "https://cafe4x.com/order/738/7" },
  { number: "08", id: "S001-F1-08", orderUrl: "https://cafe4x.com/order/738/8" },
  { number: "09", id: "S001-F1-09", orderUrl: "https://cafe4x.com/order/738/9" },
  { number: "10", id: "S001-F1-10", employee: "vikram.singh@office.com", orderUrl: "https://cafe4x.com/order/738/10" },
];

const officeSeats: SeatItem[] = [
  { number: "01", id: "S003-F1-01", employee: "rizwi@faaztech", orderUrl: `${window.location.origin}/order/3/01` },
  { number: "02", id: "S003-F1-02", employee: "imthi@faaztech", orderUrl: `${window.location.origin}/order/3/02` },
  { number: "03", id: "S003-F1-03", employee: "saif@faaztech", orderUrl: `${window.location.origin}/order/3/03` },
  { number: "04", id: "S003-F1-04", orderUrl: `${window.location.origin}/order/3/04` },
  { number: "05", id: "S003-F1-05", orderUrl: `${window.location.origin}/order/3/05` },
  { number: "06", id: "S003-F1-06", orderUrl: `${window.location.origin}/order/3/06` },
  { number: "07", id: "S003-F1-07", orderUrl: `${window.location.origin}/order/3/07` },
  { number: "08", id: "S003-F1-08", orderUrl: `${window.location.origin}/order/3/08` },
  { number: "09", id: "S003-F1-09", orderUrl: `${window.location.origin}/order/3/09` },
  { number: "10", id: "S003-F1-10", orderUrl: `${window.location.origin}/order/3/10` },
];

const initialSeatsByLoc: Record<string, SeatItem[]> = {
  "1": defaultSeats,
  "2": defaultSeats.map((s) => ({ ...s, id: `S002-F1-${s.number}` })),
  "3": officeSeats,
};

export default function LocationPage() {
  const [locations, setLocations] = useState<LocationItem[]>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_locations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out deprecated initial default locations: Meeting Room and Workspace
          const cleaned = parsed.filter(
            (l: any) =>
              l.name?.toLowerCase() !== "meeting room" &&
              l.name?.toLowerCase() !== "workspace" &&
              l.id !== "1" &&
              l.id !== "2"
          );
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch { }
    return initialLocationsList;
  });

  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals for Locations
  const [isCreateLocationOpen, setIsCreateLocationOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationItem | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Assign Provider Modal State
  const [assignModalLoc, setAssignModalLoc] = useState<LocationItem | null>(null);

  // Fetch from backend on mount and sync to local state
  useEffect(() => {
    let isMounted = true;
    locationApi.getLocations()
      .then((serverLocs) => {
        if (!isMounted) return;
        if (Array.isArray(serverLocs) && serverLocs.length > 0) {
          const cleaned = serverLocs.filter(
            (l: any) =>
              l.name?.toLowerCase() !== "meeting room" &&
              l.name?.toLowerCase() !== "workspace" &&
              l.id !== "1" &&
              l.id !== "2"
          );
          if (cleaned.length > 0) {
            setLocations(cleaned);
            try {
              localStorage.setItem("cafe4x_locations", JSON.stringify(cleaned));
            } catch { }
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch locations from server, using local storage:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const saveLocations = (newLocs: LocationItem[]) => {
    // 1. Always store locally in state and localStorage immediately
    setLocations(newLocs);
    try {
      localStorage.setItem("cafe4x_locations", JSON.stringify(newLocs));
    } catch { }
  };


  // Seating State for active location
  const [seatsByLoc, setSeatsByLoc] = useState<Record<string, SeatItem[]>>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_seatsByLoc");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          // ensure office has the employees if not already
          if (!parsed["3"]) {
            parsed["3"] = officeSeats;
          }
          return parsed;
        }
      }
    } catch { }
    return initialSeatsByLoc;
  });

  const saveSeatsByLoc = (data: Record<string, SeatItem[]>) => {
    setSeatsByLoc(data);
    try {
      localStorage.setItem("cafe4x_seatsByLoc", JSON.stringify(data));
    } catch { }
  };
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Create Seat Modal State (Location-Seat Create)
  const [isCreateSeatOpen, setIsCreateSeatOpen] = useState(false);
  const [newSeatForm, setNewSeatForm] = useState({
    location: "738",
    email: "",
    seatId: "",
    seatNo: "",
    orderUrl: "",
  });

  // Edit Seat Modal
  const [isEditSeatOpen, setIsEditSeatOpen] = useState(false);

  // Filter Locations
  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => l.name.toLowerCase().includes(q));
  }, [locations, searchQuery]);

  const totalRecords = filteredLocations.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLocations = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, validCurrentPage, pageSize]);

  // Active Seating State
  const activeLocationId = selectedLocation?.id || "1";
  const currentSeats = seatsByLoc[activeLocationId] || defaultSeats;
  const currentSeat = selectedSeatNumber
    ? currentSeats.find((s) => s.number === selectedSeatNumber) || null
    : null;

  // Handlers
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleExport = () => {
    const headers = ["Location Name,Status,Total Seats"];
    const rows = filteredLocations.map((l) => `"${l.name}","${l.status}","${l.totalSeats}"`);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `locations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleCreateLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    const newId = Date.now().toString();
    const newLoc: LocationItem = {
      id: newId,
      name: newLocationName.trim(),
      status: "Active",
      totalSeats: 12,
    };
    // 1. Store in local state immediately
    const updated = [...locations, newLoc];
    saveLocations(updated);

    // 2. Sync to backend asynchronously
    locationApi.createLocation(newLoc).catch((err) => {
      console.warn("Could not save location to backend:", err);
    });

    const updatedSeats = {
      ...seatsByLoc,
      [newId]: defaultSeats.map((s) => ({
        ...s,
        id: `S${newId}-F1-${s.number}`,
        orderUrl: `${window.location.origin}/order/${newId}/${parseInt(s.number, 10)}`,
      })),
    };
    saveSeatsByLoc(updatedSeats);
    setNewLocationName("");
    setIsCreateLocationOpen(false);
  };

  const handleDeleteLocation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this location?")) {
      const updated = locations.filter((l) => l.id !== id);
      saveLocations(updated);
      if (selectedLocation?.id === id) {
        setSelectedLocation(null);
      }
      locationApi.deleteLocation(id).catch((err) => {
        console.warn("Could not delete location from backend:", err);
      });
    }
  };

  // Open assign modal for a location
  const handleOpenAssignModal = (loc: LocationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignModalLoc(loc);
  };

  // Save location assignment updated from AssignCard
  const handleSaveLocationAssignment = (updatedLoc: LocationItem) => {
    const updated = locations.map((loc) =>
      loc.id === updatedLoc.id ? updatedLoc : loc
    );
    saveLocations(updated);

    locationApi.assignProvider(updatedLoc.id, {
      assignedProviderId: updatedLoc.assignedProviderId,
      assignedProviderEmail: updatedLoc.assignedProviderEmail,
      assignedProviderName: updatedLoc.assignedProviderName,
    }).catch((err) => {
      console.warn("Could not assign provider on backend:", err);
    });
  };


  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Create New Seat in Seating Page
  const handleCreateSeatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeatForm.seatNo.trim()) return;
    const padded = newSeatForm.seatNo.padStart(2, "0");
    const locId = selectedLocation?.id || "1";

    const customOrderUrl = newSeatForm.orderUrl.trim()
      ? newSeatForm.orderUrl.trim()
      : `${window.location.origin}/order/${locId}/${parseInt(padded, 10) || 1}`;

    const created: SeatItem = {
      number: padded,
      id: newSeatForm.seatId.trim() || `S00${locId}-F1-${padded}`,
      employee: newSeatForm.email.trim() || undefined,
      orderUrl: customOrderUrl,
    };

    const nextSeatsByLoc = {
      ...seatsByLoc,
      [locId]: [...(seatsByLoc[locId] || []), created],
    };
    saveSeatsByLoc(nextSeatsByLoc);

    // Update location totalSeats counter
    const updated = locations.map((l) =>
      l.id === locId ? { ...l, totalSeats: l.totalSeats + 1 } : l
    );
    saveLocations(updated);

    setSelectedSeatNumber(padded);
    setIsCreateSeatOpen(false);
    setNewSeatForm({
      location: locId,
      email: "",
      seatId: "",
      seatNo: "",
      orderUrl: "",
    });
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">

            {/* ========================================================
                VIEW 1: LOCATIONS LIST (EXACT MODEL FROM SCREENSHOT)
               ======================================================== */}
            {!selectedLocation ? (
              <div>
                {/* Top Toolbar Header matching screenshot */}
                <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#EEE5DC] bg-white/90 p-4 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: Locations label and search input */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <h2 className="text-xl font-bold text-[#342219]">Locations</h2>
                    <div className="relative w-full sm:w-72">
                      <Search
                        size={17}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="type and enter..."
                        className="w-full rounded-xl border border-[#E8DED4] bg-white py-2 pl-9 pr-3 text-sm text-[#342219] outline-none transition placeholder:text-[#B1A69D] focus:border-[#9A6747] focus:ring-2 focus:ring-[#9A6747]/10"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A08C7D] hover:text-[#342219]"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions (+ Create Location, + Create Seat, Bulk Upload, Export, Refresh) */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Create Location */}
                    <button
                      type="button"
                      onClick={() => setIsCreateLocationOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#754329] to-[#9A6747] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#754329]/15 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:text-sm"
                    >
                      <Plus size={16} />
                      <span>Create Location</span>
                    </button>

                    {/* Bulk Upload */}
                    <button
                      type="button"
                      onClick={() => setIsBulkOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#7C4A2D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#7C4A2D]/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#6D3F24] sm:text-sm"
                    >
                      <Upload size={16} />
                      <span>Bulk Upload</span>
                    </button>

                    {/* Export */}
                    <button
                      type="button"
                      onClick={handleExport}
                      className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-4 py-2.5 text-xs font-semibold text-[#6F4228] transition duration-200 hover:border-[#6F4228] hover:bg-[#FAF6F1] sm:text-sm"
                    >
                      <Download size={16} />
                      <span>Export</span>
                    </button>

                    {/* Refresh */}
                    <button
                      type="button"
                      onClick={handleRefresh}
                      title="Refresh"
                      aria-label="Refresh locations"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DED4] bg-white text-[#75472D] transition hover:bg-[#FAF6F1]"
                    >
                      <RotateCw
                        size={17}
                        className={isRefreshing ? "animate-spin text-[#9A6747]" : ""}
                      />
                    </button>
                  </div>
                </div>

                {/* Locations Card Grid matching screenshot */}
                {paginatedLocations.length === 0 ? (
                  <div className="my-8 rounded-3xl border border-[#EEE5DC] bg-white/80 p-12 text-center backdrop-blur-md">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2E6D9] text-[#75472D]">
                      <Building2 size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-[#342219]">No locations found</h3>
                    <p className="mt-1 text-sm text-[#897B71]">
                      Click Create Location to add your office space.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {paginatedLocations.map((loc) => (
                      <div
                        key={loc.id}
                        className="group relative flex flex-col rounded-3xl border border-[#EEE5DC] bg-white p-5 shadow-lg shadow-[#70452D]/5 transition duration-300 hover:-translate-y-1 hover:border-[#DEC5B0] hover:shadow-xl"
                      >
                        {/* Office Silhouette Graphic - Click opens realistic boardroom seats */}
                        <div
                          onClick={() => setSelectedLocation(loc)}
                          className="flex h-44 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#EBECEE] transition duration-200 group-hover:bg-[#E5E6EA]"
                          title="Click to open realistic boardroom layout and seats"
                        >
                          <svg
                            className="h-32 w-32 text-[#3D4F5A] transition duration-200 group-hover:scale-105"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 2C9.79 2 8 3.79 8 6C8 8.21 9.79 10 12 10C14.21 10 16 8.21 16 6C16 3.79 14.21 2 12 2ZM12 12C7.58 12 4 14.24 4 17V20C4 20.55 4.45 21 5 21H19C19.55 21 20 20.55 20 20V17C20 14.24 16.42 12 12 12Z" />
                          </svg>
                        </div>

                        {/* Title and Active Badge */}
                        <div className="mt-4 flex items-center justify-between">
                          <span
                            onClick={() => setSelectedLocation(loc)}
                            className="cursor-pointer font-bold text-base text-[#342219] hover:text-[#8C5835]"
                          >
                            {loc.name}
                          </span>
                          <span className="rounded-md bg-[#28A745] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                            {loc.status}
                          </span>
                        </div>

                        {/* Assigned Provider Tag if assigned */}
                        {loc.assignedProviderName && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#E0D3C5] bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-medium text-[#7A4B2A]">
                            <UserCheck size={13} className="text-[#8C5835] shrink-0" />
                            <span className="truncate">
                              Assigned: <strong className="font-semibold text-[#342219]">{loc.assignedProviderName}</strong>
                            </span>
                          </div>
                        )}

                        {/* Action buttons (Assign, edit, Delete) */}
                        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EEE5DC] pt-3">
                          <button
                            type="button"
                            onClick={(e) => handleOpenAssignModal(loc, e)}
                            className="flex flex-col items-center justify-center rounded-xl border border-[#E8DED4] p-2 text-[11px] font-semibold text-[#593A28] transition hover:bg-[#FAF6F1]"
                            title="Assign Provider"
                          >
                            <UserPlus size={16} className="text-[#8C5835]" />
                            <span className="mt-1">Assign</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLoc(loc);
                              setIsEditLocationOpen(true);
                            }}
                            className="flex flex-col items-center justify-center rounded-xl border border-[#E8DED4] p-2 text-[11px] font-semibold text-[#593A28] transition hover:bg-[#FAF6F1]"
                            title="Edit location"
                          >
                            <Edit size={16} className="text-[#8C5835]" />
                            <span className="mt-1">edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteLocation(loc.id, e)}
                            className="flex flex-col items-center justify-center rounded-xl border border-[#E8DED4] p-2 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                            title="Delete location"
                          >
                            <Trash2 size={16} />
                            <span className="mt-1">Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Pagination Bar */}
                <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#EEE5DC] bg-white/90 px-5 py-3 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:flex-row">
                  <div className="flex items-center gap-2">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border border-[#E8DED4] bg-white px-2 py-1 text-xs font-semibold text-[#45352B] outline-none focus:border-[#9A6747]"
                    >
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                    </select>

                    <button
                      type="button"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage(1)}
                      className="rounded-lg p-1.5 text-[#75472D] transition hover:bg-[#FAF6F1] disabled:opacity-30"
                      aria-label="First page"
                    >
                      <ChevronsLeft size={16} />
                    </button>

                    <button
                      type="button"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg p-1.5 text-[#75472D] transition hover:bg-[#FAF6F1] disabled:opacity-30"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <span className="rounded-md border border-[#E8DED4] bg-white px-3 py-1 text-xs font-bold text-[#342219]">
                      {validCurrentPage}
                    </span>

                    <span className="text-xs text-[#897B71]">of {totalPages}</span>

                    <button
                      type="button"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg p-1.5 text-[#75472D] transition hover:bg-[#FAF6F1] disabled:opacity-30"
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>

                    <button
                      type="button"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="rounded-lg p-1.5 text-[#75472D] transition hover:bg-[#FAF6F1] disabled:opacity-30"
                      aria-label="Last page"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-[#70523E]">
                    <span>Total Records:</span>
                    <span className="rounded-lg bg-[#0D6EFD] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                      {totalRecords}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================
                  VIEW 2: REALISTIC TOP-DOWN ARCHITECTURAL IMAGE BOARDROOM
                  WITH PHOTOREALISTIC TABLE, ROOM & INTERACTIVE SEATS
                 ======================================================== */
              <div>
                {/* Header with Back Button and + Create Seat Button */}
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLocation(null)}
                      className="flex items-center gap-2 rounded-2xl border border-[#D5C2B1] bg-white px-4 py-2 text-xs font-bold text-[#6F4228] shadow-sm transition hover:bg-[#FAF6F1]"
                    >
                      <ArrowLeft size={15} />
                      <span>Back to Locations</span>
                    </button>

                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-[#342219] sm:text-3xl">
                        {selectedLocation.name} <span className="text-[#8C5835]">Seating Plan</span>
                      </h1>
                    </div>
                  </div>

                  {/* Actions & Filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Create Seat Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const nextNum = `${currentSeats.length + 1}`;
                        const padded = nextNum.padStart(2, "0");
                        setNewSeatForm({
                          location: "738",
                          email: "",
                          seatId: `S${selectedLocation.id}-F1-${padded}`,
                          seatNo: padded,
                          orderUrl: `https://cafe4x.com/order/738/${nextNum}`,
                        });
                        setIsCreateSeatOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#754329]/20 transition hover:-translate-y-0.5"
                    >
                      <Plus size={15} />
                      <span>Create</span>
                    </button>
                  </div>
                </div>

                {/* Main Dynamic Grid: Full width (12 cols) if no seat clicked, 8/4 cols when seat is clicked */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

                  {/* ========================================================
                      REALISTIC BOARDROOM IMAGE CANVAS WITH OVERLAID INTERACTIVE SEATS
                      (EXPANDS TO 12 COLS WHEN NO SEAT SELECTED, 8 COLS WHEN CLICKED)
                     ======================================================== */}
                  <div
                    className={`flex flex-col rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 shadow-xl shadow-[#70452D]/5 backdrop-blur-md transition-all duration-300 ${currentSeat ? "lg:col-span-8" : "lg:col-span-12"
                      }`}
                  >

                    {/* Subtitle */}
                    <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h2 className="text-base font-bold text-[#342219]">
                          Boardroom Architectural View ({currentSeats.length} configured seats)
                        </h2>
                      </div>
                      <span className="text-xs font-semibold text-[#8A7667]">
                        {currentSeat
                          ? `Inspecting Seat ${currentSeat.number}`
                          : "Click any chair to view seat details & QR code"}
                      </span>
                    </div>

                    {/* DYNAMIC REACT CONFERENCE TABLE & CHAIRS MODEL */}
                    <div className="relative my-6 flex min-h-[420px] w-full flex-col items-center justify-center overflow-x-auto rounded-3xl border-2 border-[#EAD5C0] bg-gradient-to-b from-[#F9F5F0] via-[#FAF6F1] to-[#F5ECE1] p-8 shadow-inner">

                      {/* Subtle floor grid backdrop */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-25"
                        style={{
                          backgroundImage: `radial-gradient(#D6C8B8 1px, transparent 1px)`,
                          backgroundSize: `20px 20px`,
                        }}
                      />

                      {/* Room accent plants in corners */}
                      <div className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8DDD2] text-xl shadow-xs select-none">
                        🪴
                      </div>
                      <div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8DDD2] text-xl shadow-xs select-none">
                        🌿
                      </div>
                      <div className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8DDD2] text-xl shadow-xs select-none">
                        🌿
                      </div>
                      <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8DDD2] text-xl shadow-xs select-none">
                        🪴
                      </div>

                      {/* Interactive Seating Model Wrapper */}
                      <div className="relative z-10 flex flex-col items-center justify-center gap-3 py-4">

                        {/* TOP ROW CHAIRS (Half of total seats, facing table) */}
                        {(() => {
                          const half = Math.ceil(currentSeats.length / 2);
                          const topSeats = currentSeats.slice(0, half);
                          const bottomSeats = currentSeats.slice(half);

                          return (
                            <>
                              {/* Top Row Seats */}
                              <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-6">
                                {topSeats.map((seat) => {
                                  const isSelected = selectedSeatNumber === seat.number;

                                  return (
                                    <div
                                      key={seat.number}
                                      onClick={() => setSelectedSeatNumber(isSelected ? null : seat.number)}
                                      className="group relative flex cursor-pointer flex-col items-center transition-all duration-200 hover:-translate-y-1"
                                    >
                                      {/* Chair Backrest */}
                                      <div className="h-3 w-12 sm:w-14 rounded-t-xl shadow-sm transition bg-gradient-to-r from-[#704225] via-[#8C5835] to-[#704225]" />

                                      {/* Chair Armrests + Cushion Button */}
                                      <div className="relative flex items-center">
                                        <div className="h-5 w-1.5 rounded-l-md bg-[#3D281D]" />

                                        <div
                                          className={`relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl font-black text-xs sm:text-sm text-white shadow-md transition duration-200 bg-gradient-to-br from-[#8C5835] via-[#A86E45] to-[#704225] border-2 border-[#E8B77C]/60 ${isSelected
                                              ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-white scale-105 shadow-yellow-500/30"
                                              : "hover:shadow-lg"
                                            }`}
                                        >
                                          {seat.number}
                                          {seat.employee && (
                                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white text-[8px]" title={seat.employee}>
                                              ✓
                                            </span>
                                          )}
                                        </div>

                                        <div className="h-5 w-1.5 rounded-r-md bg-[#3D281D]" />
                                      </div>

                                      {/* Tooltip on Hover */}
                                      <div className="pointer-events-none absolute -top-9 z-30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                        <div className="rounded-lg bg-[#2A1C14] px-2.5 py-1 text-[10px] font-bold text-white shadow-md whitespace-nowrap text-center">
                                          Seat {seat.number}
                                          {seat.employee && (
                                            <div className="text-[9px] font-normal text-emerald-300">
                                              {seat.employee}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* THE REACT OAK CONFERENCE TABLE (Dynamically widens according to number of seats) */}
                              <div
                                style={{
                                  minWidth: `${Math.max(280, half * 72)}px`,
                                }}
                                className="relative my-2 flex h-24 sm:h-28 items-center justify-between rounded-3xl border-2 border-[#94623B] bg-gradient-to-r from-[#B9885E] via-[#CFA077] to-[#B9885E] px-6 shadow-xl transition-all duration-300"
                              >
                                {/* Left Table End Decor */}
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60 shadow-xs text-xs select-none">
                                  ☕
                                </div>

                                {/* Center Table Inset Planter Runner */}
                                <div className="flex items-center gap-3 rounded-full border border-[#83532C] bg-[#543319]/80 px-4 sm:px-6 py-2 shadow-inner">
                                  <span className="text-base select-none">🌱</span>
                                  <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-[#F0D5BE]">
                                    {selectedLocation.name} Conference Table ({currentSeats.length} Seats)
                                  </span>
                                  <span className="text-base select-none">🌿</span>
                                </div>

                                {/* Right Table End Decor */}
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60 shadow-xs text-xs select-none">
                                  ☕
                                </div>
                              </div>

                              {/* BOTTOM ROW CHAIRS (Facing up toward table) */}
                              <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
                                {bottomSeats.map((seat) => {
                                  const isSelected = selectedSeatNumber === seat.number;

                                  return (
                                    <div
                                      key={seat.number}
                                      onClick={() => setSelectedSeatNumber(isSelected ? null : seat.number)}
                                      className="group relative flex cursor-pointer flex-col items-center transition-all duration-200 hover:translate-y-1"
                                    >
                                      {/* Chair Armrests + Cushion Button */}
                                      <div className="relative flex items-center">
                                        <div className="h-5 w-1.5 rounded-l-md bg-[#3D281D]" />

                                        <div
                                          className={`relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl font-black text-xs sm:text-sm text-white shadow-md transition duration-200 bg-gradient-to-br from-[#8C5835] via-[#A86E45] to-[#704225] border-2 border-[#E8B77C]/60 ${isSelected
                                              ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-white scale-105 shadow-yellow-500/30"
                                              : "hover:shadow-lg"
                                            }`}
                                        >
                                          {seat.number}
                                          {seat.employee && (
                                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white text-[8px]" title={seat.employee}>
                                              ✓
                                            </span>
                                          )}
                                        </div>

                                        <div className="h-5 w-1.5 rounded-r-md bg-[#3D281D]" />
                                      </div>

                                      {/* Chair Backrest */}
                                      <div className="h-3 w-12 sm:w-14 rounded-b-xl shadow-sm transition bg-gradient-to-r from-[#704225] via-[#8C5835] to-[#704225]" />

                                      {/* Tooltip on Hover */}
                                      <div className="pointer-events-none absolute -bottom-9 z-30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                        <div className="rounded-lg bg-[#2A1C14] px-2.5 py-1 text-[10px] font-bold text-white shadow-md whitespace-nowrap text-center">
                                          Seat {seat.number}
                                          {seat.employee && (
                                            <div className="text-[9px] font-normal text-emerald-300">
                                              {seat.employee}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Bottom Action / Add Seat Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EEE5DC] pt-4 text-xs font-semibold">
                      <div className="flex items-center gap-2 text-[#70523E]">
                        <span>Total Configured Seats: </span>
                        <span className="rounded-md bg-[#FAF4ED] px-2 py-0.5 font-bold text-[#8C5835] border border-[#EAD5C0]">
                          {currentSeats.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = `${currentSeats.length + 1}`;
                          const padded = nextNum.padStart(2, "0");
                          setNewSeatForm({
                            location: "738",
                            email: "",
                            seatId: `S${selectedLocation.id}-F1-${padded}`,
                            seatNo: padded,
                            orderUrl: `https://cafe4x.com/order/738/${nextNum}`,
                          });
                          setIsCreateSeatOpen(true);
                        }}
                        className="text-xs font-bold text-[#8C5835] hover:underline"
                      >
                        + Add another seat to this layout
                      </button>
                    </div>
                  </div>

                  {/* ========================================================
                      UNIFIED RIGHT DRAWER: SEAT DETAILS & ORDER URL QR IN ONE CARD
                     ======================================================== */}
                  {currentSeat && (
                    <div className="flex flex-col lg:col-span-4 animate-in fade-in slide-in-from-right duration-300">
                      <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 shadow-xl shadow-[#70452D]/5 backdrop-blur-md">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835]">
                              <Armchair size={22} />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-[#342219]">Seat Details & QR</h3>
                              <p className="text-xs text-[#8A7667]">{selectedLocation.name} · Seat {currentSeat.number}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#75472D] to-[#9A6747] font-black text-sm text-white shadow-md">
                              {currentSeat.number}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedSeatNumber(null)}
                              className="rounded-xl p-1.5 text-gray-400 hover:bg-[#FAF6F1] hover:text-gray-700"
                              title="Close Drawer"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Details & Identifiers */}
                        <div className="mt-5 space-y-3.5 text-xs">
                          {/* Assigned Employee */}
                          {currentSeat.employee ? (
                            <div className="flex flex-col gap-1 rounded-xl border border-[#EEE5DC] p-3">
                              <span className="font-semibold text-[#8A7667]">Assigned Employee</span>
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAD5C0] text-[#70452D]">
                                  <User size={13} />
                                </div>
                                <span className="font-bold text-xs text-[#342219] truncate">
                                  {currentSeat.employee}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-xl border border-[#EEE5DC] p-3">
                              <span className="font-semibold text-[#8A7667]">Assigned Employee</span>
                              <span className="text-xs text-[#8A7667] italic">Unassigned (Free seat)</span>
                            </div>
                          )}

                          {/* Seat ID */}
                          <div className="flex items-center justify-between rounded-xl border border-[#EEE5DC] p-3">
                            <span className="font-semibold text-[#8A7667]">Seat Identifier</span>
                            <span className="font-mono font-bold text-[#342219]">
                              {currentSeat.id}
                            </span>
                          </div>

                          {/* Order URL Box */}
                          <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[#8A7667]">Order URL</span>
                            <div className="flex items-center justify-between rounded-2xl border border-[#E8DED4] bg-[#FAF8F5] p-2.5">
                              <span className="truncate text-xs font-mono text-[#70523E]">
                                {currentSeat.orderUrl}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(currentSeat.orderUrl)}
                                className="ml-2 flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#8C5835] shadow-xs hover:bg-[#FAF6F1]"
                                title="Copy URL"
                              >
                                {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
                                <span>{copiedUrl ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          </div>

                          {/* Integrated Live QR Code Container */}
                          <div className="mt-2 rounded-2xl border border-[#EEE5DC] bg-[#FAF8F5] p-3.5">
                            <div className="flex items-center gap-3.5">
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                    currentSeat.orderUrl
                                  )}`}
                                  alt="Seat QR Code"
                                  className="h-full w-full object-contain"
                                />
                              </div>

                              <div className="flex-1 space-y-1">
                                <p className="text-xs font-bold text-[#342219]">
                                  Scan to Order (Seat {currentSeat.number})
                                </p>
                                <p className="text-[11px] text-[#8A7667]">
                                  Guests scan this QR to order from their seat
                                </p>
                                <div className="pt-1 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                                        currentSeat.orderUrl
                                      )}`;
                                      link.target = "_blank";
                                      link.download = `seat_${currentSeat.number}_qr.png`;
                                      link.click();
                                    }}
                                    className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#8C5835] border border-[#D5C2B1] hover:bg-[#FAF6F1]"
                                  >
                                    <Download size={12} />
                                    <span>Download QR</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#EEE5DC] pt-4">
                          <button
                            type="button"
                            onClick={() => setIsEditSeatOpen(true)}
                            className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#D5C2B1] bg-white py-2.5 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1]"
                          >
                            <Edit size={14} />
                            <span>Edit Seat</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              alert(`Generated QR Code for Seat ${currentSeat.number}: ${currentSeat.orderUrl}`)
                            }
                            className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#754329] to-[#8C5835] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
                          >
                            <QrCode size={14} />
                            <span>Generate QR</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto px-4 py-6 text-center text-xs text-[#9A8778]">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
            <ShieldCheck size={15} />
            <span>Good Food. Better Days. © {new Date().getFullYear()} Cafe4X. All rights reserved.</span>
          </div>
        </footer>

        {/* ========================================================
            MODAL: CREATE LOCATION
           ======================================================== */}
        {isCreateLocationOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6ECE2] text-[#8C5835]">
                    <Plus size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-[#342219]">Create Location</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateLocationOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateLocationSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#45352B]">
                    Location / Office Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. office, meeting lounge"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    className="w-full rounded-xl border border-[#E8DED4] px-3 py-2 text-sm text-[#342219] outline-none transition focus:border-[#8C5835]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateLocationOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-5 py-2 text-xs font-semibold text-white shadow-md hover:opacity-95"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: CREATE SEAT (LOCATION-SEAT CREATE)
           ======================================================== */}
        {isCreateSeatOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-xl font-semibold text-gray-800">
                  Location-Seat Create
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateSeatOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Form matching user's exact modal layout */}
              <form onSubmit={handleCreateSeatSubmit} className="mt-5 space-y-4 text-sm">
                {/* Location */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Location
                  </label>
                  <div className="col-span-9">
                    <input
                      type="text"
                      readOnly
                      value={newSeatForm.location || "738"}
                      className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Email
                  </label>
                  <div className="col-span-9">
                    <input
                      type="email"
                      placeholder="Email"
                      value={newSeatForm.email}
                      onChange={(e) =>
                        setNewSeatForm({ ...newSeatForm, email: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                    />
                  </div>
                </div>

                {/* SeatId * */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    SeatId<span className="text-red-500">*</span>
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="text"
                      placeholder="SeatId"
                      value={newSeatForm.seatId}
                      onChange={(e) =>
                        setNewSeatForm({ ...newSeatForm, seatId: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                    />
                  </div>
                </div>

                {/* SeatNo * */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    SeatNo<span className="text-red-500">*</span>
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="text"
                      placeholder="SeatNo"
                      value={newSeatForm.seatNo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewSeatForm({
                          ...newSeatForm,
                          seatNo: val,
                          // Automatically suggest orderUrl if not yet customized or follows default pattern
                          orderUrl:
                            !newSeatForm.orderUrl ||
                              newSeatForm.orderUrl.startsWith("https://cafe4x.com/order/")
                              ? `https://cafe4x.com/order/${newSeatForm.location || "738"}/${val || "1"}`
                              : newSeatForm.orderUrl,
                        });
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                    />
                  </div>
                </div>

                {/* OrderUrl * */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    OrderUrl<span className="text-red-500">*</span>
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="text"
                      placeholder="OrderUrl"
                      value={newSeatForm.orderUrl}
                      onChange={(e) =>
                        setNewSeatForm({ ...newSeatForm, orderUrl: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                    />
                  </div>
                </div>

                {/* Bottom Actions matching screenshot buttons */}
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="submit"
                    className="rounded-md border border-[#28A745] bg-white px-5 py-2 font-medium text-[#28A745] transition hover:bg-[#28A745] hover:text-white"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateSeatOpen(false)}
                    className="rounded-md bg-[#DC3545] px-5 py-2 font-medium text-white shadow-xs transition hover:bg-[#C82333]"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: EDIT SEAT
           ======================================================== */}
        {isEditSeatOpen && currentSeat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3">
                <h3 className="text-lg font-bold text-[#342219]">
                  Edit Seat {currentSeat.number}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditSeatOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-[#45352B]">
                    Assigned Employee Email
                  </label>
                  <input
                    type="email"
                    defaultValue={currentSeat.employee || ""}
                    placeholder="e.g. employee@office.com"
                    onChange={(e) => {
                      currentSeat.employee = e.target.value;
                    }}
                    className="w-full rounded-xl border border-[#E8DED4] p-2.5 text-sm text-[#342219] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#45352B]">
                    Order URL
                  </label>
                  <input
                    type="text"
                    defaultValue={currentSeat.orderUrl}
                    onChange={(e) => {
                      currentSeat.orderUrl = e.target.value;
                    }}
                    className="w-full rounded-xl border border-[#E8DED4] p-2.5 text-sm text-[#342219] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditSeatOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const locId = selectedLocation?.id || "1";
                      const updatedSeats = (seatsByLoc[locId] || []).map((s) =>
                        s.number === currentSeat.number ? { ...currentSeat } : s
                      );
                      saveSeatsByLoc({
                        ...seatsByLoc,
                        [locId]: updatedSeats,
                      });
                      setIsEditSeatOpen(false);
                    }}
                    className="rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-5 py-2 font-semibold text-white shadow-md hover:opacity-95"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: EDIT LOCATION
           ======================================================== */}
        {isEditLocationOpen && editingLoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3">
                <h3 className="text-lg font-bold text-[#342219]">Edit Location</h3>
                <button
                  type="button"
                  onClick={() => setIsEditLocationOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-[#45352B]">Name</label>
                  <input
                    type="text"
                    value={editingLoc.name}
                    onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })}
                    className="w-full rounded-xl border border-[#E8DED4] p-2 text-sm text-[#342219] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditLocationOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocations((prev) =>
                        prev.map((l) => (l.id === editingLoc.id ? editingLoc : l))
                      );
                      setIsEditLocationOpen(false);
                    }}
                    className="rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-5 py-2 font-semibold text-white"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: BULK UPLOAD
           ======================================================== */}
        {isBulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3">
                <h3 className="text-lg font-bold text-[#342219]">Bulk Upload Locations</h3>
                <button
                  type="button"
                  onClick={() => setIsBulkOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DECFBE] bg-[#FDFBF7] p-6 text-center hover:border-[#8C5835]"
                >
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" />
                  <Upload size={24} className="text-[#8C5835]" />
                  <p className="mt-2 text-xs font-bold text-gray-800">Choose CSV file</p>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsBulkOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: ASSIGN USER (COMPONENT: AssignCard)
            ONLY PROVIDERS CAN BE SELECTED
           ======================================================== */}
        {assignModalLoc && (
          <AssignCard
            location={assignModalLoc}
            isOpen={Boolean(assignModalLoc)}
            onClose={() => setAssignModalLoc(null)}
            onSave={handleSaveLocationAssignment}
          />
        )}

      </div>
    </Background>
  );
}
