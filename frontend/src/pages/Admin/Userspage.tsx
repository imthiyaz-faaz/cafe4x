import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  UserRound,
  Plus,
  Upload,
  Download,
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Shield,
  CloudUpload,
  FileSpreadsheet,
  Edit,
  Trash2,
  AlertCircle,
  MapPin,
  Building2,
  Loader2,
  Check,
  ArrowRight,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import UserCreate from "../../components/users/usercreate";
import UsersEdit from "../../components/users/usersedit";
import { userApi } from "../../services/userApi";
import { locationApi, type LocationItem } from "../../services/locations";


export interface UserItem {
  id: string;
  name: string;
  userName: string;
  password?: string;
  userType: string;
  email: string;
  mobileNumber: string;
  organization?: string;
  shortCode?: string;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [serverUsers, serverLocations] = await Promise.all([
        userApi.getUsers(undefined, currentShortCode || undefined),
        locationApi.getLocations(undefined, currentShortCode || undefined),
      ]);

      if (Array.isArray(serverUsers)) {
        setUsers(serverUsers.filter((u: any) => (u.userType || "").toLowerCase() !== "employee") as UserItem[]);
      } else {
        setUsers([]);
      }

      if (Array.isArray(serverLocations)) {
        setLocations(serverLocations);
      } else {
        setLocations([]);
      }
    } catch (err: any) {
      console.warn("Could not fetch users from server:", err);
      setFetchError(err?.message || "Failed to load users. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [currentShortCode]);

  // Load users from backend on mount or organization switch
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const saveUsers = (newUsers: UserItem[]) => {
    setUsers(newUsers);
    try {
      // Merge with global cafe4x_users store
      const stored = localStorage.getItem("cafe4x_users");
      let allUsers: UserItem[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) allUsers = parsed;
      }
      if (currentShortCode) {
        // Replace current org users in storage
        const others = allUsers.filter(
          (u) => (u.shortCode || "").toUpperCase() !== currentShortCode
        );
        allUsers = [...others, ...newUsers];
      } else {
        allUsers = newUsers;
      }
      localStorage.setItem("cafe4x_users", JSON.stringify(allUsers));
    } catch { }
  };


  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Modal States ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Provider Location Assignment Modal State
  const [assignLocationUser, setAssignLocationUser] = useState<UserItem | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [initialLocationIds, setInitialLocationIds] = useState<string[]>([]);
  const [isAssignLocationModalOpen, setIsAssignLocationModalOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [isSavingLocations, setIsSavingLocations] = useState(false);
  const [locationModalError, setLocationModalError] = useState<string | null>(null);

  // Provider Location Navigation Selection Modal State
  const [navLocationModalUser, setNavLocationModalUser] = useState<UserItem | null>(null);
  const [providerNavLocations, setProviderNavLocations] = useState<LocationItem[]>([]);
  const [isNavLocationModalOpen, setIsNavLocationModalOpen] = useState(false);
  const [loadingNavUserId, setLoadingNavUserId] = useState<string | null>(null);

  // Bulk Upload state
  const [selectedBulkFile, setSelectedBulkFile] = useState<File | null>(null);
  const [bulkError, setBulkError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Filtering ---
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.userName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.mobileNumber || "").toLowerCase().includes(q) ||
        u.userType.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // --- Pagination ---
  const totalRecords = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, validCurrentPage, pageSize]);

  // --- Handlers ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsers();
    setIsRefreshing(false);
  };

  const handleExport = () => {
    const headers = [
      "Name,User Name,Password,User Type,Email,Mobile Number",
    ];
    const rows = filteredUsers.map(
      (u) =>
        `"${u.name}","${u.userName}","${u.password || ""}","${u.userType}","${u.email}","${u.mobileNumber}"`
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `users_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample Template for Bulk Import
  const handleDownloadTemplate = () => {
    const templateContent =
      "Name,User Name,Password,User Type,Email,Mobile Number\nJohn Doe,johndoe,Pass@123,Staff,john@example.com,9876543210\nJane Smith,janesmith,Pass@123,Admin,jane@example.com,9123456789";
    const encodedUri = encodeURI(
      "data:text/csv;charset=utf-8," + templateContent
    );
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "user_bulk_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // User Created Callback
  const handleUserCreated = (newUser: UserItem) => {
    let currentUserOrg = "";
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) currentUserOrg = JSON.parse(stored).organization || "";
    } catch { }

    const userWithOrg: UserItem = {
      ...newUser,
      shortCode: currentShortCode || newUser.shortCode,
      organization: currentUserOrg || newUser.organization,
    };

    const updated = [userWithOrg, ...users.filter((u) => u.id !== userWithOrg.id)];
    saveUsers(updated);

    setToastMessage({
      type: "success",
      message: `User "${newUser.name}" (${newUser.userType}) created successfully.`,
    });
    setTimeout(() => setToastMessage(null), 5000);

    // Refresh from DB to guarantee sync
    userApi.getUsers(undefined, currentShortCode || undefined)
      .then((serverUsers) => {
        if (Array.isArray(serverUsers)) {
          setUsers(serverUsers.filter((u: any) => (u.userType || "").toLowerCase() !== "employee") as UserItem[]);
        }
      })
      .catch(() => {});
  };

  // Open Edit User Modal
  const openEditModal = (user: UserItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingUser(user);
    setIsEditOpen(true);
  };

  // Handle Provider Location Assignment Click
  const handleOpenAssignLocationModal = (user: UserItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // Find all location IDs currently assigned to this provider
    const assignedIds = locations
      .filter((loc) => {
        const directMatch = String(loc.assignedProviderId) === String(user.id);
        const listMatch = (loc.assignedProviders || []).some(
          (p) => String(p.id) === String(user.id)
        );
        return directMatch || listMatch;
      })
      .map((loc) => String(loc.id));

    setAssignLocationUser(user);
    setSelectedLocationIds(assignedIds);
    setInitialLocationIds(assignedIds);
    setLocationSearchQuery("");
    setLocationModalError(null);
    setIsAssignLocationModalOpen(true);
  };

  const handleToggleLocationSelection = (locId: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleSaveLocationAssignments = async () => {
    if (!assignLocationUser) return;
    setIsSavingLocations(true);
    setLocationModalError(null);

    const providerId = String(assignLocationUser.id);
    const addedLocationIds = selectedLocationIds.filter((id) => !initialLocationIds.includes(id));
    const removedLocationIds = initialLocationIds.filter((id) => !selectedLocationIds.includes(id));

    try {
      // Process additions
      for (const locId of addedLocationIds) {
        const targetLoc = locations.find((l) => String(l.id) === locId);
        const existingProviders = targetLoc?.assignedProviders || [];
        const existingIds = existingProviders.map((p) => String(p.id));
        const mergedIds = Array.from(new Set([...existingIds, providerId]));

        await locationApi.assignProvider(locId, {
          providerIds: mergedIds,
          assignedProviderId: mergedIds[0],
        });
      }

      // Process removals
      for (const locId of removedLocationIds) {
        const targetLoc = locations.find((l) => String(l.id) === locId);
        const existingProviders = targetLoc?.assignedProviders || [];
        const remainingIds = existingProviders
          .map((p) => String(p.id))
          .filter((pid) => pid !== providerId);

        await locationApi.assignProvider(locId, {
          providerIds: remainingIds,
          assignedProviderId: remainingIds[0] || undefined,
        });
      }

      // Refresh locations list
      const refreshedLocations = await locationApi.getLocations(
        undefined,
        currentShortCode || undefined
      );
      setLocations(Array.isArray(refreshedLocations) ? refreshedLocations : []);

      setIsAssignLocationModalOpen(false);
      setAssignLocationUser(null);
      setToastMessage({
        type: "success",
        message: `Locations successfully updated for ${assignLocationUser.name}`,
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to save location assignments:", err);
      setLocationModalError(err?.message || "Failed to update location assignments. Please try again.");
    } finally {
      setIsSavingLocations(false);
    }
  };

  // Navigate to provider workspace for a chosen location
  const navigateToProviderLocation = (locationItem: LocationItem) => {
    setIsNavLocationModalOpen(false);
    setNavLocationModalUser(null);

    const orgSlug = currentShortCode ? currentShortCode.toUpperCase() : "admin";
    navigate(`/${orgSlug}/admin/locationseats/${locationItem.id}`);
  };

  // Handle Provider Location Button Click
  const handleProviderLocationClick = async (user: UserItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingNavUserId) return;

    setLoadingNavUserId(user.id);
    try {
      // Fetch fresh assigned locations for this provider
      const locs = await locationApi.getLocations(
        { providerId: user.id, shortCode: currentShortCode || undefined },
        currentShortCode || undefined
      );

      const assignedLocations = Array.isArray(locs) ? locs : [];

      if (assignedLocations.length === 0) {
        // Requirement 2: No assigned locations -> display "No locations assigned" and do not navigate
        setToastMessage({
          type: "error",
          message: "No locations assigned",
        });
        setTimeout(() => setToastMessage(null), 4000);
      } else if (assignedLocations.length === 1) {
        // Requirement 2: Exactly one assigned location -> navigate directly
        navigateToProviderLocation(assignedLocations[0]);
      } else {
        // Requirement 2: Multiple assigned locations -> show selection popup
        setProviderNavLocations(assignedLocations);
        setNavLocationModalUser(user);
        setIsNavLocationModalOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to load provider locations:", err);
      // Fallback: check currently loaded locations list for this provider
      const fallbackLocations = locations.filter((loc) => {
        const directMatch = String(loc.assignedProviderId) === String(user.id);
        const listMatch = (loc.assignedProviders || []).some(
          (p) => String(p.id) === String(user.id)
        );
        return directMatch || listMatch;
      });

      if (fallbackLocations.length === 0) {
        setToastMessage({
          type: "error",
          message: "No locations assigned",
        });
        setTimeout(() => setToastMessage(null), 4000);
      } else if (fallbackLocations.length === 1) {
        navigateToProviderLocation(fallbackLocations[0]);
      } else {
        setProviderNavLocations(fallbackLocations);
        setNavLocationModalUser(user);
        setIsNavLocationModalOpen(true);
      }
    } finally {
      setLoadingNavUserId(null);
    }
  };

  // User Updated Callback
  const handleUserUpdated = (updatedUser: UserItem) => {
    const updated = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    saveUsers(updated);
    userApi.updateUser(updatedUser.id, updatedUser).catch((err) => {
      console.warn("Could not sync user update to server:", err);
    });
  };

  // Prompt Delete User (opens confirmation dialog)
  const promptDeleteUser = (user: UserItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setUserToDelete(user);
    setDeleteError("");
  };

  // Confirm Permanent Deletion
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      await userApi.deleteUser(userToDelete.id);

      const targetId = userToDelete.id;
      const targetName = userToDelete.name;
      const targetType = userToDelete.userType;

      // Update local state immediately
      const updated = users.filter((u) => u.id !== targetId);
      saveUsers(updated);

      setUserToDelete(null);
      setToastMessage({
        type: "success",
        message: `User "${targetName}" (${targetType}) permanently deleted.`,
      });
      setTimeout(() => setToastMessage(null), 5000);

      // Refresh from DB to ensure state is in sync
      const serverUsers = await userApi.getUsers(undefined, currentShortCode || undefined);
      if (Array.isArray(serverUsers)) {
        setUsers(serverUsers.filter((u: any) => (u.userType || "").toLowerCase() !== "employee") as UserItem[]);
      }
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      setDeleteError(err?.message || "Failed to delete user. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Upload File Handler
  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedBulkFile(file);
      setBulkError("");
    }
  };

  const handleBulkUploadSubmit = () => {
    if (!selectedBulkFile) {
      setBulkError("Please choose a file to upload.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const lines = content.split("\n").filter((l) => l.trim().length > 0);
        const newItems: UserItem[] = [];

        // Skip header if line 0 is header
        const startIndex = lines[0]?.toLowerCase().includes("name") ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const cols = lines[i]
            .split(",")
            .map((c) => c.replace(/["\r]/g, "").trim());
          if (cols[0] && cols[4]) {
            newItems.push({
              id: `${Date.now()}-${i}`,
              name: cols[0],
              userName: cols[1] || cols[0].toLowerCase().replace(/\s+/g, ""),
              password: cols[2] || "",
              userType: cols[3] || "Admin",
              email: cols[4],
              mobileNumber: cols[5] || "",
            });
          }
        }

        if (newItems.length > 0) {
          setUsers((prev) => [...newItems, ...prev]);
          setIsBulkOpen(false);
          setSelectedBulkFile(null);
        } else {
          setBulkError("No valid rows found in CSV. Please verify columns.");
        }
      }
    };
    reader.readAsText(selectedBulkFile);
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        {/* Navigation Bar */}
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {toastMessage && (
              <div
                className={`mb-4 flex items-center justify-between rounded-2xl p-4 text-xs font-semibold shadow-xs ${
                  toastMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <span>{toastMessage.message}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="ml-2 text-current opacity-70 hover:opacity-100"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {/* Top Toolbar Header */}
            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#EEE5DC] bg-white/90 p-4 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Title & Search Input */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2E6D9] text-[#75472D]">
                    <UserRound size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-[#342219]">Users</h2>
                </div>

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

              {/* Right: Actions (Create, Bulk Upload, Export, Refresh) */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Create Button */}
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#754329] to-[#9A6747] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#754329]/15 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:text-sm"
                >
                  <Plus size={16} />
                  <span>Create</span>
                </button>

                {/* Bulk Upload Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBulkFile(null);
                    setBulkError("");
                    setIsBulkOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7C4A2D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#7C4A2D]/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#6D3F24] sm:text-sm"
                >
                  <Upload size={16} />
                  <span>Bulk Upload</span>
                </button>

                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-4 py-2.5 text-xs font-semibold text-[#6F4228] transition duration-200 hover:border-[#6F4228] hover:bg-[#FAF6F1] sm:text-sm"
                >
                  <Download size={16} />
                  <span>Export</span>
                </button>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={handleRefresh}
                  title="Refresh"
                  aria-label="Refresh user list"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DED4] bg-white text-[#75472D] transition hover:bg-[#FAF6F1]"
                >
                  <RotateCw
                    size={17}
                    className={isRefreshing ? "animate-spin text-[#9A6747]" : ""}
                  />
                </button>
              </div>
            </div>

            {/* Users Cards Grid */}
            {isLoading ? (
              /* Loading Skeleton State */
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: pageSize > 12 ? 12 : pageSize }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center rounded-3xl border border-[#EEE5DC] bg-white/70 p-6 text-center shadow-sm backdrop-blur-xs animate-pulse"
                  >
                    {/* User Avatar Circle Skeleton */}
                    <div className="mb-4 h-20 w-20 rounded-full bg-[#EADBCE]/70" />

                    {/* Full Name Skeleton */}
                    <div className="h-5 w-32 rounded-lg bg-[#EADBCE]/90" />

                    {/* Email Skeleton */}
                    <div className="mt-2 h-3.5 w-44 rounded-md bg-[#EADBCE]/60" />

                    {/* User Name Skeleton */}
                    <div className="mt-2 h-3 w-24 rounded-md bg-[#EADBCE]/50" />

                    {/* Mobile Number Skeleton */}
                    <div className="mt-2 h-3.5 w-28 rounded-md bg-[#EADBCE]/60" />

                    {/* Role Badge Skeleton */}
                    <div className="mt-4 h-6 w-20 rounded-md bg-[#EADBCE]/70" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              /* Error State with Retry */
              <div className="my-8 flex flex-col items-center justify-center rounded-3xl border border-amber-200 bg-amber-50/80 p-10 text-center shadow-sm backdrop-blur-md">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertCircle size={28} />
                </div>
                <h3 className="text-base font-bold text-amber-900">Failed to load users</h3>
                <p className="mt-1 max-w-md text-xs text-amber-800">{fetchError}</p>
                <button
                  type="button"
                  onClick={fetchUsers}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#75472D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5C3620] cursor-pointer"
                >
                  <RotateCw size={14} />
                  <span>Retry</span>
                </button>
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="my-8 rounded-3xl border border-[#EEE5DC] bg-white/80 p-12 text-center backdrop-blur-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2E6D9] text-[#75472D]">
                  <UserRound size={32} />
                </div>
                <h3 className="text-lg font-bold text-[#342219]">
                  {searchQuery ? "No matching users found" : "No users found"}
                </h3>
                <p className="mt-1 text-sm text-[#897B71]">
                  {searchQuery
                    ? "Try adjusting your search criteria or clearing the search query."
                    : "No users have been registered yet. Click Create to add a new user."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {paginatedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="group relative flex flex-col items-center rounded-3xl border border-[#EEE5DC] bg-white/90 p-6 text-center shadow-md shadow-[#70452D]/5 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-[#DEC5B0] hover:shadow-xl hover:shadow-[#70452D]/10"
                  >
                    {/* User Avatar Circle */}
                    <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-[#E8DDD2] to-[#D5C2B1] text-[#9A8778] shadow-inner">
                      <UserRound size={42} className="text-[#877467]" />
                      <div className="absolute bottom-0 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                    </div>

                    {/* Full Name */}
                    <h3 className="text-base font-bold text-[#342219]">
                      {user.name}
                    </h3>

                    {/* Email */}
                    <p
                      title={user.email}
                      className="mt-1 w-full truncate text-xs font-medium text-[#70523E]"
                    >
                      {user.email}
                    </p>

                    {/* User Name */}
                    <p className="mt-1 text-xs text-[#897B71]">{user.userName}</p>

                    {/* Mobile Number */}
                    <p className="mt-1 text-xs font-semibold tracking-wider text-[#4A382E]">
                      {user.mobileNumber}
                    </p>

                    {/* Action buttons (Top right or hover action) */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => openEditModal(user, e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF4ED] text-[#75472D] border border-[#E8DED4] shadow-xs hover:bg-[#75472D] hover:text-white transition"
                        title="Edit User"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => promptDeleteUser(user, e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200 shadow-xs hover:bg-red-600 hover:text-white transition"
                        title="Delete User"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Role Badge and Actions */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#1D2B3A] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                        <Shield size={11} className="text-[#7FB3D5]" />
                        {user.userType}
                      </span>

                      {/* Location Action Button for Provider Users */}
                      {(user.userType || "").toLowerCase() === "provider" && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleProviderLocationClick(user, e)}
                            disabled={loadingNavUserId === user.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#CBB3A1] bg-[#FAF6F1] px-2.5 py-1 text-[11px] font-bold text-[#75472D] shadow-2xs transition hover:border-[#75472D] hover:bg-[#75472D] hover:text-white cursor-pointer disabled:opacity-60"
                            title="Navigate to Location Workspace"
                          >
                            {loadingNavUserId === user.id ? (
                              <Loader2 size={12} className="animate-spin text-[#75472D]" />
                            ) : (
                              <MapPin size={12} />
                            )}
                            <span>Location</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenAssignLocationModal(user, e)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#DEC5B0] bg-white px-2 py-1 text-[11px] font-semibold text-[#8C5835] shadow-2xs transition hover:bg-[#FAF6F1] hover:text-[#5C3620] cursor-pointer"
                            title="Assign Locations"
                          >
                            <Edit size={11} />
                            <span>Assign</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Assigned Locations Display for Provider Users */}
                    {(() => {
                      if ((user.userType || "").toLowerCase() !== "provider") return null;

                      const assignedLocs = locations.filter((loc) => {
                        const directMatch = String(loc.assignedProviderId) === String(user.id);
                        const listMatch = (loc.assignedProviders || []).some(
                          (p) => String(p.id) === String(user.id)
                        );
                        return directMatch || listMatch;
                      });

                      if (assignedLocs.length === 0) {
                        return (
                          <div className="mt-3 w-full rounded-xl border border-dashed border-[#DEC5B0] bg-[#FAF8F5]/60 px-2.5 py-1.5 text-center">
                            <span className="text-[11px] font-medium text-[#8A7667]">
                              No locations assigned
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="mt-3 w-full rounded-xl border border-[#EEE5DC] bg-[#FAF8F5] p-2 text-left">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A7667] mb-1 flex items-center justify-between">
                            <span>Assigned Locations ({assignedLocs.length})</span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {assignedLocs.map((al) => (
                              <span
                                key={al.id}
                                className="inline-flex items-center gap-1 rounded-md border border-[#EAD7C8] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#704225] shadow-2xs truncate max-w-full"
                                title={al.name}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="truncate">{al.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination & Total Records Bar */}
            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#EEE5DC] bg-white/90 px-5 py-3 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:flex-row">
              {/* Pagination controls */}
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
                  <option value={48}>48</option>
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
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

              {/* Total Records Counter */}
              <div className="flex items-center gap-2 text-xs font-semibold text-[#70523E]">
                <span>Total Records:</span>
                <span className="rounded-lg bg-[#0D6EFD] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                  {totalRecords}
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* ========================================================
            MODAL 1: USER CREATE (EXTRACTED TO STANDALONE COMPONENT)
           ======================================================== */}
        <UserCreate
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onUserCreated={handleUserCreated}
          shortCode={currentShortCode}
        />

        {/* ========================================================
            MODAL 2: EDIT USER (EXTRACTED TO STANDALONE COMPONENT)
           ======================================================== */}
        <UsersEdit
          isOpen={isEditOpen}
          user={editingUser}
          onClose={() => {
            setIsEditOpen(false);
            setEditingUser(null);
          }}
          onUserUpdated={handleUserUpdated}
        />

        {/* ========================================================
            MODAL 2: BULK IMPORT USERS (EXACT SCREENSHOT LAYOUT)
           ======================================================== */}
        {/* ========================================================
            MODAL: PERMANENT USER DELETE CONFIRMATION
           ======================================================== */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2.5 text-red-600">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
                    <Trash2 size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-[#342219]">Delete User</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeleting) {
                      setUserToDelete(null);
                      setDeleteError('');
                    }
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700 transition"
                  disabled={isDeleting}
                >
                  <X size={20} />
                </button>
              </div>

              {deleteError && (
                <div className="mb-4 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600 border border-red-200">
                  {deleteError}
                </div>
              )}

              {/* Body */}
              <div className="space-y-3 text-sm text-[#4A382E]">
                <p>
                  Are you sure you want to permanently delete this user account?
                </p>

                {/* User Details Card */}
                <div className="rounded-xl border border-gray-100 bg-[#FAF6F1] p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500">Name:</span>
                    <span className="font-bold text-[#342219]">{userToDelete.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500">Account Type:</span>
                    <span className="inline-flex items-center gap-1 rounded bg-[#1D2B3A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      <Shield size={10} className="text-[#7FB3D5]" />
                      {userToDelete.userType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500">Username:</span>
                    <span className="font-medium text-[#70523E]">{userToDelete.userName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500">Email:</span>
                    <span className="font-medium text-[#70523E] truncate max-w-[200px]" title={userToDelete.email}>
                      {userToDelete.email}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-red-600 font-medium">
                  This action will permanently delete the account, revoke all active sessions, and remove access immediately. This cannot be undone.
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setUserToDelete(null);
                    setDeleteError('');
                  }}
                  disabled={isDeleting}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? 'Deleting...' : 'Permanently Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: PROVIDER LOCATION ASSIGNMENT POPUP
           ======================================================== */}
        {isAssignLocationModalOpen && assignLocationUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white p-6 sm:p-7 shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F0E6DD] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835] shadow-xs">
                    <Building2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#342219] tracking-tight">
                      Assign Locations
                    </h3>
                    <p className="text-xs text-[#8A7667] mt-0.5">
                      Assign locations for provider <span className="font-bold text-[#75472D]">{assignLocationUser.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isSavingLocations) {
                      setIsAssignLocationModalOpen(false);
                      setAssignLocationUser(null);
                    }
                  }}
                  disabled={isSavingLocations}
                  className="rounded-xl p-1.5 text-[#A08C7D] hover:bg-[#FAF6F1] hover:text-[#342219] transition cursor-pointer disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Error Alert */}
              {locationModalError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <span>{locationModalError}</span>
                </div>
              )}

              {/* Search & Selection Summary */}
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                  />
                  <input
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full rounded-xl border border-[#DEC5B0] bg-[#FAF8F5] py-2 pl-9 pr-3 text-xs text-[#342219] placeholder-[#A08C7D] focus:border-[#75472D] focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#75472D] bg-[#FAF6F1] px-3 py-2 rounded-xl border border-[#E8DED4] self-start sm:self-auto shrink-0">
                  <span>{selectedLocationIds.length} of {locations.length} selected</span>
                </div>
              </div>

              {/* Locations Checkbox List */}
              <div className="mt-4 overflow-y-auto pr-1 flex-1 min-h-[220px]">
                {(() => {
                  const query = locationSearchQuery.trim().toLowerCase();
                  const filteredLocs = locations.filter(
                    (loc) =>
                      !query ||
                      loc.name.toLowerCase().includes(query) ||
                      (loc.displayId || "").toLowerCase().includes(query)
                  );

                  if (filteredLocs.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[#8A7667]">
                        <Building2 size={32} className="text-[#CBB3A1] mb-2" />
                        <p className="font-semibold">No locations found</p>
                        <p className="text-[11px] mt-0.5 text-[#A08C7D]">
                          {query ? "Try a different search term" : "No locations available in this organization"}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredLocs.map((loc) => {
                        const locIdStr = String(loc.id);
                        const isChecked = selectedLocationIds.includes(locIdStr);

                        return (
                          <div
                            key={loc.id}
                            onClick={() => !isSavingLocations && handleToggleLocationSelection(locIdStr)}
                            className={`group flex items-start gap-3 p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer ${
                              isChecked
                                ? "bg-[#FAF4ED] border-[#75472D] shadow-xs"
                                : "bg-white hover:bg-[#FAF8F5] border-[#EEE5DC] hover:border-[#DEC5B0]"
                            }`}
                          >
                            {/* Custom Checkbox */}
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                                  isChecked
                                    ? "bg-[#75472D] border-[#75472D] text-white"
                                    : "border-[#CBB3A1] bg-white group-hover:border-[#75472D]"
                                }`}
                              >
                                {isChecked && <Check size={14} strokeWidth={3} />}
                              </div>
                            </div>

                            {/* Location Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="inline-block rounded-md bg-[#009FB7] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider shadow-2xs">
                                  {loc.displayId || `LOC-${loc.id}`}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                    loc.status === "Active"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-gray-100 text-gray-600 border border-gray-200"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      loc.status === "Active" ? "bg-emerald-500" : "bg-gray-400"
                                    }`}
                                  />
                                  {loc.status}
                                </span>
                              </div>
                              <h4 className="mt-1 text-sm font-bold text-[#342219] truncate">
                                {loc.name}
                              </h4>
                              <p className="text-[11px] text-[#8A7667]">
                                {loc.totalSeats || 0} Total Seats
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F0E6DD] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssignLocationModalOpen(false);
                    setAssignLocationUser(null);
                  }}
                  disabled={isSavingLocations}
                  className="rounded-xl border border-gray-200 px-5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLocationAssignments}
                  disabled={isSavingLocations}
                  className="flex items-center gap-1.5 rounded-xl bg-[#69391D] hover:bg-[#522c15] text-white px-5 py-2 text-xs font-bold shadow-md transition hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSavingLocations ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: PROVIDER ASSIGNED LOCATIONS SELECTION / NAVIGATION POPUP
            (Matching the Choose Organization screen style)
           ======================================================== */}
        {isNavLocationModalOpen && navLocationModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-[#EEE5DC] bg-[#FAF8F5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F0E6DD] pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835] shadow-xs">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-[#342219] tracking-tight">
                      Choose a <span className="text-[#8B5738]">Location<span className="text-[#C99A6B]">.</span></span>
                    </h3>
                    <p className="text-xs text-[#8A7667] mt-0.5">
                      Assigned locations for provider <span className="font-bold text-[#75472D]">{navLocationModalUser.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsNavLocationModalOpen(false);
                    setNavLocationModalUser(null);
                  }}
                  className="rounded-xl p-1.5 text-[#A08C7D] hover:bg-white hover:text-[#342219] transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Locations Grid matching Choose Organization screen cards */}
              <div className="mt-6 overflow-y-auto pr-1 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {providerNavLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="group flex flex-col justify-between bg-white hover:bg-white/95 p-5 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-[#EEE5DC] hover:border-[#DEC5B0]"
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Dark silhouette avatar box / Location Icon Container */}
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#32454E] text-white shadow-xs overflow-hidden">
                          <MapPin size={26} className="text-[#8FBCC8]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-block rounded-md bg-[#009FB7] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-xs">
                              {loc.displayId || `LOC-${loc.id}`}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                loc.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-600 border border-gray-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  loc.status === "Active" ? "bg-emerald-500" : "bg-gray-400"
                                }`}
                              />
                              {loc.status}
                            </span>
                          </div>
                          <h4 className="mt-2 text-base font-bold text-[#342219] truncate leading-snug group-hover:text-[#8B5738] transition-colors">
                            {loc.name}
                          </h4>
                          <p className="text-[11px] font-medium text-[#8A7667] mt-0.5">
                            {loc.totalSeats || 0} Total Seats
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#F2ECE5]">
                        <button
                          type="button"
                          onClick={() => navigateToProviderLocation(loc)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#69391D] hover:bg-[#522c15] text-white py-2 px-3 text-xs font-bold tracking-wide shadow-xs hover:shadow transition-all cursor-pointer"
                        >
                          <span>Open Location</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex justify-end border-t border-[#F0E6DD] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsNavLocationModalOpen(false);
                    setNavLocationModalUser(null);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {isBulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200 bg-white p-7 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F6ECE2] text-[#8C5835]">
                    <FileSpreadsheet size={22} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    Bulk Import Users
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {bulkError && (
                <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
                  {bulkError}
                </div>
              )}

              {/* Step 1: Download Template */}
              <div className="relative mt-2 flex gap-4">
                {/* Step indicator circle */}
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8C5835] text-xs font-bold text-white">
                    1
                  </div>
                  <div className="h-full w-0.5 bg-gray-200" />
                </div>

                <div className="flex-1 pb-6">
                  <h4 className="text-sm font-bold text-gray-800">
                    Download Template
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Download the standard CSV template. Please do not modify
                    the column headers to ensure a successful import.
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8C5835]">
                    Columns: Name, User Name, Password, User Type, Email, Mobile Number
                  </p>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="mt-3 flex items-center gap-2 rounded-full border border-[#CBB3A1] bg-white px-4 py-1.5 text-xs font-semibold text-[#8C5835] transition hover:bg-[#FAF6F1]"
                  >
                    <Download size={14} />
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Upload Data */}
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8C5835] text-xs font-bold text-white">
                  2
                </div>

                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-800">
                    Upload Data
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Select your completed file and click upload.
                  </p>

                  {/* Drop/Browse Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DECFBE] bg-[#FDFBF7] p-6 text-center transition hover:border-[#8C5835]"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv,.xls,.xlsx"
                      onChange={handleBulkFileChange}
                      className="hidden"
                    />

                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8C5835]">
                      <CloudUpload size={24} />
                    </div>

                    <p className="mt-3 text-sm font-bold text-gray-800">
                      {selectedBulkFile
                        ? selectedBulkFile.name
                        : "Click to browse file"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Supported formats: .csv, .xls, .xlsx
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Actions: Cancel and Upload File */}
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsBulkOpen(false)}
                  className="rounded-xl border border-gray-200 px-5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkUploadSubmit}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#B48F73] to-[#8C5835] px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:opacity-95"
                >
                  <Upload size={14} />
                  <span>Upload File</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Background>
  );
}
