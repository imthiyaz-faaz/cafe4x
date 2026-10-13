import { useState, useMemo } from "react";
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
} from "lucide-react";
import Background from "../../components/background";
import ProviderNavbar from "../../components/navbar/providernavbar";

// Category images from src/assets/images
import pendingOrdersImg from "../../assets/images/pending_orders_4k.png";
import cancelledOrdersImg from "../../assets/images/cancelled_4k.png";
import deliveredOrdersImg from "../../assets/images/delivered_4k.png";
import allOrdersImg from "../../assets/images/all_orders_4k.png";

// Realistic boardroom / workspace sample photos matching the user screenshot
const MEETING_ROOM_IMG =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80";
const WORKSPACE_IMG =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80";
const OFFICE_IMG =
  "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80";

export interface ProviderLocation {
  id: string;
  name: string;
  badgeCount?: number; // e.g. 12
  isRedBadge?: boolean;
  image: string;
  totalSeats: number;
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

// Initial Admin Created Locations matching screenshot
const initialLocations: ProviderLocation[] = [
  {
    id: "1",
    name: "Meeting Room",
    image: MEETING_ROOM_IMG,
    totalSeats: 10,
  },
  {
    id: "2",
    name: "Workspace",
    badgeCount: 12,
    isRedBadge: true,
    image: WORKSPACE_IMG,
    totalSeats: 12,
  },
  {
    id: "3",
    name: "office",
    badgeCount: 10,
    image: OFFICE_IMG,
    totalSeats: 10,
  },
];

// Initial mock orders for Provider fulfillment
const initialOrders: ProviderOrder[] = [
  {
    id: "#ORD-1001",
    seat: "03",
    locationName: "Workspace",
    employeeName: "Arjun Kumar",
    items: [
      { name: "Coffee", qty: 2, price: 20 },
      { name: "Veg Sandwich", qty: 1, price: 60 },
    ],
    total: 100,
    time: "2 mins ago",
    status: "Pending",
  },
  {
    id: "#ORD-1002",
    seat: "07",
    locationName: "Meeting Room",
    employeeName: "Priya Sharma",
    items: [
      { name: "Tea", qty: 3, price: 15 },
      { name: "Samosa", qty: 3, price: 20 },
    ],
    total: 105,
    time: "5 mins ago",
    status: "Pending",
  },
  {
    id: "#ORD-1003",
    seat: "05",
    locationName: "Workspace",
    employeeName: "Vikram Singh",
    items: [{ name: "Cappuccino", qty: 1, price: 30 }],
    total: 30,
    time: "12 mins ago",
    status: "Preparing",
  },
  {
    id: "#ORD-1004",
    seat: "02",
    locationName: "office",
    employeeName: "Sneha Reddy",
    items: [
      { name: "Cold Coffee", qty: 1, price: 40 },
      { name: "French Fries", qty: 1, price: 50 },
    ],
    total: 90,
    time: "18 mins ago",
    status: "Pending",
  },
];

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

  // Live order updates by provider
  const [orders, setOrders] = useState<ProviderOrder[]>(initialOrders);

  // Sync locations from localStorage if admin created any in Admin Location page
  const locations = useMemo(() => {
    try {
      const stored = localStorage.getItem("cafe4x_locations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((loc: any, idx: number) => ({
            id: String(loc.id || idx),
            name: loc.name || "Location",
            badgeCount: loc.totalSeats || 10,
            isRedBadge: idx % 2 === 1,
            image: idx % 2 === 0 ? MEETING_ROOM_IMG : WORKSPACE_IMG,
            totalSeats: loc.totalSeats || 10,
          }));
        }
      }
    } catch {
      // fallback to initialLocations
    }
    return initialLocations;
  }, []);

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
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
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
                            className={`flex h-14 items-center justify-center px-4 transition-colors ${
                              isRed
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
                                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                                    isRed
                                      ? "bg-[#8B1D27] text-white"
                                      : "bg-[#70452D] text-white"
                                  }`}
                                >
                                  {loc.badgeCount}
                                </span>
                              )}
                            </div>
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

            {/* VIEW 2: LOCATION 4 CATEGORIES (EXACT USER SCREENSHOT) */}
            {activeTab === "provider" && selectedLocation && (
              <div>
                {/* Top Row with Back Button matching screenshot */}
                <div className="mb-10 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedLocation(null)}
                    title="Back to Locations"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B38E74] text-white shadow-md transition duration-200 hover:scale-105 hover:bg-[#9E785F]"
                  >
                    <ArrowLeft size={20} className="stroke-[2.5]" />
                  </button>
                </div>

                {/* The 4 Category Cards (Matching User Screenshot) */}
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
                  {(["pending", "canceled", "delivered", "all"] as OrderCategory[]).map(
                    (catKey) => {
                      const item = categoryDetails[catKey];

                      return (
                        <div
                          key={catKey}
                          className="group flex w-[230px] sm:w-[250px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#DEC5B0]/70 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
                        >
                          {/* Top Graphic Illustration Box showing images from image folder */}
                          <div className="flex h-48 w-full items-center justify-center bg-white p-5 transition group-hover:scale-105 duration-300">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="h-36 w-36 object-contain drop-shadow-sm select-none"
                            />
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
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              order.status === "Pending"
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
