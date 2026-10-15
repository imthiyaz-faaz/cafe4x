import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Building2,
  ShieldCheck,
  User,
} from "lucide-react";

export interface LocationItem {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  image?: string;
  shortCode?: string;
  organizationId?: string;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
}

export interface ProviderUserItem {
  id: string;
  name: string;
  userName: string;
  email: string;
  userType: string;
}

interface AssignCardProps {
  location: LocationItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedLocation: LocationItem) => void;
}

export default function AssignCard({
  location,
  isOpen,
  onClose,
  onSave,
}: AssignCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    location.assignedProviderId || ""
  );
  const [showList, setShowList] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync selected provider when location changes or modal opens
  useEffect(() => {
    setSelectedProviderId(location.assignedProviderId || "");
    setSearchQuery("");
    setDropdownOpen(false);
    setShowList(false);
    setSuccessMsg("");
  }, [location, isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const [providerUsers, setProviderUsers] = useState<ProviderUserItem[]>([]);

  // Fetch only providers belonging to this organization from backend
  useEffect(() => {
    if (!isOpen) return;

    let orgShortCode = "";
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) {
        orgShortCode = JSON.parse(stored).shortCode || "";
      }
    } catch {}

    import("../../services/users").then(({ userApi }) => {
      userApi
        .getUsers("Provider", orgShortCode || undefined)
        .then((users: any) => {
          if (Array.isArray(users)) {
            const mapped: ProviderUserItem[] = users
              .filter((u: any) => (u.userType || "").toLowerCase() === "provider")
              .map((u: any) => ({
                id: String(u.id),
                name: u.name,
                userName: u.userName,
                email: u.email,
                userType: u.userType,
              }));
            setProviderUsers(mapped);
          }
        })
        .catch((err) => {
          console.warn("Could not fetch organization providers:", err);
          setProviderUsers([]);
        });
    });
  }, [isOpen]);

  // Filter provider list based on search inside dropdown
  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return providerUsers;
    return providerUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.userName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [providerUsers, searchQuery]);

  const selectedProvider = useMemo(() => {
    return providerUsers.find((p) => p.id === selectedProviderId);
  }, [providerUsers, selectedProviderId]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: LocationItem = {
      ...location,
      assignedProviderId: selectedProvider ? selectedProvider.id : undefined,
      assignedProviderEmail: selectedProvider ? selectedProvider.email : undefined,
      assignedProviderName: selectedProvider ? selectedProvider.name : undefined,
    };

    setSuccessMsg("Provider assigned successfully!");
    setTimeout(() => {
      setSuccessMsg("");
      onSave(updated);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-visible rounded-2xl border border-[#E8DED4] bg-white p-6 shadow-2xl transition-all">
        {/* Header: [location.name] - User assign */}
        <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5EBE1] text-[#8C5835]">
              <Building2 size={16} />
            </div>
            <h3 className="text-base font-semibold text-[#342219]">
              {location.name} - User assign
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#FAF6F1] hover:text-gray-700 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-2.5 text-xs font-semibold text-green-700 border border-green-200 animate-in fade-in">
            <Check size={14} className="text-green-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="mt-4 space-y-4">
          {/* Available Users Field */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800">
                Available Users
              </label>
              <span className="text-[11px] font-medium text-[#8C5835] bg-[#FAF4ED] px-2 py-0.5 rounded-md border border-[#E8DED4]">
                Providers only
              </span>
            </div>

            {/* Custom Dropdown Trigger */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-xs text-gray-700 shadow-2xs hover:border-[#8C5835] focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835] focus:outline-none transition"
              >
                <div className="flex items-center gap-2 truncate">
                  <User size={14} className="text-[#8C5835] shrink-0" />
                  <span className={selectedProvider ? "font-semibold text-gray-900" : "text-gray-500"}>
                    {selectedProvider
                      ? `${selectedProvider.name} (${selectedProvider.userName})`
                      : "Select User"}
                  </span>
                </div>
                {dropdownOpen ? (
                  <ChevronUp size={15} className="text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown size={15} className="text-gray-500 shrink-0" />
                )}
              </button>

              {/* Dropdown Menu (matching screenshot) */}
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in duration-150 overflow-hidden">
                  {/* Select All Option */}
                  <div
                    onClick={() => {
                      if (filteredProviders.length > 0) {
                        if (selectedProviderId === filteredProviders[0].id) {
                          setSelectedProviderId("");
                        } else {
                          setSelectedProviderId(filteredProviders[0].id);
                        }
                      }
                    }}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-gray-100 px-3.5 py-2.5 text-xs font-medium text-gray-700 hover:bg-[#FAF6F1] transition"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={
                        filteredProviders.length > 0 &&
                        selectedProviderId === filteredProviders[0].id
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-[#8C5835] focus:ring-0 cursor-pointer"
                    />
                    <span>Select All</span>
                  </div>

                  {/* Search Bar inside dropdown */}
                  <div className="border-b border-gray-100 p-2 bg-[#FAF8F5]">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Here..."
                        className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-[#8C5835]"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Provider users list */}
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredProviders.length === 0 ? (
                      <div className="px-4 py-4 text-center text-xs text-gray-400">
                        No Provider users found
                      </div>
                    ) : (
                      filteredProviders.map((provider) => {
                        const isChecked = selectedProviderId === provider.id;
                        return (
                          <div
                            key={provider.id}
                            onClick={() => {
                              setSelectedProviderId(isChecked ? "" : provider.id);
                            }}
                            className={`flex cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs transition hover:bg-[#FAF6F1] ${
                              isChecked ? "bg-[#FAF4ED] font-semibold text-[#704225]" : "text-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <input
                                type="checkbox"
                                readOnly
                                checked={isChecked}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-[#8C5835] focus:ring-0 cursor-pointer"
                              />
                              <div className="truncate">
                                <div className="font-medium text-gray-900">{provider.name}</div>
                                <div className="text-[11px] text-gray-400 truncate">{provider.email}</div>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#EADCCF] px-2 py-0.5 text-[10px] font-bold text-[#704225]">
                              Provider
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Show List toggle link */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowList(!showList)}
              className="text-xs font-semibold text-[#593A28] hover:text-[#8C5835] underline underline-offset-2 transition cursor-pointer"
            >
              {showList ? "Hide List.." : "Show List.."}
            </button>

            {/* Show List details panel */}
            {showList && (
              <div className="mt-2.5 rounded-xl border border-[#EEE5DC] bg-[#FAF8F5] p-3.5 text-xs animate-in fade-in duration-200">
                <div className="font-bold text-[#342219] mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#8C5835]" />
                  <span>Location Details</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-[#E8DED4]">
                  <div>
                    <span className="text-gray-400">Name:</span>{" "}
                    <span className="font-semibold text-gray-800">{location.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Seats:</span>{" "}
                    <span className="font-semibold text-gray-800">{location.totalSeats}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>{" "}
                    <span className="font-semibold text-green-600">{location.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Assigned:</span>{" "}
                    <span className="font-semibold text-[#8C5835]">
                      {location.assignedProviderName || "None"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 font-bold text-[#342219] mb-1.5 flex items-center justify-between">
                  <span>Eligible Providers</span>
                  <span className="rounded bg-[#EADCCF] px-1.5 py-0.5 text-[10px] text-[#704225]">
                    {providerUsers.length}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {providerUsers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-[11px] bg-white rounded-lg p-2 border border-[#E8DED4]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <UserCheck size={12} className="text-[#8C5835] shrink-0" />
                        <span className="font-medium text-gray-800 truncate">
                          {p.name} ({p.userName})
                        </span>
                      </div>
                      <span className="text-gray-500 font-mono text-[10px] shrink-0 ml-2">
                        {p.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons matching screenshot (Save & Cancel) */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EEE5DC]">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[#8C5835] px-6 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#774728] active:scale-95 focus:outline-none cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#DC3545] bg-white px-5 py-2 text-xs font-bold text-[#DC3545] transition hover:bg-red-50 active:scale-95 focus:outline-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
