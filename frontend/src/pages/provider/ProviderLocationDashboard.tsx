import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Search,
  ChevronDown,
  Building2,
  Armchair,
  Package,
  FileBarChart,
  Repeat,
  Bell,
  CheckCircle2,
  Coffee,
  Truck,
  RotateCw,
  MoreVertical,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Background from "../../components/background";
import ProviderNavbar from "../../components/navbar/providernavbar";
import { api } from "../../services/apiClient";
import heroImg from "../../assets/images/hero.png";

interface ProviderLocationSummary {
  id: number;
  name: string;
  status: string;
  image?: string;
  totalSeats: number;
}

interface ProviderTableSummary {
  id: number;
  name: string;
  seatLimit: number;
  occupiedSeats: number;
  availableSeats: number;
  isActive: number;
  pendingOrderCount: number;
}

interface ProviderRecentOrderSummary {
  id: string;
  displayId: string;
  tableName: string;
  tableId: number;
  seatNumber?: string | number;
  status: string;
  time: string;
  createdAt: string;
  firstItemImage?: string;
  firstItemName?: string;
}

interface LocationSummaryResponse {
  success: boolean;
  location: ProviderLocationSummary;
  stats: {
    myTables: number;
    pendingOrders: number;
    preparingOrders: number;
    readyOrders: number;
    deliveredToday: number;
  };
  tables: ProviderTableSummary[];
  recentOrders: ProviderRecentOrderSummary[];
}

interface ProviderLocationDashboardProps {
  locationId: string | number;
  onBack: () => void;
  onSelectCategory?: (category: "pending" | "preparing" | "ready" | "delivered" | "all", tableId?: number | string, tableName?: string) => void;
}

export const ProviderLocationDashboard: React.FC<ProviderLocationDashboardProps> = ({
  locationId,
  onBack,
  onSelectCategory,
}) => {
  const navigate = useNavigate();
  const { shortCode } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<LocationSummaryResponse | null>(null);
  const [searchTable, setSearchTable] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<"tables" | "allOrders" | "reports">("tables");

  const orgPrefix = shortCode ? `/${shortCode}` : "";

  // Load summary data from backend
  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<LocationSummaryResponse>(`/api/provider/location/${locationId}/summary`);
      if (res && res.success) {
        setData(res);
      }
    } catch (err) {
      console.error("Failed to load provider location summary:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (locationId) {
      loadSummary();
    }
  }, [locationId]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    if (!data?.tables) return [];
    return data.tables.filter((t) => {
      const matchesSearch = !searchTable.trim() || t.name.toLowerCase().includes(searchTable.toLowerCase().trim());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && t.isActive === 1) ||
        (statusFilter === "inactive" && t.isActive === 0);
      return matchesSearch && matchesStatus;
    });
  }, [data?.tables, searchTable, statusFilter]);

  // Format relative elapsed time
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return "just now";
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${Math.floor(diffHrs / 24)}d ago`;
    } catch {
      return "recently";
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "pending") {
      return {
        bg: "bg-[#FFF4E5]",
        text: "text-[#D97706]",
        border: "border-[#FDE68A]",
        label: "Pending",
      };
    }
    if (s === "preparing") {
      return {
        bg: "bg-[#EBF5FF]",
        text: "text-[#2563EB]",
        border: "border-[#BFDBFE]",
        label: "Preparing",
      };
    }
    if (s === "ready") {
      return {
        bg: "bg-[#EAF7ED]",
        text: "text-[#16A34A]",
        border: "border-[#BBF7D0]",
        label: "Ready",
      };
    }
    if (s === "delivered") {
      return {
        bg: "bg-[#F3E8FF]",
        text: "text-[#9333EA]",
        border: "border-[#E9D5FF]",
        label: "Delivered",
      };
    }
    return {
      bg: "bg-gray-100",
      text: "text-gray-700",
      border: "border-gray-200",
      label: status,
    };
  };

  return (
    <div className="space-y-6">
      {/* 1. Location Header matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#70452D] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Locations</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-[#342219] tracking-tight">
                  {data?.location.name || "Location"}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]">
                  {data?.location.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-[#8A7667] mt-0.5">
                Your assigned tables and orders for this location
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSummary}
          className="self-end sm:self-auto p-2.5 rounded-2xl bg-white border border-[#EEE5DC] text-[#70452D] hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
          title="Refresh Dashboard"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* 2. Top Summary Stat Cards (5 Cards matching reference) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: My Tables */}
        <div className="flex items-center gap-3.5 rounded-3xl border border-[#F4E3D7] bg-[#FDF7F2] p-4 shadow-2xs hover:shadow-md transition-all duration-200">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F6DEC9] text-[#A75D28] shadow-xs">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h16" />
              <path d="M4 12h16" />
              <path d="M4 12v6" />
              <path d="M20 12v6" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#8A7667] truncate">My Tables</span>
            <span className="text-xl sm:text-2xl font-black text-[#342219] mt-0.5 block">
              {data?.stats.myTables || 0}
            </span>
          </div>
        </div>

        {/* Card 2: Pending Orders */}
        <div 
          onClick={() => onSelectCategory ? onSelectCategory("pending") : navigate(`${orgPrefix}/provider/pending-orders`)}
          className="flex items-center gap-3.5 rounded-3xl border border-[#FFE8D6] bg-[#FFF8F2] p-4 shadow-2xs hover:shadow-md hover:border-[#F97316]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FED7AA] text-[#C2410C] shadow-xs">
            <Package className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#8A7667] truncate">Pending Orders</span>
            <span className="text-xl sm:text-2xl font-black text-[#342219] mt-0.5 block">
              {data?.stats.pendingOrders || 0}
            </span>
          </div>
        </div>

        {/* Card 3: Preparing */}
        <div 
          onClick={() => onSelectCategory ? onSelectCategory("preparing") : null}
          className="flex items-center gap-3.5 rounded-3xl border border-[#FEF3C7] bg-[#FFFDF5] p-4 shadow-2xs hover:shadow-md hover:border-[#B45309]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FDE68A] text-[#B45309] shadow-xs">
            <Coffee className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#8C7650] truncate">Preparing</span>
            <span className="text-xl sm:text-2xl font-black text-[#4B3B1B] mt-0.5 block">
              {data?.stats.preparingOrders || 0}
            </span>
          </div>
        </div>

        {/* Card 4: Ready */}
        <div 
          onClick={() => onSelectCategory ? onSelectCategory("ready") : null}
          className="flex items-center gap-3.5 rounded-3xl border border-[#D9EFE3] bg-[#F2FAF6] p-4 shadow-2xs hover:shadow-md hover:border-[#16A34A]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D2F0E1] text-[#16A34A] shadow-xs">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#6C897B] truncate">Ready</span>
            <span className="text-xl sm:text-2xl font-black text-[#1D3B2E] mt-0.5 block">
              {data?.stats.readyOrders || 0}
            </span>
          </div>
        </div>

        {/* Card 5: Delivered Today */}
        <div 
          onClick={() => onSelectCategory ? onSelectCategory("delivered") : null}
          className="col-span-2 md:col-span-1 flex items-center gap-3.5 rounded-3xl border border-[#E9D5FF] bg-[#FAF5FF] p-4 shadow-2xs hover:shadow-md hover:border-[#7C3AED]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#DDD6FE] text-[#7C3AED] shadow-xs">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#7E6A8A] truncate">Delivered Today</span>
            <span className="text-xl sm:text-2xl font-black text-[#342219] mt-0.5 block">
              {data?.stats.deliveredToday || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Body: 3-column / 12-column responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 of 12): Location Information Card */}
        <div className="lg:col-span-3 space-y-4">
          <div className="overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white/95 p-5 shadow-xs backdrop-blur-sm">
            {/* Location Image */}
            <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-stone-100 shadow-2xs mb-4">
              <img
                src={data?.location.image || heroImg}
                alt={data?.location.name}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = heroImg;
                }}
              />
            </div>

            {/* Location Title & Assigned Badge */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-black text-[#342219]">
                {data?.location.name || "Location"}
              </h2>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF3EB] text-[#8C5835] border border-[#EAD7C8] text-[11px] font-bold">
                <Users className="w-3 h-3 stroke-[2.5]" />
                <span>Assigned to you</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-1.5 pt-2 border-t border-[#F0E6DC]">
              <button
                type="button"
                onClick={() => setActiveSideTab("tables")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeSideTab === "tables"
                    ? "bg-[#FAF3EB] text-[#704225] border border-[#EAD7C8] shadow-2xs"
                    : "text-[#593A28] hover:bg-[#FAF8F5]"
                }`}
              >
                <svg className="w-4 h-4 shrink-0 text-[#704225]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h16" />
                  <path d="M4 12h16" />
                  <path d="M4 12v6" />
                  <path d="M20 12v6" />
                </svg>
                <span>Tables & Orders</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSideTab("allOrders");
                  if (onSelectCategory) {
                    onSelectCategory("all");
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeSideTab === "allOrders"
                    ? "bg-[#FAF3EB] text-[#704225] border border-[#EAD7C8] shadow-2xs"
                    : "text-[#593A28] hover:bg-[#FAF8F5]"
                }`}
              >
                <Package className="w-4 h-4 shrink-0 text-[#8C5835]" />
                <span>All Orders</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSideTab("reports");
                  navigate(`${orgPrefix}/provider/reports`);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeSideTab === "reports"
                    ? "bg-[#FAF3EB] text-[#704225] border border-[#EAD7C8] shadow-2xs"
                    : "text-[#593A28] hover:bg-[#FAF8F5]"
                }`}
              >
                <FileBarChart className="w-4 h-4 shrink-0 text-[#8C5835]" />
                <span>Reports</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: My Tables Section */}
        <div className="lg:col-span-9 space-y-4">
          <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 p-5 shadow-xs backdrop-blur-sm">
            {/* Header: Title, Search, and Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F0E6DC]">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#704225]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h16" />
                  <path d="M4 12h16" />
                  <path d="M4 12v6" />
                  <path d="M20 12v6" />
                </svg>
                <h3 className="text-base font-extrabold text-[#342219]">
                  My Tables ({filteredTables.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTable}
                    onChange={(e) => setSearchTable(e.target.value)}
                    placeholder="Search table..."
                    className="w-36 sm:w-44 pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E8DED4] rounded-xl text-xs text-[#342219] placeholder:text-gray-400 outline-none focus:border-[#8C5835]"
                  />
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8DED4] bg-[#FAF8F5] text-xs font-semibold text-[#70523E] hover:bg-white transition cursor-pointer"
                  >
                    <span>
                      {statusFilter === "all" ? "All Status" : statusFilter === "active" ? "Active" : "Inactive"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#8C5835]" />
                  </button>

                  {statusDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-32 rounded-xl border border-[#EEE5DC] bg-white p-1 shadow-lg z-20 animate-in fade-in">
                      {(["all", "active", "inactive"] as const).map((st) => (
                        <div
                          key={st}
                          onClick={() => {
                            setStatusFilter(st);
                            setStatusDropdownOpen(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                            statusFilter === st ? "bg-[#FAF3EB] text-[#704225] font-bold" : "text-[#342219] hover:bg-[#FAF8F5]"
                          }`}
                        >
                          {st === "all" ? "All Status" : st === "active" ? "Active" : "Inactive"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="pt-4">
              {filteredTables.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF4ED] text-[#8C5835] flex items-center justify-center mx-auto mb-2.5">
                    <Coffee className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#342219]">No Tables Found</h4>
                  <p className="text-xs text-[#8A7667] mt-1 max-w-xs mx-auto">
                    {searchTable
                      ? "No tables match your search query."
                      : "You do not have any tables assigned to you in this location yet."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredTables.map((tbl) => (
                    <div
                      key={tbl.id}
                      className="group rounded-3xl border border-[#EEE5DC] bg-white p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Table Header: Name, Active Badge, 3-dot */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-[#342219]">{tbl.name}</h4>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                tbl.isActive === 1
                                  ? "bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]"
                                  : "bg-stone-100 text-stone-600 border border-stone-200"
                              }`}
                            >
                              {tbl.isActive === 1 ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <div className="p-1 text-[#A8907E] hover:text-[#342219] rounded-lg">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Middle: Wooden Table Visual & Stats */}
                        <div className="flex items-center gap-3 py-1">
                          {/* Visual Table */}
                          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-xl bg-[#A86B3E] border-2 border-[#8C5835] shadow-xs flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-emerald-600 shadow-2xs" />
                            </div>
                            <div className="absolute top-0 w-3 h-1.5 rounded-t-sm bg-[#FAF4ED] border border-[#D5C2B1]" />
                            <div className="absolute bottom-0 w-3 h-1.5 rounded-b-sm bg-[#FAF4ED] border border-[#D5C2B1]" />
                            <div className="absolute left-0 h-3 w-1.5 rounded-l-sm bg-[#FAF4ED] border border-[#D5C2B1]" />
                            <div className="absolute right-0 h-3 w-1.5 rounded-r-sm bg-[#FAF4ED] border border-[#D5C2B1]" />
                          </div>

                          {/* Stats info */}
                          <div className="min-w-0 flex-1 space-y-1 text-xs">
                            <div className="flex items-center gap-1.5 text-[#593A28]">
                              <Users className="w-3 h-3 text-[#8C5835] shrink-0" />
                              <span className="font-bold text-[11px]">{tbl.seatLimit} Seats</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#8A7667] text-[10px]">
                              <span>{tbl.occupiedSeats} Occupied</span>
                              <span>&bull;</span>
                              <span>{tbl.availableSeats} Available</span>
                            </div>
                          </div>

                          {/* Pending Orders Pill */}
                          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 text-center shrink-0">
                            <span className="block text-sm font-black text-[#B45309]">
                              {tbl.pendingOrderCount}
                            </span>
                            <span className="block text-[9px] font-semibold text-[#8C7650]">
                              Pending
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action: View Orders */}
                      <div className="mt-4 pt-3 border-t border-[#F0E6DC]">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectCategory) {
                              onSelectCategory("all", tbl.id, tbl.name);
                            } else {
                              navigate(`${orgPrefix}/provider/pending-orders?tableId=${tbl.id}`);
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#704225] hover:text-[#5E361D] transition cursor-pointer group-hover:translate-x-0.5"
                        >
                          <span>View Orders</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderLocationDashboard;

