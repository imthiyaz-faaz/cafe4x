import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  Copy,
  Check,
  User,
  ShieldCheck,
  Building2,
  ArrowLeft,
  UserCheck,
  ExternalLink,
  Key,
  RefreshCw,
  Ban,
  UserMinus,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import AssignCard, { type LocationItem } from "../../components/locations/assigncard";
import { locationApi } from "../../services/locations";
import { userApi, type UserItem } from "../../services/userApi";
import CreateFormModal, { FormRow } from "../../components/common/CreateFormModal";

interface SeatItem {
  number: string;
  id: string;
  displayId?: string;
  locationId?: string;
  organizationId?: string;
  employee?: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeId?: string;
  orderUrl: string;
}

export default function LocationPage() {
  const params = useParams();
  const urlShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;
  const currentShortCode = useMemo(() => {
    if (urlShortCode) return urlShortCode;
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.shortCode) return u.shortCode.toUpperCase();
      }
    } catch { }
    return "";
  }, [urlShortCode]);

  const locStorageKey = currentShortCode ? `cafe4x_locations_${currentShortCode}` : "cafe4x_locations";
  const seatsStorageKey = currentShortCode ? `cafe4x_seatsByLoc_${currentShortCode}` : "cafe4x_seatsByLoc";

  // Helper to compute next available unique seat number and sequential Seat ID (e.g. FTS-01, FTS-02, ...)
  const getNextAvailableSeatInfo = (existingSeats: SeatItem[]) => {
    const code = currentShortCode || "FTS";
    const usedNumbers = new Set<number>();

    (existingSeats || []).forEach((s) => {
      const parsedNum = parseInt(s.number, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        usedNumbers.add(parsedNum);
      }
      if (s.id) {
        const match = s.id.match(/(\d+)$/);
        if (match) {
          const idNum = parseInt(match[1], 10);
          if (!isNaN(idNum) && idNum > 0) {
            usedNumbers.add(idNum);
          }
        }
      }
    });

    let candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }

    const padded = String(candidate).padStart(2, "0");
    const seatId = `${code}-${padded}`;
    return { number: padded, seatId };
  };

  const [locations, setLocations] = useState<LocationItem[]>(() => {
    try {
      const stored = localStorage.getItem(locStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
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
  const [newLocationStatus, setNewLocationStatus] = useState<"Active" | "Inactive">("Active");
  const [newLocationImage, setNewLocationImage] = useState<string>("");
  const locationImageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Assign Provider Modal State
  const [assignModalLoc, setAssignModalLoc] = useState<LocationItem | null>(null);

  // Fetch from backend on mount or organization switch and sync to local state
  useEffect(() => {
    let isMounted = true;
    locationApi.getLocations(undefined, currentShortCode || undefined)
      .then((serverLocs) => {
        if (!isMounted) return;
        if (Array.isArray(serverLocs)) {
          setLocations(serverLocs as LocationItem[]);
          try {
            localStorage.setItem(locStorageKey, JSON.stringify(serverLocs));
          } catch { }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch locations from server:", err);
        setLocations([]);
      });

    return () => {
      isMounted = false;
    };
  }, [locStorageKey, currentShortCode]);

  const saveLocations = (newLocs: LocationItem[]) => {
    // 1. Always store locally in state and localStorage immediately
    setLocations(newLocs);
    try {
      localStorage.setItem(locStorageKey, JSON.stringify(newLocs));
    } catch { }
  };


  // Seating State for active location
  const [seatsByLoc, setSeatsByLoc] = useState<Record<string, SeatItem[]>>(() => {
    try {
      const stored = localStorage.getItem(seatsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch { }
    return {};
  });

  // All employees/users in organization for employee QR code resolution
  const [orgUsers, setOrgUsers] = useState<UserItem[]>([]);
  const [tokenActionLoading, setTokenActionLoading] = useState(false);

  // Fetch users from backend for the organization
  const fetchOrgUsers = () => {
    userApi
      .getUsers(undefined, currentShortCode || undefined)
      .then((users) => {
        if (Array.isArray(users)) {
          setOrgUsers(users);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch users for employee QR resolution:", err);
      });
  };

  useEffect(() => {
    fetchOrgUsers();
  }, [currentShortCode]);

  const saveSeatsByLoc = (data: Record<string, SeatItem[]>) => {
    setSeatsByLoc(data);
    try {
      localStorage.setItem(seatsStorageKey, JSON.stringify(data));
      // Also sync to global key so UserOrderPage can always find seat employee information
      localStorage.setItem("cafe4x_seatsByLoc", JSON.stringify(data));
    } catch { }
  };

  // Helper to resolve an employee's secure permanent QR order URL or seat permanent QR URL
  const getEmployeeOrderUrl = (employeeIdentifier?: string, _seatId?: string, locId?: string, seatNo?: string) => {
    const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
    if (employeeIdentifier && orgUsers.length > 0) {
      const cleanIdent = employeeIdentifier.trim().toLowerCase();
      const matched = orgUsers.find(
        (u) =>
          u.email.toLowerCase() === cleanIdent ||
          u.name.toLowerCase() === cleanIdent ||
          u.userName.toLowerCase() === cleanIdent ||
          u.id === cleanIdent
      );
      if (matched?.qrToken) {
        return `${window.location.origin}${orgPrefix}/employee/${matched.qrToken}`;
      }
    }
    // Permanent entry URL for this seat (routes through secure session creation)
    const effectiveLocId = locId || (selectedLocation ? String(selectedLocation.id) : "1");
    const effectiveSeatNo = parseInt(seatNo || "1", 10) || 1;
    return `${window.location.origin}${orgPrefix}/order/${effectiveLocId}/${effectiveSeatNo}`;
  };

  // Load seats from backend on selectedLocation change, falling back to local storage
  useEffect(() => {
    if (!selectedLocation) return;
    const locId = String(selectedLocation.id);
    const code = currentShortCode || "FTS";

    // 1. Fetch from backend
    locationApi
      .getSeats(locId)
      .then((backendSeats) => {
        if (Array.isArray(backendSeats) && backendSeats.length > 0) {
          const mapped: SeatItem[] = backendSeats.map((s) => ({
            id: s.id || `${code}-${s.number}`,
            displayId: s.displayId,
            number: s.number,
            locationId: locId,
            employee: s.employee || s.employeeEmail || undefined,
            employeeName: s.employeeName,
            employeeEmail: s.employeeEmail,
            employeeId: s.employeeId,
            orderUrl: s.orderUrl || getEmployeeOrderUrl(s.employee || s.employeeEmail, s.id, locId, s.number),
          }));
          setSeatsByLoc((prev) => ({ ...prev, [locId]: mapped }));
          try {
            localStorage.setItem(seatsStorageKey, JSON.stringify({ ...seatsByLoc, [locId]: mapped }));
            localStorage.setItem("cafe4x_seatsByLoc", JSON.stringify({ ...seatsByLoc, [locId]: mapped }));
          } catch { }
          return;
        }

        // If backend has no seats, generate default seats
        const existing = seatsByLoc[locId];
        if (!existing || existing.length === 0) {
          const totalSeats = Number(selectedLocation.totalSeats) || 12;
          const generated: SeatItem[] = Array.from({ length: totalSeats }, (_, i) => {
            const num = String(i + 1).padStart(2, "0");
            const seatId = `${code}-${num}`;
            return {
              number: num,
              id: seatId,
              orderUrl: getEmployeeOrderUrl(undefined, seatId, locId, num),
            };
          });
          saveSeatsByLoc({ ...seatsByLoc, [locId]: generated });
        }
      })
      .catch(() => {
        // Fallback: generate default if local is empty
        const existing = seatsByLoc[locId];
        if (!existing || existing.length === 0) {
          const totalSeats = Number(selectedLocation.totalSeats) || 12;
          const generated: SeatItem[] = Array.from({ length: totalSeats }, (_, i) => {
            const num = String(i + 1).padStart(2, "0");
            const seatId = `${code}-${num}`;
            return {
              number: num,
              id: seatId,
              orderUrl: getEmployeeOrderUrl(undefined, seatId, locId, num),
            };
          });
          saveSeatsByLoc({ ...seatsByLoc, [locId]: generated });
        }
      });
  }, [selectedLocation?.id, currentShortCode]);

  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Create Seat Modal State (Location-Seat Create)
  const [isCreateSeatOpen, setIsCreateSeatOpen] = useState(false);
  const [newSeatForm, setNewSeatForm] = useState({
    location: "738",
    seatId: "",
    seatNo: "",
    assignNow: true,
    employeeName: "",
    employeeEmail: "",
    orderUrl: "",
  });
  const [createSeatError, setCreateSeatError] = useState<string | null>(null);
  const [isCreatingSeat, setIsCreatingSeat] = useState(false);

  // Edit / Assign Seat Modal
  const [isEditSeatOpen, setIsEditSeatOpen] = useState(false);
  const [editSeatForm, setEditSeatForm] = useState({
    employeeName: "",
    employeeEmail: "",
    orderUrl: "",
  });
  const [editSeatError, setEditSeatError] = useState<string | null>(null);
  const [isSavingSeat, setIsSavingSeat] = useState(false);

  // Unassign Seat Confirmation Modal State
  const [isUnassignConfirmOpen, setIsUnassignConfirmOpen] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [seatActionMessage, setSeatActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const activeLocationId = selectedLocation?.id || "";
  const currentSeats = activeLocationId ? (seatsByLoc[activeLocationId] || []) : [];
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
    let currentOrgId = "";
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) currentOrgId = JSON.parse(stored).organizationId || "";
    } catch { }

    const newLoc: LocationItem = {
      id: newId,
      name: newLocationName.trim(),
      status: newLocationStatus,
      totalSeats: 12,
      image: newLocationImage || undefined,
      shortCode: currentShortCode || undefined,
      organizationId: currentOrgId || undefined,
    };
    // 1. Store in local state immediately
    const updated = [...locations, newLoc];
    saveLocations(updated);

    // 2. Sync to backend asynchronously
    locationApi.createLocation(newLoc).catch((err) => {
      console.warn("Could not save location to backend:", err);
    });

    const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
    const generatedSeats: SeatItem[] = Array.from({ length: 12 }, (_, i) => {
      const num = String(i + 1).padStart(2, "0");
      const seatId = `S${newId}-F1-${num}`;
      return {
        number: num,
        id: seatId,
        orderUrl: `${window.location.origin}${orgPrefix}/order/${newId}/${i + 1}?seatId=${seatId}`,
      };
    });

    const updatedSeats = {
      ...seatsByLoc,
      [newId]: generatedSeats,
    };
    saveSeatsByLoc(updatedSeats);
    setNewLocationName("");
    setNewLocationStatus("Active");
    setNewLocationImage("");
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
  const handleCreateSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSeatError(null);

    const rawSeatNo = newSeatForm.seatNo.trim();
    if (!rawSeatNo) {
      setCreateSeatError("Seat number is required.");
      return;
    }
    const padded = rawSeatNo.padStart(2, "0");
    const locId = selectedLocation?.id || "1";
    const code = currentShortCode || "FTS";
    const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
    const finalSeatId = newSeatForm.seatId.trim() || `${code}-${padded}`;

    const currentLocSeats = seatsByLoc[locId] || [];

    // Duplicate seat number / ID check
    const seatExists = currentLocSeats.some(
      (s) => s.number === padded || s.id.toLowerCase() === finalSeatId.toLowerCase()
    );
    if (seatExists) {
      setCreateSeatError(`Seat identifier ${finalSeatId} (Seat ${padded}) already exists in this location.`);
      return;
    }

    // Validate employee details if assigning an employee
    const trimmedName = newSeatForm.employeeName.trim();
    const trimmedEmail = newSeatForm.employeeEmail.trim().toLowerCase();

    if (newSeatForm.assignNow) {
      if (!trimmedName) {
        setCreateSeatError("Employee Name is required when assigning an employee.");
        return;
      }
      if (!trimmedEmail) {
        setCreateSeatError("Employee Email is required when assigning an employee.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setCreateSeatError("Please enter a valid employee email address (e.g. employee@example.com).");
        return;
      }

      // Check if employee is already assigned to another seat in this location
      const alreadyAssigned = currentLocSeats.find(
        (s) =>
          s.employee &&
          (s.employee.toLowerCase() === trimmedEmail ||
           s.employeeEmail?.toLowerCase() === trimmedEmail ||
           s.employeeName?.toLowerCase() === trimmedName.toLowerCase())
      );
      if (alreadyAssigned) {
        setCreateSeatError(`Employee is already assigned to seat ${alreadyAssigned.id || alreadyAssigned.number}.`);
        return;
      }
    }

    setIsCreatingSeat(true);

    try {
      const idealUrl = newSeatForm.assignNow
        ? getEmployeeOrderUrl(trimmedEmail || trimmedName, finalSeatId, locId, padded)
        : `${window.location.origin}${orgPrefix}/order/${locId}/${parseInt(padded, 10) || 1}?seatId=${finalSeatId}`;

      const createdSeat: SeatItem = {
        number: padded,
        id: finalSeatId,
        employee: newSeatForm.assignNow ? trimmedEmail : undefined,
        employeeName: newSeatForm.assignNow ? trimmedName : undefined,
        employeeEmail: newSeatForm.assignNow ? trimmedEmail : undefined,
        orderUrl: idealUrl,
      };

      // 1. Sync to backend API
      try {
        await locationApi.saveSeat(locId, {
          id: finalSeatId,
          number: padded,
          employee: createdSeat.employee,
          employeeName: createdSeat.employeeName,
          employeeEmail: createdSeat.employeeEmail,
          orderUrl: idealUrl,
        });
      } catch (err: any) {
        console.warn("Could not save seat to backend (falling back to local state):", err);
      }

      // 2. Update local state
      const nextSeatsByLoc = {
        ...seatsByLoc,
        [locId]: [...currentLocSeats, createdSeat],
      };
      saveSeatsByLoc(nextSeatsByLoc);

      // 3. Update location totalSeats counter
      const updated = locations.map((l) =>
        l.id === locId ? { ...l, totalSeats: (seatsByLoc[locId]?.length || 0) + 1 } : l
      );
      saveLocations(updated);

      setSelectedSeatNumber(padded);
      setIsCreateSeatOpen(false);
      setNewSeatForm({
        location: locId,
        seatId: "",
        seatNo: "",
        assignNow: true,
        employeeName: "",
        employeeEmail: "",
        orderUrl: "",
      });
      setSeatActionMessage({
        type: "success",
        text: `Seat ${finalSeatId} created successfully${newSeatForm.assignNow ? ` and assigned to ${trimmedName}` : " as Available"}.`,
      });
      setTimeout(() => setSeatActionMessage(null), 4000);
    } catch (err: any) {
      setCreateSeatError(err.message || "Failed to create seat.");
    } finally {
      setIsCreatingSeat(false);
    }
  };

  // Remove / Unassign Employee from Selected Seat
  const handleUnassignEmployee = async () => {
    if (!currentSeat || !selectedLocation) return;
    setIsUnassigning(true);
    const locId = selectedLocation.id;
    const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
    const defaultUrl = `${window.location.origin}${orgPrefix}/order/${locId}/${parseInt(currentSeat.number, 10) || 1}?seatId=${currentSeat.id}`;

    try {
      // 1. Sync to backend
      try {
        await locationApi.unassignSeat(locId, currentSeat.id);
      } catch (err: any) {
        console.warn("Backend unassignSeat error (updating local state):", err);
      }

      // 2. Update local state — keep seat, seat identifier, and position; clear employee assignment
      const updatedSeats = (seatsByLoc[locId] || []).map((s) => {
        if (s.number === currentSeat.number) {
          return {
            ...s,
            employee: undefined,
            employeeName: undefined,
            employeeEmail: undefined,
            employeeId: undefined,
            orderUrl: defaultUrl,
          };
        }
        return s;
      });

      saveSeatsByLoc({
        ...seatsByLoc,
        [locId]: updatedSeats,
      });

      setIsUnassignConfirmOpen(false);
      setSeatActionMessage({
        type: "success",
        text: `Employee removed from ${currentSeat.id}. Seat is now Available for new assignments.`,
      });
      setTimeout(() => setSeatActionMessage(null), 4000);
    } catch (err: any) {
      setSeatActionMessage({
        type: "error",
        text: err.message || "Failed to unassign employee.",
      });
      setTimeout(() => setSeatActionMessage(null), 4000);
    } finally {
      setIsUnassigning(false);
    }
  };

  // Assign or Change Employee on an Existing Seat
  const handleSaveSeatAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeat || !selectedLocation) return;
    setEditSeatError(null);

    const locId = selectedLocation.id;
    const trimmedName = editSeatForm.employeeName.trim();
    const trimmedEmail = editSeatForm.employeeEmail.trim().toLowerCase();

    // If both name & email are empty, this acts as clearing the assignment
    if (!trimmedName && !trimmedEmail) {
      await handleUnassignEmployee();
      setIsEditSeatOpen(false);
      return;
    }

    if (!trimmedName) {
      setEditSeatError("Employee Name is required.");
      return;
    }
    if (!trimmedEmail) {
      setEditSeatError("Employee Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEditSeatError("Please enter a valid employee email address.");
      return;
    }

    // Check if employee is already assigned to a different seat
    const currentLocSeats = seatsByLoc[locId] || [];
    const duplicate = currentLocSeats.find(
      (s) =>
        s.number !== currentSeat.number &&
        s.employee &&
        (s.employee.toLowerCase() === trimmedEmail ||
         s.employeeEmail?.toLowerCase() === trimmedEmail ||
         s.employeeName?.toLowerCase() === trimmedName.toLowerCase())
    );
    if (duplicate) {
      setEditSeatError(`Employee is already assigned to seat ${duplicate.id || duplicate.number}.`);
      return;
    }

    setIsSavingSeat(true);
    try {
      const idealUrl = getEmployeeOrderUrl(trimmedEmail || trimmedName, currentSeat.id, locId, currentSeat.number);

      // 1. Sync to backend
      try {
        await locationApi.assignSeat(locId, currentSeat.id, {
          employeeName: trimmedName,
          employeeEmail: trimmedEmail,
          employee: trimmedEmail,
          orderUrl: idealUrl,
        });
      } catch (err: any) {
        console.warn("Backend assignSeat error (updating local state):", err);
      }

      // 2. Update local state
      const updatedSeats = currentLocSeats.map((s) => {
        if (s.number === currentSeat.number) {
          return {
            ...s,
            employee: trimmedEmail,
            employeeName: trimmedName,
            employeeEmail: trimmedEmail,
            orderUrl: idealUrl,
          };
        }
        return s;
      });

      saveSeatsByLoc({
        ...seatsByLoc,
        [locId]: updatedSeats,
      });

      setIsEditSeatOpen(false);
      setSeatActionMessage({
        type: "success",
        text: `Seat ${currentSeat.id} successfully assigned to ${trimmedName}.`,
      });
      setTimeout(() => setSeatActionMessage(null), 4000);
    } catch (err: any) {
      setEditSeatError(err.message || "Failed to update seat assignment.");
    } finally {
      setIsSavingSeat(false);
    }
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
                        {/* Office Silhouette Graphic or Uploaded Image - Click opens realistic boardroom seats */}
                        <div
                          onClick={() => setSelectedLocation(loc)}
                          className="flex h-44 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#EBECEE] transition duration-200 group-hover:bg-[#E5E6EA] overflow-hidden"
                          title="Click to open realistic boardroom layout and seats"
                        >
                          {loc.image ? (
                            <img
                              src={loc.image}
                              alt={loc.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <svg
                              className="h-32 w-32 text-[#3D4F5A] transition duration-200 group-hover:scale-105"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M12 2C9.79 2 8 3.79 8 6C8 8.21 9.79 10 12 10C14.21 10 16 8.21 16 6C16 3.79 14.21 2 12 2ZM12 12C7.58 12 4 14.24 4 17V20C4 20.55 4.45 21 5 21H19C19.55 21 20 20.55 20 20V17C20 14.24 16.42 12 12 12Z" />
                            </svg>
                          )}
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
              <div className="space-y-6">
                {/* Header with Back Button and Actions Bar */}
                <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[#EEE5DC] bg-white/90 p-5 shadow-lg shadow-[#70452D]/5 backdrop-blur-md sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setSelectedLocation(null)}
                      className="group flex items-center gap-2 rounded-2xl border border-[#D5C2B1] bg-white px-4 py-2.5 text-xs font-bold text-[#6F4228] shadow-xs transition duration-200 hover:-translate-x-0.5 hover:border-[#8C5835] hover:bg-[#FAF6F1]"
                    >
                      <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                      <span>Back to Locations</span>
                    </button>

                    <div className="h-6 w-px bg-[#E8DED4] hidden sm:block" />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                        <h1 className="text-xl font-black tracking-tight text-[#342219] sm:text-2xl">
                          {selectedLocation.name} <span className="text-[#8C5835]">Seating Plan</span>
                        </h1>
                      </div>
                      <p className="text-xs text-[#8A7667] mt-0.5">
                        Interactive Architectural Seating Planner &amp; QR Management
                      </p>
                    </div>
                  </div>

                  {/* Actions & Seat Stats */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 rounded-2xl border border-[#EAD5C0] bg-[#FAF6F2] px-3.5 py-2 text-xs font-bold text-[#70452D]">
                      <Armchair size={15} className="text-[#8C5835]" />
                      <span>{currentSeats.length} Total Seats</span>
                      <span className="text-[#C4A48C]">•</span>
                      <span className="text-emerald-700 font-semibold">{currentSeats.filter(s => s.employee).length} Occupied</span>
                    </div>

                    {/* Create Seat Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const locId = selectedLocation.id;
                        const locSeats = seatsByLoc[locId] || [];
                        const nextInfo = getNextAvailableSeatInfo(locSeats);
                        const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
                        setNewSeatForm({
                          location: selectedLocation.name || locId,
                          seatId: nextInfo.seatId,
                          seatNo: nextInfo.number,
                          assignNow: true,
                          employeeName: "",
                          employeeEmail: "",
                          orderUrl: `${window.location.origin}${orgPrefix}/order/${locId}/${parseInt(nextInfo.number, 10) || 1}?seatId=${nextInfo.seatId}`,
                        });
                        setCreateSeatError(null);
                        setIsCreateSeatOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#754329]/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#754329]/35 active:translate-y-0"
                    >
                      <Plus size={16} />
                      <span>Create Seat</span>
                    </button>
                  </div>
                </div>

                {/* Status Message Notification Banner */}
                {seatActionMessage && (
                  <div
                    className={`rounded-2xl p-4 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
                      seatActionMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-current" />
                      <span>{seatActionMessage.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSeatActionMessage(null)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Main Dynamic Grid: Full width (12 cols) if no seat clicked, 8/4 cols when seat is clicked */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

                  {/* ========================================================
                      REALISTIC BOARDROOM IMAGE CANVAS WITH OVERLAID INTERACTIVE SEATS
                      (EXPANDS TO 12 COLS WHEN NO SEAT SELECTED, 8 COLS WHEN CLICKED)
                     ======================================================== */}
                  <div
                    className={`flex flex-col rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 sm:p-7 shadow-xl shadow-[#70452D]/5 backdrop-blur-md transition-all duration-300 ${currentSeat ? "lg:col-span-8" : "lg:col-span-12"
                      }`}
                  >

                    {/* Room Header & Legend */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#EEE5DC] pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#734329] to-[#8C5835] text-white shadow-sm">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-[#342219]">
                              {selectedLocation.name} Executive Boardroom
                            </h2>
                            <span className="rounded-full bg-[#F3E8DC] px-2.5 py-0.5 text-[10px] font-bold text-[#70452D] border border-[#DECFBE]">
                              Room Plan
                            </span>
                          </div>
                          <p className="text-xs text-[#8A7667]">
                            Click any seat to view assigned employee, launch quick actions, or generate &amp; download table QR codes.
                          </p>
                        </div>
                      </div>

                      {/* Seat Status Indicators (Legend) */}
                      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#EADBCE] bg-[#FAF6F2] p-2 text-xs">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/80 shadow-2xs">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                          <span className="text-[#6D5545] font-bold text-[11px]">Assigned</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/80 shadow-2xs">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#96603B] shadow-xs" />
                          <span className="text-[#6D5545] font-bold text-[11px]">Available</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/80 shadow-2xs">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200" />
                          <span className="text-[#6D5545] font-bold text-[11px]">Selected</span>
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC EXECUTIVE CONFERENCE ROOM CANVAS */}
                    <div className="relative my-6 flex min-h-[480px] w-full flex-col items-center justify-center overflow-x-auto rounded-3xl border border-[#DEC5B0] bg-gradient-to-b from-[#FBF8F5] via-[#F8F2EC] to-[#F2E8DC] p-6 sm:p-10 shadow-inner">

                      {/* Subtle architectural dot grid floor */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-40"
                        style={{
                          backgroundImage: `radial-gradient(#C2AFA0 1.2px, transparent 1.2px)`,
                          backgroundSize: `22px 22px`,
                        }}
                      />

                      {/* Ambient Architectural Lighting overlay */}
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-100/30 via-transparent to-stone-400/10" />

                      {/* Modern Botanical Corners & Atmosphere Markers */}
                      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow-xs border border-[#E8DED4] backdrop-blur-md select-none">
                        <span className="text-base">🪴</span>
                        <span className="text-[10px] font-bold text-[#8C5835] uppercase tracking-wider">North Zone</span>
                      </div>
                      <div className="absolute top-4 right-4 flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow-xs border border-[#E8DED4] backdrop-blur-md select-none">
                        <span className="text-[10px] font-bold text-[#8C5835] uppercase tracking-wider">Screen Area</span>
                        <span className="text-base">🖥️</span>
                      </div>
                      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow-xs border border-[#E8DED4] backdrop-blur-md select-none">
                        <span className="text-base">🌱</span>
                        <span className="text-[10px] font-bold text-[#8C5835] uppercase tracking-wider">Room Entrance</span>
                      </div>
                      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow-xs border border-[#E8DED4] backdrop-blur-md select-none">
                        <span className="text-[10px] font-bold text-[#8C5835] uppercase tracking-wider">Espresso Bar</span>
                        <span className="text-base">☕</span>
                      </div>

                      {/* Interactive Seating Model Wrapper */}
                      <div className="relative z-10 flex flex-col items-center justify-center gap-4 py-8">

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
                                  const isAssigned = Boolean(seat.employee);

                                  return (
                                    <div
                                      key={seat.number}
                                      onClick={() => setSelectedSeatNumber(isSelected ? null : seat.number)}
                                      className="group relative flex cursor-pointer flex-col items-center transition-all duration-200 hover:-translate-y-1.5"
                                    >
                                      {/* Chair Backrest */}
                                      <div
                                        className={`h-3 w-12 sm:w-14 rounded-t-xl shadow-xs transition duration-200 ${isSelected
                                            ? "bg-amber-500 shadow-md shadow-amber-500/40"
                                            : isAssigned
                                              ? "bg-gradient-to-r from-[#442D20] via-[#5D3D29] to-[#442D20]"
                                              : "bg-gradient-to-r from-[#6B3F24] via-[#855132] to-[#6B3F24]"
                                          }`}
                                      />

                                      {/* Chair Armrests + Cushion Button */}
                                      <div className="relative flex items-center">
                                        <div className={`h-6 w-1.5 rounded-l-md transition ${isSelected ? "bg-amber-700" : "bg-[#2A1B13]"}`} />

                                        <div
                                          className={`relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl font-black text-xs sm:text-sm text-white shadow-md transition-all duration-200 border-2 select-none ${isSelected
                                              ? "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-amber-200 ring-4 ring-amber-400/40 scale-110 shadow-xl shadow-amber-500/30"
                                              : isAssigned
                                                ? "bg-gradient-to-br from-[#4D2E1B] via-[#694228] to-[#452716] border-emerald-400/70 hover:scale-105 hover:shadow-lg"
                                                : "bg-gradient-to-br from-[#7B4B2A] via-[#945E37] to-[#6F4021] border-[#F2D1AC]/60 hover:scale-105 hover:shadow-lg"
                                            }`}
                                        >
                                          {seat.number}

                                          {/* Status Indicator Badge */}
                                          <span
                                            className={`absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-white text-[9px] font-black shadow-xs ${isAssigned
                                                ? "bg-emerald-500 text-white ring-emerald-100"
                                                : "bg-[#96603B] text-amber-100 ring-[#F3E8DC]"
                                              }`}
                                            title={isAssigned ? `Assigned: ${seat.employee}` : "Available Seat"}
                                          >
                                            {isAssigned ? "✓" : "•"}
                                          </span>
                                        </div>

                                        <div className={`h-6 w-1.5 rounded-r-md transition ${isSelected ? "bg-amber-700" : "bg-[#2A1B13]"}`} />
                                      </div>

                                      {/* Seat ID Pill */}
                                      <div className="mt-1.5">
                                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold tracking-tight border shadow-2xs transition ${isSelected
                                            ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200"
                                            : "bg-white/95 text-[#6E4229] border-[#DECFBE]"
                                          }`}>
                                          {seat.id || `Seat-${seat.number}`}
                                        </span>
                                      </div>

                                      {/* Tooltip on Hover */}
                                      <div className="pointer-events-none absolute -top-14 z-30 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-1">
                                        <div className="rounded-xl border border-stone-700/50 bg-[#251710]/95 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-xl backdrop-blur-xs whitespace-nowrap text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-amber-300">
                                            <span>Seat {seat.number}</span>
                                            <span className="text-stone-400 font-mono">({seat.id})</span>
                                          </div>
                                          <div className={isAssigned ? "text-emerald-300 text-[9px] mt-0.5 font-medium" : "text-amber-200 text-[9px] mt-0.5 font-medium"}>
                                            {isAssigned ? `👤 ${seat.employee}` : "✨ Available • Click to manage"}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* THE EXECUTIVE WOOD GRAIN CONFERENCE TABLE */}
                              <div
                                style={{
                                  minWidth: `${Math.max(320, half * 84)}px`,
                                }}
                                className="relative my-4 flex h-26 sm:h-30 items-center justify-between rounded-3xl border-2 border-[#8C5835] bg-gradient-to-r from-[#A57147] via-[#C59268] to-[#A57147] px-6 sm:px-8 shadow-2xl transition-all duration-300 ring-1 ring-amber-900/10"
                              >
                                {/* Left Table End Decor */}
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md text-base select-none border border-amber-300 backdrop-blur-xs">
                                  ☕
                                </div>

                                {/* Center Table Inset Planter Runner */}
                                <div className="flex items-center gap-3 sm:gap-4 rounded-full border border-[#5E381C] bg-[#2E180B]/90 px-5 sm:px-8 py-2.5 shadow-inner">
                                  <span className="text-base select-none">🌱</span>
                                  <div className="text-center">
                                    <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#FDEBD9]">
                                      {selectedLocation.name} Executive Table
                                    </div>
                                    <div className="text-[9px] font-semibold text-[#D7B7A0] mt-0.5">
                                      {currentSeats.length} Seats &bull; {currentSeats.filter(s => s.employee).length} Occupied
                                    </div>
                                  </div>
                                  <span className="text-base select-none">🌿</span>
                                </div>

                                {/* Right Table End Decor */}
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md text-base select-none border border-amber-300 backdrop-blur-xs">
                                  ☕
                                </div>
                              </div>

                              {/* BOTTOM ROW CHAIRS (Facing up toward table) */}
                              <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
                                {bottomSeats.map((seat) => {
                                  const isSelected = selectedSeatNumber === seat.number;
                                  const isAssigned = Boolean(seat.employee);

                                  return (
                                    <div
                                      key={seat.number}
                                      onClick={() => setSelectedSeatNumber(isSelected ? null : seat.number)}
                                      className="group relative flex cursor-pointer flex-col items-center transition-all duration-200 hover:translate-y-1.5"
                                    >
                                      {/* Seat ID Pill */}
                                      <div className="mb-1.5">
                                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold tracking-tight border shadow-2xs transition ${isSelected
                                            ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200"
                                            : "bg-white/95 text-[#6E4229] border-[#DECFBE]"
                                          }`}>
                                          {seat.id || `Seat-${seat.number}`}
                                        </span>
                                      </div>

                                      {/* Chair Armrests + Cushion Button */}
                                      <div className="relative flex items-center">
                                        <div className={`h-6 w-1.5 rounded-l-md transition ${isSelected ? "bg-amber-700" : "bg-[#2A1B13]"}`} />

                                        <div
                                          className={`relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl font-black text-xs sm:text-sm text-white shadow-md transition-all duration-200 border-2 select-none ${isSelected
                                              ? "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-amber-200 ring-4 ring-amber-400/40 scale-110 shadow-xl shadow-amber-500/30"
                                              : isAssigned
                                                ? "bg-gradient-to-br from-[#4D2E1B] via-[#694228] to-[#452716] border-emerald-400/70 hover:scale-105 hover:shadow-lg"
                                                : "bg-gradient-to-br from-[#7B4B2A] via-[#945E37] to-[#6F4021] border-[#F2D1AC]/60 hover:scale-105 hover:shadow-lg"
                                            }`}
                                        >
                                          {seat.number}

                                          {/* Status Indicator Badge */}
                                          <span
                                            className={`absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-white text-[9px] font-black shadow-xs ${isAssigned
                                                ? "bg-emerald-500 text-white ring-emerald-100"
                                                : "bg-[#96603B] text-amber-100 ring-[#F3E8DC]"
                                              }`}
                                            title={isAssigned ? `Assigned: ${seat.employee}` : "Available Seat"}
                                          >
                                            {isAssigned ? "✓" : "•"}
                                          </span>
                                        </div>

                                        <div className={`h-6 w-1.5 rounded-r-md transition ${isSelected ? "bg-amber-700" : "bg-[#2A1B13]"}`} />
                                      </div>

                                      {/* Chair Backrest */}
                                      <div
                                        className={`h-3 w-12 sm:w-14 rounded-b-xl shadow-xs transition duration-200 ${isSelected
                                            ? "bg-amber-500 shadow-md shadow-amber-500/40"
                                            : isAssigned
                                              ? "bg-gradient-to-r from-[#442D20] via-[#5D3D29] to-[#442D20]"
                                              : "bg-gradient-to-r from-[#6B3F24] via-[#855132] to-[#6B3F24]"
                                          }`}
                                      />

                                      {/* Tooltip on Hover */}
                                      <div className="pointer-events-none absolute -bottom-14 z-30 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-1">
                                        <div className="rounded-xl border border-stone-700/50 bg-[#251710]/95 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-xl backdrop-blur-xs whitespace-nowrap text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-amber-300">
                                            <span>Seat {seat.number}</span>
                                            <span className="text-stone-400 font-mono">({seat.id})</span>
                                          </div>
                                          <div className={isAssigned ? "text-emerald-300 text-[9px] mt-0.5 font-medium" : "text-amber-200 text-[9px] mt-0.5 font-medium"}>
                                            {isAssigned ? `👤 ${seat.employee}` : "✨ Available • Click to manage"}
                                          </div>
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
                        <span>Total Configured Seats:</span>
                        <span className="rounded-lg bg-[#FAF4ED] px-2.5 py-1 font-bold text-[#8C5835] border border-[#EAD5C0] shadow-2xs">
                          {currentSeats.length} Seats
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const locId = selectedLocation.id;
                          const locSeats = seatsByLoc[locId] || [];
                          const nextInfo = getNextAvailableSeatInfo(locSeats);
                          const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
                          setNewSeatForm({
                            location: selectedLocation.name || locId,
                            seatId: nextInfo.seatId,
                            seatNo: nextInfo.number,
                            assignNow: true,
                            employeeName: "",
                            employeeEmail: "",
                            orderUrl: `${window.location.origin}${orgPrefix}/order/${locId}/${parseInt(nextInfo.number, 10) || 1}?seatId=${nextInfo.seatId}`,
                          });
                          setCreateSeatError(null);
                          setIsCreateSeatOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C5835] transition hover:text-[#6F3F24] hover:underline"
                      >
                        <Plus size={14} />
                        <span>Add another seat to this layout</span>
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
                        {(() => {
                          const cleanIdent = (currentSeat.employee || "").trim().toLowerCase();
                          const matchedEmployee = cleanIdent
                            ? orgUsers.find(
                                (u) =>
                                  u.email.toLowerCase() === cleanIdent ||
                                  u.name.toLowerCase() === cleanIdent ||
                                  u.userName.toLowerCase() === cleanIdent ||
                                  u.id === cleanIdent
                              )
                            : null;

                          const effectiveOrderUrl = getEmployeeOrderUrl(
                            currentSeat.employee,
                            currentSeat.id,
                            activeLocationId,
                            currentSeat.number
                          );

                          return (
                            <div className="mt-5 space-y-3.5 text-xs">
                              {/* Assigned Employee */}
                              {matchedEmployee ? (
                                <div className="flex flex-col gap-1.5 rounded-2xl border border-[#EEE5DC] bg-white p-3.5 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-[#8A7667]">Assigned Employee</span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        matchedEmployee.qrTokenStatus === "revoked"
                                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                                          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                      }`}
                                    >
                                      {matchedEmployee.qrTokenStatus === "revoked" ? "Token Revoked" : "Occupied"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 mt-1">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAD5C0] text-[#70452D] font-bold text-xs">
                                      {matchedEmployee.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-bold text-xs text-[#342219] truncate">
                                        {matchedEmployee.name}
                                      </span>
                                      <span className="text-[11px] text-[#8A7667] truncate">
                                        {matchedEmployee.email}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (currentSeat.employee || currentSeat.employeeEmail || currentSeat.employeeName) ? (
                                <div className="flex flex-col gap-1.5 rounded-2xl border border-[#EEE5DC] bg-white p-3.5 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-[#8A7667]">Assigned Employee</span>
                                    <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                                      Occupied
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 mt-1">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAD5C0] text-[#70452D] font-bold text-xs">
                                      <User size={15} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-bold text-xs text-[#342219] truncate">
                                        {currentSeat.employeeName || currentSeat.employee}
                                      </span>
                                      {currentSeat.employeeEmail && (
                                        <span className="text-[11px] text-[#8A7667] truncate">
                                          {currentSeat.employeeEmail}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#D5C2B1] bg-[#FAF8F5] p-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EEE5DC] text-[#8C5835]">
                                      <Armchair size={14} />
                                    </div>
                                    <div>
                                      <span className="font-bold text-xs text-[#593A28]">Available Seat</span>
                                      <p className="text-[10px] text-[#8A7667]">No employee currently assigned</p>
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold">
                                    Available
                                  </span>
                                </div>
                              )}

                              {/* Seat ID */}
                              <div className="flex items-center justify-between rounded-2xl border border-[#EEE5DC] bg-white p-3 shadow-2xs">
                                <span className="font-semibold text-[#8A7667]">Seat Identifier</span>
                                <span className="font-mono font-bold text-sm text-[#342219]">
                                  {currentSeat.id}
                                </span>
                              </div>

                              {/* Order URL Box */}
                              <div className="flex flex-col gap-1.5">
                                <span className="font-semibold text-[#8A7667]">
                                  {matchedEmployee ? "Employee Unique Order URL" : "Order URL"}
                                </span>
                                <div className="flex items-center justify-between rounded-2xl border border-[#E8DED4] bg-[#FAF8F5] p-2.5">
                                  <span className="truncate text-xs font-mono text-[#70523E]">
                                    {effectiveOrderUrl}
                                  </span>
                                  <div className="flex items-center gap-1.5 ml-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(effectiveOrderUrl)}
                                      className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#8C5835] shadow-xs hover:bg-[#FAF6F1] cursor-pointer"
                                      title="Copy URL"
                                    >
                                      {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
                                      <span>{copiedUrl ? "Copied" : "Copy"}</span>
                                    </button>
                                    <a
                                      href={effectiveOrderUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1 rounded-lg bg-[#8C5835] px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#774728] cursor-pointer"
                                      title="Open Employee Order Page"
                                    >
                                      <ExternalLink size={13} />
                                      <span>Open</span>
                                    </a>
                                  </div>
                                </div>
                              </div>

                              {/* Integrated Live QR Code Container */}
                              <div className="mt-2 rounded-2xl border border-[#EEE5DC] bg-[#FAF8F5] p-3.5">
                                <div className="flex items-center gap-3.5">
                                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                        effectiveOrderUrl
                                      )}`}
                                      alt="Employee QR Code"
                                      className="h-full w-full object-contain"
                                    />
                                  </div>

                                  <div className="flex-1 space-y-1">
                                    <p className="text-xs font-bold text-[#342219]">
                                      {matchedEmployee ? `Employee QR (${matchedEmployee.name})` : `Seat ${currentSeat.number} QR`}
                                    </p>
                                    <p className="text-[11px] text-[#8A7667]">
                                      {matchedEmployee ? "Personal secure QR ordering token" : "Assign an employee to create personal QR link"}
                                    </p>
                                    <div className="pt-1 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const link = document.createElement("a");
                                          link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                                            effectiveOrderUrl
                                          )}`;
                                          link.target = "_blank";
                                          link.download = `${matchedEmployee ? matchedEmployee.name.replace(/\s+/g, "_") : `seat_${currentSeat.number}`}_qr.png`;
                                          link.click();
                                        }}
                                        className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#8C5835] border border-[#D5C2B1] hover:bg-[#FAF6F1] cursor-pointer"
                                      >
                                        <Download size={12} />
                                        <span>Download QR (PNG)</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Token Management Actions for Assigned Employee */}
                              {matchedEmployee && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 mt-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-[11px] text-amber-900 flex items-center gap-1.5">
                                      <Key size={12} />
                                      Security & Token Control
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={tokenActionLoading}
                                      onClick={async () => {
                                        if (!confirm(`Are you sure you want to regenerate the QR token for ${matchedEmployee.name}? The old QR code will become invalid immediately.`)) {
                                          return;
                                        }
                                        setTokenActionLoading(true);
                                        try {
                                          const res = await userApi.regenerateQrToken(matchedEmployee.id);
                                          if (res.success) {
                                            alert(`New QR token generated successfully for ${matchedEmployee.name}!`);
                                            fetchOrgUsers();
                                          }
                                        } catch (err: any) {
                                          alert(err.message || "Failed to regenerate token");
                                        } finally {
                                          setTokenActionLoading(false);
                                        }
                                      }}
                                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-white border border-amber-300 px-2 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100/50 cursor-pointer disabled:opacity-50"
                                    >
                                      <RefreshCw size={11} className={tokenActionLoading ? "animate-spin" : ""} />
                                      <span>Regenerate</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={tokenActionLoading}
                                      onClick={async () => {
                                        if (!confirm(`Are you sure you want to revoke the QR token for ${matchedEmployee.name}? They will no longer be able to place orders until a new token is generated.`)) {
                                          return;
                                        }
                                        setTokenActionLoading(true);
                                        try {
                                          const res = await userApi.revokeQrToken(matchedEmployee.id);
                                          if (res.success) {
                                            alert(`QR ordering token revoked for ${matchedEmployee.name}.`);
                                            fetchOrgUsers();
                                          }
                                        } catch (err: any) {
                                          alert(err.message || "Failed to revoke token");
                                        } finally {
                                          setTokenActionLoading(false);
                                        }
                                      }}
                                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-rose-50 border border-rose-300 px-2 py-1.5 text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                                    >
                                      <Ban size={11} />
                                      <span>Revoke Token</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Action Buttons: Context-aware for Assigned vs Available Seats */}
                        <div className="mt-5 border-t border-[#EEE5DC] pt-4">
                          {Boolean(currentSeat.employee || currentSeat.employeeEmail || currentSeat.employeeName) ? (
                            <div className="grid grid-cols-2 gap-2.5">
                              {/* Change Employee */}
                              <button
                                type="button"
                                onClick={() => {
                                  const cleanIdent = (currentSeat.employee || currentSeat.employeeEmail || "").trim().toLowerCase();
                                  const matched = cleanIdent
                                    ? orgUsers.find((u) => u.email.toLowerCase() === cleanIdent || u.name.toLowerCase() === cleanIdent)
                                    : null;
                                  setEditSeatForm({
                                    employeeName: currentSeat.employeeName || matched?.name || "",
                                    employeeEmail: currentSeat.employeeEmail || currentSeat.employee || matched?.email || "",
                                    orderUrl: currentSeat.orderUrl || "",
                                  });
                                  setEditSeatError(null);
                                  setIsEditSeatOpen(true);
                                }}
                                className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#D5C2B1] bg-white py-2.5 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1] shadow-2xs"
                              >
                                <UserPlus size={14} className="text-[#8C5835]" />
                                <span>Change Employee</span>
                              </button>

                              {/* Remove Employee */}
                              <button
                                type="button"
                                onClick={() => setIsUnassignConfirmOpen(true)}
                                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100 shadow-2xs"
                              >
                                <UserMinus size={14} className="text-rose-600" />
                                <span>Remove Employee</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {/* Assign Employee for Available seat */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSeatForm({
                                    employeeName: "",
                                    employeeEmail: "",
                                    orderUrl: "",
                                  });
                                  setEditSeatError(null);
                                  setIsEditSeatOpen(true);
                                }}
                                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#754329] to-[#8C5835] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
                              >
                                <UserPlus size={15} />
                                <span>Assign Employee</span>
                              </button>
                            </div>
                          )}
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
            MODAL: CREATE LOCATION (MATCHING APP UI THEME)
           ======================================================== */}
        <CreateFormModal
          isOpen={isCreateLocationOpen}
          onClose={() => {
            setNewLocationName("");
            setNewLocationImage("");
            setIsCreateLocationOpen(false);
          }}
          title="Location Create"
          onSubmit={handleCreateLocationSubmit}
        >
          {/* Name */}
          <FormRow label="Name" required>
            <input
              id="location-name"
              required
              type="text"
              placeholder="Name"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none transition focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
            />
          </FormRow>

          {/* Status */}
          <FormRow label="Status" required>
            <select
              id="location-status"
              required
              value={newLocationStatus}
              onChange={(e) => setNewLocationStatus(e.target.value as "Active" | "Inactive")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 bg-white outline-none transition focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20 cursor-pointer"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FormRow>

          {/* Image */}
          <FormRow label="Image" labelAlign="top">
            <input
              type="file"
              ref={locationImageInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setNewLocationImage(ev.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />

            {/* Image Upload Trigger Box with upload icon */}
            <div
              onClick={() => locationImageInputRef.current?.click()}
              className="group relative flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/70 transition hover:border-[#8C5835] hover:bg-white overflow-hidden shadow-xs"
              title="Click to select image"
            >
              {newLocationImage ? (
                <div className="relative h-full w-full">
                  <img
                    src={newLocationImage}
                    alt="Location preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold text-white bg-black/60 px-2 py-1 rounded-md">Change</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 group-hover:text-[#8C5835] transition">
                  <Upload size={24} className="mb-1 text-gray-400 group-hover:text-[#8C5835]" />
                  <span className="text-xs font-semibold text-gray-700">Upload Image</span>
                  <span className="text-[10px] text-gray-400">JPG, PNG (Max 2MB)</span>
                </div>
              )}
            </div>
          </FormRow>
        </CreateFormModal>

        {/* ========================================================
            MODAL: CREATE SEAT (LOCATION-SEAT CREATE)
           ======================================================== */}
        <CreateFormModal
          isOpen={isCreateSeatOpen}
          onClose={() => {
            setIsCreateSeatOpen(false);
            setCreateSeatError(null);
          }}
          title="Create Seat"
          onSubmit={handleCreateSeatSubmit}
        >
          {createSeatError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {createSeatError}
            </div>
          )}

          {/* Location */}
          <FormRow label="Location">
            <input
              type="text"
              readOnly
              value={selectedLocation?.name || newSeatForm.location || "Office"}
              className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700 outline-none cursor-not-allowed"
            />
          </FormRow>

          {/* SeatId (Read-only, auto-generated sequentially e.g. FTS-01, FTS-02) */}
          <FormRow label="Seat Identifier" required>
            <div className="relative">
              <input
                required
                readOnly
                type="text"
                placeholder="Seat Identifier"
                value={newSeatForm.seatId}
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700 font-mono font-bold outline-none cursor-not-allowed"
                title="Automatically generated using organization shortcode and sequential seat number"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Auto Generated
              </span>
            </div>
          </FormRow>

          {/* SeatNo * */}
          <FormRow label="Seat Number" required>
            <input
              required
              type="text"
              placeholder="e.g. 13"
              value={newSeatForm.seatNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                const locId = selectedLocation?.id || "1";
                const code = currentShortCode || "FTS";
                const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
                const generatedId = `${code}-${val ? val.padStart(2, "0") : ""}`;

                setNewSeatForm({
                  ...newSeatForm,
                  seatNo: val,
                  seatId: generatedId,
                  orderUrl: `${window.location.origin}${orgPrefix}/order/${locId}/${parseInt(val, 10) || 1}?seatId=${generatedId}`,
                });
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 font-bold"
            />
          </FormRow>

          {/* Assign Employee Checkbox */}
          <div className="my-3 rounded-xl border border-[#EEE5DC] bg-[#FAF8F5] p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newSeatForm.assignNow}
                onChange={(e) => setNewSeatForm({ ...newSeatForm, assignNow: e.target.checked })}
                className="h-4 w-4 rounded text-[#8C5835] focus:ring-[#8C5835] border-gray-300 cursor-pointer"
              />
              <span className="text-xs font-bold text-[#342219]">Assign an employee now</span>
            </label>
            <p className="mt-1 ml-6.5 text-[11px] text-[#8A7667]">
              {newSeatForm.assignNow
                ? "This seat will be marked Occupied and associated with this employee."
                : "Leave unchecked to create an unassigned Available seat that can be assigned later."}
            </p>
          </div>

          {/* Employee Fields - Shown when assignNow is checked */}
          {newSeatForm.assignNow && (
            <div className="space-y-3 rounded-2xl border border-[#E8DED4] bg-white p-3.5">
              <FormRow label="Employee Name" required>
                <input
                  required={newSeatForm.assignNow}
                  type="text"
                  placeholder="e.g. Mohamed Imthiyaz"
                  value={newSeatForm.employeeName}
                  onChange={(e) =>
                    setNewSeatForm({ ...newSeatForm, employeeName: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 font-medium"
                />
              </FormRow>

              <FormRow label="Employee Email" required>
                <input
                  required={newSeatForm.assignNow}
                  type="email"
                  placeholder="e.g. imthiyaz@example.com"
                  value={newSeatForm.employeeEmail}
                  onChange={(e) =>
                    setNewSeatForm({ ...newSeatForm, employeeEmail: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 font-medium"
                />
              </FormRow>
            </div>
          )}

          {isCreatingSeat && (
            <div className="mt-2 text-center text-xs font-medium text-[#8C5835] animate-pulse">
              Creating seat and registering assignment…
            </div>
          )}
        </CreateFormModal>

        {/* ========================================================
            MODAL: ASSIGN / CHANGE EMPLOYEE
           ======================================================== */}
        {isEditSeatOpen && currentSeat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6ECE2] text-[#8C5835]">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#342219]">
                      {currentSeat.employee || currentSeat.employeeEmail ? "Change Employee" : "Assign Employee"}
                    </h3>
                    <p className="text-xs text-[#8A7667]">
                      Seat {currentSeat.number} &bull; <span className="font-mono">{currentSeat.id}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditSeatOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {editSeatError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                  {editSeatError}
                </div>
              )}

              <form onSubmit={handleSaveSeatAssignment} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-[#45352B]">
                    Employee Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mohamed Imthiyaz"
                    value={editSeatForm.employeeName}
                    onChange={(e) => setEditSeatForm({ ...editSeatForm, employeeName: e.target.value })}
                    className="w-full rounded-xl border border-[#E8DED4] p-2.5 text-sm text-[#342219] outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 font-medium"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#45352B]">
                    Employee Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. imthiyaz@example.com"
                    value={editSeatForm.employeeEmail}
                    onChange={(e) => setEditSeatForm({ ...editSeatForm, employeeEmail: e.target.value })}
                    className="w-full rounded-xl border border-[#E8DED4] p-2.5 text-sm text-[#342219] outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 font-medium"
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
                  <p className="font-semibold">Assignment details:</p>
                  <p className="mt-0.5 text-[#7C5A3E]">
                    Seat identifier <strong className="font-mono">{currentSeat.id}</strong> will remain unchanged.
                    Order links and QR badges will route orders under this employee identity.
                  </p>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isSavingSeat}
                    onClick={() => setIsEditSeatOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSeat}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-5 py-2 font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50"
                  >
                    {isSavingSeat ? "Saving…" : "Save Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: CONFIRM REMOVE / UNASSIGN EMPLOYEE
           ======================================================== */}
        {isUnassignConfirmOpen && currentSeat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl animate-in fade-in duration-200">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mx-auto mb-3.5">
                <UserMinus size={24} />
              </div>

              <h3 className="text-center text-lg font-bold text-[#342219]">
                Remove Employee from Seat {currentSeat.number}?
              </h3>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 text-xs text-gray-700 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#8A7667]">Seat Identifier:</span>
                  <strong className="font-mono text-[#342219]">{currentSeat.id}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A7667]">Assigned Employee:</span>
                  <strong className="text-[#342219]">{currentSeat.employeeName || currentSeat.employee || "Assigned"}</strong>
                </div>
                {currentSeat.employeeEmail && (
                  <div className="flex justify-between">
                    <span className="text-[#8A7667]">Email:</span>
                    <span className="font-mono text-gray-600">{currentSeat.employeeEmail}</span>
                  </div>
                )}
              </div>

              <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 space-y-1">
                <p className="font-semibold text-amber-950">What will happen:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[#735133]">
                  <li>The employee assignment will be cleared.</li>
                  <li>Seat <strong className="font-mono">{currentSeat.id}</strong> will remain in the seating plan as <strong>Available</strong>.</li>
                  <li>The seat and location records are NOT deleted.</li>
                  <li>Another employee can be assigned to this seat at any time.</li>
                </ul>
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isUnassigning}
                  onClick={() => setIsUnassignConfirmOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUnassigning}
                  onClick={handleUnassignEmployee}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
                >
                  {isUnassigning ? "Removing…" : "Yes, Remove Employee"}
                </button>
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
