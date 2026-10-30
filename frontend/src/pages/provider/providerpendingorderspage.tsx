import { formatProviderOrderId } from "../../utils/providerOrderFormatter";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun,
  Moon,
  Calendar,
  Sparkles,
  PieChart,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  Coffee,
} from "lucide-react";
import Background from "../../components/background";
import ProviderNavbar from "../../components/navbar/providernavbar";
import { orderApi, type ProviderOrder } from "../../services/orders";
import { itemsApi } from "../../services/items";

export default function ProviderPendingOrdersPage() {
  const navigate = useNavigate();

  // Session Filter State: "all" | "morning" | "evening"
  const [pendingSessionFilter, setPendingSessionFilter] = useState<"all" | "morning" | "evening">("all");

  // Pagination for Pending Orders
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(12);

  // Live session and clock
  const [currentLiveSession, setCurrentLiveSession] = useState<"morning" | "evening">(() => {
    return new Date().getHours() < 12 ? "morning" : "evening";
  });
  const [currentLiveTime, setCurrentLiveTime] = useState<string>(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });
  const [todayDateString, setTodayDateString] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Modal states
  const [isPendingSummaryModalOpen, setIsPendingSummaryModalOpen] = useState(false);
  const [selectedPendingOrderIds, setSelectedPendingOrderIds] = useState<string[]>([]);
  const [expandedSummaryItems, setExpandedSummaryItems] = useState<Record<string, boolean>>({});
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{ action: "Delivered" | "Canceled"; count: number } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Edit / Cancel modal states
  const [editingOrder, setEditingOrder] = useState<ProviderOrder | null>(null);
  const [editAdjustmentAmount, setEditAdjustmentAmount] = useState<string>("0");
  const [editDiscount, setEditDiscount] = useState<string>("0");
  const [editSeat, setEditSeat] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStatus, setEditStatus] = useState<ProviderOrder["status"]>("Pending");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<ProviderOrder | null>(null);
  const [isCancellingOrder, setIsCancellingOrder] = useState<boolean>(false);

  // Item images map
  const [itemImagesMap, setItemImagesMap] = useState<Record<string, string>>({});

  // Orders State with localStorage cache & real-time polling
  const [orders, setOrders] = useState<ProviderOrder[]>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_provider_orders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((o: any) => o.locationName?.toLowerCase() !== "meeting room");
        }
      }
    } catch {}
    return [];
  });

  const saveOrders = (newOrders: ProviderOrder[]) => {
    setOrders(newOrders);
    try {
      localStorage.setItem("cafe4x_provider_orders", JSON.stringify(newOrders));
    } catch {}
  };

  // Helper to determine if an order date is today
  const isOrderFromToday = (order: ProviderOrder) => {
    if (!order.createdAt) return true;
    const orderDate = new Date(order.createdAt);
    if (isNaN(orderDate.getTime())) return true;
    const now = new Date();
    return (
      orderDate.getFullYear() === now.getFullYear() &&
      orderDate.getMonth() === now.getMonth() &&
      orderDate.getDate() === now.getDate()
    );
  };

  // Helper to determine an order's session
  const getOrderSession = (order: ProviderOrder): "morning" | "evening" => {
    if (order.createdAt) {
      const orderDate = new Date(order.createdAt);
      if (!isNaN(orderDate.getTime())) {
        return orderDate.getHours() < 12 ? "morning" : "evening";
      }
    }
    if (order.time && order.time.toLowerCase().includes("pm")) {
      const match = order.time.match(/(\d+):/);
      if (match) {
        const hour = parseInt(match[1], 10);
        if (hour !== 12) return "evening";
      }
    }
    if (order.time && order.time.toLowerCase().includes("am")) {
      return "morning";
    }
    return new Date().getHours() < 12 ? "morning" : "evening";
  };

  const getDisplayOrderTime = (order: ProviderOrder): string => {
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

  // Fetch orders from backend
  const fetchOrdersFromBackend = () => {
    orderApi
      .getOrders()
      .then((serverOrders) => {
        if (Array.isArray(serverOrders)) {
          setOrders(serverOrders);
          try {
            localStorage.setItem("cafe4x_provider_orders", JSON.stringify(serverOrders));
          } catch {}
        }
      })
      .catch(() => {
        try {
          const stored = localStorage.getItem("cafe4x_provider_orders");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) setOrders(parsed);
          }
        } catch {}
      });
  };

  // Live timer & storage listener
  useEffect(() => {
    fetchOrdersFromBackend();

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentLiveTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentLiveSession(now.getHours() < 12 ? "morning" : "evening");

      const nowDateString = now.toISOString().slice(0, 10);
      if (nowDateString !== todayDateString) {
        setTodayDateString(nowDateString);
        fetchOrdersFromBackend();
      }
    }, 1000);

    const poll = setInterval(() => {
      fetchOrdersFromBackend();
    }, 3000);

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

    return () => {
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener("storage", handleStorage);
    };
  }, [todayDateString]);

  // Load menu item images
  useEffect(() => {
    itemsApi
      .getItems()
      .then((res) => {
        if (Array.isArray(res)) {
          const map: Record<string, string> = {};
          res.forEach((it) => {
            if (it.name && it.image) {
              map[it.name.toLowerCase().trim()] = it.image;
            }
          });
          setItemImagesMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Update order status
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: "Preparing" | "Ready" | "Delivered" | "Canceled"
  ) => {
    const nextOrders = orders.map((o) =>
      o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o
    );
    saveOrders(nextOrders);

    try {
      await orderApi.updateStatus(orderId, newStatus);
    } catch (err) {
      console.warn("Could not sync order status to server:", err);
    }
  };

  // Open Edit Order Modal
  const handleOpenEditOrder = (order: ProviderOrder) => {
    setEditingOrder(order);
    setEditAdjustmentAmount(String(order.adjustmentAmount !== undefined ? order.adjustmentAmount : 0));
    setEditDiscount(String(order.discount !== undefined ? order.discount : 0));
    setEditSeat(order.seat || "");
    setEditNotes(order.notes || "");
    setEditStatus(order.status || "Pending");
  };

  // Save Edit Order
  const handleSaveOrderEdit = async () => {
    if (!editingOrder) return;
    const adj = parseFloat(editAdjustmentAmount);
    const disc = parseFloat(editDiscount);
    if (isNaN(adj)) {
      alert("Please enter a valid adjustment amount.");
      return;
    }
    if (isNaN(disc) || disc < 0) {
      alert("Please enter a valid discount amount (0 or positive).");
      return;
    }

    const subtotal =
      editingOrder.subtotal !== undefined
        ? editingOrder.subtotal
        : editingOrder.items?.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) ||
          editingOrder.total;
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

      const nextOrders = orders.map((o) => {
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
      });
      saveOrders(nextOrders);
      setEditingOrder(null);
    } catch (err: any) {
      console.error("Failed to update order:", err);
      alert("Failed to update order in database: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Execute Individual Cancel
  const handleConfirmCancelOrder = async () => {
    if (!cancelConfirmOrder) return;
    setIsCancellingOrder(true);
    try {
      await orderApi.updateStatus(cancelConfirmOrder.id, "Canceled");
      const nextOrders = orders.map((o) =>
        o.id === cancelConfirmOrder.id
          ? { ...o, status: "Canceled" as const, updatedAt: new Date().toISOString() }
          : o
      );
      saveOrders(nextOrders);
      setCancelConfirmOrder(null);
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      const nextOrders = orders.map((o) =>
        o.id === cancelConfirmOrder.id
          ? { ...o, status: "Canceled" as const, updatedAt: new Date().toISOString() }
          : o
      );
      saveOrders(nextOrders);
      setCancelConfirmOrder(null);
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Execute Bulk Action
  const handleExecuteBulkAction = async () => {
    if (!bulkActionConfirm || selectedPendingOrderIds.length === 0) return;
    const targetStatus = bulkActionConfirm.action;
    setIsBulkUpdating(true);
    try {
      await orderApi.bulkUpdateStatus(selectedPendingOrderIds, targetStatus);
      const idSet = new Set(selectedPendingOrderIds);
      const nextOrders = orders.map((o) =>
        idSet.has(o.id) ? { ...o, status: targetStatus, updatedAt: new Date().toISOString() } : o
      );
      saveOrders(nextOrders);
      setSelectedPendingOrderIds([]);
      setBulkActionConfirm(null);
    } catch (err: any) {
      console.error("Bulk update failed:", err);
      const idSet = new Set(selectedPendingOrderIds);
      const nextOrders = orders.map((o) =>
        idSet.has(o.id) ? { ...o, status: targetStatus, updatedAt: new Date().toISOString() } : o
      );
      saveOrders(nextOrders);
      setSelectedPendingOrderIds([]);
      setBulkActionConfirm(null);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Filtered orders for today
  const todayOrders = useMemo(() => orders.filter((o) => isOrderFromToday(o)), [orders]);
  const pendingOrdersList = useMemo(
    () =>
      todayOrders.filter(
        (o) => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready"
      ),
    [todayOrders]
  );

  const pendingOrdersCount = pendingOrdersList.length;

  const sessionFilteredOrders = useMemo(() => {
    return pendingOrdersList.filter((o) => {
      if (pendingSessionFilter === "all") return true;
      return getOrderSession(o) === pendingSessionFilter;
    });
  }, [pendingOrdersList, pendingSessionFilter]);

  // Pagination calculations
  const pTotalRecords = sessionFilteredOrders.length;
  const pTotalPages = Math.max(1, Math.ceil(pTotalRecords / pendingPageSize));
  const pValidPage = Math.min(Math.max(1, pendingPage), pTotalPages);
  const pPaginatedOrders = sessionFilteredOrders.slice(
    (pValidPage - 1) * pendingPageSize,
    pValidPage * pendingPageSize
  );

  return (
    <Background>
      <div className="flex min-h-screen flex-col font-sans pt-20">
        <ProviderNavbar
          activeTab="pendingOrders"
          onTabChange={(tab) => {
            if (tab === "provider") navigate("/provider");
            else if (tab === "reports") navigate("/provider/reports");
          }}
          pendingOrdersCount={pendingOrdersCount}
        />

        <main className="flex-1 px-6 py-6 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="space-y-6">
              {/* Header matching screenshot exactly */}
              <div className="flex flex-col gap-4 rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-[#342219]">My Pending Orders</h2>
                    {/* Live session badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs border ${
                        currentLiveSession === "morning"
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : "bg-indigo-50 text-indigo-900 border-indigo-200"
                      }`}
                    >
                      {currentLiveSession === "morning" ? (
                        <Sun
                          size={13}
                          className="text-amber-600 animate-spin"
                          style={{ animationDuration: "12s" }}
                        />
                      ) : (
                        <Moon size={13} className="text-indigo-600" />
                      )}
                      <span>
                        Current: {currentLiveSession === "morning" ? "Morning Session" : "Evening Session"}
                      </span>
                    </span>
                  </div>

                  <p className="flex items-center gap-2 text-xs text-[#897B71]">
                    <span>
                      Real-time queue for today (
                      {new Date().toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      )
                    </span>
                    <span>&bull;</span>
                    <span className="font-mono font-bold text-[#754329] bg-[#FAF6F1] px-2 py-0.5 rounded-md border border-[#E8DED4]">
                      Live: {currentLiveTime}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Today's Pending Summary Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPendingOrderIds([]);
                      setIsPendingSummaryModalOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#007BFF] to-[#0056b3] px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:opacity-95 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <PieChart size={15} />
                    <span>Today's Pending Summary</span>
                  </button>

                  {/* Session Switcher Pills: Today All | Morning (Before 12 PM) | Evening (12 PM Onwards) */}
                  <div className="flex items-center rounded-2xl bg-[#FAF8F5] p-1 border border-[#DEC5B0] shadow-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSessionFilter("all");
                        setPendingPage(1);
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        pendingSessionFilter === "all"
                          ? "bg-[#754329] text-white shadow-2xs"
                          : "text-[#70523E] hover:bg-white/80"
                      }`}
                    >
                      <Calendar size={13} />
                      <span>Today All</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPendingSessionFilter("morning");
                        setPendingPage(1);
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        pendingSessionFilter === "morning"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "text-[#70523E] hover:bg-white/80"
                      }`}
                    >
                      <Sun size={13} />
                      <span>Morning (Before 12 PM)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPendingSessionFilter("evening");
                        setPendingPage(1);
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        pendingSessionFilter === "evening"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-[#70523E] hover:bg-white/80"
                      }`}
                    >
                      <Moon size={13} />
                      <span>Evening (12 PM Onwards)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/provider")}
                    className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-4 py-2 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1] shadow-2xs cursor-pointer"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Locations</span>
                  </button>
                </div>
              </div>

              {/* Main Orders Display matching screenshot */}
              {sessionFilteredOrders.length === 0 ? (
                <div className="rounded-3xl border border-[#EEE5DC] bg-white/90 p-16 text-center shadow-xs">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF6F1] text-[#70452D]">
                    {pendingSessionFilter === "morning" ? (
                      <Sun size={28} className="text-amber-600" />
                    ) : pendingSessionFilter === "evening" ? (
                      <Moon size={28} className="text-indigo-600" />
                    ) : (
                      <Sparkles size={28} />
                    )}
                  </div>
                  <h4 className="text-base font-bold text-[#342219]">
                    No pending orders for{" "}
                    {pendingSessionFilter === "morning"
                      ? "Morning Session"
                      : pendingSessionFilter === "evening"
                      ? "Evening Session"
                      : "today"}
                    !
                  </h4>
                  <p className="mt-1 text-xs text-[#8A7667]">
                    Orders automatically update in real-time as employees place them at their seats.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pPaginatedOrders.map((order) => {
                      const session = getOrderSession(order);
                      const subtotal =
                        order.subtotal !== undefined
                          ? order.subtotal
                          : order.items?.reduce(
                              (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1),
                              0
                            ) || order.total;
                      const currentAdj =
                        order.adjustmentAmount !== undefined ? order.adjustmentAmount : 0;
                      const discount = Number(order.discount) || 0;
                      const netTotal =
                        order.total !== undefined
                          ? order.total
                          : Math.max(0, subtotal + currentAdj - discount);

                      return (
                        <div
                          key={order.id}
                          className="flex flex-col justify-between rounded-2xl border border-[#EEE5DC] bg-white p-5 shadow-sm transition hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-[#70452D]">
                                  {formatProviderOrderId(order)}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                    session === "morning"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-indigo-100 text-indigo-800"
                                  }`}
                                >
                                  {session === "morning" ? <Sun size={11} /> : <Moon size={11} />}
                                  {session === "morning" ? "Morning" : "Evening"}
                                </span>
                              </div>

                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  order.status === "Ready"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : order.status === "Preparing"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {order.status}
                              </span>
                            </div>

                            <div className="mt-3 space-y-1 text-xs">
                              <p className="font-bold text-[#342219]">
                                Customer:{" "}
                                <span className="text-[#70452D]">
                                  {order.employeeName || "Guest User"}
                                </span>
                              </p>
                              <p className="text-[#8A7667]">
                                Location:{" "}
                                <span className="font-semibold text-stone-800">
                                  {order.locationName}
                                </span>{" "}
                                • Seat:{" "}
                                <span className="font-semibold text-stone-800">
                                  {order.seat || "—"}
                                </span>
                              </p>
                              <p className="text-[11px] text-[#A08C7D]">
                                Placed: {getDisplayOrderTime(order)}
                              </p>
                            </div>

                            <div className="mt-3 rounded-xl bg-[#FAF8F5] p-3">
                              <span className="block text-[11px] font-bold text-stone-700 mb-1">
                                Items Ordered:
                              </span>
                              {(order.items || []).map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs text-stone-700 py-0.5"
                                >
                                  <span>
                                    {it.qty}x {it.name}
                                  </span>
                                  <span>₹{(it.price || 0) * (it.qty || 1)}</span>
                                </div>
                              ))}

                              <div className="border-t border-[#E8DED4] pt-2 mt-2 space-y-1 text-[11px] text-stone-600">
                                <div className="flex justify-between">
                                  <span>Original Subtotal:</span>
                                  <span className="font-medium">₹ {subtotal.toFixed(2)}</span>
                                </div>
                                {currentAdj !== 0 && (
                                  <div className="flex justify-between text-amber-800">
                                    <span>Adjustment:</span>
                                    <span className="font-medium">
                                      {currentAdj > 0
                                        ? `+ ₹ ${currentAdj.toFixed(2)}`
                                        : `- ₹ ${Math.abs(currentAdj).toFixed(2)}`}
                                    </span>
                                  </div>
                                )}
                                {discount > 0 && (
                                  <div className="flex justify-between text-rose-700">
                                    <span>Discount:</span>
                                    <span className="font-medium">- ₹ {discount.toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-black text-sm text-[#70452D] pt-1 border-t border-[#E8DED4]">
                                  <span>Net Amount:</span>
                                  <span className="text-[#28A745]">₹ {netTotal.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0E6DB] pt-3 mt-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditOrder(order)}
                                title="Edit adjustment, discount, or details"
                                className="rounded-lg border border-stone-200 bg-stone-50 p-1.5 text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelConfirmOrder(order)}
                                title="Cancel order"
                                className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {order.status === "Pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(order.id, "Preparing")}
                                  className="rounded-lg bg-[#70452D] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#593A28] cursor-pointer"
                                >
                                  Mark Preparing
                                </button>
                              )}
                              {order.status === "Preparing" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(order.id, "Ready")}
                                  className="rounded-lg bg-[#28A745] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#218838] cursor-pointer"
                                >
                                  Mark Ready
                                </button>
                              )}
                              {order.status === "Ready" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(order.id, "Delivered")}
                                  className="rounded-lg bg-[#007BFF] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0069D9] cursor-pointer"
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
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Bar */}
                  <div className="flex items-center justify-between border-t border-[#E8DED4] bg-white rounded-2xl px-5 py-3 shadow-sm text-xs text-[#70523E]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-600">Per page:</span>
                      <select
                        value={pendingPageSize}
                        onChange={(e) => {
                          setPendingPageSize(Number(e.target.value));
                          setPendingPage(1);
                        }}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 font-medium text-xs text-[#70523E] outline-none"
                      >
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                      </select>

                      <button
                        type="button"
                        disabled={pValidPage <= 1}
                        onClick={() => setPendingPage(1)}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &laquo;
                      </button>
                      <button
                        type="button"
                        disabled={pValidPage <= 1}
                        onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &lsaquo;
                      </button>
                      <span className="rounded border border-stone-300 bg-white px-2.5 py-1 font-bold">
                        {pValidPage}
                      </span>
                      <span>of {pTotalPages}</span>
                      <button
                        type="button"
                        disabled={pValidPage >= pTotalPages}
                        onClick={() => setPendingPage((p) => Math.min(pTotalPages, p + 1))}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &rsaquo;
                      </button>
                      <button
                        type="button"
                        disabled={pValidPage >= pTotalPages}
                        onClick={() => setPendingPage(pTotalPages)}
                        className="cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &raquo;
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 font-medium italic">
                      <span>Total Pending Records:</span>
                      <span className="rounded bg-[#007BFF] px-2 py-0.5 not-italic font-bold text-white">
                        {pTotalRecords}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ========================================================
            TODAY'S PENDING SUMMARY MODAL (WITH BULK & INDIVIDUAL ACTIONS)
           ======================================================== */}
        {isPendingSummaryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-[#7D533D] to-[#593A28] px-6 py-4 text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <PieChart size={20} className="text-amber-300" />
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Today's Pending Summary
                    </h3>
                    <p className="text-[11px] text-amber-100/80">
                      Active orders awaiting completion across assigned locations
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPendingSummaryModalOpen(false)}
                  className="rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Aggregation & Content */}
              {(() => {
                const allPendingIds = pendingOrdersList.map((o) => o.id);
                const isAllSelected =
                  allPendingIds.length > 0 && selectedPendingOrderIds.length === allPendingIds.length;

                const toggleSelectAll = () => {
                  if (isAllSelected) {
                    setSelectedPendingOrderIds([]);
                  } else {
                    setSelectedPendingOrderIds([...allPendingIds]);
                  }
                };

                const toggleSelectOne = (id: string) => {
                  if (selectedPendingOrderIds.includes(id)) {
                    setSelectedPendingOrderIds(selectedPendingOrderIds.filter((x) => x !== id));
                  } else {
                    setSelectedPendingOrderIds([...selectedPendingOrderIds, id]);
                  }
                };

                interface PendingOrderDetailRow {
                  order: ProviderOrder;
                  qty: number;
                  amount: number;
                  preferenceText: string;
                }

                interface AggregatedPendingItem {
                  name: string;
                  image: string;
                  qty: number;
                  totalAmount: number;
                  orders: PendingOrderDetailRow[];
                }

                const pendingItemMap: Record<string, AggregatedPendingItem> = {};
                let grandPendingQty = 0;
                let grandPendingAmount = 0;

                pendingOrdersList.forEach((o) => {
                  (o.items || []).forEach((it) => {
                    let baseName = it.name || "Item";
                    let pref = "";
                    if (baseName.includes("(") && baseName.includes(")")) {
                      const match = baseName.match(/^(.*?)\s*\((.*?)\)$/);
                      if (match) {
                        baseName = match[1].trim();
                        pref = match[2].trim();
                      }
                    }

                    const normalizedKey = baseName.toLowerCase().trim();
                    const itemImg = itemImagesMap[normalizedKey] || "";

                    if (!pendingItemMap[baseName]) {
                      pendingItemMap[baseName] = {
                        name: baseName,
                        image: itemImg,
                        qty: 0,
                        totalAmount: 0,
                        orders: [],
                      };
                    }

                    const lineQty = Number(it.qty) || 0;
                    const lineTotal = lineQty * (Number(it.price) || 0);

                    pendingItemMap[baseName].qty += lineQty;
                    pendingItemMap[baseName].totalAmount += lineTotal;
                    if (!pendingItemMap[baseName].image && itemImg) {
                      pendingItemMap[baseName].image = itemImg;
                    }

                    const prefDisplay = pref
                      ? pref.includes(":")
                        ? pref
                        : `Sugar: ${pref}`
                      : "Standard";

                    pendingItemMap[baseName].orders.push({
                      order: o,
                      qty: lineQty,
                      amount: lineTotal,
                      preferenceText: prefDisplay,
                    });

                    grandPendingQty += lineQty;
                    grandPendingAmount += lineTotal;
                  });
                });

                const pendingSummaryRows = Object.values(pendingItemMap);

                const toggleExpand = (name: string) => {
                  setExpandedSummaryItems((prev) => ({
                    ...prev,
                    [name]: !prev[name],
                  }));
                };

                return (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Top Bulk Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-amber-50/60 px-6 py-3 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          disabled={allPendingIds.length === 0}
                          className="flex items-center gap-1.5 text-xs font-bold text-stone-800 hover:text-black cursor-pointer disabled:opacity-40"
                        >
                          {isAllSelected ? (
                            <CheckSquare size={17} className="text-[#754329]" />
                          ) : (
                            <Square size={17} className="text-stone-400" />
                          )}
                          <span>Select All ({allPendingIds.length})</span>
                        </button>

                        {selectedPendingOrderIds.length > 0 && (
                          <span className="text-xs font-semibold text-[#754329]">
                            {selectedPendingOrderIds.length} selected
                          </span>
                        )}
                      </div>

                      {/* Bulk Status Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={selectedPendingOrderIds.length === 0}
                          onClick={() =>
                            setBulkActionConfirm({
                              action: "Delivered",
                              count: selectedPendingOrderIds.length,
                            })
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-[#28A745] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#218838] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <CheckCircle2 size={14} />
                          <span>Mark Delivered ({selectedPendingOrderIds.length})</span>
                        </button>

                        <button
                          type="button"
                          disabled={selectedPendingOrderIds.length === 0}
                          onClick={() =>
                            setBulkActionConfirm({
                              action: "Canceled",
                              count: selectedPendingOrderIds.length,
                            })
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Cancel Selected</span>
                        </button>
                      </div>
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 border-b border-gray-200 bg-[#FAF8F5] px-6 py-2.5 text-xs font-bold text-gray-700 shrink-0">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-3 text-center">Pending Quantity</div>
                      <div className="col-span-3 text-right">Total Amount</div>
                    </div>

                    {/* Scrollable Rows */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                      {pendingSummaryRows.length === 0 ? (
                        <div className="p-12 text-center text-xs text-gray-400">
                          No pending orders awaiting preparation!
                        </div>
                      ) : (
                        pendingSummaryRows.map((item) => {
                          const isExpanded = !!expandedSummaryItems[item.name];

                          return (
                            <div key={item.name} className="flex flex-col">
                              <div
                                onClick={() => toggleExpand(item.name)}
                                className="grid grid-cols-12 items-center px-6 py-3 text-xs hover:bg-[#FCFAF8] transition cursor-pointer"
                              >
                                <div className="col-span-6 flex items-center gap-3">
                                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-[#FAF8F5] shadow-2xs">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[#8C5835]">
                                        <Coffee size={18} />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-gray-900">
                                      {item.name}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(item.name);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition cursor-pointer"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp size={12} className="text-gray-500" />
                                      ) : (
                                        <ChevronDown size={12} className="text-gray-500" />
                                      )}
                                      <span>Details ({item.orders.length})</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="col-span-3 flex justify-center">
                                  <span className="flex h-6 min-w-[28px] items-center justify-center rounded-full bg-[#0E2038] px-2 text-xs font-bold text-white shadow-xs">
                                    {item.qty}
                                  </span>
                                </div>

                                <div className="col-span-3 text-right font-black text-sm text-[#28A745]">
                                  ₹ {item.totalAmount.toFixed(2)}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="border-y border-gray-200 bg-gray-50/90 px-6 py-3 text-xs animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-gray-600">
                                    <span>
                                      Order Breakdown & Individual Actions ({item.orders.length})
                                    </span>
                                    <span className="text-stone-400 font-normal italic">
                                      Click row to collapse
                                    </span>
                                  </div>

                                  <div className="divide-y divide-gray-200/60 pt-1 space-y-1.5">
                                    {item.orders.map((sub, sIdx) => {
                                      const isSelected = selectedPendingOrderIds.includes(
                                        sub.order.id
                                      );
                                      return (
                                        <div
                                          key={sIdx}
                                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 text-xs bg-white/70 p-2.5 rounded-xl border border-gray-100"
                                        >
                                          <div className="flex items-center gap-2.5">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleSelectOne(sub.order.id)}
                                              className="h-4 w-4 rounded border-gray-300 text-[#754329] focus:ring-[#754329] cursor-pointer"
                                            />
                                            <span className="inline-flex items-center rounded-md bg-[#28A745] px-2 py-0.5 text-[11px] font-bold text-white">
                                              Seat:{" "}
                                              {sub.order.employeeName
                                                ? sub.order.employeeName.split("@")[0]
                                                : `Seat ${sub.order.seat}`}
                                            </span>
                                            <span className="font-mono text-[11px] text-blue-600 font-bold">
                                              {formatProviderOrderId(sub.order)}
                                            </span>
                                            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                                              {sub.preferenceText}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-4 self-end sm:self-auto">
                                            <div className="text-right">
                                              <span className="text-[10px] text-gray-500 block">
                                                Qty: {sub.qty}
                                              </span>
                                              <span className="font-bold text-gray-800">
                                                ₹ {sub.amount.toFixed(2)}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                              {sub.order.status === "Pending" && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleUpdateOrderStatus(sub.order.id, "Preparing")
                                                  }
                                                  className="rounded-lg bg-[#70452D] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#593A28] cursor-pointer"
                                                >
                                                  Preparing
                                                </button>
                                              )}
                                              {sub.order.status === "Preparing" && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleUpdateOrderStatus(sub.order.id, "Ready")
                                                  }
                                                  className="rounded-lg bg-[#28A745] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#218838] cursor-pointer"
                                                >
                                                  Ready
                                                </button>
                                              )}
                                              {sub.order.status === "Ready" && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleUpdateOrderStatus(
                                                      sub.order.id,
                                                      "Delivered"
                                                    )
                                                  }
                                                  className="rounded-lg bg-[#007BFF] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0069D9] cursor-pointer"
                                                >
                                                  Delivered
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => setCancelConfirmOrder(sub.order)}
                                                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/80 px-6 py-4 text-xs shrink-0">
                      <div className="font-extrabold uppercase tracking-wider text-gray-600">
                        GRAND TOTAL
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-md bg-stone-600 px-3 py-1 font-bold text-white shadow-2xs">
                          Total Items: {grandPendingQty}
                        </span>
                        <span className="rounded-md bg-[#28A745] px-3.5 py-1 font-bold text-white shadow-2xs">
                          Total Amount: ₹ {grandPendingAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ========================================================
            EDIT ORDER MODAL (ADJUSTMENT & DISCOUNT & SEAT)
           ======================================================== */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="text-base font-bold text-gray-900">
                  Edit Order #{formatProviderOrderId(editingOrder)}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer / Seat</label>
                  <input
                    type="text"
                    value={editSeat}
                    onChange={(e) => setEditSeat(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-[#754329]"
                    placeholder="e.g. 12 or Boardroom 3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Adjustment (₹) <span className="font-normal text-stone-400">(±)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAdjustmentAmount}
                      onChange={(e) => setEditAdjustmentAmount(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#754329]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#754329]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#754329]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Preparing">Preparing</option>
                    <option value="Ready">Ready</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Canceled">Canceled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Notes / Instructions</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#754329]"
                    placeholder="Add special notes..."
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={handleSaveOrderEdit}
                  className="rounded-xl bg-[#754329] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#593A28] disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            CONFIRM CANCEL ORDER MODAL
           ======================================================== */}
        {cancelConfirmOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-2xl">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-base font-bold text-stone-900">Cancel this order?</h3>
              <p className="mt-2 text-xs text-stone-600">
                Are you sure you want to cancel order #{formatProviderOrderId(cancelConfirmOrder)}? This will remove it from the active queue.
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
                  onClick={handleConfirmCancelOrder}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
                >
                  {isCancellingOrder ? "Cancelling..." : "Yes, Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            BULK ACTION CONFIRM MODAL (DELIVERED / CANCELED)
           ======================================================== */}
        {bulkActionConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-2xl">
              <div
                className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                  bulkActionConfirm.action === "Delivered"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {bulkActionConfirm.action === "Delivered" ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <AlertCircle size={24} />
                )}
              </div>
              <h3 className="text-base font-bold text-stone-900">
                Confirm Bulk {bulkActionConfirm.action}
              </h3>
              <p className="mt-2 text-xs text-stone-600">
                Are you sure you want to mark{" "}
                <span className="font-bold text-stone-900">{bulkActionConfirm.count} pending orders</span> as{" "}
                <span
                  className={`font-bold ${
                    bulkActionConfirm.action === "Delivered" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {bulkActionConfirm.action}
                </span>?
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isBulkUpdating}
                  onClick={() => setBulkActionConfirm(null)}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBulkUpdating}
                  onClick={handleExecuteBulkAction}
                  className={`rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50 ${
                    bulkActionConfirm.action === "Delivered"
                      ? "bg-[#28A745] hover:bg-[#218838]"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isBulkUpdating ? "Updating..." : `Yes, Mark ${bulkActionConfirm.action}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Background>
  );
}
