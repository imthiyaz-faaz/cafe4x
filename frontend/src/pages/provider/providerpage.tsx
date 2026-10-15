import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CheckCircle2,
  Layers,
  ArrowLeft,
  Sparkles,
  Search,
  XCircle,
  Armchair,
  ShoppingBag,
  Coffee,
} from "lucide-react";
import Background from "../../components/background";
import ProviderNavbar from "../../components/navbar/providernavbar";

// Category images from src/assets/images
import pendingOrdersImg from "../../assets/images/pending_orders_4k.png";
import cancelledOrdersImg from "../../assets/images/cancelled_4k.png";
import deliveredOrdersImg from "../../assets/images/delivered_4k.png";
import allOrdersImg from "../../assets/images/all_orders_4k.png";
import { orderApi } from "../../services/orderApi";



const OFFICE_IMG =
  "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80";

export interface ProviderLocation {
  id: string;
  name: string;
  badgeCount?: number; // e.g. 12
  isRedBadge?: boolean;
  image: string;
  totalSeats: number;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
}

export interface ProviderOrder {
  id: string;
  seat: string;
  locationName: string;
  employeeName: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  time: string;
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";
}

// Orders are created live by employees and synced via backend & localStorage

export type OrderCategory = "pending" | "canceled" | "delivered" | "all";


const categoryDetails: Record<OrderCategory, { title: string; subtitle: string; image: string }> = {
  pending: { title: "Pending Order", subtitle: "Orders awaiting preparation", image: pendingOrdersImg },
  canceled: { title: "Canceled Order", subtitle: "Orders declined or cancelled", image: cancelledOrdersImg },
  delivered: { title: "Delivered Order", subtitle: "Orders served to customer", image: deliveredOrdersImg },
  all: { title: "All Order", subtitle: "All historical & active orders", image: allOrdersImg },
};

export default function ProviderPage() {
  const [activeTab, setActiveTab] = useState<"provider" | "pendingOrders">("provider");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  // Detail view when provider clicks a location
  const [selectedLocation, setSelectedLocation] = useState<ProviderLocation | null>(null);

  // Active Category view inside a selected location: null (shows 4 cards) or "pending" | "canceled" | "delivered" | "all"
  const [selectedCategory, setSelectedCategory] = useState<OrderCategory | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Live order updates by provider (backend API + localStorage)
  const [orders, setOrders] = useState<ProviderOrder[]>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_provider_orders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out deprecated demo orders if any
          const realOrders = parsed.filter(
            (o: any) => o.locationName?.toLowerCase() !== "meeting room"
          );
          return realOrders;
        }
      }
    } catch {}
    return [];
  });

  // Fetch orders from backend and sync with localStorage
  const fetchOrdersFromBackend = () => {
    orderApi.getOrders()
      .then((serverOrders) => {
        if (Array.isArray(serverOrders)) {
          setOrders(serverOrders);
          try {
            localStorage.setItem("cafe4x_provider_orders", JSON.stringify(serverOrders));
          } catch {}
        }
      })
      .catch(() => {
        // Fallback to local storage

        try {
          const stored = localStorage.getItem("cafe4x_provider_orders");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) setOrders(parsed);
          }
        } catch {}
      });
  };

  useEffect(() => {
    fetchOrdersFromBackend();

    const handleStorage = () => {
      try {
        const stored = localStorage.getItem("cafe4x_provider_orders");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setOrders(parsed);
        }
      } catch {}
    };

    window.addEventListener("storage", handleStorage);
    // Poll every 3 seconds for new live employee orders from backend
    const interval = setInterval(() => {
      fetchOrdersFromBackend();
    }, 3000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  const saveOrders = (newOrders: ProviderOrder[]) => {
    setOrders(newOrders);
    try {
      localStorage.setItem("cafe4x_provider_orders", JSON.stringify(newOrders));
    } catch {}
  };


  // Get current logged in user from localStorage
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  }, []);

  const [serverLocations, setServerLocations] = useState<ProviderLocation[]>([]);

  // Fetch locations assigned to this provider from backend
  useEffect(() => {
    let providerId = currentUser?.id ? String(currentUser.id) : "";
    let shortCode = currentUser?.shortCode || "";

    import("../../services/locationApi").then(({ locationApi }) => {
      locationApi
        .getLocations(providerId || undefined, shortCode || undefined)
        .then((locList) => {
          if (Array.isArray(locList)) {
            const mapped: ProviderLocation[] = locList.map((loc: any, idx: number) => ({
              id: String(loc.id || idx),
              name: loc.name || "Location",
              badgeCount: loc.totalSeats || 12,
              isRedBadge: idx % 2 === 1,
              image: loc.image || OFFICE_IMG,
              totalSeats: loc.totalSeats || 12,
              assignedProviderId: loc.assignedProviderId,
              assignedProviderEmail: loc.assignedProviderEmail,
              assignedProviderName: loc.assignedProviderName,
            }));
            setServerLocations(mapped);
          }
        })
        .catch((err) => {
          console.warn("Could not fetch assigned locations for provider:", err);
        });
    });
  }, [currentUser]);

  // Sync locations: use backend fetched locations assigned to provider
  const locations = useMemo(() => {
    if (serverLocations.length > 0) {
      return serverLocations;
    }

    let locList: ProviderLocation[] = [];
    try {
      const stored = localStorage.getItem("cafe4x_locations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          locList = parsed.map((loc: any, idx: number) => ({
            id: String(loc.id || idx),
            name: loc.name || "Location",
            badgeCount: loc.totalSeats || 12,
            isRedBadge: idx % 2 === 1,
            image: loc.image || OFFICE_IMG,
            totalSeats: loc.totalSeats || 12,
            assignedProviderId: loc.assignedProviderId,
            assignedProviderEmail: loc.assignedProviderEmail,
            assignedProviderName: loc.assignedProviderName,
          }));
        }
      }
    } catch {}

    if (currentUser && currentUser.userType === "Provider") {
      const providerId = currentUser.id ? String(currentUser.id) : "";
      const providerEmail = currentUser.email ? currentUser.email.toLowerCase() : "";

      return locList.filter(
        (loc) =>
          (providerId && String(loc.assignedProviderId) === providerId) ||
          (providerEmail && loc.assignedProviderEmail?.toLowerCase() === providerEmail)
      );
    }

    return locList;
  }, [serverLocations, currentUser]);


  // Filter locations
  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) => loc.name.toLowerCase().includes(q));
  }, [locations, searchQuery]);

  const totalRecords = filteredLocations.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLocations = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, validCurrentPage, pageSize]);

  // Pending orders count
  const pendingOrdersCount = orders.filter((o) => o.status === "Pending").length;

  const handleUpdateOrderStatus = (orderId: string, nextStatus: ProviderOrder["status"]) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o));
    saveOrders(updated);

    orderApi.updateStatus(orderId, nextStatus).catch((err) => {
      console.warn("Could not sync order status to backend:", err);
    });
  };


  return (
    <Background>
      <div className="flex min-h-screen flex-col font-sans pt-20">
        {/* =========================================================
            HEADER / TOP NAVIGATION (SAME UI AS ADMIN NAVBAR)
           ========================================================= */}
        <ProviderNavbar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === "provider") {
              setSelectedLocation(null);
            }
          }}
          pendingOrdersCount={pendingOrdersCount}
        />

        {/* =========================================================
            MAIN CONTENT AREA
           ========================================================= */}
        <main className="flex-1 px-6 py-6 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            {/* VIEW 1: LOCATIONS GALLERY (MATCHING SCREENSHOT) */}
            {activeTab === "provider" && !selectedLocation && (
              <div>
                {/* Search Bar matching screenshot */}
                <div className="mb-10 mt-2">
                  <div className="relative w-64 sm:w-72">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="type and enter..."
                      className="w-full rounded-md border border-[#CFC5BA] bg-white/90 px-3 py-2 text-sm text-[#342219] shadow-xs outline-none transition placeholder:text-[#A08C7D] focus:border-[#8C5835] focus:bg-white focus:ring-1 focus:ring-[#8C5835]"
                    />
                  </div>
                </div>

                {/* Location Cards Grid */}
                {paginatedLocations.length === 0 ? (
                  <div className="my-16 rounded-3xl border border-[#EEE5DC] bg-white/80 p-12 text-center backdrop-blur-md">
                    <Layers className="mx-auto mb-3 h-12 w-12 text-[#A08C7D]" />
                    <h3 className="text-lg font-bold text-[#342219]">No locations matched</h3>
                    <p className="mt-1 text-sm text-[#897B71]">
                      Try adjusting your search query.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-8 sm:justify-start sm:gap-10">
                    {paginatedLocations.map((loc) => {
                      const isRed = loc.isRedBadge;
                      return (
                        <div
                          key={loc.id}
                          onClick={() => setSelectedLocation(loc)}
                          className="group flex w-[280px] sm:w-[310px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#DEC5B0]/60 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
                        >
                          {/* Top Card Image with rounded inner preview */}
                          <div className="relative h-48 w-full overflow-hidden bg-[#ECE8E1] p-3">
                            <img
                              src={loc.image}
                              alt={loc.name}
                              className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>

                          {/* Bottom Card Banner: Clean Pill Banner */}
                          <div
                            className={`flex min-h-[3.5rem] flex-col items-center justify-center py-2.5 px-4 transition-colors ${isRed
                                ? "bg-[#C92A38] text-white"
                                : "bg-[#F3EFEA] text-[#342219] group-hover:bg-[#EAE4DC]"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base font-semibold tracking-wide">
                                {loc.name}
                              </span>
                              {loc.badgeCount !== undefined && (
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-bold ${isRed
                                      ? "bg-[#8B1D27] text-white"
                                      : "bg-[#70452D] text-white"
                                    }`}
                                >
                                  {loc.badgeCount}
                                </span>
                              )}
                            </div>
                            {loc.assignedProviderName && (
                              <div className="mt-1 text-[11px] font-medium opacity-90">
                                Provider: <span className="font-semibold">{loc.assignedProviderName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bottom Pagination Bar matching screenshot */}
                <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-transparent pt-6 sm:flex-row">
                  {/* Left Pagination Controls */}
                  <div className="flex items-center gap-2 text-sm text-[#593A28]">
                    {/* Page size dropdown */}
                    <div className="relative">
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="cursor-pointer appearance-none rounded-md border border-[#CFC5BA] bg-white py-1 pl-2.5 pr-7 text-xs font-medium text-[#342219] shadow-xs outline-none focus:border-[#8C5835]"
                      >
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#70452D]">
                        ▼
                      </span>
                    </div>

                    {/* First page button */}
                    <button
                      type="button"
                      disabled={validCurrentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="rounded p-1 text-[#8C5835] transition hover:bg-[#F3EFEA] disabled:opacity-40"
                    >
                      <ChevronsLeft size={16} />
                    </button>

                    {/* Previous page button */}
                    <button
                      type="button"
                      disabled={validCurrentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="rounded p-1 text-[#8C5835] transition hover:bg-[#F3EFEA] disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* Current Page input */}
                    <input
                      type="text"
                      value={validCurrentPage}
                      readOnly
                      className="h-7 w-9 rounded-md border border-[#CFC5BA] bg-white text-center text-xs font-semibold text-[#342219] shadow-xs outline-none"
                    />

                    <span className="text-xs text-[#75675D]">of {totalPages}</span>

                    {/* Next page button */}
                    <button
                      type="button"
                      disabled={validCurrentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded p-1 text-[#8C5835] transition hover:bg-[#F3EFEA] disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>

                    {/* Last page button */}
                    <button
                      type="button"
                      disabled={validCurrentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="rounded p-1 text-[#8C5835] transition hover:bg-[#F3EFEA] disabled:opacity-40"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>

                  {/* Right: Total Records badge */}
                  <div className="flex items-center gap-2 text-sm italic text-[#593A28]">
                    <span>Total Records:</span>
                    <span className="rounded bg-[#007BFF] px-2 py-0.5 text-xs font-bold not-italic text-white shadow-xs">
                      {totalRecords}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: LOCATION 4 CATEGORIES (EXACT USER SCREENSHOT) & DETAILED ORDERS VIEW */}
            {activeTab === "provider" && selectedLocation && !selectedCategory && (
              <div>
                {/* Top Row with Location Title and Back Button matching screenshot */}
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <h2 className="text-xl font-bold text-[#342219]">
                        {selectedLocation.name} &bull; Order Categories
                      </h2>
                      <p className="text-xs text-[#8A7667]">
                        Select a category to view and manage employee orders for this location
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocation(null);
                      setSelectedCategory(null);
                    }}
                    title="Back to Locations"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B38E74] text-white shadow-md transition duration-200 hover:scale-105 hover:bg-[#9E785F]"
                  >
                    <ArrowLeft size={20} className="stroke-[2.5]" />
                  </button>
                </div>

                {/* The 4 Category Cards (Matching User Screenshot with live badges & click to view orders) */}
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
                  {(["pending", "canceled", "delivered", "all"] as OrderCategory[]).map(
                    (catKey) => {
                      const item = categoryDetails[catKey];
                      const locOrders = orders.filter((o) =>
                        selectedLocation
                          ? o.locationName.toLowerCase() === selectedLocation.name.toLowerCase() ||
                            o.locationName.toLowerCase() === "office" && selectedLocation.name.toLowerCase() === "office"
                          : true
                      );
                      const count = locOrders.filter((o) => {
                        if (catKey === "pending") return o.status === "Pending" || o.status === "Preparing" || o.status === "Ready";
                        if (catKey === "canceled") return o.status === "Canceled";
                        if (catKey === "delivered") return o.status === "Delivered";
                        return true;
                      }).length;

                      return (
                        <div
                          key={catKey}
                          onClick={() => {
                            setSelectedCategory(catKey);
                            setCategorySearch("");
                          }}
                          className="group flex w-[230px] sm:w-[250px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#DEC5B0]/70 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
                        >
                          {/* Top Graphic Illustration Box showing images from image folder */}
                          <div className="relative flex h-48 w-full items-center justify-center bg-white p-5 transition group-hover:scale-105 duration-300">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="h-36 w-36 object-contain drop-shadow-sm select-none"
                            />
                            {/* Live count badge */}
                            <span className="absolute top-3 right-3 rounded-full bg-[#754329] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                              {count}
                            </span>
                          </div>

                          {/* Bottom Card Pill Banner */}
                          <div className="flex h-12 items-center justify-center border-t border-[#F0E6DB] bg-[#F7F4EF] px-4 transition group-hover:bg-[#EFE8DD]">
                            <span className="text-sm font-semibold text-[#342219]">
                              {item.title}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2.5: ORDERS LIST FOR THE CLICKED CATEGORY */}
            {activeTab === "provider" && selectedLocation && selectedCategory && (
              <div className="space-y-6">
                {/* Header for Category Orders */}
                <div className="flex flex-col gap-4 rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={categoryDetails[selectedCategory].image}
                      alt={categoryDetails[selectedCategory].title}
                      className="h-14 w-14 object-contain rounded-2xl border border-[#EEDFCE] p-1.5 bg-[#FAF7F2] shadow-2xs"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-[#342219]">
                          {categoryDetails[selectedCategory].title}s
                        </h2>
                        <span className="rounded-full bg-[#F3EFEA] px-2.5 py-0.5 text-xs font-bold text-[#754329] border border-[#DEC5B0]">
                          {selectedLocation.name}
                        </span>
                      </div>
                      <p className="text-xs text-[#8A7667]">
                        {categoryDetails[selectedCategory].subtitle} &bull; Real-time kitchen dispatch
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Category Switcher Tabs */}
                    <div className="hidden lg:flex items-center rounded-xl bg-[#FAF8F5] p-1 border border-[#DEC5B0]">
                      {(["pending", "canceled", "delivered", "all"] as OrderCategory[]).map((cKey) => (
                        <button
                          key={cKey}
                          type="button"
                          onClick={() => setSelectedCategory(cKey)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition capitalize ${
                            selectedCategory === cKey
                              ? "bg-[#754329] text-white shadow-2xs"
                              : "text-[#70523E] hover:bg-white/80"
                          }`}
                        >
                          {cKey}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-4 py-2 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1] shadow-2xs"
                    >
                      <ArrowLeft size={16} />
                      <span>Back to Categories</span>
                    </button>
                  </div>
                </div>

                {/* Search & Stats Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:w-80">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                    />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Search by employee, seat, or order ID..."
                      className="w-full rounded-xl border border-[#E8DED4] bg-white py-2 pl-9 pr-3 text-xs text-[#342219] shadow-xs outline-none transition placeholder:text-[#B1A69D] focus:border-[#9A6747] focus:ring-2 focus:ring-[#9A6747]/10"
                    />
                  </div>

                  {/* Summary Counts */}
                  {(() => {
                    const locOrders = orders.filter((o) =>
                      selectedLocation
                        ? o.locationName.toLowerCase() === selectedLocation.name.toLowerCase() ||
                          (o.locationName.toLowerCase() === "office" && selectedLocation.name.toLowerCase() === "office")
                        : true
                    );
                    const pendingCount = locOrders.filter((o) => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready").length;
                    const deliveredCount = locOrders.filter((o) => o.status === "Delivered").length;
                    const canceledCount = locOrders.filter((o) => o.status === "Canceled").length;

                    return (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-bold text-amber-900 border border-amber-200">
                          Pending: {pendingCount}
                        </span>
                        <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-bold text-emerald-900 border border-emerald-200">
                          Delivered: {deliveredCount}
                        </span>
                        <span className="rounded-lg bg-rose-100 px-2.5 py-1 font-bold text-rose-900 border border-rose-200">
                          Canceled: {canceledCount}
                        </span>
                        <span className="rounded-lg bg-stone-100 px-2.5 py-1 font-bold text-stone-800 border border-stone-200">
                          Total: {locOrders.length}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Master-Detail Orders Layout matching exact screenshot */}
                {(() => {
                  const locOrders = orders.filter((o) =>
                    selectedLocation
                      ? o.locationName.toLowerCase() === selectedLocation.name.toLowerCase() ||
                        (o.locationName.toLowerCase() === "office" && selectedLocation.name.toLowerCase() === "office")
                      : true
                  );

                  const filtered = locOrders.filter((order) => {
                    // Category filter
                    if (selectedCategory === "pending") {
                      if (!(order.status === "Pending" || order.status === "Preparing" || order.status === "Ready")) return false;
                    } else if (selectedCategory === "canceled") {
                      if (order.status !== "Canceled") return false;
                    } else if (selectedCategory === "delivered") {
                      if (order.status !== "Delivered") return false;
                    }
                    // Text search filter
                    if (categorySearch.trim()) {
                      const q = categorySearch.toLowerCase();
                      const matchName = order.employeeName.toLowerCase().includes(q);
                      const matchId = order.id.toLowerCase().includes(q);
                      const matchSeat = order.seat.toLowerCase().includes(q);
                      const matchItem = order.items.some((i) => i.name.toLowerCase().includes(q));
                      return matchName || matchId || matchSeat || matchItem;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="my-8 rounded-3xl border border-[#EEE5DC] bg-white/90 p-12 text-center shadow-sm">
                        <Sparkles className="mx-auto mb-3 h-12 w-12 text-[#A08C7D]" />
                        <h3 className="text-base font-bold text-[#342219]">
                          No {categoryDetails[selectedCategory].title}s Found
                        </h3>
                        <p className="mt-1 text-xs text-[#8A7667]">
                          There are currently no orders in this category for {selectedLocation.name}.
                        </p>
                      </div>
                    );
                  }

                  // Default selected order if none clicked yet or invalid
                  const activeOrder =
                    filtered.find((o) => o.id === selectedOrderId) || filtered[0];

                  return (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                      {/* ========================================================
                          LEFT SIDEBAR: ORDER LIST (MATCHING EXACT USER SCREENSHOT)
                         ======================================================== */}
                      <div className="flex flex-col rounded-2xl border border-[#E8DED4] bg-white shadow-md overflow-hidden lg:col-span-5">
                        <div className="flex items-center justify-between border-b border-[#F0E6DB] bg-[#FAF8F5] px-4 py-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#754329]">
                            {categoryDetails[selectedCategory].title} Queue ({filtered.length})
                          </span>
                          <span className="rounded bg-[#007BFF] px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                            Active
                          </span>
                        </div>

                        {/* Scrollable list of orders */}
                        <div className="divide-y divide-[#F0E6DB] max-h-[600px] overflow-y-auto">
                          {filtered.map((order) => {
                            const isSelected = activeOrder?.id === order.id;
                            // Clean display name: first word e.g. "Imthiyaz", "Rizwan"
                            const shortName = order.employeeName.split(" ")[0].split("@")[0];
                            const cleanName = shortName.charAt(0).toUpperCase() + shortName.slice(1);
                            // Items summary line e.g. "Coffee : 1", "Milk : 1"
                            const firstItem = order.items[0];
                            const summaryText = firstItem
                              ? `${firstItem.name} : ${firstItem.qty}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ""}`
                              : "Order Items";

                            return (
                              <div
                                key={order.id}
                                onClick={() => setSelectedOrderId(order.id)}
                                className={`flex items-start gap-4 p-4 cursor-pointer transition-colors duration-150 ${
                                  isSelected
                                    ? "bg-[#FAF4ED] border-l-4 border-l-[#8C5835]"
                                    : "hover:bg-[#FCFAF8]"
                                }`}
                              >
                                {/* Left Chair / Seat Graphic Column with Employee Name */}
                                <div className="flex flex-col items-center justify-center w-16 shrink-0 text-center">
                                  {/* Realistic Chair Icon matching screenshot */}
                                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2D2A28] via-[#3D3A37] to-[#1F1C1B] text-white shadow-md border-2 border-stone-600">
                                    <Armchair size={24} className="text-stone-200 drop-shadow-sm" />
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#8C5835] text-[9px] font-bold text-white border border-white">
                                      {order.seat}
                                    </span>
                                  </div>
                                  <span className="mt-1.5 text-xs font-semibold text-[#342219] truncate max-w-[68px]">
                                    {cleanName}
                                  </span>
                                </div>

                                {/* Right Order Info Column matching screenshot */}
                                <div className="flex flex-1 flex-col justify-between">
                                  <div className="flex items-start justify-between">
                                    <span className="text-xs font-bold text-stone-800">
                                      {summaryText}
                                    </span>
                                    <span className="font-bold text-xs text-stone-900">
                                      ₹ {order.total.toFixed(2)}
                                    </span>
                                  </div>

                                  {/* Order ID matching screenshot e.g. 0000885 */}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrderId(order.id);
                                    }}
                                    className="mt-0.5 text-xs font-mono font-semibold text-blue-600 hover:underline cursor-pointer"
                                  >
                                    {order.id.replace("#ORD-", "0000")}
                                  </span>

                                  {/* Date & Time + New Status Badge */}
                                  <div className="mt-1 flex items-center justify-between">
                                    <span className="text-[11px] text-[#8A7667]">
                                      {order.time.includes("ago")
                                        ? `${new Date().toLocaleDateString("en-GB")} ${order.time}`
                                        : order.time}
                                    </span>

                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs ${
                                        order.status === "Pending"
                                          ? "bg-[#007BFF]"
                                          : order.status === "Preparing"
                                          ? "bg-amber-600"
                                          : order.status === "Ready"
                                          ? "bg-purple-600"
                                          : order.status === "Delivered"
                                          ? "bg-emerald-600"
                                          : "bg-rose-600"
                                      }`}
                                    >
                                      {order.status === "Pending" ? "New" : order.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bottom pagination matching screenshot: 12 < 1 of 1 > Total Records: X */}
                        <div className="flex items-center justify-between border-t border-[#F0E6DB] bg-[#FAF8F5] px-4 py-2.5 text-xs text-[#70523E]">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-stone-300 bg-white px-2 py-0.5 font-medium">
                              12 ▼
                            </span>
                            <span className="cursor-pointer font-bold">&laquo;</span>
                            <span className="cursor-pointer font-bold">&lsaquo;</span>
                            <span className="rounded border border-stone-300 bg-white px-2 py-0.5 font-bold">
                              1
                            </span>
                            <span>of 1</span>
                            <span className="cursor-pointer font-bold">&rsaquo;</span>
                            <span className="cursor-pointer font-bold">&raquo;</span>
                          </div>

                          <div className="flex items-center gap-1.5 font-medium italic">
                            <span>Total Records:</span>
                            <span className="rounded bg-[#007BFF] px-2 py-0.5 not-italic font-bold text-white">
                              {filtered.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ========================================================
                          RIGHT SIDEBAR: SEPARATED ORDERED ITEMS DETAIL VIEW
                         ======================================================== */}
                      <div className="flex flex-col rounded-2xl border border-[#E8DED4] bg-white p-6 shadow-md lg:col-span-7">
                        {activeOrder ? (
                          <div className="flex flex-col h-full justify-between">
                            <div>
                              {/* Order Detail Header */}
                              <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-[#342219]">
                                      Order {activeOrder.id}
                                    </h3>
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                        activeOrder.status === "Pending"
                                          ? "bg-blue-100 text-blue-800"
                                          : activeOrder.status === "Preparing"
                                          ? "bg-amber-100 text-amber-800"
                                          : activeOrder.status === "Ready"
                                          ? "bg-purple-100 text-purple-800"
                                          : activeOrder.status === "Delivered"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {activeOrder.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#8A7667]">
                                    Ordered by{" "}
                                    <span className="font-semibold text-[#342219]">
                                      {activeOrder.employeeName}
                                    </span>{" "}
                                    at{" "}
                                    <span className="font-semibold text-[#8C5835]">
                                      Seat {activeOrder.seat}
                                    </span>{" "}
                                    ({activeOrder.locationName})
                                  </p>
                                </div>

                                <div className="text-right">
                                  <span className="text-xs text-[#8A7667]">Order Time</span>
                                  <div className="text-xs font-bold text-[#342219]">
                                    {activeOrder.time}
                                  </div>
                                </div>
                              </div>

                              {/* Separate Item Cards Breakdown */}
                              <div className="my-5">
                                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#754329]">
                                  Items Ordered Separately ({activeOrder.items.length})
                                </h4>

                                <div className="space-y-3">
                                  {activeOrder.items.map((it, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between rounded-xl border border-[#EEE5DC] bg-[#FAF8F5] p-3.5 shadow-2xs hover:border-[#D5C2B1] transition"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#E8DED4] text-[#70452D] shadow-2xs">
                                          <Coffee size={20} />
                                        </div>
                                        <div>
                                          <h5 className="text-sm font-bold text-[#342219]">
                                            {it.name}
                                          </h5>
                                          <span className="text-xs text-[#8A7667]">
                                            Unit Price: ₹{it.price}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-4">
                                        <div className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#70452D] border border-[#DEC5B0]">
                                          Qty: {it.qty}
                                        </div>
                                        <div className="text-sm font-black text-[#342219] w-20 text-right">
                                          ₹ {(it.price * it.qty).toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Order Notes if any */}
                                {(activeOrder as any).notes && (
                                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                                    <span className="font-bold">Special Instructions: </span>
                                    {(activeOrder as any).notes}
                                  </div>
                                )}

                                {/* Bill Summary Box */}
                                <div className="mt-5 rounded-xl border border-[#E8DED4] bg-[#F7F3EE] p-4 text-xs space-y-2">
                                  <div className="flex justify-between text-[#8A7667]">
                                    <span>Items Subtotal</span>
                                    <span>₹ {activeOrder.total.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#8A7667]">
                                    <span>Taxes & Service</span>
                                    <span>₹ 0.00</span>
                                  </div>
                                  <div className="border-t border-[#DEC5B0] pt-2 flex justify-between text-base font-black text-[#754329]">
                                    <span>Total Amount</span>
                                    <span>₹ {activeOrder.total.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons for Provider */}
                            <div className="flex items-center justify-end gap-3 border-t border-[#F0E6DB] pt-4">
                              {activeOrder.status === "Pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateOrderStatus(activeOrder.id, "Canceled")}
                                    className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                                  >
                                    Decline Order
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateOrderStatus(activeOrder.id, "Preparing")}
                                    className="rounded-xl bg-[#754329] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 transition"
                                  >
                                    Start Preparing
                                  </button>
                                </>
                              )}

                              {activeOrder.status === "Preparing" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(activeOrder.id, "Ready")}
                                  className="rounded-xl bg-[#28A745] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 transition"
                                >
                                  Mark Order Ready
                                </button>
                              )}

                              {activeOrder.status === "Ready" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(activeOrder.id, "Delivered")}
                                  className="rounded-xl bg-[#007BFF] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 transition"
                                >
                                  Deliver to Seat {activeOrder.seat}
                                </button>
                              )}

                              {activeOrder.status === "Delivered" && (
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                  <CheckCircle2 size={16} /> Delivered to Seat {activeOrder.seat}
                                </div>
                              )}

                              {activeOrder.status === "Canceled" && (
                                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                                  <XCircle size={16} /> Order Canceled
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-64 text-center">
                            <ShoppingBag className="h-10 w-10 text-[#A08C7D] mb-2" />
                            <p className="text-sm font-bold text-[#342219]">No Order Selected</p>
                            <p className="text-xs text-[#8A7667]">Click any order on the left to inspect items</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* VIEW 3: MY PENDING ORDERS TAB */}
            {activeTab === "pendingOrders" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-2 rounded-2xl border border-[#EEE5DC] bg-white/95 p-6 shadow-md backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#342219]">
                      My Pending Orders
                    </h2>
                    <p className="text-xs text-[#897B71]">
                      Real-time queue of workplace café orders waiting for fulfillment
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("provider")}
                    className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-4 py-2 text-xs font-semibold text-[#6F4228] transition hover:bg-[#FAF6F1]"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Locations</span>
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-3xl border border-[#EEE5DC] bg-white/90 p-12 text-center">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-[#70452D]" />
                    <p className="font-semibold text-[#342219]">No pending orders at the moment!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-[#EEE5DC] bg-white p-5 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#70452D]">
                              {order.id}
                            </span>
                            <span className="rounded-md bg-[#FAF6F1] px-2 py-0.5 text-xs font-semibold text-[#593A28]">
                              {order.locationName} &bull; Seat {order.seat}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${order.status === "Pending"
                                ? "bg-amber-100 text-amber-800"
                                : order.status === "Preparing"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.status === "Ready"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-emerald-100 text-emerald-800"
                              }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        {/* Customer & Time */}
                        <div className="mt-3 flex items-center justify-between text-xs text-[#897B71]">
                          <span className="font-medium text-[#342219]">
                            Customer: {order.employeeName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {order.time}
                          </span>
                        </div>

                        {/* Order Items */}
                        <div className="my-3 space-y-1.5 rounded-xl bg-[#FAF6F1] p-3 text-xs">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between font-medium text-[#342219]">
                              <span>
                                {it.name} &times; {it.qty}
                              </span>
                              <span>₹{it.price * it.qty}</span>
                            </div>
                          ))}
                          <div className="border-t border-[#E8DED4] pt-1.5 flex justify-between font-bold text-[#70452D]">
                            <span>Total</span>
                            <span>₹{order.total}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          {order.status === "Pending" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(order.id, "Preparing")}
                              className="rounded-lg bg-[#70452D] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#593A28]"
                            >
                              Mark Preparing
                            </button>
                          )}
                          {order.status === "Preparing" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(order.id, "Ready")}
                              className="rounded-lg bg-[#28A745] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#218838]"
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.status === "Ready" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(order.id, "Delivered")}
                              className="rounded-lg bg-[#007BFF] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0069D9]"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {order.status === "Delivered" && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <CheckCircle2 size={14} /> Completed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </Background>
  );
}
