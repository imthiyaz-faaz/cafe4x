import { useState, useMemo, useEffect, useRef } from "react";
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
  Coffee,
  Calendar,
  Sun,
  Moon,
  Receipt,
  Filter,
  Layers,
  ChevronDown,
  RotateCw,
} from "lucide-react";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { orderApi, type ProviderOrder, type EmployeeOrderSummary } from "../../services/orderApi";
import { itemsApi, type MenuItem } from "../../services/itemsApi";
import { workingHoursApi } from "../../services/workingHoursApi";
import {
  classifyOrderPeriod,
  DEFAULT_ORDER_PERIODS,
  getDateStringsInTimezone,
  getTimeInTimezone,
  type OrderPeriodConfig,
} from "../../utils/orderTimeClassification";

export interface OrderItemDetail {
  itemId?: string;
  name: string;
  price: number;
  qty: number;
  image: string;
  preference?: string;
}

export interface OrderRecord {
  id: string; // e.g. "#ORD-1001"
  displayId?: string;
  employeeName: string;
  employeeId?: string | null;
  employeeEmail?: string | null;
  department: string;
  avatarInitials: string;
  avatarBg?: string;
  items: OrderItemDetail[];
  itemSummary: string;
  seat: string;
  subtotal: number;
  adjustmentAmount: number;
  discount: number;
  total: number;
  orderTime: string;
  createdAt: string;
  status: "Pending" | "Preparing" | "Ready" | "Completed" | "Delivered" | "Canceled";
  notes?: string;
  locationName?: string;
  period: "morning" | "evening" | "other";
}

export interface EmployeeGroup {
  employeeKey: string;
  employeeId: string | null;
  employeeName: string;
  employeeEmail: string | null;
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

export default function OrdersPage() {
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;
  const ordersStorageKey = currentShortCode ? `cafe4x_admin_orders_${currentShortCode}` : "cafe4x_admin_orders";

  // Timezone & Period Configuration
  const [orgTimezone, setOrgTimezone] = useState<string>("Asia/Dubai");
  const [periodConfig] = useState<OrderPeriodConfig>(DEFAULT_ORDER_PERIODS);

  // Date Filter State: "today" | "yesterday" | "custom"
  const [dateFilterType, setDateFilterType] = useState<"today" | "yesterday" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Orders State
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Employee Key for Inspection/Filter
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeSearchFilter, setEmployeeSearchFilter] = useState("");

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Maintain item lookup maps from menu items database
  const [itemsById, setItemsById] = useState<Record<string, MenuItem>>({});
  const [itemsByName, setItemsByName] = useState<Record<string, MenuItem>>({});
  const itemsByIdRef = useRef<Record<string, MenuItem>>({});
  const itemsByNameRef = useRef<Record<string, MenuItem>>({});
  itemsByIdRef.current = itemsById;
  itemsByNameRef.current = itemsByName;

  // Available employees with orders in the current date range
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeOrderSummary[]>([]);

  // 1. Fetch Organization Working Hours to get accurate configured timezone
  useEffect(() => {
    workingHoursApi
      .getWorkingHours()
      .then((res: any) => {
        const tz = res?.workingHours?.timezone || res?.timezone;
        if (tz) {
          setOrgTimezone(tz);
        }
      })
      .catch(() => {
        // Fallback default timezone: Asia/Dubai
      });
  }, [currentShortCode]);

  // 2. Compute Active Start & End Date Strings in ISO for the server
  const activeDateRange = useMemo(() => {
    const { todayStr, yesterdayStr } = getDateStringsInTimezone(orgTimezone);

    if (dateFilterType === "today") {
      return {
        startDate: todayStr,
        endDate: todayStr,
      };
    } else if (dateFilterType === "yesterday") {
      return {
        startDate: yesterdayStr,
        endDate: yesterdayStr,
      };
    } else {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
  }, [dateFilterType, customStartDate, customEndDate, orgTimezone]);

  // 3. Fetch menu items to get exact current images and IDs
  useEffect(() => {
    itemsApi
      .getItems(currentShortCode || undefined)
      .then((itemsList) => {
        if (Array.isArray(itemsList)) {
          const byId: Record<string, MenuItem> = {};
          const byName: Record<string, MenuItem> = {};
          itemsList.forEach((it) => {
            if (it.id) {
              byId[it.id] = it;
            }
            if (it.name) {
              byName[it.name.trim().toLowerCase()] = it;
            }
          });
          setItemsById(byId);
          setItemsByName(byName);
        }
      })
      .catch(() => {});
  }, [currentShortCode]);

  // 4. Fetch available employees who have orders in this date range
  useEffect(() => {
    const controller = new AbortController();
    orderApi
      .getOrderEmployees(
        {
          startDate: activeDateRange.startDate,
          endDate: activeDateRange.endDate,
        },
        { signal: controller.signal }
      )
      .then((list) => {
        setAvailableEmployees(list || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setAvailableEmployees([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeDateRange, currentShortCode]);

  // 5. Fetch real employee orders from backend with date & employee parameters
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    const loadOrders = (signal?: AbortSignal) => {
      orderApi
        .getOrders(
          {
            startDate: activeDateRange.startDate,
            endDate: activeDateRange.endDate,
          },
          { signal }
        )
        .then((serverOrders) => {
          if (Array.isArray(serverOrders) && serverOrders.length > 0) {
            const currentItemsById = itemsByIdRef.current;
            const currentItemsByName = itemsByNameRef.current;

            const mapped: OrderRecord[] = serverOrders.map((so: ProviderOrder) => {
              const initials = so.employeeName
                ? so.employeeName
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "EM";

              const itemsMapped = (so.items || []).map((it) => {
                const fullName = (it.name || "").trim();
                const baseName = fullName.replace(/\s*\(.*?\)\s*$/, "").trim().toLowerCase();
                const fullKey = fullName.toLowerCase();

                let exactImage = "";
                if (it.itemId && currentItemsById[it.itemId]?.image) {
                  exactImage = currentItemsById[it.itemId].image;
                } else if (it.image) {
                  exactImage = it.image;
                } else if (currentItemsByName[fullKey]?.image) {
                  exactImage = currentItemsByName[fullKey].image;
                } else if (currentItemsByName[baseName]?.image) {
                  exactImage = currentItemsByName[baseName].image;
                }

                return {
                  itemId: it.itemId,
                  name: it.name,
                  price: it.price,
                  qty: it.qty,
                  image: exactImage,
                  preference: it.preference,
                };
              });

              const summary = itemsMapped.map((i) => `${i.name} x${i.qty}`).join(", ");
              const createdAtStr = so.createdAt || new Date().toISOString();
              const { displayTime } = getTimeInTimezone(createdAtStr, orgTimezone);
              const period = classifyOrderPeriod(createdAtStr, orgTimezone, periodConfig);

              return {
                id: so.displayId || so.id,
                displayId: so.displayId,
                employeeName: so.employeeName,
                employeeId: so.employeeId,
                employeeEmail: (so as any).employeeEmail || null,
                department: so.locationName || "Office Team",
                avatarInitials: initials,
                avatarBg: "bg-[#754329]",
                items: itemsMapped,
                itemSummary: summary || "No items",
                seat: so.seat?.startsWith("Seat ") ? so.seat : `Seat ${so.seat || "—"}`,
                subtotal: so.subtotal ?? so.total,
                adjustmentAmount: so.adjustmentAmount ?? 0,
                discount: so.discount ?? 0,
                total: so.total,
                orderTime: displayTime || so.time || "Recent",
                createdAt: createdAtStr,
                status: (so.status as any) || "Pending",
                notes: so.notes,
                locationName: so.locationName,
                period,
              };
            });

            setOrders(mapped);
            try {
              localStorage.setItem(ordersStorageKey, JSON.stringify(mapped));
            } catch {}
          } else {
            setOrders([]);
            try {
              localStorage.removeItem(ordersStorageKey);
            } catch {}
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setOrders([]);
          }
        })
        .finally(() => {
          if (!signal || !signal.aborted) {
            setIsLoading(false);
          }
        });
    };

    loadOrders(controller.signal);

    const interval = setInterval(() => {
      loadOrders(controller.signal);
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [activeDateRange, orgTimezone]);

  // Group Orders by Employee
  const employeeGroups: EmployeeGroup[] = useMemo(() => {
    const map = new Map<string, EmployeeGroup>();

    orders.forEach((order) => {
      // Keyed by employeeId (if exists) or employeeName
      const key = (order.employeeId ? `id_${order.employeeId}` : order.employeeName || "Guest").trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          employeeKey: key,
          employeeId: order.employeeId || null,
          employeeName: order.employeeName || "Employee",
          employeeEmail: order.employeeEmail || null,
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
      // If we have an email on this order, save it
      if (order.employeeEmail && !grp.employeeEmail) {
        grp.employeeEmail = order.employeeEmail;
      }
    });

    return Array.from(map.values());
  }, [orders]);

  // Filter Employee Groups based on search input & employee dropdown filter
  const filteredEmployees = useMemo(() => {
    let result = employeeGroups;

    if (selectedEmployeeKey) {
      result = result.filter((emp) => emp.employeeKey === selectedEmployeeKey);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter(
      (emp) =>
        emp.employeeName.toLowerCase().includes(q) ||
        (emp.employeeEmail && emp.employeeEmail.toLowerCase().includes(q)) ||
        emp.department.toLowerCase().includes(q) ||
        emp.seat.toLowerCase().includes(q) ||
        emp.orders.some((o) =>
          o.id.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
        )
    );
  }, [employeeGroups, selectedEmployeeKey, searchQuery]);

  // Selected Employee object (when an employee is explicitly selected)
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeKey) return null;
    return employeeGroups.find((eg) => eg.employeeKey === selectedEmployeeKey) || null;
  }, [employeeGroups, selectedEmployeeKey]);

  // Orders for the selected employee, classified into Morning, Evening, and Other
  const { morningOrders, eveningOrders, otherOrders } = useMemo(() => {
    if (!selectedEmployee) {
      return {
        morningOrders: [] as OrderRecord[],
        eveningOrders: [] as OrderRecord[],
        otherOrders: [] as OrderRecord[],
        financialSummary: {
          totalOrders: 0,
          morningCount: 0,
          eveningCount: 0,
          otherCount: 0,
          totalItems: 0,
          morningAmount: 0,
          eveningAmount: 0,
          grossAmount: 0,
          completedAmount: 0,
          pendingAmount: 0,
          cancelledAmount: 0,
          discounts: 0,
          adjustments: 0,
          netAmount: 0,
        },
      };
    }

    const employeeOrders = selectedEmployee.orders;
    const morning: OrderRecord[] = [];
    const evening: OrderRecord[] = [];
    const other: OrderRecord[] = [];

    let totalItems = 0;
    let morningAmount = 0;
    let eveningAmount = 0;
    let grossAmount = 0;
    let completedAmount = 0;
    let pendingAmount = 0;
    let cancelledAmount = 0;
    let totalDiscounts = 0;
    let totalAdjustments = 0;

    employeeOrders.forEach((o) => {
      // Items count
      const orderItemCount = o.items.reduce((acc, it) => acc + (it.qty || 1), 0);
      totalItems += orderItemCount;

      // Exclude cancelled orders from sales totals according to business rules
      const isCancelled = o.status === "Canceled";

      if (!isCancelled) {
        grossAmount += o.total;
        totalDiscounts += o.discount || 0;
        totalAdjustments += o.adjustmentAmount || 0;
      }

      // Status breakdown
      if (o.status === "Delivered" || o.status === "Completed") {
        completedAmount += o.total;
      } else if (isCancelled) {
        cancelledAmount += o.total;
      } else {
        pendingAmount += o.total;
      }

      // Period breakdown
      if (o.period === "morning") {
        morning.push(o);
        if (!isCancelled) {
          morningAmount += o.total;
        }
      } else if (o.period === "evening") {
        evening.push(o);
        if (!isCancelled) {
          eveningAmount += o.total;
        }
      } else {
        other.push(o);
      }
    });

    // Net Amount: Total value of completed/delivered sales
    const netAmount = completedAmount;

    return {
      morningOrders: morning,
      eveningOrders: evening,
      otherOrders: other,
      financialSummary: {
        totalOrders: employeeOrders.length,
        morningCount: morning.length,
        eveningCount: evening.length,
        otherCount: other.length,
        totalItems,
        morningAmount,
        eveningAmount,
        grossAmount,
        completedAmount,
        pendingAmount,
        cancelledAmount,
        discounts: totalDiscounts,
        adjustments: totalAdjustments,
        netAmount,
      },
    };
  }, [selectedEmployee]);

  // Pagination calculation for Directory Table
  const totalRecords = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedEmployees = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, validCurrentPage, pageSize]);

  // Filter available employees for dropdown search
  const filteredDropdownEmployees = useMemo(() => {
    const q = employeeSearchFilter.trim().toLowerCase();
    if (!q) return availableEmployees;
    return availableEmployees.filter(
      (e) =>
        e.employeeName.toLowerCase().includes(q) ||
        (e.employeeEmail && e.employeeEmail.toLowerCase().includes(q)) ||
        e.department.toLowerCase().includes(q) ||
        e.seat.toLowerCase().includes(q)
    );
  }, [availableEmployees, employeeSearchFilter]);

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* Top Toolbar: Filters, Employee Selection, and Search */}
            <div className="mb-6 rounded-2xl border border-[#EEE5DC] bg-white/95 p-4 shadow-sm backdrop-blur-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Header Title */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF4ED] text-[#754329] border border-[#E8DED4]">
                    <User size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#342219]">Employee Orders</h2>
                    <p className="text-xs text-[#8A7667]">
                      Filter by employee and date to inspect morning & evening orders and financial summaries
                    </p>
                  </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* 1. Date Filter (Today / Yesterday / Custom) */}
                  <div className="flex items-center rounded-xl border border-[#E8DED4] bg-[#FAF8F5] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setDateFilterType("today")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                        dateFilterType === "today"
                          ? "bg-[#754329] text-white shadow-2xs"
                          : "text-[#704225] hover:bg-[#EFE6DC]"
                      }`}
                    >
                      <Calendar size={13} />
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilterType("yesterday")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                        dateFilterType === "yesterday"
                          ? "bg-[#754329] text-white shadow-2xs"
                          : "text-[#704225] hover:bg-[#EFE6DC]"
                      }`}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilterType("custom")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                        dateFilterType === "custom"
                          ? "bg-[#754329] text-white shadow-2xs"
                          : "text-[#704225] hover:bg-[#EFE6DC]"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Custom Date Pickers (Shown if Custom is selected) */}
                  {dateFilterType === "custom" && (
                    <div className="flex items-center gap-2 rounded-xl border border-[#E8DED4] bg-white px-2.5 py-1 text-xs shadow-2xs">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="text-xs text-gray-700 outline-none"
                        title="Start Date"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="text-xs text-gray-700 outline-none"
                        title="End Date"
                      />
                    </div>
                  )}

                  {/* 2. Searchable Employee Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmployeeDropdownOpen(!employeeDropdownOpen)}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition shadow-2xs ${
                        selectedEmployeeKey
                          ? "border-[#754329] bg-[#FAF4ED] text-[#754329]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <Filter size={14} className="text-[#8C5835]" />
                      <span className="max-w-[140px] truncate sm:max-w-[180px]">
                        {selectedEmployee ? selectedEmployee.employeeName : "All Employees"}
                      </span>
                      <ChevronDown size={14} className="text-gray-400" />
                    </button>

                    {/* Employee Dropdown Popover */}
                    {employeeDropdownOpen && (
                      <div className="absolute left-0 mt-2 z-50 w-80 rounded-2xl border border-[#EEE5DC] bg-white p-2.5 shadow-xl animate-in fade-in slide-in-from-top-2">
                        <div className="relative mb-2">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search employee by name, seat..."
                            value={employeeSearchFilter}
                            onChange={(e) => setEmployeeSearchFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#754329]"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeKey(null);
                              setEmployeeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition ${
                              !selectedEmployeeKey
                                ? "bg-[#FAF4ED] text-[#754329]"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            All Employees ({availableEmployees.length})
                          </button>

                          {filteredDropdownEmployees.length === 0 ? (
                            <div className="py-4 text-center text-xs text-gray-400">
                              No employees found with orders
                            </div>
                          ) : (
                            filteredDropdownEmployees.map((emp) => {
                              const empKey = (emp.employeeId ? `id_${emp.employeeId}` : emp.employeeName).trim().toLowerCase();
                              const isSelected = selectedEmployeeKey === empKey;

                              return (
                                <button
                                  key={empKey}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployeeKey(empKey);
                                    setEmployeeDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between ${
                                    isSelected
                                      ? "bg-[#FAF4ED] text-[#754329] font-bold"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="truncate pr-2">
                                    <p className="font-bold text-gray-900 truncate">{emp.employeeName}</p>
                                    <p className="text-[10px] text-gray-400 truncate">
                                      {emp.department} &bull; {emp.seat}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-[#FAF4ED] px-2 py-0.5 text-[10px] font-bold text-[#754329] border border-[#E8DED4]">
                                    {emp.orderCount} orders
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Clear Filter Button */}
                  {selectedEmployeeKey && (
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeKey(null)}
                      className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                      title="Clear employee filter"
                    >
                      <X size={14} />
                      Clear
                    </button>
                  )}

                  {/* 3. Global Search Input */}
                  <div className="relative w-full sm:w-60">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Search orders, items..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-gray-800 outline-none transition placeholder-gray-400 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* IF AN EMPLOYEE IS SELECTED: DISPLAY DETAILED SUMMARY & MORNING/EVENING ORDERS */}
            {selectedEmployee ? (
              <div className="space-y-6">
                {/* 1. Selected Employee Profile Header Card */}
                <div className="rounded-2xl border border-[#EEE5DC] bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-bold text-lg text-white shadow-md ${selectedEmployee.avatarBg}`}
                      >
                        {selectedEmployee.avatarInitials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-xl font-black text-gray-900">
                            {selectedEmployee.employeeName}
                          </h3>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {selectedEmployee.employeeEmail && (
                            <span className="font-medium text-gray-600">
                              {selectedEmployee.employeeEmail}
                            </span>
                          )}
                          <span className="text-gray-300">&bull;</span>
                          <span className="rounded-md bg-[#FAF4ED] px-2 py-0.5 font-semibold text-[#754329] border border-[#EEDFCE]">
                            {selectedEmployee.department}
                          </span>
                          <span className="text-gray-300">&bull;</span>
                          <div className="flex items-center gap-1 font-semibold text-gray-700">
                            <MapPin size={13} className="text-[#8C5835]" />
                            <span>{selectedEmployee.seat}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Back to All Employees Action */}
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeKey(null)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-2xs self-start sm:self-auto"
                    >
                      <X size={15} />
                      Back to All Employees
                    </button>
                  </div>
                </div>

                {/* 2. SYMMETRICAL SESSIONS GRID: MORNING & EVENING SESSIONS SIDE-BY-SIDE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  {/* MORNING ORDERS SESSION */}
                  <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4 sm:p-5 shadow-xs flex flex-col h-full">
                    <div className="mb-3 flex items-center justify-between border-b border-[#F0E6DB] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                          <Sun size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#342219]">Morning Orders</h4>
                          <p className="text-[11px] text-gray-400">
                            {periodConfig.morningStart} AM - {periodConfig.morningEnd} AM
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                        {morningOrders.length} {morningOrders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>

                    {morningOrders.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-xs text-gray-400">
                        <Sun className="mb-1.5 h-6 w-6 text-amber-200" />
                        <p className="font-medium text-gray-500">No morning orders</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {morningOrders.map((order) => (
                          <OrderCard key={order.id} order={order} itemsById={itemsById} itemsByName={itemsByName} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* EVENING ORDERS SESSION */}
                  <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4 sm:p-5 shadow-xs flex flex-col h-full">
                    <div className="mb-3 flex items-center justify-between border-b border-[#F0E6DB] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Moon size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#342219]">Evening Orders</h4>
                          <p className="text-[11px] text-gray-400">
                            04:00 PM - 11:59 PM
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
                        {eveningOrders.length} {eveningOrders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>

                    {eveningOrders.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-xs text-gray-400">
                        <Moon className="mb-1.5 h-6 w-6 text-indigo-200" />
                        <p className="font-medium text-gray-500">No evening orders</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {eveningOrders.map((order) => (
                          <OrderCard key={order.id} order={order} itemsById={itemsById} itemsByName={itemsByName} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. SECTION C: OTHER ORDERS (If any exist outside standard periods) */}
                {otherOrders.length > 0 && (
                  <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4 sm:p-5 shadow-xs">
                    <div className="mb-3 flex items-center justify-between border-b border-[#F0E6DB] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-700 border border-gray-200">
                          <Layers size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#342219]">Other Orders</h4>
                          <p className="text-[11px] text-gray-400">Outside standard hours</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700 border border-gray-200">
                        {otherOrders.length} {otherOrders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {otherOrders.map((order) => (
                        <OrderCard key={order.id} order={order} itemsById={itemsById} itemsByName={itemsByName} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Total Amount Calculated at the End */}
                <div className="rounded-2xl border border-[#EEE5DC] bg-white p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FAF4ED] text-[#754329] border border-[#EEDFCE]">
                        <Receipt size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                          Total Amount Calculated
                        </h4>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {selectedEmployee.orders.length} {selectedEmployee.orders.length === 1 ? "order" : "orders"} &bull; {selectedEmployee.orders.reduce((acc, o) => acc + o.items.reduce((sum, it) => sum + (it.qty || 1), 0), 0)} items
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-gray-400 font-medium">Total Spend</span>
                      <p className="text-3xl font-black text-[#754329]">
                        ₹ {selectedEmployee.totalSpend.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* IF NO EMPLOYEE SELECTED: DISPLAY ALL EMPLOYEES DIRECTORY TABLE */
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
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-14 text-center text-xs text-gray-500">
                            <RotateCw className="mx-auto mb-2 h-7 w-7 text-[#8E6548] animate-spin" />
                            <p className="font-semibold text-gray-700">Loading orders...</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Fetching employee order records for the selected period.
                            </p>
                          </td>
                        </tr>
                      ) : paginatedEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-14 text-center text-xs text-gray-500">
                            <Sparkles className="mx-auto mb-2 h-8 w-8 text-[#A08C7D]" />
                            <p className="font-semibold text-gray-700">No employee orders found for this date range</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Orders placed by employees will appear here in real-time.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        paginatedEmployees.map((emp) => {
                          return (
                            <tr
                              key={emp.employeeKey}
                              onClick={() => setSelectedEmployeeKey(emp.employeeKey)}
                              className="cursor-pointer transition duration-150 hover:bg-[#FAF6F2]"
                            >
                              {/* Employee Info (Avatar + Name + Email) */}
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
                                    {emp.employeeEmail ? (
                                      <p className="text-[10px] text-gray-400 mt-0.5">{emp.employeeEmail}</p>
                                    ) : (
                                      <p className="text-[10px] text-gray-400 mt-0.5">
                                        Last active: {emp.latestOrderTime}
                                      </p>
                                    )}
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
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    emp.latestStatus === "Pending"
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
                    Total Employees with Orders:{" "}
                    <span className="font-bold text-gray-900">{employeeGroups.length}</span>
                  </div>
                </div>
              </div>
            )}
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

// Sub-component: Order Card with full items breakdown
function OrderCard({
  order,
  itemsById,
  itemsByName,
}: {
  order: OrderRecord;
  itemsById: Record<string, MenuItem>;
  itemsByName: Record<string, MenuItem>;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-[#754329] hover:shadow-md">
      <div>
        {/* Order Card Header */}
        <div className="flex items-center justify-between border-b border-[#F0E6DB] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-[#754329]">
              {order.id}
            </span>
            <span className="text-[11px] text-gray-300">&bull;</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Clock size={11} />
              {order.orderTime}
            </span>
          </div>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              order.status === "Pending"
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

        {/* Seat / Location */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1 font-semibold text-gray-700">
            <MapPin size={12} className="text-[#8C5835]" />
            <span>{order.seat}</span>
          </div>
          {order.locationName && (
            <span className="text-[10px] text-gray-400">{order.locationName}</span>
          )}
        </div>

        {/* Ordered Items Table / List */}
        <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100 bg-[#FAF8F5]/50 p-2 text-xs">
          {order.items.map((item, idx) => {
            const fullName = (item.name || "").trim();
            const baseName = fullName.replace(/\s*\(.*?\)\s*$/, "").trim().toLowerCase();
            const fullKey = fullName.toLowerCase();
            const resolvedImage =
              item.image ||
              (item.itemId && itemsById[item.itemId]?.image) ||
              itemsByName[fullKey]?.image ||
              itemsByName[baseName]?.image ||
              "";

            return (
              <div key={idx} className="flex items-center justify-between py-2 first:pt-1 last:pb-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E8DED4] bg-white overflow-hidden shadow-2xs">
                    {resolvedImage ? (
                      <img
                        src={resolvedImage}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                          const parent = (e.currentTarget as HTMLElement).parentElement;
                          if (parent) {
                            const placeholder = parent.querySelector(".order-neutral-placeholder");
                            if (placeholder) (placeholder as HTMLElement).style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`order-neutral-placeholder flex h-full w-full items-center justify-center text-[#8C5835] ${
                        resolvedImage ? "hidden" : "flex"
                      }`}
                    >
                      <Coffee size={14} />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <span>Qty: {item.qty}</span>
                      <span>&bull;</span>
                      <span>₹{item.price} each</span>
                      {item.preference && (
                        <>
                          <span>&bull;</span>
                          <span className="font-medium text-[#754329] bg-[#FAF4ED] px-1 rounded">
                            {item.preference}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="font-bold text-gray-900">
                  ₹ {(item.price * item.qty).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Special Instructions / Notes */}
        {order.notes && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[10px] text-amber-900">
            <span className="font-bold">Note: </span>
            {order.notes}
          </div>
        )}
      </div>

        {/* Order Total & Subtotal Breakdown */}
      <div className="mt-3 border-t border-[#F0E6DB] pt-2">
        {(order.discount > 0 || order.adjustmentAmount !== 0) && (
          <div className="mb-1 flex justify-between text-[10px] text-gray-400">
            <span>Subtotal: ₹{order.subtotal.toFixed(2)}</span>
            {order.discount > 0 && <span className="text-emerald-600">-₹{order.discount}</span>}
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-600">Order Total</span>
          <span className="text-sm font-black text-[#754329]">
            ₹ {order.total.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
