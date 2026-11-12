import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Users,
  Plus,
} from "lucide-react";
import type { LocationItem, LocationProviderSummary } from "../../services/locations/locationService";
export type { LocationItem, LocationProviderSummary };

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
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [initialProviderIds, setInitialProviderIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
                name: u.name || u.userName || "Provider",
                userName: u.userName || "",
                email: u.email || "",
                userType: u.userType || "Provider",
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

  // Sync selected providers when location changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setDropdownOpen(false);

    let initialIds: string[] = [];
    if (location.assignedProviders && location.assignedProviders.length > 0) {
      initialIds = location.assignedProviders.map((p: LocationProviderSummary) => String(p.id));
    } else if (location.assignedProviderId) {
      initialIds = [String(location.assignedProviderId)];
    }
    setSelectedProviderIds(initialIds);
    setInitialProviderIds(initialIds);
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

  // Filter provider list based on search
  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return providerUsers;
    return providerUsers.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.userName && u.userName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [providerUsers, searchQuery]);

  const selectedProvidersList = useMemo(() => {
    return providerUsers.filter((p) => selectedProviderIds.includes(p.id));
  }, [providerUsers, selectedProviderIds]);

  const handleToggleProvider = (id: string) => {
    if (selectedProviderIds.includes(id)) {
      setSelectedProviderIds(selectedProviderIds.filter((pId) => pId !== id));
    } else {
      setSelectedProviderIds([...selectedProviderIds, id]);
    }
  };

  const handleRemoveProvider = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProviderIds(selectedProviderIds.filter((pId) => pId !== id));
  };

  const getInitials = (name?: string, userName?: string) => {
    const target = (name || userName || "PR").trim();
    const parts = target.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return target.slice(0, 2).toUpperCase();
  };

  const hasChanges = useMemo(() => {
    if (selectedProviderIds.length !== initialProviderIds.length) return true;
    const sortedA = [...selectedProviderIds].sort();
    const sortedB = [...initialProviderIds].sort();
    return sortedA.some((id, idx) => id !== sortedB[idx]);
  }, [selectedProviderIds, initialProviderIds]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    const assignedList: LocationProviderSummary[] = selectedProvidersList.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      userName: p.userName,
    }));

    const primary = assignedList[0] || null;

    const updated: LocationItem = {
      ...location,
      assignedProviderId: primary ? primary.id : undefined,
      assignedProviderEmail: primary ? primary.email : undefined,
      assignedProviderName: primary ? primary.name : undefined,
      assignedProviders: assignedList,
      assignedProvidersCount: assignedList.length,
    };

    try {
      await onSave(updated);
      onClose();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[760px] overflow-hidden rounded-[28px] border border-[#EFE5DC] bg-white p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5ECE3] text-[#704225] shadow-xs">
              <Users size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-[#2B180D]">
                {location.name} – Assign Provider
              </h3>
              <p className="text-xs text-[#8A7667] mt-0.5">
                Assign one or more providers to this location.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-[#FAF6F1] hover:text-gray-700 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Empty State Banner (Shown when no providers are currently assigned to this location) */}
        {selectedProviderIds.length === 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-[#F0E6DC] bg-gradient-to-b from-[#FDF9F5] via-[#FAF4ED] to-[#F5ECE2] p-6 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#704225] shadow-sm border border-[#EFE5DC] mb-3">
              <Users size={24} className="stroke-[2.2]" />
            </div>
            <h4 className="text-base font-bold text-[#2B180D]">
              No Providers Assigned
            </h4>
            <p className="text-xs text-[#8A7667] mt-1 mb-4">
              This location doesn't have any providers yet.
            </p>
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#704225] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#5E361D] transition cursor-pointer active:scale-95"
            >
              <Plus size={14} className="stroke-[2.5]" />
              <span>Assign Provider</span>
            </button>
          </div>
        )}

        {/* Two-Column Provider Selection Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN: Select Providers */}
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <Users size={16} className="text-[#2B180D] stroke-[2.2]" />
              <h4 className="text-sm font-bold text-[#2B180D]">Select Providers</h4>
            </div>

            {/* Searchable Dropdown Bar */}
            <div className="relative mb-3.5" ref={dropdownRef}>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 shadow-2xs hover:border-[#704225] cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Search size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-400 select-none">
                    Search and select provider(s)...
                  </span>
                </div>
                {dropdownOpen ? (
                  <ChevronUp size={16} className="text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-500 shrink-0" />
                )}
              </div>

              {/* Dropdown Menu for quick search & filter */}
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1.5 w-full rounded-2xl border border-[#EFE5DC] bg-white p-2 shadow-xl animate-in fade-in duration-150">
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type to filter..."
                      className="w-full rounded-xl border border-gray-200 bg-[#FAF7F3] py-1.5 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-[#704225]"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredProviders.length === 0 ? (
                      <div className="py-3 text-center text-xs text-gray-400">
                        No providers found
                      </div>
                    ) : (
                      filteredProviders.map((p) => {
                        const isChecked = selectedProviderIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleToggleProvider(p.id)}
                            className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs cursor-pointer transition ${
                              isChecked
                                ? "bg-[#FAF3EB] text-[#704225] font-semibold"
                                : "text-gray-700 hover:bg-[#FAF7F3]"
                            }`}
                          >
                            <span className="truncate">{p.name || p.userName}</span>
                            {isChecked && <Check size={14} className="text-[#704225] shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selectable Provider Cards List */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {filteredProviders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#EFE5DC] p-6 text-center text-xs text-gray-400">
                  No providers available
                </div>
              ) : (
                filteredProviders.map((provider) => {
                  const isSelected = selectedProviderIds.includes(provider.id);
                  const initials = getInitials(provider.name, provider.userName);

                  return (
                    <div
                      key={provider.id}
                      onClick={() => handleToggleProvider(provider.id)}
                      className={`group flex items-center gap-3 rounded-2xl border p-2.5 transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-[#EAD7C8] bg-[#FAF3EB] shadow-xs"
                          : "border-transparent bg-white hover:border-[#F0E6DC] hover:bg-[#FDFBF9]"
                      }`}
                    >
                      {/* Custom Checkbox */}
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition ${
                          isSelected
                            ? "border-[#704225] bg-[#704225] text-white"
                            : "border-gray-300 bg-white group-hover:border-gray-400"
                        }`}
                      >
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>

                      {/* Circular Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFE3D7] text-xs font-bold text-[#704225]">
                        {initials}
                      </div>

                      {/* Provider Info */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[#2B180D]">
                          {provider.name || provider.userName}
                        </div>
                        <div className="truncate text-[11px] text-[#8A7667]">
                          {provider.email || "No email"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Selected Providers */}
          <div className="border-t md:border-t-0 md:border-l border-[#F0E6DC] md:pl-6 pt-4 md:pt-0">
            <div className="mb-3.5 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EAD7C8] text-[#704225]">
                <Check size={12} className="stroke-[3]" />
              </div>
              <h4 className="text-sm font-bold text-[#2B180D]">
                Selected Providers ({selectedProviderIds.length})
              </h4>
            </div>

            {selectedProvidersList.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#EFE5DC] bg-[#FAF8F5]/60 p-6 text-center">
                <Users size={28} className="text-[#C8B8AC] stroke-[1.5] mb-2" />
                <p className="text-xs font-semibold text-[#8A7667]">
                  No providers selected
                </p>
                <p className="text-[11px] text-[#A6978A] mt-0.5">
                  Check providers from the list on the left
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-[260px] overflow-y-auto content-start">
                {selectedProvidersList.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAD7C8] bg-[#FAF3EB] px-3 py-1.5 text-xs font-semibold text-[#704225] shadow-2xs transition hover:bg-[#F5ECE1]"
                  >
                    <span>{p.name || p.userName}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveProvider(p.id, e)}
                      className="rounded-full p-0.5 text-[#8A7667] hover:bg-[#EAD7C8] hover:text-[#2B180D] transition cursor-pointer"
                      title="Remove provider"
                    >
                      <X size={12} className="stroke-[2.5]" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-[#F0E6DC]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#FAF7F3] hover:border-gray-400 active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !hasChanges}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer ${
              isSubmitting || !hasChanges
                ? "bg-gray-300 cursor-not-allowed opacity-60 shadow-none"
                : "bg-gradient-to-r from-[#6F3F24] via-[#7D4629] to-[#8C5030] hover:shadow-lg hover:brightness-105"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={14} className="stroke-[3]" />
                <span>Save Assignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
