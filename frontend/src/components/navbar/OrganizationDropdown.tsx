import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Building2, Check, Loader2, UserCircle, MapPin } from "lucide-react";
import { organizationApi, type Organization } from "../../services/organizationApi";
import { locationApi, type LocationItem } from "../../services/locations";
import { useAuth } from "../common/AuthContext";

interface OrganizationDropdownProps {
  userRole?: "Admin" | "Provider" | string;
  className?: string;
  isMobile?: boolean;
  onCloseMobileMenu?: () => void;
}

export default function OrganizationDropdown({
  userRole,
  className = "",
  isMobile = false,
  onCloseMobileMenu,
}: OrganizationDropdownProps) {
  const { user: currentUser, switchOrganization } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const activeRole = userRole || currentUser?.userType || "Admin";
  const isProvider = activeRole === "Provider";

  // Read workspace-specific active organization
  const [providerActiveOrg, setProviderActiveOrg] = useState<{ id: string; name: string; shortCode: string } | null>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_provider_activeOrg");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [adminActiveOrg, setAdminActiveOrg] = useState<{ id: string; name: string; shortCode: string } | null>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_admin_activeOrg");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Calculate active values specific to the current workspace
  const activeShortCode = (
    isProvider
      ? (params.shortCode || providerActiveOrg?.shortCode || (currentUser?.userType === "Provider" ? currentUser.shortCode : "") || "")
      : (params.shortCode || adminActiveOrg?.shortCode || (currentUser?.userType === "Admin" ? currentUser.shortCode : "") || "")
  ).toUpperCase();

  const activeOrgName = isProvider
    ? (providerActiveOrg?.name || (currentUser?.userType === "Provider" ? currentUser.organization : "") || (activeShortCode ? `${activeShortCode} Workspace` : "Workspace"))
    : (adminActiveOrg?.name || (currentUser?.userType === "Admin" ? currentUser.organization : "") || (activeShortCode ? `${activeShortCode} Workspace` : "Workspace"));

  // Ensure correct identity is displayed for Provider vs Admin
  const displayName = isProvider
    ? (currentUser?.userType === "Provider" ? (currentUser.name || currentUser.userName || "Cafe Provider") : "Cafe Provider")
    : (currentUser?.userType === "Admin" ? (currentUser.name || currentUser.userName || "Admin User") : (currentUser?.name || "User"));

  // Load organizations for Admin or assigned locations for Provider
  const fetchData = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setFetchError(null);

    try {
      if (isProvider) {
        // Fetch locations assigned to this provider in the provider's active organization
        const providerId = currentUser?.userType === "Provider" ? String(currentUser.id) : undefined;
        const locs = await locationApi.getLocations(
          providerId,
          activeShortCode || undefined
        );
        if (Array.isArray(locs)) {
          setLocations(locs);
        } else {
          setLocations([]);
        }
      } else {
        // Fetch organizations linked to this Admin
        const orgs = await organizationApi.getOrganizations(currentUser.id);
        if (orgs && orgs.length > 0) {
          setOrganizations(orgs);
        } else {
          fallbackToLocalStorageOrUser();
        }
      }
    } catch {
      if (isProvider) {
        setLocations([]);
      } else {
        fallbackToLocalStorageOrUser();
      }
    } finally {
      setLoading(false);
    }
  };

  const fallbackToLocalStorageOrUser = () => {
    try {
      const stored = localStorage.getItem("cafe4x_organizations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrganizations(parsed);
          return;
        }
      }
    } catch {}

    const fallbackOrg = isProvider ? providerActiveOrg : adminActiveOrg;
    if (fallbackOrg?.name || fallbackOrg?.shortCode) {
      setOrganizations([
        {
          id: fallbackOrg.id || "org_1",
          name: fallbackOrg.name || "Current Organization",
          shortCode: (fallbackOrg.shortCode || "ORG").toUpperCase(),
        },
      ]);
    } else if (currentUser?.organization || currentUser?.shortCode) {
      setOrganizations([
        {
          id: currentUser.organizationId || "org_1",
          name: currentUser.organization || "Current Organization",
          shortCode: (currentUser.shortCode || "ORG").toUpperCase(),
        },
      ]);
    } else {
      setOrganizations([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, isProvider, activeShortCode, currentUser?.id]);

  // Outside click & Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectOrg = (org: Organization) => {
    const newShort = (org.shortCode || "").toUpperCase();
    const currentShort = activeShortCode;

    // Update active organization state & persistence via existing AuthContext
    switchOrganization(
      {
        id: org.id,
        name: org.name,
        shortCode: newShort,
      },
      isProvider ? "Provider" : "Admin"
    );

    if (isProvider) {
      setProviderActiveOrg({ id: org.id, name: org.name, shortCode: newShort });
    } else {
      setAdminActiveOrg({ id: org.id, name: org.name, shortCode: newShort });
    }

    setIsOpen(false);
    if (onCloseMobileMenu) onCloseMobileMenu();

    if (!newShort || newShort === currentShort) {
      return;
    }

    // Preserve the current path whenever possible by substituting the shortCode prefix
    const pathname = location.pathname;
    let targetPath = "";

    if (isProvider) {
      if (currentShort && pathname.startsWith(`/${currentShort}`)) {
        targetPath = pathname.replace(`/${currentShort}`, `/${newShort}`);
      } else {
        targetPath = `/${newShort}/provider`;
      }
    } else {
      // Admin role
      if (currentShort && pathname.startsWith(`/${currentShort}`)) {
        targetPath = pathname.replace(`/${currentShort}`, `/${newShort}`);
      } else {
        const knownAdminRoutes = ["landing", "users", "location", "items", "orders", "working-hours", "reports"];
        const segment = pathname.split("/")[1] || "";
        if (knownAdminRoutes.includes(segment)) {
          targetPath = `/${newShort}/${segment}`;
        } else {
          targetPath = `/${newShort}/landing`;
        }
      }
    }

    // Seamlessly navigate and automatically refresh into the selected organization
    window.location.href = targetPath;
  };

  const handleSelectLocation = (loc: LocationItem) => {
    setIsOpen(false);
    if (onCloseMobileMenu) onCloseMobileMenu();

    // Dispatch event so ProviderPage can immediately activate this location
    window.dispatchEvent(
      new CustomEvent("cafe4x_select_location", {
        detail: {
          id: loc.id,
          name: loc.name,
          totalSeats: loc.totalSeats || 12,
          image: loc.image,
          assignedProviderId: loc.assignedProviderId,
          assignedProviderEmail: loc.assignedProviderEmail,
          assignedProviderName: loc.assignedProviderName,
        },
      })
    );

    // Also navigate to provider page with locationId query param
    const base = activeShortCode ? `/${activeShortCode}/provider` : "/provider";
    navigate(`${base}?locationId=${loc.id}`);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button: Exactly matches the existing profile/organization badge */}
      <button
        type="button"
        title={isProvider ? "Select Location" : "Switch Organization"}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center gap-3 rounded-xl border border-[#EFE7DE] bg-[#FAF6F1] px-3.5 py-1.5 transition text-left cursor-pointer hover:border-[#DEC5B0] hover:bg-[#F5ECE0] ${
          isOpen ? "ring-2 ring-[#70452D]/20 border-[#DEC5B0]" : ""
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAD5C0] text-[#70452D]">
          <UserCircle size={24} />
        </div>
        <div className="text-left select-none">
          <p className="text-xs font-bold text-[#342219]">{displayName}</p>
          <div className="flex items-center gap-1 text-[10px] text-[#9A8778]">
            {activeShortCode && (
              <span className="rounded bg-[#E3D3C4] px-1 py-0.2 font-semibold text-[#633B22]">
                {activeShortCode}
              </span>
            )}
            <span className="max-w-[130px] truncate">{activeOrgName}</span>
            <span className="ml-1 text-[9px] font-semibold text-[#009FB7] hover:underline flex items-center gap-0.5">
              ⇄ {isProvider ? "Locations" : "Switch"}
            </span>
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={isProvider ? "Assigned Locations" : "Switch Organization"}
          className={`absolute z-50 mt-2 w-72 rounded-2xl border border-[#EEE5DC] bg-white p-2 shadow-xl shadow-[#70452D]/10 backdrop-blur-md transition-all ${
            isMobile ? "left-0 right-0 max-w-full" : "right-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F0E6DE] px-3 py-2">
            <div className="flex items-center gap-2">
              {isProvider ? (
                <MapPin size={15} className="text-[#A66C43]" />
              ) : (
                <Building2 size={15} className="text-[#A66C43]" />
              )}
              <span className="text-xs font-bold tracking-wide text-[#342219]">
                {isProvider ? "My Assigned Locations" : "Switch Organization"}
              </span>
            </div>
            {isProvider ? (
              locations.length > 0 && (
                <span className="rounded-full bg-[#FAF6F1] px-2 py-0.5 text-[10px] font-semibold text-[#8B6B58] border border-[#EFE7DE]">
                  {locations.length} {locations.length === 1 ? "location" : "locations"}
                </span>
              )
            ) : (
              organizations.length > 0 && (
                <span className="rounded-full bg-[#FAF6F1] px-2 py-0.5 text-[10px] font-semibold text-[#8B6B58] border border-[#EFE7DE]">
                  {organizations.length} {organizations.length === 1 ? "org" : "orgs"}
                </span>
              )
            )}
          </div>

          {/* List / Loading / Error / Empty states */}
          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                <Loader2 size={20} className="animate-spin text-[#A66C43]" />
                <p className="text-xs font-medium text-[#8B7B70]">
                  {isProvider ? "Loading locations..." : "Loading organizations..."}
                </p>
              </div>
            ) : fetchError ? (
              <div className="py-4 px-3 text-center">
                <p className="text-xs text-rose-600 mb-2">{fetchError}</p>
                <button
                  type="button"
                  onClick={fetchData}
                  className="text-xs font-semibold text-[#70452D] underline hover:text-[#523220]"
                >
                  Retry
                </button>
              </div>
            ) : isProvider ? (
              /* PROVIDER LOCATIONS LIST */
              locations.length === 0 ? (
                <div className="py-6 px-3 text-center">
                  <p className="text-xs font-medium text-[#8B7B70]">No assigned locations found.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {locations.map((loc) => {
                    const initials = (loc.name || "Loc")
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <button
                        key={loc.id}
                        type="button"
                        role="option"
                        onClick={() => handleSelectLocation(loc)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors cursor-pointer text-[#5D4E44] hover:bg-[#FAF6F1] hover:text-[#342219]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold bg-[#EAD5C0]/60 text-[#70452D]">
                            {initials}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="truncate font-semibold text-[#342219]">{loc.name}</p>
                            <p className="text-[10px] text-[#9A8778]">
                              {loc.totalSeats || 0} Seats {loc.status ? `• ${loc.status}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-[#70452D]">
                          <span className="text-[10px] font-semibold text-[#009FB7] hover:underline">
                            Open →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              /* ADMIN ORGANIZATIONS LIST */
              organizations.length === 0 ? (
                <div className="py-6 px-3 text-center">
                  <p className="text-xs font-medium text-[#8B7B70]">No organizations available.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {organizations.map((org) => {
                    const orgShort = (org.shortCode || "").toUpperCase();
                    const isActive = Boolean(
                      (org.id && org.id === currentUser?.organizationId) ||
                      (orgShort && orgShort === activeShortCode)
                    );

                    const initials = (org.name || orgShort || "O")
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <button
                        key={org.id || orgShort}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelectOrg(org)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-[#FAF6F1] text-[#342219] font-bold border border-[#E9DFD5]"
                            : "text-[#5D4E44] hover:bg-[#FAF6F1]/80 hover:text-[#342219]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                              isActive
                                ? "bg-gradient-to-r from-[#75472D] to-[#9A6747] text-white shadow-xs"
                                : "bg-[#EAD5C0]/60 text-[#70452D]"
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="truncate font-semibold text-[#342219]">{org.name}</p>
                            <p className="text-[10px] text-[#9A8778]">{orgShort}</p>
                          </div>
                        </div>

                        {isActive && (
                          <div className="flex items-center gap-1 shrink-0 text-[#70452D]">
                            <span className="text-[10px] font-semibold text-[#009FB7]">Active</span>
                            <Check size={14} className="stroke-[2.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
