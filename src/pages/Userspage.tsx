import { useState, useMemo, useRef } from "react";
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
} from "lucide-react";
import Background from "../components/background";
import Sidebar from "../components/sidebar/sidebar";

export interface UserItem {
  id: string;
  name: string;
  userName: string;
  password?: string;
  userType: string;
  email: string;
  mobileNumber: string;
}

const initialUsers: UserItem[] = [
  {
    id: "1",
    name: "AdminUser",
    email: "Admin@gmail.com",
    userName: "AdminUser",
    mobileNumber: "987654321",
    userType: "Admin",
  },
  {
    id: "2",
    name: "FTS Admin",
    email: "admin@faaztechsolutions.com",
    userName: "Adminuser",
    mobileNumber: "9876543211",
    userType: "Admin",
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Modal States ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // Create User Form fields
  const [createForm, setCreateForm] = useState({
    name: "",
    userName: "",
    password: "",
    confirmPassword: "",
    userType: "Admin",
    email: "",
    mobileNumber: "",
  });
  const [createError, setCreateError] = useState("");

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
        u.mobileNumber.toLowerCase().includes(q) ||
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
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
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

  // Create User Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!createForm.name.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!createForm.userName.trim()) {
      setCreateError("User Name is required");
      return;
    }
    if (!createForm.password) {
      setCreateError("Password is required");
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError("Passwords do not match");
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError("Email is required");
      return;
    }
    if (!createForm.mobileNumber.trim()) {
      setCreateError("Mobile Number is required");
      return;
    }

    const newUser: UserItem = {
      id: Date.now().toString(),
      name: createForm.name.trim(),
      userName: createForm.userName.trim(),
      password: createForm.password,
      userType: createForm.userType || "Admin",
      email: createForm.email.trim(),
      mobileNumber: createForm.mobileNumber.trim(),
    };

    setUsers((prev) => [newUser, ...prev]);
    setIsCreateOpen(false);
    setCreateForm({
      name: "",
      userName: "",
      password: "",
      confirmPassword: "",
      userType: "Admin",
      email: "",
      mobileNumber: "",
    });
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
      <Sidebar>
        {/* Main Content */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
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
                  onClick={() => {
                    setCreateError("");
                    setIsCreateOpen(true);
                  }}
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
            {paginatedUsers.length === 0 ? (
              <div className="my-8 rounded-3xl border border-[#EEE5DC] bg-white/80 p-12 text-center backdrop-blur-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2E6D9] text-[#75472D]">
                  <UserRound size={32} />
                </div>
                <h3 className="text-lg font-bold text-[#342219]">No users found</h3>
                <p className="mt-1 text-sm text-[#897B71]">
                  Try adjusting your search criteria or create a new user.
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

                    {/* Role Badge */}
                    <div className="mt-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#1D2B3A] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                        <Shield size={11} className="text-[#7FB3D5]" />
                        {user.userType}
                      </span>
                    </div>
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
            MODAL 1: USER CREATE (EXACT SCREENSHOT LAYOUT & FIELDS)
           ======================================================== */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-xl font-medium text-gray-800">User Create</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Error message */}
              {createError && (
                <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                  {createError}
                </div>
              )}

              {/* Form fields in table/grid alignment */}
              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-3.5">
                {/* Name */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Name"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  />
                </div>

                {/* User Name */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    User Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="User Name"
                    value={createForm.userName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, userName: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="password"
                    placeholder="Password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, password: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  />
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="password"
                    placeholder="ConfirmPassword"
                    value={createForm.confirmPassword}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  />
                </div>

                {/* User Type */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    User Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.userType}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, userType: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Customer">Customer</option>
                  </select>
                </div>

                {/* Email */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  />
                </div>

                {/* Mobile Number */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="w-40 text-sm font-semibold text-gray-700">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="Mobile Number"
                    value={createForm.mobileNumber}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        mobileNumber: e.target.value,
                      })
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-500"
                  />
                </div>

                {/* Bottom Buttons: Submit and Close */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="submit"
                    className="rounded-lg border border-[#28A745] px-5 py-1.5 text-sm font-medium text-[#28A745] transition hover:bg-[#28A745] hover:text-white"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-lg bg-[#DC3545] px-5 py-1.5 text-sm font-medium text-white transition hover:bg-[#c82333]"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL 2: BULK IMPORT USERS (EXACT SCREENSHOT LAYOUT)
           ======================================================== */}
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
      </Sidebar>
    </Background>
  );
}
