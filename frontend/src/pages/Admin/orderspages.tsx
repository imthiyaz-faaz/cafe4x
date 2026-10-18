import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  ShieldCheck,
  User,
  Sparkles,
  Clock,
  ArrowRight,
} from "lucide-react";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { orderApi } from "../../services/orderApi";

export interface OrderItemDetail {
  name: string;
  price: number;
  qty: number;
  image: string;
}

export interface OrderRecord {
  id: string; // e.g. "#ORD-1001"
  employeeName: string;
  department: string;
  avatarInitials: string;
  avatarBg?: string;
  items: OrderItemDetail[];
  itemSummary: string;
  seat: string;
  total: number;
  orderTime: string;
  status: "Pending" | "Preparing" | "Ready" | "Completed" | "Delivered" | "Canceled";
  notes?: string;
  locationName?: string;
}

export interface EmployeeGroup {
  employeeKey: string;
  employeeName: string;
  department: string;
  avatarInitials: string;
  avatarBg: string;
  seat: string;
  locationName: string;
  totalOrdersCount: number;
  totalSpend: number;
  latestOrderTime: string;
  latestStatus: OrderRecord["status"];
  orders: OrderRecord[];
}

const initialOrders: OrderRecord[] = [];

export default function OrdersPage() {
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;
  const isNewOrg = currentShortCode && currentShortCode !== "HQ" && currentShortCode !== "FTS";
  const ordersStorageKey = currentShortCode ? `cafe4x_admin_orders_${currentShortCode}` : "cafe4x_admin_orders";

  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const stored = localStorage.getItem(ordersStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return isNewOrg ? [] : initialOrders;
  });

  // Selected Employee Key for Right Drawer
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch real employee orders from backend and sync with admin orders
  const fetchOrders = () => {
    orderApi
      .getOrders()
      .then((serverOrders) => {
        if (Array.isArray(serverOrders) && serverOrders.length > 0) {
          const defaultImgs: Record<string, string> = {
            tea: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=150&q=80",
            coffee: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80",
            "black tea": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=150&q=80",
            "lemon tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=150&q=80",
            "black coffee": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=150&q=80",
            milk: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=150&q=80",
          };

          const mapped: OrderRecord[] = serverOrders.map((so) => {
            const initials = so.employeeName
              ? so.employeeName
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
              : "EM";

            const itemsMapped = (so.items || []).map((it) => ({
              name: it.name,
              price: it.price,
              qty: it.qty,
              image:
                defaultImgs[it.name.toLowerCase()] ||
                "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80",
            }));

            const summary = itemsMapped.map((i) => `${i.name} x${i.qty}`).join(", ");

            return {
              id: so.id,
              employeeName: so.employeeName,
              department: so.locationName || "Office Team",
              avatarInitials: initials,
              avatarBg: "bg-[#754329]",
              items: itemsMapped,
              itemSummary: summary || "No items",
              seat: `Seat ${so.seat}`,
              total: so.total,
              orderTime: so.createdAt
                ? new Date(so.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
                : (so.time && so.time !== "Just now" ? so.time : "Recent"),
              status: so.status as any,
              notes: so.notes,
              locationName: so.locationName,
            };
          });

          setOrders(mapped);
          try {
            localStorage.setItem(ordersStorageKey, JSON.stringify(mapped));
          } catch { }
        } else {
          setOrders([]);
        }
      })
      .catch(() => {
        setOrders([]);
      });
  };

  useEffect(() => {
    fetchOrders();

    const handleStorage = () => {
      try {
        const stored = localStorage.getItem(ordersStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setOrders(parsed);
        }
      } catch { }
    };

    window.addEventListener("storage", handleStorage);
    const interval = setInterval(fetchOrders, 3000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Group Orders by Employee so Employee details show first
  const employeeGroups: EmployeeGroup[] = useMemo(() => {
    const map = new Map<string, EmployeeGroup>();

    orders.forEach((order) => {
      const key = (order.employeeName || "Guest").trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          employeeKey: key,
          employeeName: order.employeeName || "Employee",
          department: order.department || order.locationName || "Office Team",
          avatarInitials: order.avatarInitials || "EM",
          avatarBg: order.avatarBg || "bg-[#754329]",
          seat: order.seat,
          locationName: order.locationName || "Office",
          totalOrdersCount: 0,
          totalSpend: 0,
          latestOrderTime: order.orderTime,
          latestStatus: order.status,
          orders: [],
        });
      }

      const grp = map.get(key)!;
      grp.orders.push(order);
      grp.totalOrdersCount += 1;
      grp.totalSpend += order.total;
    });

    return Array.from(map.values());
  }, [orders]);

  // Filter Employee Groups based on search input
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employeeGroups;

    return employeeGroups.filter(
      (emp) =>
        emp.employeeName.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.seat.toLowerCase().includes(q) ||
        emp.orders.some((o) =>
          o.id.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
        )
    );
  }, [employeeGroups, searchQuery]);

  // Pagination calculation
  const totalRecords = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedEmployees = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, validCurrentPage, pageSize]);

  // Selected Employee Group for the Right Details Drawer
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeKey) return null;
    return employeeGroups.find((eg) => eg.employeeKey === selectedEmployeeKey) || null;
  }, [employeeGroups, selectedEmployeeKey]);

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* Top Toolbar: Search Bar Only */}
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#EEE5DC] bg-white/95 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF4ED] text-[#754329] border border-[#E8DED4]">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#342219]">Employee Orders</h2>
                  <p className="text-xs text-[#8A7667]">
                    Click on any employee to inspect their individual orders and items
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by employee, seat, or items..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 outline-none transition placeholder-gray-400 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 shadow-2xs"
                />
              </div>
            </div>

            {/* Main Layout: Employees List (Left) + Selected Employee's Orders Drawer (Right) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* LEFT: EMPLOYEES DIRECTORY TABLE */}
              <div
                className={`flex flex-col transition-all duration-300 ${selectedEmployee ? "lg:col-span-7" : "lg:col-span-12"
                  }`}
              >
                <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#EEE5DC] bg-[#FAF8F5] text-[#704225]">
                        <tr>
                          <th className="px-5 py-3.5 font-bold">Employee</th>
                          <th className="px-4 py-3.5 font-bold">Department / Location</th>
                          <th className="px-4 py-3.5 font-bold">Seat</th>
                          <th className="px-4 py-3.5 font-bold text-center">Total Orders</th>
                          <th className="px-4 py-3.5 font-bold text-right">Total Amount</th>
                          <th className="px-4 py-3.5 font-bold">Latest Status</th>
                          <th className="w-10 px-4 py-3.5 text-center">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#F5EFE8] text-gray-700">
                        {paginatedEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-14 text-center text-xs text-gray-500">
                              <Sparkles className="mx-auto mb-2 h-8 w-8 text-[#A08C7D]" />
                              <p className="font-semibold text-gray-700">No employee orders found</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Orders placed by employees will appear here in real-time.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          paginatedEmployees.map((emp) => {
                            const isSelected = selectedEmployeeKey === emp.employeeKey;

                            return (
                              <tr
                                key={emp.employeeKey}
                                onClick={() => {
                                  setSelectedEmployeeKey(emp.employeeKey);
                                  setSelectedOrderId(emp.orders[0]?.id || null);
                                }}
                                className={`cursor-pointer transition duration-150 hover:bg-[#FAF6F2] ${isSelected ? "bg-[#FAF4ED] border-l-4 border-l-[#754329]" : ""
                                  }`}
                              >
                                {/* Employee Info (Avatar + Name) */}
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs text-white shadow-2xs ${emp.avatarBg}`}
                                    >
                                      {emp.avatarInitials}
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-900 leading-tight">
                                        {emp.employeeName}
                                      </p>
                                      <p className="text-[11px] text-gray-500 mt-0.5">
                                        Last active: {emp.latestOrderTime}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Department / Location */}
                                <td className="px-4 py-3.5">
                                  <span className="rounded-md bg-[#FAF4ED] px-2.5 py-1 text-[11px] font-semibold text-[#754329] border border-[#EEDFCE]">
                                    {emp.department}
                                  </span>
                                </td>

                                {/* Seat */}
                                <td className="px-4 py-3.5 font-semibold text-gray-800">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin size={13} className="text-[#8C5835]" />
                                    <span>{emp.seat}</span>
                                  </div>
                                </td>

                                {/* Total Orders Count */}
                                <td className="px-4 py-3.5 text-center">
                                  <span className="inline-flex items-center justify-center rounded-full bg-[#EFE6DC] px-2.5 py-0.5 text-xs font-bold text-[#704225]">
                                    {emp.totalOrdersCount}
                                  </span>
                                </td>

                                {/* Total Amount */}
                                <td className="px-4 py-3.5 font-bold text-gray-900 text-right">
                                  ₹ {emp.totalSpend.toFixed(2)}
                                </td>

                                {/* Latest Status */}
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${emp.latestStatus === "Pending"
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : emp.latestStatus === "Preparing"
                                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                                          : emp.latestStatus === "Ready"
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : emp.latestStatus === "Completed" || emp.latestStatus === "Delivered"
                                              ? "bg-green-100 text-green-800 border border-green-200"
                                              : "bg-rose-100 text-rose-800 border border-rose-200"
                                      }`}
                                  >
                                    {emp.latestStatus}
                                  </span>
                                </td>

                                {/* Action Arrow */}
                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center text-[#8C5835] hover:text-[#754329]">
                                    <ArrowRight size={16} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Pagination */}
                  <div className="flex flex-col gap-3 border-t border-[#EEE5DC] bg-white px-4 py-3 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={validCurrentPage === 1}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronsLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={validCurrentPage === 1}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className="flex items-center gap-1 font-semibold text-gray-700">
                        <input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={validCurrentPage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 1 && val <= totalPages) setCurrentPage(val);
                          }}
                          className="w-10 rounded border border-gray-300 py-0.5 text-center text-xs"
                        />
                        <span>of {totalPages}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={validCurrentPage === totalPages}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={validCurrentPage === totalPages}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </div>

                    <div className="font-semibold text-gray-600">
                      Total Employees:{" "}
                      <span className="font-bold text-gray-900">{employeeGroups.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: EMPLOYEE ORDERS SEPARATE DRAWER */}
              {selectedEmployee ? (
                <div className="flex flex-col lg:col-span-5 animate-in fade-in slide-in-from-right duration-300">
                  <div className="rounded-2xl border border-[#EEE5DC] bg-white p-5 shadow-lg">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full font-bold text-sm text-white shadow-sm ${selectedEmployee.avatarBg}`}
                        >
                          {selectedEmployee.avatarInitials}
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-gray-900">
                            {selectedEmployee.employeeName}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{selectedEmployee.department}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-[#8C5835]">
                              {selectedEmployee.seat}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeKey(null);
                          setSelectedOrderId(null);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                        title="Close employee details"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Employee Quick Stats Box */}
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#E8DED4] bg-[#FAF8F5] p-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          Total Orders Placed
                        </span>
                        <p className="text-base font-extrabold text-[#754329]">
                          {selectedEmployee.totalOrdersCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          Lifetime Amount
                        </span>
                        <p className="text-base font-extrabold text-gray-900">
                          ₹ {selectedEmployee.totalSpend.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Orders Placed by this Employee */}
                    <div className="mt-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                        Orders ({selectedEmployee.orders.length})
                      </h4>

                      <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1">
                        {selectedEmployee.orders.map((order) => {
                          const isExpanded = selectedOrderId === order.id;

                          return (
                            <div
                              key={order.id}
                              onClick={() => setSelectedOrderId(order.id)}
                              className={`rounded-xl border p-3.5 transition cursor-pointer ${isExpanded
                                  ? "border-[#8C5835] bg-[#FAF6F2] shadow-xs"
                                  : "border-gray-200 bg-white hover:border-[#D5C2B1]"
                                }`}
                            >
                              {/* Order Card Header */}
                              <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-[#754329]">
                                    {order.id}
                                  </span>
                                  <span className="text-[11px] text-gray-400">&bull;</span>
                                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                    <Clock size={11} />
                                    {order.orderTime}
                                  </span>
                                </div>

                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${order.status === "Pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : order.status === "Preparing"
                                        ? "bg-blue-100 text-blue-800"
                                        : order.status === "Ready"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : order.status === "Completed" || order.status === "Delivered"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-rose-100 text-rose-800"
                                    }`}
                                >
                                  {order.status}
                                </span>
                              </div>

                              {/* Order Items List */}
                              <div className="mt-3 space-y-2">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="h-8 w-8 rounded-lg object-cover border border-gray-100 shadow-2xs"
                                      />
                                      <div>
                                        <p className="font-semibold text-gray-900">{item.name}</p>
                                        <p className="text-[10px] text-gray-500">
                                          ₹{item.price} × {item.qty}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-bold text-gray-800">
                                      ₹{(item.price * item.qty).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Order Notes / Special Instructions */}
                              {order.notes && (
                                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-900">
                                  <span className="font-bold">Note: </span>
                                  {order.notes}
                                </div>
                              )}

                              {/* Order Total Footer */}
                              <div className="mt-3 flex items-center justify-between border-t border-[#F0E6DB] pt-2 text-xs">
                                <span className="font-semibold text-gray-500">Order Total</span>
                                <span className="font-black text-sm text-[#754329]">
                                  ₹ {order.total.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto px-4 py-6 text-center text-xs text-[#9A8778]">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
            <ShieldCheck size={15} />
            <span>Good Food. Better Days. © {new Date().getFullYear()} Cafe4X. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </Background>
  );
}
