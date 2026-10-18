import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  Armchair,
  Coffee,
  Sun,
  Moon,
  Calendar,
  X,
  Inbox,
  Edit3,
  Trash2,
  AlertCircle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Package,
  Layers,
  Filter,
} from "lucide-react";
import Background from "../../components/background";
import ProviderNavbar from "../../components/navbar/providernavbar";
import { orderApi, type ProviderOrder } from "../../services/orders";

export default function PendingOrdersPage() {
  const params = useParams();
  const shortCode = params.shortCode || "";

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "morning" | "evening">("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  // Pagination states
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Orders state
  const [orders, setOrders] = useState<ProviderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Live session clock
  const [currentLiveTime, setCurrentLiveTime] = useState<string>(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });
  const [currentLiveSession, setCurrentLiveSession] = useState<"morning" | "evening">(() => {
    return new Date().getHours() < 12 ? "morning" : "evening";
  });
  const [todayDateString, setTodayDateString] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Edit / Update Modal
  const [editingOrder, setEditingOrder] = useState<ProviderOrder | null>(null);
  const [editAdjustmentAmount, setEditAdjustmentAmount] = useState<string>("0");
  const [editDiscount, setEditDiscount] = useState<string>("0");
  const [editSeat, setEditSeat] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStatus, setEditStatus] = useState<ProviderOrder["status"]>("Pending");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Cancel Confirmation Modal
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<ProviderOrder | null>(null);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  // Mark Delivered Confirmation Modal
  const [deliverConfirmOrder, setDeliverConfirmOrder] = useState<ProviderOrder | null>(null);
  const [isDeliveringOrder, setIsDeliveringOrder] = useState(false);

  // Selected order details drawer
  const [selectedOrder, setSelectedOrder] = useState<ProviderOrder | null>(null);

  // Fetch orders from backend with todayOnly=true and scoped permissions
  const fetchOrders = () => {
    orderApi
      .getOrders({ todayOnly: true })
      .then((serverOrders) => {
        if (Array.isArray(serverOrders)) {
          // Keep only pending statuses: Pending, Preparing, Ready
          const pendingOnly = serverOrders.filter(
            (o) => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready"
          );
          setOrders(pendingOnly);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch pending orders from backend:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Clock timer & auto-midnight refresh
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentLiveTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentLiveSession(now.getHours() < 12 ? "morning" : "evening");

      const nowDateStr = now.toISOString().slice(0, 10);
      if (nowDateStr !== todayDateString) {
        setTodayDateString(nowDateStr);
        fetchOrders();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [todayDateString]);

  // Initial fetch and 4s polling
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Time & session helpers
  const getDisplayTime = (order: ProviderOrder): string => {
    if (order.createdAt) {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }
    if (order.time && order.time.toLowerCase() !== "just now") {
      return order.time;
    }
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const getOrderSession = (order: ProviderOrder): "morning" | "evening" => {
    if (order.createdAt) {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) {
        return d.getHours() < 12 ? "morning" : "evening";
      }
    }
    if (order.time?.toLowerCase().includes("pm")) {
      const match = order.time.match(/(\d+):/);
      if (match && parseInt(match[1], 10) !== 12) return "evening";
    }
    if (order.time?.toLowerCase().includes("am")) return "morning";
    return new Date().getHours() < 12 ? "morning" : "evening";
  };

  // Unique locations from pending orders
  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.locationName) set.add(o.locationName);
    });
    return Array.from(set);
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Session filter
      if (sessionFilter !== "all" && getOrderSession(o) !== sessionFilter) {
        return false;
      }
      // Location filter
      if (locationFilter !== "all" && o.locationName?.toLowerCase() !== locationFilter.toLowerCase()) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = (o.displayId || o.id).toLowerCase().includes(q);
        const matchEmp = o.employeeName.toLowerCase().includes(q);
        const matchSeat = o.seat.toLowerCase().includes(q);
        const matchLoc = o.locationName.toLowerCase().includes(q);
        const matchItem = o.items?.some((it) => it.name.toLowerCase().includes(q));
        return matchId || matchEmp || matchSeat || matchLoc || matchItem;
      }
      return true;
    });
  }, [orders, sessionFilter, locationFilter, searchQuery]);

  // Pagination calculations
  const totalRecords = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, validPage, pageSize]);

  // Total Monetary summary for filtered pending orders
  const { totalSubtotal, totalAdjustments, totalDiscounts, totalNet } = useMemo(() => {
    let sub = 0;
    let adj = 0;
    let disc = 0;
    let net = 0;

    filteredOrders.forEach((o) => {
      const orderSub = o.subtotal !== undefined
        ? Number(o.subtotal)
        : (o.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || Number(o.total) || 0);
      const orderAdj = Number(o.adjustmentAmount) || 0;
      const orderDisc = Number(o.discount) || 0;
      const orderNet = o.total !== undefined ? Number(o.total) : Math.max(0, orderSub + orderAdj - orderDisc);

      sub += orderSub;
      adj += orderAdj;
      disc += orderDisc;
      net += orderNet;
    });

    return { totalSubtotal: sub, totalAdjustments: adj, totalDiscounts: disc, totalNet: net };
  }, [filteredOrders]);

  // Handlers for individual actions
  const handleOpenEdit = (order: ProviderOrder) => {
    setEditingOrder(order);
    setEditAdjustmentAmount(String(order.adjustmentAmount !== undefined ? order.adjustmentAmount : 0));
    setEditDiscount(String(order.discount !== undefined ? order.discount : 0));
    setEditSeat(order.seat || "");
    setEditNotes(order.notes || "");
    setEditStatus(order.status || "Pending");
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    const adj = parseFloat(editAdjustmentAmount);
    const disc = parseFloat(editDiscount);
    if (isNaN(adj)) {
      alert("Please enter a valid numeric adjustment amount (e.g. 10 or -10).");
      return;
    }
    if (isNaN(disc) || disc < 0) {
      alert("Please enter a valid discount amount (0 or positive).");
      return;
    }

    const subtotal = editingOrder.subtotal !== undefined
      ? editingOrder.subtotal
      : (editingOrder.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || editingOrder.total);
    const calculatedTotal = Math.max(0, subtotal + adj - disc);

    setIsSavingEdit(true);
    try {
      await orderApi.updateOrder(editingOrder.id, {
        adjustmentAmount: adj,
        discount: disc,
        total: calculatedTotal,
        seat: editSeat.trim() || editingOrder.seat,
        notes: editNotes.trim(),
        status: editStatus,
      });

      // Update state
      if (editStatus === "Delivered" || editStatus === "Canceled") {
        setOrders((prev) => prev.filter((o) => o.id !== editingOrder.id));
        if (selectedOrder?.id === editingOrder.id) setSelectedOrder(null);
      } else {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === editingOrder.id) {
              return {
                ...o,
                adjustmentAmount: adj,
                discount: disc,
                total: calculatedTotal,
                seat: editSeat.trim() || editingOrder.seat,
                notes: editNotes.trim(),
                status: editStatus,
                updatedAt: new Date().toISOString(),
              };
            }
            return o;
          })
        );
        if (selectedOrder?.id === editingOrder.id) {
          setSelectedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  adjustmentAmount: adj,
                  discount: disc,
                  total: calculatedTotal,
                  seat: editSeat.trim() || prev.seat,
                  notes: editNotes.trim(),
                  status: editStatus,
                }
              : null
          );
        }
      }
      setEditingOrder(null);
    } catch (err: any) {
      console.error("Failed to update order:", err);
      alert("Could not save order updates: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeliver = async () => {
    if (!deliverConfirmOrder) return;
    setIsDeliveringOrder(true);
    try {
      await orderApi.updateStatus(deliverConfirmOrder.id, "Delivered");
      setOrders((prev) => prev.filter((o) => o.id !== deliverConfirmOrder.id));
      if (selectedOrder?.id === deliverConfirmOrder.id) setSelectedOrder(null);
      setDeliverConfirmOrder(null);
    } catch (err: any) {
      console.error("Failed to deliver order:", err);
      setOrders((prev) => prev.filter((o) => o.id !== deliverConfirmOrder.id));
      setDeliverConfirmOrder(null);
    } finally {
      setIsDeliveringOrder(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmOrder) return;
    setIsCancellingOrder(true);
    try {
      await orderApi.updateStatus(cancelConfirmOrder.id, "Canceled");
      setOrders((prev) => prev.filter((o) => o.id !== cancelConfirmOrder.id));
      if (selectedOrder?.id === cancelConfirmOrder.id) setSelectedOrder(null);
      setCancelConfirmOrder(null);
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      setOrders((prev) => prev.filter((o) => o.id !== cancelConfirmOrder.id));
      setCancelConfirmOrder(null);
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleStatusProgress = async (order: ProviderOrder, nextStatus: ProviderOrder["status"]) => {
    try {
      await orderApi.updateStatus(order.id, nextStatus);
      if (nextStatus === "Delivered" || nextStatus === "Canceled") {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        if (selectedOrder?.id === order.id) setSelectedOrder(null);
      } else {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
        }
      }
    } catch (err) {
      console.error("Failed status progress:", err);
    }
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col font-sans pt-20">
        {/* Provider Navigation Bar with active pendingOrders badge */}
        <ProviderNavbar activeTab="pendingOrders" pendingOrdersCount={orders.length} />

        <main className="flex-1 px-4 py-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Top Header Card */}
            <div className="flex flex-col gap-4 rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7D533D] to-[#593A28] text-white shadow-md">
                    <Package size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#342219]">My Pending Orders</h2>
                    <p className="text-xs text-[#8A7667]">
                      Real-time queue for today ({new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}) &bull; Live dispatch
                    </p>
                  </div>
                </div>
              </div>

              {/* Status / Live clock pills */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs border ${
                    currentLiveSession === "morning"
                      ? "bg-amber-50 text-amber-900 border-amber-200"
                      : "bg-indigo-50 text-indigo-900 border-indigo-200"
                  }`}
                >
                  {currentLiveSession === "morning" ? (
                    <Sun size={13} className="text-amber-600 animate-spin" style={{ animationDuration: "12s" }} />
                  ) : (
                    <Moon size={13} className="text-indigo-600" />
                  )}
                  <span>{currentLiveSession === "morning" ? "Morning Session" : "Evening Session"}</span>
                </span>

                <span className="font-mono text-xs font-bold text-[#754329] bg-[#FAF6F1] px-3 py-1 rounded-xl border border-[#E8DED4]">
                  Live: {currentLiveTime}
                </span>

                <Link
                  to={shortCode ? `/${shortCode}/provider` : "/provider"}
                  className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-3.5 py-1.5 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1] shadow-2xs cursor-pointer"
                >
                  <Layers size={14} />
                  <span>Locations View</span>
                </Link>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A7667]">Pending Orders</span>
                <p className="mt-1 text-2xl font-black text-[#754329]">{filteredOrders.length}</p>
                <span className="text-[10px] text-stone-500">Awaiting kitchen service</span>
              </div>

              <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A7667]">Original Subtotal</span>
                <p className="mt-1 text-2xl font-black text-stone-900">₹ {totalSubtotal.toFixed(2)}</p>
                <span className="text-[10px] text-stone-500">Total base item value</span>
              </div>

              <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A7667]">Net Adjustments</span>
                <p className={`mt-1 text-2xl font-black ${totalAdjustments >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {totalAdjustments >= 0 ? `+ ₹ ${totalAdjustments.toFixed(2)}` : `- ₹ ${Math.abs(totalAdjustments).toFixed(2)}`}
                </p>
                <span className="text-[10px] text-stone-500">Discounts: - ₹ {totalDiscounts.toFixed(2)}</span>
              </div>

              <div className="rounded-2xl border border-[#DEC5B0] bg-gradient-to-br from-[#FAF6F1] to-[#F5ECE1] p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#754329]">Final Net Total</span>
                <p className="mt-1 text-2xl font-black text-[#28A745]">₹ {totalNet.toFixed(2)}</p>
                <span className="text-[10px] font-medium text-stone-600">Receivable amount</span>
              </div>
            </div>

            {/* Filters & Search Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#EEE5DC] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by order ID, employee, seat, or items..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAF8F5] py-2 pl-9 pr-3 text-xs text-gray-800 outline-none transition placeholder-gray-400 focus:border-[#8C5835] focus:bg-white focus:ring-1 focus:ring-[#8C5835]/20"
                />
              </div>

              {/* Session Filter Pills + Location Filter Dropdown */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Location Filter */}
                {availableLocations.length > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Filter size={13} className="text-[#8C5835]" />
                    <select
                      value={locationFilter}
                      onChange={(e) => {
                        setLocationFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="rounded-xl border border-gray-200 bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-[#593A28] outline-none"
                    >
                      <option value="all">All Locations</option>
                      {availableLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Session Filter */}
                <div className="flex items-center rounded-xl bg-[#FAF8F5] p-1 border border-[#DEC5B0]">
                  <button
                    type="button"
                    onClick={() => {
                      setSessionFilter("all");
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      sessionFilter === "all" ? "bg-[#754329] text-white shadow-2xs" : "text-[#70523E] hover:bg-white"
                    }`}
                  >
                    <Calendar size={12} />
                    <span>All Today</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionFilter("morning");
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      sessionFilter === "morning" ? "bg-amber-600 text-white shadow-2xs" : "text-[#70523E] hover:bg-white"
                    }`}
                  >
                    <Sun size={12} />
                    <span>Morning</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionFilter("evening");
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      sessionFilter === "evening" ? "bg-indigo-600 text-white shadow-2xs" : "text-[#70523E] hover:bg-white"
                    }`}
                  >
                    <Moon size={12} />
                    <span>Evening</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Orders Table & Drawer Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* TABLE CONTAINER */}
              <div className={`flex flex-col transition-all duration-300 ${selectedOrder ? "lg:col-span-8" : "lg:col-span-12"}`}>
                <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#EEE5DC] bg-[#FAF8F5] text-[#704225]">
                        <tr>
                          <th className="px-4 py-3.5 font-bold">Order ID</th>
                          <th className="px-4 py-3.5 font-bold">Time / Session</th>
                          <th className="px-4 py-3.5 font-bold">Employee</th>
                          <th className="px-4 py-3.5 font-bold">Location & Seat</th>
                          <th className="px-4 py-3.5 font-bold">Items & Qty</th>
                          <th className="px-3 py-3.5 font-bold text-right">Subtotal</th>
                          <th className="px-3 py-3.5 font-bold text-right">Adj / Disc</th>
                          <th className="px-4 py-3.5 font-bold text-right">Net Amount</th>
                          <th className="px-3 py-3.5 font-bold text-center">Status</th>
                          <th className="px-4 py-3.5 font-bold text-center">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#F5EFE8] text-gray-700">
                        {isLoading ? (
                          <tr>
                            <td colSpan={10} className="py-14 text-center text-xs text-gray-500">
                              <div className="flex items-center justify-center gap-2">
                                <span className="h-4 w-4 rounded-full border-2 border-[#754329] border-t-transparent animate-spin" />
                                <span>Loading today's pending orders...</span>
                              </div>
                            </td>
                          </tr>
                        ) : paginatedOrders.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-16 text-center text-xs text-gray-500">
                              <Inbox className="mx-auto mb-2 h-10 w-10 text-[#A08C7D] stroke-1" />
                              <p className="font-semibold text-gray-800">No pending orders found</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Orders placed by employees will appear here in real-time.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          paginatedOrders.map((order) => {
                            const isSelected = selectedOrder?.id === order.id;
                            const session = getOrderSession(order);
                            const totalQty = order.items?.reduce((s, it) => s + (Number(it.qty) || 1), 0) || 1;
                            const subtotal = order.subtotal !== undefined
                              ? Number(order.subtotal)
                              : (order.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || Number(order.total) || 0);
                            const adj = Number(order.adjustmentAmount) || 0;
                            const disc = Number(order.discount) || 0;
                            const netTotal = order.total !== undefined ? Number(order.total) : Math.max(0, subtotal + adj - disc);

                            return (
                              <tr
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={`cursor-pointer transition duration-150 hover:bg-[#FAF6F2] ${
                                  isSelected ? "bg-[#FAF4ED] border-l-4 border-l-[#754329]" : ""
                                }`}
                              >
                                {/* Order ID */}
                                <td className="px-4 py-3.5 font-mono font-bold text-[#754329] whitespace-nowrap">
                                  {order.displayId || order.id}
                                </td>

                                {/* Time / Session */}
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-stone-900">{getDisplayTime(order)}</span>
                                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                                      {session === "morning" ? <Sun size={10} className="text-amber-500" /> : <Moon size={10} className="text-indigo-500" />}
                                      <span>{session === "morning" ? "Morning" : "Evening"}</span>
                                    </span>
                                  </div>
                                </td>

                                {/* Employee */}
                                <td className="px-4 py-3.5 font-semibold text-stone-900 whitespace-nowrap">
                                  {order.employeeName}
                                </td>

                                {/* Location & Seat */}
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-stone-800">{order.locationName}</span>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-[#754329] font-bold">
                                      <Armchair size={11} /> Seat {order.seat}
                                    </span>
                                  </div>
                                </td>

                                {/* Items & Qty */}
                                <td className="px-4 py-3.5 max-w-[200px]">
                                  <div className="truncate text-stone-800 font-medium">
                                    {order.items?.map((it) => `${it.name} (${it.qty})`).join(", ") || "Order Items"}
                                  </div>
                                  <span className="text-[10px] text-stone-500 font-semibold">Total Qty: {totalQty}</span>
                                </td>

                                {/* Subtotal */}
                                <td className="px-3 py-3.5 text-right font-medium text-stone-800 whitespace-nowrap">
                                  ₹ {subtotal.toFixed(2)}
                                </td>

                                {/* Adjustment / Discount */}
                                <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                  <div className="flex flex-col text-[11px]">
                                    <span className={`font-semibold ${adj > 0 ? "text-emerald-700" : adj < 0 ? "text-rose-700" : "text-stone-400"}`}>
                                      {adj !== 0 ? (adj > 0 ? `+₹${adj.toFixed(2)}` : `-₹${Math.abs(adj).toFixed(2)}`) : "₹0.00"}
                                    </span>
                                    {disc > 0 && <span className="text-rose-600 font-semibold">-₹{disc.toFixed(2)}</span>}
                                  </div>
                                </td>

                                {/* Final Net Amount */}
                                <td className="px-4 py-3.5 text-right font-black text-sm text-[#28A745] whitespace-nowrap">
                                  ₹ {netTotal.toFixed(2)}
                                </td>

                                {/* Status */}
                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-2xs ${
                                      order.status === "Pending"
                                        ? "bg-blue-100 text-blue-800"
                                        : order.status === "Preparing"
                                        ? "bg-amber-100 text-amber-800"
                                        : order.status === "Ready"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {order.status === "Pending" ? "New" : order.status}
                                  </span>
                                </td>

                                {/* Actions: Update, Delivered, Cancel */}
                                <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Update button */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(order)}
                                      title="Update order details and adjustment amount"
                                      className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-[11px] font-bold text-stone-700 hover:bg-stone-50 transition shadow-2xs cursor-pointer"
                                    >
                                      <Edit3 size={12} />
                                      <span>Update</span>
                                    </button>

                                    {/* Delivered button */}
                                    <button
                                      type="button"
                                      onClick={() => setDeliverConfirmOrder(order)}
                                      title="Mark order delivered"
                                      className="flex items-center gap-1 rounded-lg bg-[#28A745] px-2 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[#218838] transition cursor-pointer"
                                    >
                                      <CheckCircle2 size={12} />
                                      <span>Delivered</span>
                                    </button>

                                    {/* Cancel button */}
                                    <button
                                      type="button"
                                      onClick={() => setCancelConfirmOrder(order)}
                                      title="Cancel order"
                                      className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                                    >
                                      <Trash2 size={12} />
                                      <span>Cancel</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-[#EEE5DC] bg-[#FAF8F5] px-5 py-3 sm:flex-row text-xs text-[#70523E]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-600">Rows per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 font-medium text-xs text-[#70523E] outline-none"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>

                      <button
                        type="button"
                        disabled={validPage <= 1}
                        onClick={() => setCurrentPage(1)}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="First Page"
                      >
                        <ChevronsLeft size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={validPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous Page"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className="rounded border border-stone-300 bg-white px-2.5 py-1 font-bold">
                        {validPage}
                      </span>
                      <span>of {totalPages}</span>

                      <button
                        type="button"
                        disabled={validPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next Page"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={validPage >= totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Last Page"
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 font-medium italic">
                      <span>Total Pending Records:</span>
                      <span className="rounded bg-[#007BFF] px-2 py-0.5 not-italic font-bold text-white">
                        {totalRecords}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT DRAWER: SELECTED ORDER DETAILS */}
              {selectedOrder && (
                <div className="flex flex-col rounded-2xl border border-[#DEC5B0] bg-white p-6 shadow-md lg:col-span-4 h-fit">
                  <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-4">
                    <div>
                      <h3 className="text-base font-bold text-[#342219]">Order Details</h3>
                      <p className="text-xs font-mono font-bold text-[#754329]">{selectedOrder.displayId || selectedOrder.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Customer Info */}
                  <div className="py-4 space-y-2 border-b border-[#F0E6DB] text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Customer:</span>
                      <span className="font-bold text-stone-900">{selectedOrder.employeeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Location:</span>
                      <span className="font-semibold text-stone-800">{selectedOrder.locationName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Seat Number:</span>
                      <span className="font-bold text-[#754329]">Seat {selectedOrder.seat}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Order Time:</span>
                      <span className="font-medium text-stone-800">{getDisplayTime(selectedOrder)}</span>
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="py-4 border-b border-[#F0E6DB] space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#754329]">Ordered Items</span>
                    <div className="space-y-2">
                      {selectedOrder.items?.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] p-2.5 text-xs border border-[#EEE5DC]">
                          <div className="flex items-center gap-2">
                            <Coffee size={15} className="text-[#754329]" />
                            <div>
                              <p className="font-bold text-stone-900">{it.name}</p>
                              <span className="text-[10px] text-stone-500">₹{it.price} each</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-stone-900">&times; {it.qty}</span>
                            <p className="text-xs font-black text-[#754329]">₹{(it.price * it.qty).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="py-4 space-y-1.5 text-xs border-b border-[#F0E6DB]">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal:</span>
                      <span className="font-medium">
                        ₹{" "}
                        {(
                          selectedOrder.subtotal !== undefined
                            ? selectedOrder.subtotal
                            : selectedOrder.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || selectedOrder.total
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-800">
                      <span>Adjustment Amount:</span>
                      <span className="font-bold">
                        {(Number(selectedOrder.adjustmentAmount) || 0) >= 0 ? "+" : ""}
                        ₹ {(Number(selectedOrder.adjustmentAmount) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>Discount:</span>
                      <span className="font-bold">- ₹ {(Number(selectedOrder.discount) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm text-stone-900 pt-2 border-t border-[#F0E6DB]">
                      <span>Final Net Total:</span>
                      <span className="text-[#28A745]">₹ {selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions in Drawer */}
                  <div className="pt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(selectedOrder)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition shadow-2xs cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Update Adjustment & Details</span>
                    </button>

                    {selectedOrder.status === "Pending" && (
                      <button
                        type="button"
                        onClick={() => handleStatusProgress(selectedOrder, "Preparing")}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#754329] py-2 text-xs font-bold text-white shadow-md hover:bg-[#5f351f] transition cursor-pointer"
                      >
                        <span>Mark Preparing</span>
                      </button>
                    )}

                    {selectedOrder.status === "Preparing" && (
                      <button
                        type="button"
                        onClick={() => handleStatusProgress(selectedOrder, "Ready")}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#28A745] py-2 text-xs font-bold text-white shadow-md hover:bg-[#218838] transition cursor-pointer"
                      >
                        <span>Mark Order Ready</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeliverConfirmOrder(selectedOrder)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#007BFF] py-2 text-xs font-bold text-white shadow-md hover:bg-[#0056b3] transition cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>Mark Delivered</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCancelConfirmOrder(selectedOrder)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Cancel Order</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ========================================================
            INDIVIDUAL ORDER UPDATE / EDIT MODAL
           ======================================================== */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-[#754329] px-6 py-4 text-white">
                <div className="flex items-center gap-2">
                  <Edit3 size={18} />
                  <h3 className="text-base font-bold text-white">
                    Update Order #{editingOrder.displayId || editingOrder.id}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Customer</label>
                    <input
                      type="text"
                      readOnly
                      value={editingOrder.employeeName}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-stone-600 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Seat Number</label>
                    <input
                      type="text"
                      value={editSeat}
                      onChange={(e) => setEditSeat(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 font-medium focus:border-[#754329] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Original Subtotal (₹)</label>
                  <input
                    type="text"
                    readOnly
                    value={`₹ ${(
                      editingOrder.subtotal !== undefined
                        ? editingOrder.subtotal
                        : editingOrder.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || editingOrder.total
                    ).toFixed(2)}`}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-stone-600 font-semibold"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block font-bold text-stone-700">Adjustment Amount (₹)</label>
                    <span className="text-[10px] text-stone-500">e.g. 10 or -10</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={editAdjustmentAmount}
                    onChange={(e) => setEditAdjustmentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 font-semibold focus:border-[#754329] outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block font-bold text-stone-700">Discount (₹)</label>
                    <span className="text-[10px] text-stone-500">Positive value</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 font-semibold focus:border-[#754329] outline-none"
                  />
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex justify-between items-center">
                  <span className="font-bold text-emerald-900">Recalculated Net Amount:</span>
                  <span className="font-black text-sm text-[#28A745]">
                    ₹{" "}
                    {Math.max(
                      0,
                      (editingOrder.subtotal !== undefined
                        ? editingOrder.subtotal
                        : editingOrder.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || editingOrder.total) +
                        (parseFloat(editAdjustmentAmount) || 0) -
                        (parseFloat(editDiscount) || 0)
                    ).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Order Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 font-medium focus:border-[#754329] outline-none"
                  >
                    <option value="Pending">Pending (New)</option>
                    <option value="Preparing">Preparing</option>
                    <option value="Ready">Ready</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Canceled">Canceled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Special Instructions / Notes</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Special requests or instructions..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#754329]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={handleSaveEdit}
                  className="rounded-xl bg-[#754329] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#5f351f] transition disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            DELIVER CONFIRMATION MODAL
           ======================================================== */}
        {deliverConfirmOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xl text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                Mark Order #{deliverConfirmOrder.displayId || deliverConfirmOrder.id} Delivered?
              </h3>
              <p className="mt-2 text-xs text-stone-600">
                Confirm delivery to <span className="font-semibold text-stone-900">{deliverConfirmOrder.employeeName}</span> at Seat {deliverConfirmOrder.seat}?
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeliveringOrder}
                  onClick={() => setDeliverConfirmOrder(null)}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeliveringOrder}
                  onClick={handleConfirmDeliver}
                  className="rounded-xl bg-[#28A745] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#218838] disabled:opacity-50"
                >
                  {isDeliveringOrder ? "Updating..." : "Yes, Mark Delivered"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            CANCEL CONFIRMATION MODAL
           ======================================================== */}
        {cancelConfirmOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                Cancel Order #{cancelConfirmOrder.displayId || cancelConfirmOrder.id}?
              </h3>
              <p className="mt-2 text-xs text-stone-600">
                Are you sure you want to cancel the order for{" "}
                <span className="font-semibold text-stone-900">{cancelConfirmOrder.employeeName}</span> at Seat {cancelConfirmOrder.seat}?
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={() => setCancelConfirmOrder(null)}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={handleConfirmCancel}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
                >
                  {isCancellingOrder ? "Cancelling..." : "Yes, Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Background>
  );
}
