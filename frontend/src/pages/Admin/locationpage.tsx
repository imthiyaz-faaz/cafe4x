import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Upload,
  Download,
  RotateCw,
  Edit,
  Edit2,
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
  CheckCircle2,
  Loader2,
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
import { formatSeatIdentifier, getSeatDisplayIdentifier } from "../../utils/seatFormatter";

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
  employeeUserName?: string;
  employeeQrToken?: string;
  assignmentId?: string;
  assignedAt?: string;
  qrToken?: string;
  orderUrl: string;
  isOccupied?: boolean;
  status?: "Occupied" | "Available";
}

/**
 * Single source of truth for seat occupancy across the entire application.
 * A seat is strictly Occupied whenever a valid employee is assigned to it
 * (via employee, employeeEmail, employeeName, employeeId, assignmentId, or explicit isOccupied flag).
 */
export function isSeatOccupied(seat?: SeatItem | null): boolean {
  if (!seat) return false;
  return Boolean(
    (seat.employee && String(seat.employee).trim().length > 0) ||
    (seat.employeeEmail && String(seat.employeeEmail).trim().length > 0) ||
    (seat.employeeName && String(seat.employeeName).trim().length > 0) ||
    (seat.employeeId && String(seat.employeeId).trim().length > 0) ||
    (seat.assignmentId && String(seat.assignmentId).trim().length > 0) ||
    seat.isOccupied === true
  );
}

export function normalizeLocationPrefix(name?: string): string {
  const cleaned = (name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "OFFICE";
}

export default function LocationPage() {
  const params = useParams();
  const navigate = useNavigate();
  const urlLocationId = params.locationId || null;
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

// Helper to compute next available unique seat number and sequential Seat ID (e.g. OFFICE-001)
  const getNextAvailableSeatInfo = (
    existingSeats: SeatItem[],
    locationName?: string,
    serverNextCandidate?: number
  ) => {
    const locPrefix = normalizeLocationPrefix(locationName || selectedLocation?.name || "OFFICE");
    const usedNumbers = new Set<number>();
    let maxNumber = 0;

    (existingSeats || []).forEach((s) => {
      const parsedNum = parseInt(s.number, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        usedNumbers.add(parsedNum);
        maxNumber = Math.max(maxNumber, parsedNum);
      }
      const rawId = s.displayId || s.id;
      if (rawId) {
        const match = rawId.match(/(\d+)$/);
        if (match) {
          const idNum = parseInt(match[1], 10);
          if (!isNaN(idNum) && idNum > 0) {
            usedNumbers.add(idNum);
            maxNumber = Math.max(maxNumber, idNum);
          }
        }
      }
    });

    let candidate = serverNextCandidate && serverNextCandidate > maxNumber
      ? serverNextCandidate
      : (maxNumber + 1);

    while (usedNumbers.has(candidate)) {
      candidate++;
    }

    const seatNumber = String(candidate);
    const seatId = `${locPrefix}-${candidate}`;
    return { number: seatNumber, seatId, candidateNum: candidate };
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
  const [createLocNameError, setCreateLocNameError] = useState<string | null>(null);
  const [createLocNameChecking, setCreateLocNameChecking] = useState(false);
  const [createLocNameAvailable, setCreateLocNameAvailable] = useState<boolean | null>(null);
  const [isSubmittingCreateLoc, setIsSubmittingCreateLoc] = useState(false);
  const createLocTimerRef = useRef<any>(null);
  const createLocAbortRef = useRef<AbortController | null>(null);

  // Edit Location state
  const [editLocNameError, setEditLocNameError] = useState<string | null>(null);
  const [editLocNameChecking, setEditLocNameChecking] = useState(false);
  const [editLocNameAvailable, setEditLocNameAvailable] = useState<boolean | null>(null);
  const [isSubmittingEditLoc, setIsSubmittingEditLoc] = useState(false);
  const editLocTimerRef = useRef<any>(null);
  const editLocAbortRef = useRef<AbortController | null>(null);

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

          // If a direct URL with :locationId was opened, select the matching location immediately
          if (urlLocationId) {
            const matched = serverLocs.find(
              (l) => String(l.id) === String(urlLocationId) || String(l.displayId) === String(urlLocationId)
            );
            if (matched) {
              setSelectedLocation(matched);
            }
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch locations from server:", err);
        setLocations([]);
      });

    return () => {
      isMounted = false;
    };
  }, [locStorageKey, currentShortCode, urlLocationId]);

  // If directly accessing via /:shortCode/admin/locationseats/:locationId and location wasn't in list yet, fetch single location
  useEffect(() => {
    if (!urlLocationId) return;
    if (selectedLocation && (String(selectedLocation.id) === String(urlLocationId) || String(selectedLocation.displayId) === String(urlLocationId))) {
      return;
    }

    let isMounted = true;
    locationApi.getLocationById(urlLocationId)
      .then((loc) => {
        if (!isMounted) return;
        if (loc) {
          setSelectedLocation(loc);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch direct location by ID:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [urlLocationId]);

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

  // Helper to re-fetch seats for active location from backend D1 database
  const refreshLocationSeats = (locId: string) => {
    locationApi
      .getSeats(locId)
      .then((backendSeats) => {
        if (Array.isArray(backendSeats)) {
          const mapped: SeatItem[] = backendSeats.map((s) => {
            const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
            const seatUrl = s.qrToken
              ? `${window.location.origin}${orgPrefix}/order/${s.qrToken}`
              : (s.orderUrl
                  ? (s.orderUrl.startsWith("http") ? s.orderUrl : `${window.location.origin}${s.orderUrl.startsWith("/") ? "" : "/"}${s.orderUrl}`)
                  : `${window.location.origin}${orgPrefix}/order/${locId}/${s.number}`);
            const assignedEmp = s.employee || s.employeeEmail || s.employeeName || undefined;
            return {
              id: s.id || s.displayId || `${normalizeLocationPrefix(selectedLocation?.name)}-${String(s.number).padStart(4, "0")}`,
              displayId: s.displayId,
              number: s.number,
              locationId: locId,
              organizationId: s.organizationId,
              qrToken: s.qrToken,
              employee: assignedEmp,
              employeeName: s.employeeName || (assignedEmp ? assignedEmp.split("@")[0] : undefined),
              employeeEmail: s.employeeEmail || (assignedEmp && assignedEmp.includes("@") ? assignedEmp : undefined),
              employeeId: s.employeeId,
              employeeUserName: s.employeeUserName,
              employeeQrToken: s.employeeQrToken,
              assignmentId: s.assignmentId,
              assignedAt: s.assignedAt,
              orderUrl: seatUrl,
              isOccupied: Boolean(assignedEmp || s.isOccupied),
              status: (assignedEmp || s.isOccupied) ? "Occupied" : "Available",
            };
          });

          setSeatsByLoc((prev) => {
            const next = { ...prev, [locId]: mapped };
            try {
              localStorage.setItem(seatsStorageKey, JSON.stringify(next));
              localStorage.setItem("cafe4x_seatsByLoc", JSON.stringify(next));
            } catch { }
            return next;
          });
        }
      })
      .catch((err) => console.warn("Failed to refresh seats:", err));
  };

  // Helper to resolve an employee's secure permanent QR order URL or seat permanent QR URL
  const getEmployeeOrderUrl = (_employeeIdentifier?: string, _seatId?: string, locId?: string, seatNo?: string, qrToken?: string) => {
    const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
    if (qrToken) {
      return `${window.location.origin}${orgPrefix}/order/${qrToken}`;
    }
    const effectiveLocId = locId || (selectedLocation ? String(selectedLocation.id) : "1");
    const effectiveSeatNo = parseInt(seatNo || "1", 10) || 1;
    return `${window.location.origin}${orgPrefix}/order/${effectiveLocId}/${effectiveSeatNo}`;
  };

  // Load seats from backend on selectedLocation change, falling back to local storage
  useEffect(() => {
    if (!selectedLocation) return;
    const locId = String(selectedLocation.id);

    // Fetch seats from backend
    refreshLocationSeats(locId);
  }, [selectedLocation?.id, currentShortCode]);

  // Seat Delete confirmation state
  const [seatToDelete, setSeatToDelete] = useState<SeatItem | null>(null);
  const [isDeletingSeat, setIsDeletingSeat] = useState(false);

  // Search & selection states for Assign Employee modal
  const [assignEmployeeSearch, setAssignEmployeeSearch] = useState("");
  const [selectedEmployeeToAssign, setSelectedEmployeeToAssign] = useState<UserItem | null>(null);
  const [selectedCreateEmployee, setSelectedCreateEmployee] = useState<UserItem | null>(null);

  const handleDeleteSeatClick = (seat: SeatItem) => {
    setSeatToDelete(seat);
  };

  const handleConfirmDeleteSeat = async () => {
    if (!seatToDelete || !selectedLocation) return;
    setIsDeletingSeat(true);
    const locId = selectedLocation.id;
    const isAssigned = isSeatOccupied(seatToDelete);

    try {
      await locationApi.deleteSeat(locId, seatToDelete.id);

      // Remove locally from state
      setSeatsByLoc((prev) => {
        const currentLocSeats = prev[locId] || [];
        const updatedSeats = currentLocSeats.filter(
          (s) => s.id !== seatToDelete.id && s.number !== seatToDelete.number
        );
        return {
          ...prev,
          [locId]: updatedSeats,
        };
      });

      // Update location counter
      setLocations((prev) =>
        prev.map((l) => (l.id === locId ? { ...l, totalSeats: Math.max(0, (l.totalSeats || 1) - 1) } : l))
      );

      if (selectedSeatNumber === seatToDelete.number) {
        setSelectedSeatNumber(null);
      }

      setSeatToDelete(null);

      // Refresh seats from server
      await refreshLocationSeats(locId);

      setSeatActionMessage({
        type: "success",
        text: isAssigned
          ? `Seat ${seatToDelete.number} and its assigned employee have been permanently deleted.`
          : `Seat ${seatToDelete.number} has been permanently deleted.`,
      });
      setTimeout(() => setSeatActionMessage(null), 4000);
    } catch (err: any) {
      setSeatActionMessage({
        type: "error",
        text: err.message || "Failed to delete seat.",
      });
      setTimeout(() => setSeatActionMessage(null), 5000);
    } finally {
      setIsDeletingSeat(false);
    }
  };

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
  const [createSeatEmailError, setCreateSeatEmailError] = useState<string | null>(null);
  const [createSeatEmailChecking, setCreateSeatEmailChecking] = useState(false);
  const [createSeatEmailAvailable, setCreateSeatEmailAvailable] = useState<boolean | null>(null);
  const createSeatEmailTimerRef = useRef<any>(null);
  const createSeatEmailAbortRef = useRef<AbortController | null>(null);
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

  // Edit Assigned Employee Modal State (Direct Name & Email Update)
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    name: "",
    email: "",
  });
  const [editEmployeeError, setEditEmployeeError] = useState<string | null>(null);
  const [editEmployeeEmailError, setEditEmployeeEmailError] = useState<string | null>(null);
  const [editEmployeeEmailChecking, setEditEmployeeEmailChecking] = useState(false);
  const [editEmployeeEmailAvailable, setEditEmployeeEmailAvailable] = useState<boolean | null>(null);
  const editEmployeeEmailTimerRef = useRef<any>(null);
  const editEmployeeEmailAbortRef = useRef<AbortController | null>(null);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);

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
  const totalOccupiedSeats = useMemo(() => {
    return currentSeats.filter((s) => isSeatOccupied(s)).length;
  }, [currentSeats]);
  const totalAvailableSeats = useMemo(() => {
    return Math.max(0, currentSeats.length - totalOccupiedSeats);
  }, [currentSeats.length, totalOccupiedSeats]);

  const currentSeat = selectedSeatNumber
    ? currentSeats.find((s) => s.number === selectedSeatNumber) || null
    : null;

  // Handlers
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleSelectLocation = (loc: LocationItem) => {
    setSelectedLocation(loc);
    const orgSlug = currentShortCode || "admin";
    navigate(`/${orgSlug}/admin/locationseats/${loc.id}`);
  };

  const handleBackToLocations = () => {
    setSelectedLocation(null);
    const orgSlug = currentShortCode || "admin";
    navigate(`/${orgSlug}/location`);
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

  // Real-time location name validation for Create Location
  const checkCreateLocationNameAvailability = async (rawVal: string) => {
    const val = rawVal.trim();
    if (!val) {
      setCreateLocNameChecking(false);
      setCreateLocNameAvailable(null);
      setCreateLocNameError(null);
      return;
    }

    // Local in-memory check first (instant check against loaded locations for this org)
    const existsLocally = locations.some(
      (l) => l.name.trim().toLowerCase() === val.toLowerCase()
    );
    if (existsLocally) {
      setCreateLocNameChecking(false);
      setCreateLocNameAvailable(false);
      setCreateLocNameError("This location name already exists in this organization.");
      return;
    }

    if (createLocAbortRef.current) {
      createLocAbortRef.current.abort();
    }
    const controller = new AbortController();
    createLocAbortRef.current = controller;

    setCreateLocNameChecking(true);
    try {
      const res = await locationApi.checkLocationName(val, undefined, controller.signal);
      if (!res.available) {
        setCreateLocNameAvailable(false);
        setCreateLocNameError("This location name already exists in this organization.");
      } else {
        setCreateLocNameAvailable(true);
        setCreateLocNameError(null);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.name === "CanceledError") {
        return;
      }
      setCreateLocNameAvailable(null);
      setCreateLocNameError(err?.message || "Unable to verify location name.");
    } finally {
      if (!controller.signal.aborted) {
        setCreateLocNameChecking(false);
      }
    }
  };

  const handleCreateLocNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setNewLocationName(nextVal);
    setCreateLocNameAvailable(null);
    setCreateLocNameError(null);

    if (createLocTimerRef.current) {
      clearTimeout(createLocTimerRef.current);
    }

    const trimmed = nextVal.trim();
    if (!trimmed) {
      setCreateLocNameChecking(false);
      setCreateLocNameAvailable(null);
      return;
    }

    setCreateLocNameChecking(true);
    createLocTimerRef.current = setTimeout(() => {
      checkCreateLocationNameAvailability(trimmed);
    }, 400);
  };

  // Real-time location name validation for Edit Location
  const checkEditLocationNameAvailability = async (rawVal: string, excludeId?: string) => {
    const val = rawVal.trim();
    if (!val) {
      setEditLocNameChecking(false);
      setEditLocNameAvailable(null);
      setEditLocNameError("Location name is required.");
      return;
    }

    // Local in-memory check first (exclude current location being edited)
    const existsLocally = locations.some(
      (l) => l.id !== excludeId && l.displayId !== excludeId && l.name.trim().toLowerCase() === val.toLowerCase()
    );
    if (existsLocally) {
      setEditLocNameChecking(false);
      setEditLocNameAvailable(false);
      setEditLocNameError("This location name already exists in this organization.");
      return;
    }

    if (editLocAbortRef.current) {
      editLocAbortRef.current.abort();
    }
    const controller = new AbortController();
    editLocAbortRef.current = controller;

    setEditLocNameChecking(true);
    try {
      const res = await locationApi.checkLocationName(val, excludeId, controller.signal);
      if (!res.available) {
        setEditLocNameAvailable(false);
        setEditLocNameError("This location name already exists in this organization.");
      } else {
        setEditLocNameAvailable(true);
        setEditLocNameError(null);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.name === "CanceledError") {
        return;
      }
      setEditLocNameAvailable(null);
      setEditLocNameError(err?.message || "Unable to verify location name.");
    } finally {
      if (!controller.signal.aborted) {
        setEditLocNameChecking(false);
      }
    }
  };

  const handleEditLocNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    if (editingLoc) {
      setEditingLoc({ ...editingLoc, name: nextVal });
    }
    setEditLocNameAvailable(null);
    setEditLocNameError(null);

    if (editLocTimerRef.current) {
      clearTimeout(editLocTimerRef.current);
    }

    const trimmed = nextVal.trim();
    if (!trimmed) {
      setEditLocNameChecking(false);
      setEditLocNameAvailable(null);
      setEditLocNameError("Location name is required.");
      return;
    }

    setEditLocNameChecking(true);
    editLocTimerRef.current = setTimeout(() => {
      checkEditLocationNameAvailability(trimmed, editingLoc?.id);
    }, 400);
  };

  const handleCreateLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newLocationName.trim();
    if (!trimmedName) {
      setCreateLocNameError("Location name is required.");
      return;
    }

    // Check duplicate within the organization before submitting
    const duplicate = locations.some(
      (l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setCreateLocNameError("This location name already exists in this organization.");
      return;
    }

    setIsSubmittingCreateLoc(true);
    try {
      // Validate availability with backend
      const checkRes = await locationApi.checkLocationName(trimmedName);
      if (!checkRes.available) {
        setCreateLocNameError("This location name already exists in this organization.");
        setIsSubmittingCreateLoc(false);
        return;
      }

      let currentOrgId = "";
      try {
        const stored = localStorage.getItem("cafe4x_currentUser");
        if (stored) currentOrgId = JSON.parse(stored).organizationId || "";
      } catch { }

      const payload: Partial<LocationItem> = {
        name: trimmedName,
        status: newLocationStatus,
        totalSeats: 0,
        image: newLocationImage || undefined,
        shortCode: currentShortCode || undefined,
        organizationId: currentOrgId || undefined,
      };

      const serverLoc = await locationApi.createLocation(payload);
      if (!serverLoc?.id) {
        throw new Error("Location creation did not return a valid location ID from the server.");
      }
      const newLoc: LocationItem = serverLoc;

      const updated = [...locations, newLoc];
      saveLocations(updated);

      const updatedSeats = {
        ...seatsByLoc,
        [newLoc.id]: [],
      };
      saveSeatsByLoc(updatedSeats);

      setNewLocationName("");
      setNewLocationStatus("Active");
      setNewLocationImage("");
      setCreateLocNameError(null);
      setCreateLocNameAvailable(null);
      setIsCreateLocationOpen(false);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to create location.";
      if (msg.toLowerCase().includes("already exists")) {
        setCreateLocNameError("This location name already exists in this organization.");
      } else {
        setCreateLocNameError(msg);
      }
    } finally {
      setIsSubmittingCreateLoc(false);
    }
  };

  const handleEditLocationSubmit = async () => {
    if (!editingLoc) return;
    const trimmedName = editingLoc.name.trim();
    if (!trimmedName) {
      setEditLocNameError("Location name is required.");
      return;
    }

    // Check duplicate within the organization (excluding this location)
    const duplicate = locations.some(
      (l) => l.id !== editingLoc.id && l.displayId !== editingLoc.id && l.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setEditLocNameError("This location name already exists in this organization.");
      return;
    }

    setIsSubmittingEditLoc(true);
    try {
      const checkRes = await locationApi.checkLocationName(trimmedName, editingLoc.id);
      if (!checkRes.available) {
        setEditLocNameError("This location name already exists in this organization.");
        setIsSubmittingEditLoc(false);
        return;
      }

      await locationApi.updateLocation(editingLoc.id, {
        name: trimmedName,
      });

      setLocations((prev) =>
        prev.map((l) => (l.id === editingLoc.id ? { ...editingLoc, name: trimmedName } : l))
      );

      if (selectedLocation?.id === editingLoc.id) {
        setSelectedLocation({ ...selectedLocation, name: trimmedName });
      }

      setIsEditLocationOpen(false);
      setEditLocNameError(null);
      setEditLocNameAvailable(null);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to update location.";
      if (msg.toLowerCase().includes("already exists")) {
        setEditLocNameError("This location name already exists in this organization.");
      } else {
        setEditLocNameError(msg);
      }
    } finally {
      setIsSubmittingEditLoc(false);
    }
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

    const providerIds = (updatedLoc.assignedProviders || []).map((p: any) => p.id);
    locationApi.assignProvider(updatedLoc.id, {
      assignedProviderId: updatedLoc.assignedProviderId,
      assignedProviderEmail: updatedLoc.assignedProviderEmail,
      assignedProviderName: updatedLoc.assignedProviderName,
      providerIds: providerIds.length > 0 ? providerIds : (updatedLoc.assignedProviderId ? [updatedLoc.assignedProviderId] : []),
    }).catch((err) => {
      console.warn("Could not assign provider on backend:", err);
    });
  };


  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Handle live Employee Email validation in Create Seat modal
  const handleCreateSeatEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setNewSeatForm((prev) => ({ ...prev, employeeEmail: rawVal }));

    if (createSeatEmailTimerRef.current) {
      clearTimeout(createSeatEmailTimerRef.current);
    }
    if (createSeatEmailAbortRef.current) {
      createSeatEmailAbortRef.current.abort();
    }

    const trimmed = rawVal.trim();
    if (!trimmed) {
      setCreateSeatEmailError("Employee email is required.");
      setCreateSeatEmailAvailable(null);
      setCreateSeatEmailChecking(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setCreateSeatEmailError("Please enter a valid email address.");
      setCreateSeatEmailAvailable(null);
      setCreateSeatEmailChecking(false);
      return;
    }

    // Format is valid, clear previous format errors and initiate backend duplicate check
    setCreateSeatEmailError(null);
    setCreateSeatEmailChecking(true);
    setCreateSeatEmailAvailable(null);

    const locId = selectedLocation?.id || "1";
    const currentLocSeats = seatsByLoc[locId] || [];
    const normalizedInput = trimmed.toLowerCase();

    createSeatEmailTimerRef.current = setTimeout(async () => {
      // 1. Fast client-side check on loaded location seats
      const clientDuplicate = currentLocSeats.some((s) => {
        const empEmail = (s.employeeEmail || (s.employee && s.employee.includes("@") ? s.employee : "")).trim().toLowerCase();
        return empEmail === normalizedInput;
      });

      if (clientDuplicate) {
        setCreateSeatEmailChecking(false);
        setCreateSeatEmailAvailable(false);
        setCreateSeatEmailError("This employee email is already assigned to a seat in this location.");
        return;
      }

      // 2. Authoritative backend check
      const abortCtrl = new AbortController();
      createSeatEmailAbortRef.current = abortCtrl;

      try {
        const res = await locationApi.checkEmployeeEmail(locId, normalizedInput, undefined, abortCtrl.signal);
        setCreateSeatEmailChecking(false);
        if (res.available) {
          setCreateSeatEmailAvailable(true);
          setCreateSeatEmailError(null);
        } else {
          setCreateSeatEmailAvailable(false);
          setCreateSeatEmailError(res.message || "This employee email is already assigned to a seat in this location.");
        }
      } catch (err: any) {
        if (err.name === "AbortError" || abortCtrl.signal.aborted) return;
        setCreateSeatEmailChecking(false);
        setCreateSeatEmailAvailable(null);
        // Do not block user on network blip, backend validation on submit will re-verify
      }
    }, 450);
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
    const parsedNum = parseInt(rawSeatNo, 10);
    const seatNum = !isNaN(parsedNum) ? String(parsedNum) : rawSeatNo;
    const locId = selectedLocation?.id || "1";
    const locName = selectedLocation?.name || "OFFICE";
    const locPrefix = normalizeLocationPrefix(locName);
    const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
    const finalSeatId = newSeatForm.seatId.trim() || `${locPrefix}-${parsedNum || 1}`;

    const currentLocSeats = seatsByLoc[locId] || [];

    // Duplicate check
    const seatExists = currentLocSeats.some(
      (s) => s.number === seatNum || 
             (s.displayId && s.displayId.toLowerCase() === finalSeatId.toLowerCase()) ||
             (s.id && s.id.toLowerCase() === finalSeatId.toLowerCase())
    );
    if (seatExists) {
      setCreateSeatError(`This seat identifier already exists in this location.`);
      return;
    }

    const targetEmp = selectedCreateEmployee;
    const trimmedName = targetEmp ? targetEmp.name : newSeatForm.employeeName.trim();
    const trimmedEmail = targetEmp ? targetEmp.email : newSeatForm.employeeEmail.trim().toLowerCase();

    if (newSeatForm.assignNow) {
      if (!trimmedName || !trimmedEmail) {
        setCreateSeatError("Please select or enter an employee to assign.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setCreateSeatEmailError("Please enter a valid email address.");
        setCreateSeatError("Please enter a valid email address.");
        return;
      }

      // Recheck email availability synchronously / against local and backend
      const clientDup = currentLocSeats.some((s) => {
        const empEmail = (s.employeeEmail || (s.employee && s.employee.includes("@") ? s.employee : "")).trim().toLowerCase();
        return empEmail === trimmedEmail;
      });
      if (clientDup) {
        const dupMsg = "This employee email is already assigned to a seat in this location.";
        setCreateSeatEmailError(dupMsg);
        setCreateSeatError(dupMsg);
        return;
      }

      try {
        const checkRes = await locationApi.checkEmployeeEmail(locId, trimmedEmail);
        if (!checkRes.available) {
          const dupMsg = checkRes.message || "This employee email is already assigned to a seat in this location.";
          setCreateSeatEmailError(dupMsg);
          setCreateSeatError(dupMsg);
          return;
        }
      } catch (err: any) {
        // If checking fails, proceed to backend saveSeat which performs authoritative check
      }
    }

    setIsCreatingSeat(true);

    try {
      const idealUrl = newSeatForm.assignNow
        ? getEmployeeOrderUrl(trimmedEmail || trimmedName, finalSeatId, locId, seatNum)
        : `${window.location.origin}${orgPrefix}/order/${locId}/${parseInt(seatNum, 10) || 1}?seatId=${finalSeatId}`;

      // 1. Save seat permanently in local D1 database
      await locationApi.saveSeat(locId, {
        id: finalSeatId,
        displayId: finalSeatId,
        number: seatNum,
        employee: newSeatForm.assignNow ? trimmedEmail : undefined,
        employeeName: newSeatForm.assignNow ? trimmedName : undefined,
        employeeEmail: newSeatForm.assignNow ? trimmedEmail : undefined,
        employeeId: targetEmp?.id,
        orderUrl: idealUrl,
      });

      // 2. Refresh seats from D1
      await refreshLocationSeats(locId);

      // 3. Update location counter
      setLocations((prev) =>
        prev.map((l) => (l.id === locId ? { ...l, totalSeats: (l.totalSeats || 0) + 1 } : l))
      );

      // 4. Refresh assignment table
      
      setSelectedSeatNumber(seatNum);
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
      setSelectedCreateEmployee(null);
      setCreateSeatEmailError(null);
      setCreateSeatEmailAvailable(null);
      setCreateSeatEmailChecking(false);
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

    try {
      // 1. Remove assignment permanently in Cloudflare D1
      await locationApi.unassignSeat(locId, currentSeat.id);

      // 2. Re-fetch seats from D1
      await refreshLocationSeats(locId);

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
    const targetEmp = selectedEmployeeToAssign;
    const trimmedName = targetEmp ? targetEmp.name : editSeatForm.employeeName.trim();
    const trimmedEmail = targetEmp ? targetEmp.email : editSeatForm.employeeEmail.trim().toLowerCase();

    // If both empty, clear assignment
    if (!trimmedName && !trimmedEmail && !targetEmp) {
      await handleUnassignEmployee();
      setIsEditSeatOpen(false);
      return;
    }

    if (!trimmedName) {
      setEditSeatError("Please select or enter an employee name.");
      return;
    }
    if (!trimmedEmail) {
      setEditSeatError("Please select or enter an employee email address.");
      return;
    }

    setIsSavingSeat(true);
    try {
      const idealUrl = getEmployeeOrderUrl(trimmedEmail || trimmedName, currentSeat.id, locId, currentSeat.number);

      // 1. Save assignment in Cloudflare D1
      await locationApi.assignSeat(locId, currentSeat.id, {
        employeeId: targetEmp?.id,
        employeeName: trimmedName,
        employeeEmail: trimmedEmail,
        employee: trimmedEmail,
        orderUrl: idealUrl,
      });

      // 2. Re-fetch seats from D1
      await refreshLocationSeats(locId);

      setIsEditSeatOpen(false);
      setSelectedEmployeeToAssign(null);
      setAssignEmployeeSearch("");
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

  // Handle live Employee Email validation in Edit Employee modal
  const handleEditEmployeeEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setEditEmployeeForm((prev) => ({ ...prev, email: rawVal }));

    if (editEmployeeEmailTimerRef.current) {
      clearTimeout(editEmployeeEmailTimerRef.current);
    }
    if (editEmployeeEmailAbortRef.current) {
      editEmployeeEmailAbortRef.current.abort();
    }

    const trimmed = rawVal.trim();
    if (!trimmed) {
      setEditEmployeeEmailError("Employee email is required.");
      setEditEmployeeEmailAvailable(null);
      setEditEmployeeEmailChecking(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEditEmployeeEmailError("Please enter a valid email address.");
      setEditEmployeeEmailAvailable(null);
      setEditEmployeeEmailChecking(false);
      return;
    }

    setEditEmployeeEmailError(null);
    setEditEmployeeEmailChecking(true);
    setEditEmployeeEmailAvailable(null);

    const locId = selectedLocation?.id || "1";
    const currentLocSeats = seatsByLoc[locId] || [];
    const normalizedInput = trimmed.toLowerCase();

    editEmployeeEmailTimerRef.current = setTimeout(async () => {
      // 1. Client-side check across other seats in this location
      const clientDuplicate = currentLocSeats.some((s) => {
        if (currentSeat && s.id === currentSeat.id) return false;
        const empEmail = (s.employeeEmail || (s.employee && s.employee.includes("@") ? s.employee : "")).trim().toLowerCase();
        return empEmail === normalizedInput;
      });

      if (clientDuplicate) {
        setEditEmployeeEmailChecking(false);
        setEditEmployeeEmailAvailable(false);
        setEditEmployeeEmailError("This employee email is already assigned to a seat in this location.");
        return;
      }

      // 2. Authoritative backend check excluding the current seat
      const abortCtrl = new AbortController();
      editEmployeeEmailAbortRef.current = abortCtrl;

      try {
        const res = await locationApi.checkEmployeeEmail(locId, normalizedInput, currentSeat?.id, abortCtrl.signal);
        setEditEmployeeEmailChecking(false);
        if (res.available) {
          setEditEmployeeEmailAvailable(true);
          setEditEmployeeEmailError(null);
        } else {
          setEditEmployeeEmailAvailable(false);
          setEditEmployeeEmailError(res.message || "This employee email is already assigned to a seat in this location.");
        }
      } catch (err: any) {
        if (err.name === "AbortError" || abortCtrl.signal.aborted) return;
        setEditEmployeeEmailChecking(false);
        setEditEmployeeEmailAvailable(null);
      }
    }, 450);
  };

  // Submit Updated Employee Details (Name & Email)
  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeat || !selectedLocation) return;
    setEditEmployeeError(null);

    const trimmedName = editEmployeeForm.name.trim();
    const trimmedEmail = editEmployeeForm.email.trim().toLowerCase();

    if (!trimmedName) {
      setEditEmployeeError("Employee name is required.");
      return;
    }
    if (!trimmedEmail) {
      setEditEmployeeEmailError("Employee email is required.");
      setEditEmployeeError("Employee email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEditEmployeeEmailError("Please enter a valid email address.");
      setEditEmployeeError("Please enter a valid email address.");
      return;
    }

    const locId = selectedLocation.id;
    const currentLocSeats = seatsByLoc[locId] || [];

    // Client-side uniqueness check
    const clientDup = currentLocSeats.some((s) => {
      if (s.id === currentSeat.id) return false;
      const empEmail = (s.employeeEmail || (s.employee && s.employee.includes("@") ? s.employee : "")).trim().toLowerCase();
      return empEmail === trimmedEmail;
    });

    if (clientDup) {
      const dupMsg = "This employee email is already assigned to a seat in this location.";
      setEditEmployeeEmailError(dupMsg);
      setEditEmployeeError(dupMsg);
      return;
    }

    setIsSavingEmployee(true);
    try {
      // Backend check before committing
      try {
        const checkRes = await locationApi.checkEmployeeEmail(locId, trimmedEmail, currentSeat.id);
        if (!checkRes.available) {
          const dupMsg = checkRes.message || "This employee email is already assigned to a seat in this location.";
          setEditEmployeeEmailError(dupMsg);
          setEditEmployeeError(dupMsg);
          setIsSavingEmployee(false);
          return;
        }
      } catch (err: any) {
        // Continue to server-level validation in assignSeat
      }

      // Check if this email corresponds to a known orgUser
      const matchedUser = orgUsers.find((u) => u.email.toLowerCase() === trimmedEmail);

      const idealUrl = getEmployeeOrderUrl(trimmedEmail, currentSeat.id, locId, currentSeat.number, currentSeat.qrToken);

      // Save to Cloudflare D1
      await locationApi.assignSeat(locId, currentSeat.id, {
        employeeId: matchedUser?.id || currentSeat.employeeId,
        employeeName: trimmedName,
        employeeEmail: trimmedEmail,
        employee: trimmedEmail,
        orderUrl: idealUrl,
      });

      // Refresh seats and assignments
      await refreshLocationSeats(locId);

      setIsEditEmployeeModalOpen(false);
      setEditEmployeeError(null);
      setEditEmployeeEmailError(null);
      setEditEmployeeEmailAvailable(null);

      setSeatActionMessage({
        type: "success",
        text: `Employee details for seat ${getSeatDisplayIdentifier(currentSeat, selectedLocation?.name)} updated successfully.`,
      });
      setTimeout(() => setSeatActionMessage(null), 4000);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to update employee details.";
      if (errMsg.toLowerCase().includes("already assigned")) {
        setEditEmployeeEmailError("This employee email is already assigned to a seat in this location.");
        setEditEmployeeError("This employee email is already assigned to a seat in this location.");
      } else {
        setEditEmployeeError(errMsg);
      }
    } finally {
      setIsSavingEmployee(false);
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
                          onClick={() => handleSelectLocation(loc)}
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
                            onClick={() => handleSelectLocation(loc)}
                            className="cursor-pointer font-bold text-base text-[#342219] hover:text-[#8C5835]"
                          >
                            {loc.name}
                          </span>
                          <span className="rounded-md bg-[#28A745] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                            {loc.status}
                          </span>
                        </div>

                        {/* Assigned Providers Badge / Chips */}
                        {((loc.assignedProviders && loc.assignedProviders.length > 0) || loc.assignedProviderName) && (
                          <div className="mt-2.5 flex flex-col gap-1 rounded-xl border border-[#E0D3C5] bg-[#FDFBF7] p-2 text-[11px] font-medium text-[#7A4B2A]">
                            <div className="flex items-center gap-1.5 text-[#8C5835] font-bold text-[11px]">
                              <UserCheck size={13} className="shrink-0" />
                              <span>
                                Assigned Providers ({loc.assignedProviders?.length || 1})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {loc.assignedProviders && loc.assignedProviders.length > 0 ? (
                                <>
                                  {loc.assignedProviders.slice(0, 2).map((p: any) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF4ED] text-[#342219] font-semibold text-[10px] border border-[#E8DED4] truncate max-w-[120px]"
                                      title={p.name}
                                    >
                                      {p.name}
                                    </span>
                                  ))}
                                  {loc.assignedProviders.length > 2 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F2ECE4] text-[#70523E] font-bold text-[10px]">
                                      +{loc.assignedProviders.length - 2} more
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF4ED] text-[#342219] font-semibold text-[10px] border border-[#E8DED4] truncate max-w-[160px]">
                                  {loc.assignedProviderName}
                                </span>
                              )}
                            </div>
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
                      onClick={handleBackToLocations}
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
                      <span className="text-emerald-700 font-semibold">{totalOccupiedSeats} Occupied</span>
                      <span className="text-[#C4A48C]">•</span>
                      <span className="text-[#8C5835] font-semibold">{totalAvailableSeats} Available</span>
                    </div>

                    {/* Create Seat Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const locId = selectedLocation.id;
                        const locSeats = seatsByLoc[locId] || [];
                        const nextInfo = getNextAvailableSeatInfo(locSeats, selectedLocation.name);
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

                      {/* Interactive Seating Model Wrapper */}
                      {currentSeats.length === 0 ? (
                        <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6 text-center max-w-md">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F2E6D9] text-[#75472D] shadow-sm">
                            <Armchair size={32} />
                          </div>
                          <h3 className="text-base font-bold text-[#342219]">
                            No seats have been created for this location yet.
                          </h3>
                          <p className="mt-1.5 text-xs text-[#8A7667] leading-relaxed">
                            Click the button below to add your first seat to this office layout.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const locId = selectedLocation.id;
                              const locSeats = seatsByLoc[locId] || [];
                              const nextInfo = getNextAvailableSeatInfo(locSeats, selectedLocation.name);
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
                            className="mt-5 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#754329]/25 hover:shadow-lg transition cursor-pointer"
                          >
                            <Plus size={16} />
                            <span>Create Seat</span>
                          </button>
                        </div>
                      ) : (
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
                                {topSeats.map((seat, sIdx) => {
                                  const isSelected = selectedSeatNumber === seat.number;
                                  const isAssigned = isSeatOccupied(seat);
                                  const assignedEmployeeLabel = seat.employeeName || seat.employee || (isAssigned ? "Occupied" : null);

                                  return (
                                    <div
                                      key={seat.id ? `top-${seat.id}` : `top-${seat.number}-${sIdx}`}
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
                                            title={isAssigned ? `Assigned: ${assignedEmployeeLabel}` : "Available Seat"}
                                          >
                                            {isAssigned ? "✓" : "•"}
                                          </span>
                                        </div>

                                        <div className={`h-6 w-1.5 rounded-r-md transition ${isSelected ? "bg-amber-700" : "bg-[#2A1B13]"}`} />
                                      </div>

                                      {/* Seat ID Pill & Employee Name */}
                                      <div className="mt-1.5 flex flex-col items-center gap-1">
                                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold tracking-tight border shadow-2xs transition ${isSelected
                                            ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200"
                                            : "bg-white/95 text-[#6E4229] border-[#DECFBE]"
                                          }`}>
                                          {getSeatDisplayIdentifier(seat, selectedLocation?.name) || `Seat-${seat.number}`}
                                        </span>
                                        {isAssigned ? (
                                          <span
                                            className="max-w-[85px] truncate rounded-md bg-emerald-100/90 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-300 shadow-2xs"
                                            title={assignedEmployeeLabel || "Occupied"}
                                          >
                                            👤 {seat.employeeName || (seat.employee ? seat.employee.split("@")[0] : "Occupied")}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-medium text-[#A08C7D]">
                                            Available
                                          </span>
                                        )}
                                      </div>

                                      {/* Tooltip on Hover */}
                                      <div className="pointer-events-none absolute -top-14 z-30 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-1">
                                        <div className="rounded-xl border border-stone-700/50 bg-[#251710]/95 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-xl backdrop-blur-xs whitespace-nowrap text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-amber-300">
                                            <span>Seat {seat.number}</span>
                                            <span className="text-stone-400 font-mono">({getSeatDisplayIdentifier(seat, selectedLocation?.name)})</span>
                                          </div>
                                          <div className={isAssigned ? "text-emerald-300 text-[9px] mt-0.5 font-medium" : "text-amber-200 text-[9px] mt-0.5 font-medium"}>
                                            {isAssigned ? `👤 ${assignedEmployeeLabel}` : "✨ Available • Click to manage"}
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
                                      {currentSeats.length} Seats &bull; {totalOccupiedSeats} Occupied &bull; {totalAvailableSeats} Available
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
                                {bottomSeats.map((seat, sIdx) => {
                                  const isSelected = selectedSeatNumber === seat.number;
                                  const isAssigned = isSeatOccupied(seat);
                                  const assignedEmployeeLabel = seat.employeeName || seat.employee || (isAssigned ? "Occupied" : null);

                                  return (
                                    <div
                                      key={seat.id ? `bottom-${seat.id}` : `bottom-${seat.number}-${sIdx}`}
                                      onClick={() => setSelectedSeatNumber(isSelected ? null : seat.number)}
                                      className="group relative flex cursor-pointer flex-col items-center transition-all duration-200 hover:translate-y-1.5"
                                    >
                                      {/* Seat ID Pill & Employee Name */}
                                      <div className="mb-1.5 flex flex-col items-center gap-1">
                                        {isAssigned ? (
                                          <span
                                            className="max-w-[85px] truncate rounded-md bg-emerald-100/90 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-300 shadow-2xs"
                                            title={assignedEmployeeLabel || "Occupied"}
                                          >
                                            👤 {seat.employeeName || (seat.employee ? seat.employee.split("@")[0] : "Occupied")}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-medium text-[#A08C7D]">
                                            Available
                                          </span>
                                        )}
                                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-mono font-bold tracking-tight border shadow-2xs transition ${isSelected
                                            ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200"
                                            : "bg-white/95 text-[#6E4229] border-[#DECFBE]"
                                          }`}>
                                          {getSeatDisplayIdentifier(seat, selectedLocation?.name) || `Seat-${seat.number}`}
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
                                            title={isAssigned ? `Assigned: ${assignedEmployeeLabel}` : "Available Seat"}
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
                                            <span className="text-stone-400 font-mono">({getSeatDisplayIdentifier(seat, selectedLocation?.name)})</span>
                                          </div>
                                          <div className={isAssigned ? "text-emerald-300 text-[9px] mt-0.5 font-medium" : "text-amber-200 text-[9px] mt-0.5 font-medium"}>
                                            {isAssigned ? `👤 ${assignedEmployeeLabel}` : "✨ Available • Click to manage"}
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
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center gap-2 border-t border-[#EEE5DC] pt-4 text-xs font-semibold text-[#70523E]">
                      <span>Total Configured Seats:</span>
                      <span className="rounded-lg bg-[#FAF4ED] px-2.5 py-1 font-bold text-[#8C5835] border border-[#EAD5C0] shadow-2xs">
                        {currentSeats.length} Seats
                      </span>
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

                          const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
                          const effectiveOrderUrl = currentSeat.qrToken
                            ? `${window.location.origin}${orgPrefix}/order/${currentSeat.qrToken}`
                            : (currentSeat.orderUrl && currentSeat.orderUrl.startsWith("http")
                                ? currentSeat.orderUrl
                                : (currentSeat.orderUrl
                                    ? `${window.location.origin}${currentSeat.orderUrl.startsWith("/") ? "" : "/"}${currentSeat.orderUrl}`
                                    : getEmployeeOrderUrl(currentSeat.employee, currentSeat.id, activeLocationId, currentSeat.number, currentSeat.qrToken)));

                          return (
                            <div className="mt-5 space-y-3.5 text-xs">
                              {/* Assigned Employee */}
                              {matchedEmployee ? (
                                <div className="flex flex-col gap-1.5 rounded-2xl border border-[#EEE5DC] bg-white p-3.5 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-[#8A7667]">Assigned Employee</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditEmployeeForm({
                                            name: matchedEmployee.name || currentSeat.employeeName || currentSeat.employee || "",
                                            email: matchedEmployee.email || currentSeat.employeeEmail || "",
                                          });
                                          setEditEmployeeError(null);
                                          setEditEmployeeEmailError(null);
                                          setEditEmployeeEmailAvailable(null);
                                          setIsEditEmployeeModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 rounded-lg border border-[#E8DED4] bg-[#FAF8F5] px-2 py-0.5 text-[11px] font-bold text-[#8C5835] hover:bg-[#F2ECE4] hover:text-[#70452D] transition cursor-pointer"
                                        title="Edit assigned employee details"
                                      >
                                        <Edit2 size={11} />
                                        <span>Edit Employee</span>
                                      </button>
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
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditEmployeeForm({
                                            name: currentSeat.employeeName || currentSeat.employee || "",
                                            email: currentSeat.employeeEmail || (currentSeat.employee?.includes("@") ? currentSeat.employee : "") || "",
                                          });
                                          setEditEmployeeError(null);
                                          setEditEmployeeEmailError(null);
                                          setEditEmployeeEmailAvailable(null);
                                          setIsEditEmployeeModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 rounded-lg border border-[#E8DED4] bg-[#FAF8F5] px-2 py-0.5 text-[11px] font-bold text-[#8C5835] hover:bg-[#F2ECE4] hover:text-[#70452D] transition cursor-pointer"
                                        title="Edit assigned employee details"
                                      >
                                        <Edit2 size={11} />
                                        <span>Edit Employee</span>
                                      </button>
                                      <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                                        Occupied
                                      </span>
                                    </div>
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
                                  {getSeatDisplayIdentifier(currentSeat, selectedLocation?.name)}
                                </span>
                              </div>

                              {/* Order URL Box */}
                              <div className="flex flex-col gap-1.5">
                                <span className="font-semibold text-[#8A7667]">
                                  "Order URL"
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
                                      {getSeatDisplayIdentifier(currentSeat, selectedLocation?.name) || `Seat ${currentSeat.number}`} QR
                                    </p>
                                    <p className="text-[11px] text-[#8A7667]">
                                      Permanent QR code for table and ordering
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
                                          link.download = `${getSeatDisplayIdentifier(currentSeat, selectedLocation?.name) || `seat_${currentSeat.number}`}_qr.png`;
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
                          {isSeatOccupied(currentSeat) ? (
                            <div>
                              {/* Delete Seat */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSeatClick(currentSeat)}
                                className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                                title="Delete this seat and assigned employee"
                              >
                                <Trash2 size={14} />
                                <span>Delete Seat</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {/* Assign Employee for Available seat */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeToAssign(null);
                                  setAssignEmployeeSearch("");
                                  setEditSeatForm({
                                    employeeName: "",
                                    employeeEmail: "",
                                    orderUrl: "",
                                  });
                                  setEditSeatError(null);
                                  setIsEditSeatOpen(true);
                                }}
                                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#754329] to-[#8C5835] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 cursor-pointer"
                              >
                                <UserPlus size={15} />
                                <span>Assign Employee</span>
                              </button>

                              {/* Delete Seat */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSeatClick(currentSeat)}
                                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                              >
                                <Trash2 size={14} />
                                <span>Delete Seat</span>
                              </button>
                            </div>
                          )}                        </div>
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
            if (createLocTimerRef.current) clearTimeout(createLocTimerRef.current);
            if (createLocAbortRef.current) createLocAbortRef.current.abort();
            setNewLocationName("");
            setNewLocationImage("");
            setCreateLocNameError(null);
            setCreateLocNameAvailable(null);
            setCreateLocNameChecking(false);
            setIsCreateLocationOpen(false);
          }}
          title="Location Create"
          onSubmit={handleCreateLocationSubmit}
          isSubmitting={isSubmittingCreateLoc || createLocNameChecking || createLocNameAvailable === false}
        >
          {/* Name */}
          <FormRow label="Name" required>
            <div className="relative w-full">
              <input
                id="location-name"
                required
                type="text"
                placeholder="Name"
                value={newLocationName}
                onChange={handleCreateLocNameChange}
                className={`w-full rounded-md border px-3 py-2 pr-9 text-gray-800 outline-none transition ${
                  createLocNameError
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                    : createLocNameAvailable === true
                    ? "border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    : "border-gray-300 focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                }`}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {createLocNameChecking && (
                  <Loader2 className="w-4 h-4 text-[#8C5835] animate-spin" />
                )}
                {!createLocNameChecking && createLocNameAvailable === true && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
              </div>
            </div>
            {createLocNameChecking ? (
              <p className="mt-1 text-xs font-medium text-[#8C5835]">Checking location name availability...</p>
            ) : createLocNameError ? (
              <p className="mt-1 text-xs font-semibold text-red-500">{createLocNameError}</p>
            ) : createLocNameAvailable === true ? (
              <p className="mt-1 text-xs font-semibold text-emerald-600">Location name is available.</p>
            ) : null}
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
            if (createSeatEmailTimerRef.current) clearTimeout(createSeatEmailTimerRef.current);
            if (createSeatEmailAbortRef.current) createSeatEmailAbortRef.current.abort();
            setIsCreateSeatOpen(false);
            setCreateSeatError(null);
            setCreateSeatEmailError(null);
            setCreateSeatEmailAvailable(null);
            setCreateSeatEmailChecking(false);
          }}
          title="Create Seat"
          onSubmit={handleCreateSeatSubmit}
          isSubmitting={isCreatingSeat}
          isSubmitDisabled={
            isCreatingSeat ||
            (newSeatForm.assignNow && (
              createSeatEmailChecking ||
              createSeatEmailAvailable === false ||
              Boolean(createSeatEmailError) ||
              !newSeatForm.employeeEmail.trim()
            ))
          }
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
                value={formatSeatIdentifier(newSeatForm.seatId)}
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
                const locName = selectedLocation?.name || "OFFICE";
                const locPrefix = normalizeLocationPrefix(locName);
                const orgPrefix = currentShortCode ? `/${currentShortCode}` : "";
                const num = parseInt(val, 10);
                const generatedId = isNaN(num) ? "" : `${locPrefix}-${num}`;

                setNewSeatForm({
                  ...newSeatForm,
                  seatNo: val,
                  seatId: generatedId,
                  orderUrl: `${window.location.origin}${orgPrefix}/order/${locId}/${num || 1}?seatId=${generatedId}`,
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
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setNewSeatForm({ ...newSeatForm, assignNow: isChecked });
                  if (!isChecked) {
                    if (createSeatEmailTimerRef.current) clearTimeout(createSeatEmailTimerRef.current);
                    if (createSeatEmailAbortRef.current) createSeatEmailAbortRef.current.abort();
                    setCreateSeatEmailError(null);
                    setCreateSeatEmailAvailable(null);
                    setCreateSeatEmailChecking(false);
                  }
                }}
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
                  placeholder="e.g alice smith"
                  value={newSeatForm.employeeName}
                  onChange={(e) =>
                    setNewSeatForm({ ...newSeatForm, employeeName: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 font-medium"
                />
              </FormRow>

              <FormRow label="Employee Email" required labelAlign="top">
                <div className="w-full">
                  <div className="relative w-full">
                    <input
                      required={newSeatForm.assignNow}
                      type="email"
                      placeholder="e.g. alice@example.com"
                      value={newSeatForm.employeeEmail}
                      onChange={handleCreateSeatEmailChange}
                      className={`w-full rounded-md border px-3 py-2 pr-9 text-gray-800 placeholder-gray-400 outline-none transition font-medium ${
                        createSeatEmailError
                          ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                          : createSeatEmailAvailable === true
                          ? "border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                          : "border-gray-300 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
                      }`}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      {createSeatEmailChecking && (
                        <Loader2 className="w-4 h-4 text-[#8C5835] animate-spin" />
                      )}
                      {!createSeatEmailChecking && createSeatEmailAvailable === true && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  </div>

                  {/* Real-time Email Validation Feedback */}
                  {createSeatEmailChecking ? (
                    <p className="mt-1 text-xs font-medium text-[#8C5835] animate-pulse">
                      Checking email availability in this location...
                    </p>
                  ) : createSeatEmailError ? (
                    <p className="mt-1 text-xs font-semibold text-red-500">
                      {createSeatEmailError}
                    </p>
                  ) : createSeatEmailAvailable === true ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Email available.
                    </p>
                  ) : null}
                </div>
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
            MODAL: EDIT ASSIGNED EMPLOYEE DETAILS (NAME & EMAIL)
           ======================================================== */}
        <CreateFormModal
          isOpen={isEditEmployeeModalOpen && Boolean(currentSeat)}
          onClose={() => {
            setIsEditEmployeeModalOpen(false);
            setEditEmployeeError(null);
            setEditEmployeeEmailError(null);
            setEditEmployeeEmailAvailable(null);
            if (editEmployeeEmailTimerRef.current) clearTimeout(editEmployeeEmailTimerRef.current);
            if (editEmployeeEmailAbortRef.current) editEmployeeEmailAbortRef.current.abort();
          }}
          title="Edit Employee"
          submitText={isSavingEmployee ? "Saving..." : "Save Changes"}
          isSubmitting={isSavingEmployee}
          isSubmitDisabled={
            isSavingEmployee ||
            !editEmployeeForm.name.trim() ||
            !editEmployeeForm.email.trim() ||
            Boolean(editEmployeeEmailError) ||
            editEmployeeEmailChecking
          }
          onSubmit={handleEditEmployeeSubmit}
          maxWidth="md"
        >
          {editEmployeeError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {editEmployeeError}
            </div>
          )}

          {/* Seat Context Pill */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#EEE5DC] bg-[#FAF8F5] p-3 text-xs">
            <span className="font-semibold text-[#8A7667]">Selected Seat:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#342219]">Seat {currentSeat?.number}</span>
              <span className="rounded-md bg-[#FAF4ED] px-2 py-0.5 font-mono text-[11px] font-bold text-[#8C5835] border border-[#EAD5C0]">
                {currentSeat ? getSeatDisplayIdentifier(currentSeat, selectedLocation?.name) : ""}
              </span>
            </div>
          </div>

          {/* Employee Name */}
          <div className="mb-4">
            <FormRow label="Employee Name" required>
              <div className="relative">
                <input
                  type="text"
                  value={editEmployeeForm.name}
                  onChange={(e) => {
                    setEditEmployeeForm((prev) => ({ ...prev, name: e.target.value }));
                    if (editEmployeeError) setEditEmployeeError(null);
                  }}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-[#342219] outline-none placeholder:text-gray-400 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
                />
              </div>
            </FormRow>
          </div>

          {/* Employee Email */}
          <div className="mb-2">
            <FormRow label="Employee Email" required>
              <div>
                <div className="relative">
                  <input
                    type="email"
                    value={editEmployeeForm.email}
                    onChange={handleEditEmployeeEmailChange}
                    placeholder="e.g. john.doe@company.com"
                    className={`w-full rounded-xl border bg-white px-3 py-2 pr-9 text-xs text-[#342219] outline-none placeholder:text-gray-400 transition ${
                      editEmployeeEmailError
                        ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200"
                        : editEmployeeEmailAvailable === true
                        ? "border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                        : "border-gray-300 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                    {editEmployeeEmailChecking && (
                      <Loader2 className="w-4 h-4 text-[#8C5835] animate-spin" />
                    )}
                    {!editEmployeeEmailChecking && editEmployeeEmailAvailable === true && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                </div>

                {/* Real-time Email Validation Feedback */}
                {editEmployeeEmailChecking ? (
                  <p className="mt-1 text-xs font-medium text-[#8C5835] animate-pulse">
                    Checking email availability in this location...
                  </p>
                ) : editEmployeeEmailError ? (
                  <p className="mt-1 text-xs font-semibold text-red-500">
                    {editEmployeeEmailError}
                  </p>
                ) : editEmployeeEmailAvailable === true ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Email available.
                  </p>
                ) : null}
              </div>
            </FormRow>
          </div>

          {isSavingEmployee && (
            <div className="mt-2 text-center text-xs font-medium text-[#8C5835] animate-pulse">
              Updating employee details…
            </div>
          )}
        </CreateFormModal>

        {/* ========================================================
            MODAL: ASSIGN / CHANGE EMPLOYEE (SEARCHABLE EMPLOYEE SELECTION)
           ======================================================== */}
        {isEditSeatOpen && currentSeat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835]">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#342219]">
                      {currentSeat.employee || currentSeat.employeeEmail ? "Change Assigned Employee" : "Assign Employee to Seat"}
                    </h3>
                    <p className="text-xs text-[#8A7667]">
                      Seat <span className="font-bold text-[#342219]">{currentSeat.number}</span> &bull; <span className="font-mono text-[#6F4228]">{getSeatDisplayIdentifier(currentSeat, selectedLocation?.name)}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditSeatOpen(false);
                    setAssignEmployeeSearch("");
                    setSelectedEmployeeToAssign(null);
                    setEditSeatError(null);
                  }}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {editSeatError && (
                <div className="mt-3.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {editSeatError}
                </div>
              )}

              {/* Employee Search */}
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-bold text-[#45352B]">
                  Select Employee from Organization
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A08C7D]" />
                  <input
                    type="text"
                    value={assignEmployeeSearch}
                    onChange={(e) => setAssignEmployeeSearch(e.target.value)}
                    placeholder="Search by employee name, username, or email..."
                    className="w-full rounded-xl border border-[#E8DED4] bg-white py-2.5 pl-9 pr-3 text-xs text-[#342219] outline-none placeholder:text-[#B1A69D] focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
                  />
                  {assignEmployeeSearch && (
                    <button
                      type="button"
                      onClick={() => setAssignEmployeeSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A08C7D] hover:text-[#342219]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Employees List */}
              <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-[#F5EFE9]">
                {(() => {
                  const q = assignEmployeeSearch.trim().toLowerCase();
                  const filtered = orgUsers.filter(
                    (u) =>
                      !q ||
                      u.name.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q) ||
                      (u.userName && u.userName.toLowerCase().includes(q))
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="py-6 text-center text-xs text-[#8A7667]">
                        No employees found matching &quot;{assignEmployeeSearch}&quot;.
                      </div>
                    );
                  }

                  return filtered.map((u) => {
                    const occupyingSeat = currentSeats.find(
                      (s) =>
                        s.number !== currentSeat.number &&
                        (s.employeeId === u.id ||
                         s.employeeEmail?.toLowerCase() === u.email.toLowerCase() ||
                         s.employee?.toLowerCase() === u.email.toLowerCase())
                    );

                    const isCurrentOccupant =
                      (currentSeat.employeeId === u.id) ||
                      (currentSeat.employeeEmail?.toLowerCase() === u.email.toLowerCase()) ||
                      (currentSeat.employee?.toLowerCase() === u.email.toLowerCase());

                    const isSelected = selectedEmployeeToAssign?.id === u.id || (!selectedEmployeeToAssign && isCurrentOccupant);

                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (occupyingSeat) return; // Prevent selecting already assigned employee
                          setSelectedEmployeeToAssign(u);
                          setEditSeatForm({
                            employeeName: u.name,
                            employeeEmail: u.email,
                            orderUrl: currentSeat.orderUrl || "",
                          });
                          setEditSeatError(null);
                        }}
                        className={`flex items-center justify-between rounded-2xl p-2.5 transition border ${
                          occupyingSeat
                            ? "opacity-50 bg-gray-50 border-gray-200 cursor-not-allowed"
                            : isSelected
                            ? "bg-[#FAF4ED] border-[#8C5835] ring-2 ring-[#8C5835]/20 cursor-pointer shadow-xs"
                            : "bg-white border-[#E8DED4] hover:bg-[#FAF8F5] cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                            isSelected ? "bg-[#8C5835] text-white" : "bg-[#EAD5C0] text-[#70452D]"
                          }`}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-[#342219] truncate">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-[#8A7667] truncate">
                              {u.userName ? `@${u.userName} · ` : ""}{u.email}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          {occupyingSeat ? (
                            <span className="rounded-md bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                              Assigned to Seat {occupyingSeat.number}
                            </span>
                          ) : isCurrentOccupant ? (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Currently Assigned
                            </span>
                          ) : isSelected ? (
                            <span className="rounded-full bg-[#8C5835] text-white p-1">
                              <Check size={12} />
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#8C5835]">
                              Select
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Selected Employee Summary */}
              {selectedEmployeeToAssign && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Selected Employee:</span>
                    <span className="font-bold text-emerald-950">{selectedEmployeeToAssign.name}</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 mt-0.5 font-mono">
                    {selectedEmployeeToAssign.email}
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2.5 border-t border-[#EEE5DC] pt-3.5">
                <button
                  type="button"
                  disabled={isSavingSeat}
                  onClick={() => {
                    setIsEditSeatOpen(false);
                    setAssignEmployeeSearch("");
                    setSelectedEmployeeToAssign(null);
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingSeat || (!selectedEmployeeToAssign && !editSeatForm.employeeEmail)}
                  onClick={handleSaveSeatAssignment}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingSeat ? "Assigning…" : "Assign Employee"}
                </button>
              </div>
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
                  <strong className="font-mono text-[#342219]">{getSeatDisplayIdentifier(currentSeat, selectedLocation?.name)}</strong>
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
                  <li>Seat <strong className="font-mono">{getSeatDisplayIdentifier(currentSeat, selectedLocation?.name)}</strong> will remain in the seating plan as <strong>Available</strong>.</li>
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
            MODAL: CONFIRM DELETE SEAT
           ======================================================== */}
        {seatToDelete && (() => {
          const isSeatAssigned = Boolean(
            seatToDelete.employee ||
            seatToDelete.employeeId ||
            seatToDelete.employeeName ||
            seatToDelete.assignmentId
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-2xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mx-auto mb-3.5">
                  <Trash2 size={24} />
                </div>

                <h3 className="text-center text-lg font-bold text-[#342219]">
                  Delete Seat {seatToDelete.number}?
                </h3>

                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 text-xs text-gray-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#8A7667]">Seat Number:</span>
                    <strong className="text-[#342219]">Seat {seatToDelete.number}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A7667]">Seat Identifier:</span>
                    <span className="font-mono font-bold text-[#342219]">{getSeatDisplayIdentifier(seatToDelete, selectedLocation?.name)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A7667]">Location:</span>
                    <span className="text-[#342219]">{selectedLocation?.name}</span>
                  </div>
                </div>

                <div className="mt-3.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 space-y-1">
                  <p className="font-bold text-rose-950">Permanent Deletion</p>
                  <p className="text-rose-800 leading-relaxed">
                    {isSeatAssigned
                      ? "Deleting this seat will permanently delete the seat and its assigned employee from the system. The employee record will also be permanently removed. This action cannot be undone."
                      : "Are you sure you want to permanently delete this seat? This action cannot be undone."}
                  </p>
                </div>

                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isDeletingSeat}
                    onClick={() => setSeatToDelete(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingSeat}
                    onClick={handleConfirmDeleteSeat}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 cursor-pointer transition"
                  >
                    {isDeletingSeat ? "Deleting…" : "Yes, Delete Seat"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
                  onClick={() => {
                    if (editLocTimerRef.current) clearTimeout(editLocTimerRef.current);
                    if (editLocAbortRef.current) editLocAbortRef.current.abort();
                    setEditLocNameError(null);
                    setEditLocNameAvailable(null);
                    setEditLocNameChecking(false);
                    setIsEditLocationOpen(false);
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-[#45352B]">Name</label>
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={editingLoc.name}
                      onChange={handleEditLocNameChange}
                      className={`w-full rounded-xl border p-2 pr-9 text-sm text-[#342219] outline-none transition ${
                        editLocNameError
                          ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                          : editLocNameAvailable === true
                          ? "border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                          : "border-[#E8DED4] focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
                      }`}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      {editLocNameChecking && (
                        <Loader2 className="w-4 h-4 text-[#8C5835] animate-spin" />
                      )}
                      {!editLocNameChecking && editLocNameAvailable === true && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  </div>
                  {editLocNameChecking ? (
                    <p className="mt-1 text-xs font-medium text-[#8C5835]">Checking location name availability...</p>
                  ) : editLocNameError ? (
                    <p className="mt-1 text-xs font-semibold text-red-500">{editLocNameError}</p>
                  ) : editLocNameAvailable === true ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-600">Location name is available.</p>
                  ) : null}
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (editLocTimerRef.current) clearTimeout(editLocTimerRef.current);
                      if (editLocAbortRef.current) editLocAbortRef.current.abort();
                      setEditLocNameError(null);
                      setEditLocNameAvailable(null);
                      setEditLocNameChecking(false);
                      setIsEditLocationOpen(false);
                    }}
                    className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingEditLoc || editLocNameChecking || editLocNameAvailable === false}
                    onClick={handleEditLocationSubmit}
                    className="rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-5 py-2 font-semibold text-white hover:opacity-95 disabled:opacity-50 cursor-pointer transition shadow-sm"
                  >
                    {isSubmittingEditLoc ? "Saving..." : "Save Changes"}
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
