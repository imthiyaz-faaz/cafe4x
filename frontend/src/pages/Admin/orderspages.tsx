import { createPortal } from "react-dom";
import { formatCurrency, getActiveOrgCurrency } from "../../utils/currencies";
import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  User,
  Clock,
  ArrowLeft,
  Calendar,
  RotateCw,
  Building2,
  Users,
  ShoppingBag,
  Banknote,
  CheckCircle2,
  X,
  Coffee,
  Flame,
  Download,
  Filter,
  Check,
  ChevronDown,
} from "lucide-react";
import { itemsApi, type MenuItem } from "../../services/itemsApi";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import {
  orderApi,
  type LocationOrderSummary,
  type ProviderOrder,
} from "../../services/orderApi";
import { locationApi, type SeatItem } from "../../services/locations";
import { userApi, type UserItem } from "../../services/userApi";
import { organizationApi } from "../../services/organizationApi";
import { workingHoursApi } from "../../services/workingHoursApi";
import { getDateStringsInTimezone } from "../../utils/orderTimeClassification";
import { formatSeatIdentifier, formatOrderSeat } from "../../utils/seatFormatter";
import { formatOrderId } from "../../utils/orderFormatter";

type ActiveView = "locations" | "employees";
type PeriodType = "daily" | "weekly" | "monthly";
type TopDateFilterType = "today" | "yesterday" | "custom";

interface EmployeeOption {
  id: string; // user id or normalized name/email
  name: string;
  email?: string;
  seatIdentifier?: string;
}

export default function OrdersPage() {
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;

  // Organization Currency & Timezone
  const [currency, setCurrency] = useState<string | null>(null);
  const [orgTimezone, setOrgTimezone] = useState<string>("Asia/Dubai");

  // Navigation View State: "locations" or "employees"
  const [activeView, setActiveView] = useState<ActiveView>("locations");
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string } | null>(null);

  // Top Location Header Quick Filter State: today | yesterday | custom
  const [topDateFilter, setTopDateFilter] = useState<TopDateFilterType>("today");
  const [topCustomStartDate, setTopCustomStartDate] = useState<string>("");
  const [topCustomEndDate, setTopCustomEndDate] = useState<string>("");

  // Location Employees View Filters:
  // 1. Employee Filter (All Employees vs specific employee)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState<boolean>(false);
  const [employeeSearchText, setEmployeeSearchText] = useState<string>("");
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const employeeMenuRef = useRef<HTMLDivElement>(null);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 300 });

  // 2. Period Filter: Daily | Weekly | Monthly
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("daily");

  // Custom Calendar Popover state
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const calendarPopoverRef = useRef<HTMLDivElement>(null);
  const calendarMenuRef = useRef<HTMLDivElement>(null);
  const [calendarViewYear, setCalendarViewYear] = useState<number>(() => new Date().getFullYear());
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(() => new Date().getMonth()); // 0-11
  const [calendarDropdownPos, setCalendarDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 320 });

  // 3. Date Selectors
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [selectedWeeklyDate, setSelectedWeeklyDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  // Applied Filter State: triggers data query on "Apply Filter"
  const [appliedFilters, setAppliedFilters] = useState<{
    employeeId: string;
    period: PeriodType;
    startDate?: string;
    endDate?: string;
    displayDateLabel: string;
  }>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    return {
      employeeId: "all",
      period: "daily",
      startDate: todayStr,
      endDate: todayStr,
      displayDateLabel: formatFriendlyDisplayDate(todayStr),
    };
  });

  // Data States
  const [locations, setLocations] = useState<LocationOrderSummary[]>([]);
  const [locationSeats, setLocationSeats] = useState<SeatItem[]>([]);
  const [orgEmployees, setOrgEmployees] = useState<UserItem[]>([]);
  const [locationOrders, setLocationOrders] = useState<ProviderOrder[]>([]);

  // Search & Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>("");

  // Modal for Viewing Single Order Details
  const [inspectedOrder, setInspectedOrder] = useState<ProviderOrder | null>(null);

  // Fallback Menu Items cache for order item images & metadata
  const [itemImagesMap, setItemImagesMap] = useState<Record<string, string>>({});
  const [itemsByIdMap, setItemsByIdMap] = useState<Record<string, MenuItem>>({});

  // Calculate and update portal position for employee dropdown
  const updateEmployeeDropdownPos = () => {
    if (employeeDropdownRef.current) {
      const rect = employeeDropdownRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.max(rect.width, 280);
      let left = rect.left;
      if (left + width > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - width - 16);
      }
      setEmployeeDropdownPos({
        top: rect.bottom + 8,
        left,
        width,
      });
    }
  };

  // Calculate and update portal position for calendar popover
  const updateCalendarDropdownPos = () => {
    if (calendarPopoverRef.current) {
      const rect = calendarPopoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(320, viewportWidth - 32);
      let left = rect.left;
      if (left + width > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - width - 16);
      }
      setCalendarDropdownPos({
        top: rect.bottom + 8,
        left,
        width,
      });
    }
  };

  // Reposition portal popovers on window scroll or resize
  useEffect(() => {
    if (!employeeDropdownOpen && !isCalendarOpen) return;
    const handleReposition = () => {
      if (employeeDropdownOpen) updateEmployeeDropdownPos();
      if (isCalendarOpen) updateCalendarDropdownPos();
    };
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [employeeDropdownOpen, isCalendarOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        employeeDropdownRef.current &&
        !employeeDropdownRef.current.contains(target) &&
        employeeMenuRef.current &&
        !employeeMenuRef.current.contains(target)
      ) {
        setEmployeeDropdownOpen(false);
      }
      if (
        calendarPopoverRef.current &&
        !calendarPopoverRef.current.contains(target) &&
        calendarMenuRef.current &&
        !calendarMenuRef.current.contains(target)
      ) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Menu items cache
  useEffect(() => {
    let isMounted = true;
    itemsApi
      .getItems(currentShortCode || undefined)
      .then((itemsList) => {
        if (!isMounted || !Array.isArray(itemsList)) return;
        const nameMap: Record<string, string> = {};
        const idMap: Record<string, MenuItem> = {};
        itemsList.forEach((it) => {
          if (it.id) idMap[it.id] = it;
          if (it.name) {
            const rawKey = it.name.toLowerCase().trim();
            const cleanKey = rawKey.replace(/\s*\(.*?\)\s*$/, "").trim();
            if (it.image) {
              nameMap[rawKey] = it.image;
              nameMap[cleanKey] = it.image;
            }
          }
        });
        setItemImagesMap(nameMap);
        setItemsByIdMap(idMap);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentShortCode]);

  // Fetch Organization Info & Working Hours Timezone
  useEffect(() => {
    let isMounted = true;
    organizationApi
      .getOrganizations()
      .then((organizations) => {
        if (!isMounted) return;
        const currentOrg = organizations.find(
          (o) => o.shortCode.toUpperCase() === currentShortCode
        );
        if (currentOrg?.currency) {
          setCurrency(currentOrg.currency);
        } else {
          setCurrency(null);
        }
      })
      .catch(() => {});

    workingHoursApi
      .getWorkingHours()
      .then((res) => {
        if (!isMounted) return;
        if (res?.workingHours?.timezone) {
          setOrgTimezone(res.workingHours.timezone);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentShortCode]);

  // Top Location Header Date Range Computation
  const topDateRange = useMemo(() => {
    const { todayStr, yesterdayStr } = getDateStringsInTimezone(orgTimezone);
    if (topDateFilter === "today") {
      return { startDate: todayStr, endDate: todayStr };
    } else if (topDateFilter === "yesterday") {
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    } else {
      return {
        startDate: topCustomStartDate || undefined,
        endDate: topCustomEndDate || undefined,
      };
    }
  }, [topDateFilter, topCustomStartDate, topCustomEndDate, orgTimezone]);

  const formatPrice = (amount: number) => {
    return formatCurrency(amount, currency || getActiveOrgCurrency(currentShortCode));
  };

  // 1. Fetch Locations with Order Aggregates (Locations View)
  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const data = await orderApi.getOrderLocations({
        startDate: topDateRange.startDate,
        endDate: topDateRange.endDate,
      });
      setLocations(data || []);
    } catch (err) {
      console.error("Failed to fetch order locations:", err);
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Location Metadata & Orders for Employee View
  const loadLocationEmployeeViewData = async (
    locId: string,
    filters: { employeeId: string; startDate?: string; endDate?: string }
  ) => {
    setIsLoading(true);
    try {
      // Find the employee option if a specific employee is selected, so we can resolve both ID, email, and name
      const targetEmp = filters.employeeId !== "all" 
        ? employeeDropdownOptions.find((e) => e.id === filters.employeeId)
        : null;
      
      const employeeQueryParam = targetEmp 
        ? (targetEmp.id || targetEmp.email || targetEmp.name) 
        : (filters.employeeId !== "all" ? filters.employeeId : undefined);

      // Fetch seats, org users, and orders in parallel
      const [seatsRes, usersRes, ordersRes] = await Promise.all([
        locationApi.getSeats(locId).catch(() => [] as SeatItem[]),
        userApi.getUsers("Employee", currentShortCode || undefined).catch(() => [] as UserItem[]),
        orderApi.getOrders({
          location: locId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          employee: employeeQueryParam,
        }).catch(() => [] as ProviderOrder[]),
      ]);

      // In case the backend matched broadly or if orders had different casing/unlinked fields,
      // apply client-side guarantee filter when a specific employee is chosen
      let finalOrders = ordersRes || [];
      if (targetEmp) {
        const empName = (targetEmp.name || "").trim().toLowerCase();
        const empEmail = (targetEmp.email || "").trim().toLowerCase();
        const empId = (targetEmp.id || "").trim().toLowerCase();

        finalOrders = finalOrders.filter((o) => {
          const oEmpId = (o.employeeId || "").trim().toLowerCase();
          const oEmpName = (o.employeeName || "").trim().toLowerCase();
          const oEmpEmail = (o.employeeEmail || "").trim().toLowerCase();

          return (
            (empId && oEmpId === empId) ||
            (empName && oEmpName === empName) ||
            (empEmail && oEmpEmail === empEmail) ||
            (empName && oEmpName.includes(empName)) ||
            (empEmail && oEmpEmail.includes(empEmail))
          );
        });
      }

      setLocationSeats(seatsRes || []);
      setOrgEmployees(usersRes || []);
      setLocationOrders(finalOrders);
    } catch (err) {
      console.error("Failed to load location employee view data:", err);
      setLocationOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch when switching to locations view or when top date range changes
  useEffect(() => {
    if (activeView === "locations") {
      fetchLocations();
    }
  }, [activeView, topDateRange]);

  // Re-fetch when in employee view and applied filters change
  useEffect(() => {
    if (activeView === "employees" && selectedLocation) {
      loadLocationEmployeeViewData(selectedLocation.id, {
        employeeId: appliedFilters.employeeId,
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
      });
    }
  }, [activeView, selectedLocation?.id, appliedFilters]);

  // Helper to calculate date range based on period & inputs
  const calculateDateRange = (
    period: PeriodType,
    dailyDate: string,
    weeklyDate: string,
    monthStr: string
  ): { startDate: string; endDate: string; label: string } => {
    if (period === "daily") {
      const d = dailyDate || new Date().toISOString().substring(0, 10);
      return {
        startDate: d,
        endDate: d,
        label: formatFriendlyDisplayDate(d),
      };
    } else if (period === "weekly") {
      const base = new Date(weeklyDate ? `${weeklyDate}T00:00:00` : new Date());
      const day = base.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon);
      const sun = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon + 6);

      const monStr = formatDateYMD(mon);
      const sunStr = formatDateYMD(sun);
      return {
        startDate: monStr,
        endDate: sunStr,
        label: `${formatFriendlyDisplayDate(monStr)} – ${formatFriendlyDisplayDate(sunStr)}`,
      };
    } else {
      // Monthly
      const parts = (monthStr || "").split("-");
      const y = parseInt(parts[0], 10) || new Date().getFullYear();
      const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);

      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);

      const startStr = formatDateYMD(firstDay);
      const endStr = formatDateYMD(lastDay);

      const monthName = firstDay.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return {
        startDate: startStr,
        endDate: endStr,
        label: monthName,
      };
    }
  };

  // Handle Apply Filter click
  const handleApplyFilter = () => {
    const range = calculateDateRange(
      selectedPeriod,
      selectedDailyDate,
      selectedWeeklyDate,
      selectedMonth
    );

    setAppliedFilters({
      employeeId: selectedEmployeeId,
      period: selectedPeriod,
      startDate: range.startDate,
      endDate: range.endDate,
      displayDateLabel: range.label,
    });
  };

  // Handle Location Click from Locations List
  const handleSelectLocation = (loc: LocationOrderSummary) => {
    setSelectedLocation({ id: loc.id, name: loc.name });
    setActiveView("employees");

    // Initialize with today's date
    const today = new Date();
    const todayStr = formatDateYMD(today);
    setSelectedEmployeeId("all");
    setSelectedPeriod("daily");
    setSelectedDailyDate(todayStr);
    setSelectedWeeklyDate(todayStr);
    setSelectedMonth(todayStr.substring(0, 7));

    setAppliedFilters({
      employeeId: "all",
      period: "daily",
      startDate: todayStr,
      endDate: todayStr,
      displayDateLabel: formatFriendlyDisplayDate(todayStr),
    });
  };

  // Seat map for fast seat identifier resolution by employee id, name, or email
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatItem>();
    (locationSeats || []).forEach((s) => {
      if (s.employeeId) map.set(s.employeeId, s);
      if (s.employeeEmail) map.set(s.employeeEmail.toLowerCase().trim(), s);
      if (s.employee) map.set(s.employee.toLowerCase().trim(), s);
      if (s.employeeName) map.set(s.employeeName.toLowerCase().trim(), s);
    });
    return map;
  }, [locationSeats]);

  // Combined Distinct Employee Options for the Employee Filter Dropdown
  const employeeDropdownOptions = useMemo<EmployeeOption[]>(() => {
    const optMap = new Map<string, EmployeeOption>();

    // 1. Employees from location's assigned seats
    (locationSeats || []).forEach((s) => {
      const name = s.employeeName || (s.employee && !s.employee.includes("@") ? s.employee : "") || (s.employeeEmail ? s.employeeEmail.split("@")[0] : "");
      const email = s.employeeEmail || (s.employee && s.employee.includes("@") ? s.employee : undefined);
      if (name || email) {
        const id = s.employeeId || email || name;
        optMap.set(id, {
          id,
          name: name || email || "Assigned Employee",
          email,
          seatIdentifier: s.displayId || (s.number ? `SEAT-${parseInt(s.number, 10) || s.number}` : undefined),
        });
      }
    });

    // 2. Organization Employees
    (orgEmployees || []).forEach((u) => {
      if (u.name || u.email) {
        const id = u.id || u.email;
        if (!optMap.has(id)) {
          optMap.set(id, {
            id,
            name: u.name || u.userName || u.email,
            email: u.email,
          });
        }
      }
    });

    // 3. Orders placed in this location (in case an unassigned employee ordered)
    (locationOrders || []).forEach((o) => {
      if (o.employeeName || o.employeeEmail || o.employeeId) {
        const id = o.employeeId || o.employeeEmail || o.employeeName;
        if (id && !optMap.has(id)) {
          optMap.set(id, {
            id,
            name: o.employeeName || o.employeeEmail || "Employee",
            email: o.employeeEmail || undefined,
            seatIdentifier: o.seat,
          });
        }
      }
    });

    return Array.from(optMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [locationSeats, orgEmployees, locationOrders]);

  // Filtered dropdown options based on search input inside the dropdown
  const filteredDropdownOptions = useMemo(() => {
    if (!employeeSearchText.trim()) return employeeDropdownOptions;
    const q = employeeSearchText.toLowerCase();
    return employeeDropdownOptions.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.email && opt.email.toLowerCase().includes(q))
    );
  }, [employeeDropdownOptions, employeeSearchText]);

  // Resolve currently selected employee label for dropdown button
  const selectedEmployeeOption = useMemo(() => {
    if (selectedEmployeeId === "all") return null;
    return (
      employeeDropdownOptions.find((e) => e.id === selectedEmployeeId) || null
    );
  }, [selectedEmployeeId, employeeDropdownOptions]);

  // Resolve currently applied employee label for table header
  const appliedEmployeeOption = useMemo(() => {
    if (appliedFilters.employeeId === "all") return null;
    return (
      employeeDropdownOptions.find((e) => e.id === appliedFilters.employeeId) || null
    );
  }, [appliedFilters.employeeId, employeeDropdownOptions]);

  // Dynamic Summary Metrics calculated strictly from filtered location orders
  const summaryMetrics = useMemo(() => {
    let totalOrders = locationOrders.length;
    let totalAmount = 0;
    let deliveredOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;

    locationOrders.forEach((o) => {
      totalAmount += Number(o.total) || 0;
      const st = (o.status || "Pending").toLowerCase();
      if (st === "delivered") {
        deliveredOrders += 1;
      } else if (st === "cancelled" || st === "canceled") {
        cancelledOrders += 1;
      } else {
        // Pending, Preparing, Ready
        pendingOrders += 1;
      }
    });

    return {
      totalOrders,
      totalAmount,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
    };
  }, [locationOrders]);

  // Export Filtered Orders to CSV
  const handleExportOrders = () => {
    if (!locationOrders || locationOrders.length === 0) {
      alert("No orders to export for the selected filter.");
      return;
    }

    const headers = [
      "Order ID",
      "Employee Name",
      "Employee Email",
      "Seat",
      "Location",
      "Items",
      "Subtotal",
      "Total Amount",
      "Order Time",
      "Status",
      "Created At",
    ];

    const rows = locationOrders.map((o) => {
      const itemsSummary = (o.items || [])
        .map((it) => `${it.name} x${it.qty}`)
        .join("; ");
      const seatVal = formatSeatIdentifier(
        o.seatId || o.seat || (o.employeeId ? seatMap.get(o.employeeId)?.displayId : "")
      );
      return [
        `"${formatOrderId(o)}"`,
        `"${o.employeeName || ""}"`,
        `"${o.employeeEmail || ""}"`,
        `"${seatVal}"`,
        `"${o.locationName || selectedLocation?.name || ""}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        `"${o.subtotal ?? o.total}"`,
        `"${o.total}"`,
        `"${o.time || ""}"`,
        `"${o.status}"`,
        `"${o.createdAt || ""}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateTag = appliedFilters.startDate || "orders";
    link.setAttribute(
      "download",
      `${selectedLocation?.name || "location"}_orders_${dateTag}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status badge renderer
  const renderStatusBadge = (status?: string) => {
    const s = (status || "Pending").toLowerCase();
    if (s === "delivered") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#EAF7ED] text-[#28A745] border border-[#CDEFD4]">
          Delivered
        </span>
      );
    } else if (s === "cancelled" || s === "canceled") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#FDEEED] text-[#DC3545] border border-[#F9CFCC]">
          Cancelled
        </span>
      );
    } else {
      // Pending, Preparing, Ready
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#FEF6E9] text-[#D97706] border border-[#FDE5BD]">
          Pending
        </span>
      );
    }
  };

  // Filtered Locations (in Locations list view)
  const filteredLocations = useMemo(() => {
    if (!locationSearchQuery.trim()) return locations;
    const q = locationSearchQuery.toLowerCase();
    return locations.filter((l) => l.name.toLowerCase().includes(q));
  }, [locations, locationSearchQuery]);

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20 text-[#4A3E3D]">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
          {/* ========================================================================= */}
          {/* HEADER SECTION                                                           */}
          {/* ========================================================================= */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              {/* Breadcrumb Navigation */}
              <nav className="flex items-center gap-1.5 text-xs text-[#8A7667] mb-1.5">
                <button
                  onClick={() => {
                    setActiveView("locations");
                    setSelectedLocation(null);
                  }}
                  className={`hover:text-[#70452D] font-semibold transition-colors ${
                    activeView === "locations" ? "text-[#70452D] font-bold" : ""
                  }`}
                >
                  Orders
                </button>

                {selectedLocation && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-[#A8907E]" />
                    <span className="text-[#70452D] font-bold">
                      {selectedLocation.name}
                    </span>
                  </>
                )}
              </nav>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#342219] tracking-tight flex items-center gap-3">
                {activeView === "locations" ? (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center shadow-xs">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span>Orders by Location</span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-[#F6ECE2] text-[#8C5835] flex items-center justify-center shadow-xs">
                      <Users className="w-5 h-5" />
                    </div>
                    <span>{selectedLocation?.name} – Employees Orders</span>
                  </>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-[#8A7667] mt-1">
                {activeView === "locations"
                  ? "Select a location to inspect assigned employee orders and total spending."
                  : `Track and analyze employee orders for ${selectedLocation?.name} with flexible filters.`}
              </p>
            </div>

            {/* Quick Actions / View Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {activeView === "locations" ? (
                <>
                  {/* Locations view quick date toggle: Today | Yesterday | Custom */}
                  <div className="inline-flex rounded-2xl bg-white/90 p-1 shadow-xs border border-[#EEE5DC]">
                    <button
                      onClick={() => setTopDateFilter("today")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                        topDateFilter === "today"
                          ? "bg-[#70452D] text-white shadow-xs"
                          : "text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1]"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setTopDateFilter("yesterday")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                        topDateFilter === "yesterday"
                          ? "bg-[#70452D] text-white shadow-xs"
                          : "text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1]"
                      }`}
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => setTopDateFilter("custom")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                        topDateFilter === "custom"
                          ? "bg-[#70452D] text-white shadow-xs"
                          : "text-[#70523E] hover:text-[#342219] hover:bg-[#FAF6F1]"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {topDateFilter === "custom" && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-[#EEE5DC] shadow-xs text-xs">
                      <Calendar className="w-3.5 h-3.5 text-[#8C5835]" />
                      <input
                        type="date"
                        value={topCustomStartDate}
                        onChange={(e) => setTopCustomStartDate(e.target.value)}
                        className="bg-transparent border-none text-[#342219] focus:outline-none text-xs"
                      />
                      <span className="text-[#A8907E]">to</span>
                      <input
                        type="date"
                        value={topCustomEndDate}
                        onChange={(e) => setTopCustomEndDate(e.target.value)}
                        className="bg-transparent border-none text-[#342219] focus:outline-none text-xs"
                      />
                    </div>
                  )}

                  <button
                    onClick={fetchLocations}
                    title="Refresh Locations"
                    className="p-2 text-[#70523E] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#8C5835]" : ""}`} />
                  </button>
                </>
              ) : (
                <>
                  {/* Back to Locations Button */}
                  <button
                    onClick={() => {
                      setActiveView("locations");
                      setSelectedLocation(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#70452D] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-xs transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Locations</span>
                  </button>

                  {/* Refresh Button */}
                  <button
                    onClick={() => {
                      if (selectedLocation) {
                        loadLocationEmployeeViewData(selectedLocation.id, {
                          employeeId: appliedFilters.employeeId,
                          startDate: appliedFilters.startDate,
                          endDate: appliedFilters.endDate,
                        });
                      }
                    }}
                    title="Refresh Orders"
                    className="p-2 text-[#70523E] bg-white border border-[#EEE5DC] rounded-2xl hover:bg-[#FAF6F1] shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#8C5835]" : ""}`} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VIEW 1: LOCATIONS LIST VIEW                                               */}
          {/* ========================================================================= */}
          {activeView === "locations" && (
            <div>
              {/* Search Bar for Locations */}
              <div className="mb-6 flex items-center justify-between">
                <div className="relative w-full max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8907E]" />
                  <input
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full pl-10 pr-4 py-2 bg-white/95 border border-[#EEE5DC] rounded-2xl text-xs sm:text-sm text-[#342219] placeholder-[#A8907E] focus:outline-none focus:ring-2 focus:ring-[#8C5835] focus:border-transparent shadow-xs"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="py-24 text-center">
                  <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C5835] mb-3" />
                  <p className="text-[#8A7667] text-sm">Loading location order summaries from database...</p>
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="py-20 text-center bg-white/80 rounded-3xl border border-[#EEE5DC] p-8 shadow-xs">
                  <Building2 className="w-12 h-12 text-[#D5C2B1] mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[#342219]">No locations found</h3>
                  <p className="text-xs text-[#8A7667] mt-1 max-w-sm mx-auto">
                    No location order activity was found for the selected time filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLocations.map((loc) => (
                    <div
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc)}
                      className="group flex flex-col justify-between rounded-3xl border border-[#EEE5DC] bg-white/95 p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer backdrop-blur-xs hover:-translate-y-0.5"
                    >
                      <div>
                        {/* Location Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835]">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              loc.status === "Active"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                            }`}
                          >
                            • {loc.status || "Active"}
                          </span>
                        </div>

                        {/* Location Name */}
                        <h3 className="text-lg font-bold text-[#342219] group-hover:text-[#70452D] transition-colors">
                          {loc.name}
                        </h3>

                        {/* Location Stats */}
                        <div className="mt-4 space-y-2 text-xs text-[#70523E]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-medium">
                              <Users className="w-4 h-4 text-[#A8907E]" />
                              <span>Assigned Employees:</span>
                            </span>
                            <span className="font-bold text-[#342219]">{loc.totalEmployees || 0}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-medium">
                              <ShoppingBag className="w-4 h-4 text-[#A8907E]" />
                              <span>Total Orders:</span>
                            </span>
                            <span className="font-bold text-[#342219]">{loc.totalOrders}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#EADBCE]/60">
                            <span className="flex items-center gap-2 font-medium">
                              <Banknote className="w-4 h-4 text-[#8C5835]" />
                              <span>Total Amount:</span>
                            </span>
                            <span className="font-black text-sm text-[#784D34]">
                              {formatPrice(loc.totalAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Order Status Breakdown: Pending & Delivered */}
                        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                            <span className="flex items-center gap-1.5 font-bold text-[11px] text-amber-900">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                              Pending
                            </span>
                            <span className="font-mono font-bold text-amber-900">{loc.pendingOrders}</span>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                            <span className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-900">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Delivered
                            </span>
                            <span className="font-mono font-bold text-emerald-900">{loc.deliveredOrders}</span>
                          </div>
                        </div>
                      </div>

                      {/* View Button Footer */}
                      <div className="mt-5 pt-3 border-t border-[#EEE5DC] flex items-center justify-between text-xs font-bold text-[#8C5835] group-hover:text-[#70452D]">
                        <span>View Employees</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: OFFICE – EMPLOYEES ORDERS (REDESIGNED MATCHING REFERENCE IMAGE)     */}
          {/* ========================================================================= */}
          {activeView === "employees" && (
            <div className="space-y-6">
              {/* ===================================================================== */}
              {/* SECTION 1: FILTER BAR CARD (Glassmorphic White Panel)                 */}
              {/* ===================================================================== */}
              <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 p-5 sm:p-6 shadow-sm backdrop-blur-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5 items-end">
                  {/* 1. Employee Filter Dropdown (Col 1-4 on desktop, 1 on mobile/tablet) */}
                  <div className="sm:col-span-1 lg:col-span-4" ref={employeeDropdownRef}>
                    <label className="block text-xs font-bold text-[#342219] mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#8C5835]" />
                      <span>Employee</span>
                    </label>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (!employeeDropdownOpen) {
                            updateEmployeeDropdownPos();
                            setEmployeeDropdownOpen(true);
                            setIsCalendarOpen(false);
                          } else {
                            setEmployeeDropdownOpen(false);
                          }
                        }}
                        className="w-full flex items-center justify-between rounded-2xl border border-[#E8DED4] bg-[#FAF8F5] px-4 py-2.5 sm:py-3 text-xs font-semibold text-[#342219] shadow-2xs hover:bg-[#F4EEE7] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <User className="w-4 h-4 text-[#8C5835] shrink-0" />
                          <span className="truncate">
                            {selectedEmployeeOption ? selectedEmployeeOption.name : "All Employees"}
                          </span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-[#8A7667] shrink-0" />
                      </button>

                      {/* Dropdown Menu Rendered in React Portal to completely escape stacking contexts & clipping */}
                      {employeeDropdownOpen &&
                        createPortal(
                          <div
                            ref={employeeMenuRef}
                            style={{
                              position: "fixed",
                              top: `${employeeDropdownPos.top}px`,
                              left: `${employeeDropdownPos.left}px`,
                              width: `${employeeDropdownPos.width}px`,
                              maxWidth: "calc(100vw - 32px)",
                              zIndex: 99999,
                            }}
                            className="rounded-2xl border border-[#EEE5DC] bg-white/98 p-2.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                          >
                            {/* Search inside dropdown - Sticky Header */}
                            <div className="sticky top-0 bg-white pb-2 z-10 border-b border-[#F4EBE2] mb-1.5">
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8907E]" />
                                <input
                                  type="text"
                                  value={employeeSearchText}
                                  onChange={(e) => setEmployeeSearchText(e.target.value)}
                                  placeholder="Search employees..."
                                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E8DED4] bg-[#FAF8F5] text-[#342219] focus:outline-none focus:border-[#8C5835]"
                                  autoFocus
                                />
                              </div>
                            </div>

                            <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-1 pr-1 pb-1">
                              {/* All Employees Option */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeId("all");
                                  setEmployeeDropdownOpen(false);
                                  setEmployeeSearchText("");
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                                  selectedEmployeeId === "all"
                                    ? "bg-[#FAF4ED] text-[#70452D] font-bold"
                                    : "hover:bg-[#FAF8F5] text-[#342219]"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 text-[#8C5835]" />
                                  <span>All Employees</span>
                                </div>
                                {selectedEmployeeId === "all" && (
                                  <Check className="w-3.5 h-3.5 text-[#8C5835]" />
                                )}
                              </button>

                              {/* Dynamically Loaded Employee List */}
                              {filteredDropdownOptions.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployeeId(opt.id);
                                    setEmployeeDropdownOpen(false);
                                    setEmployeeSearchText("");
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                                    selectedEmployeeId === opt.id
                                      ? "bg-[#FAF4ED] text-[#70452D] font-bold"
                                      : "hover:bg-[#FAF8F5] text-[#342219]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 text-left">
                                    <div className="w-6 h-6 rounded-full bg-[#EAD5C0] text-[#70452D] flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                      {opt.name.substring(0, 2)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{opt.name}</p>
                                      {opt.email && (
                                        <p className="text-[10px] text-[#8A7667] truncate">{opt.email}</p>
                                      )}
                                    </div>
                                  </div>
                                  {selectedEmployeeId === opt.id && (
                                    <Check className="w-3.5 h-3.5 text-[#8C5835] shrink-0 ml-2" />
                                  )}
                                </button>
                              ))}

                              {filteredDropdownOptions.length === 0 && (
                                <div className="py-4 text-center text-xs text-[#8A7667]">
                                  No employees found.
                                </div>
                              )}
                            </div>
                          </div>,
                          document.body
                        )}
                    </div>
                  </div>

                  {/* 2. Period Filter (Daily | Weekly | Monthly) (Col 5-7 on desktop) */}
                  <div className="sm:col-span-1 lg:col-span-3">
                    <label className="block text-xs font-bold text-[#342219] mb-2">
                      Period
                    </label>

                    <div className="flex items-center rounded-2xl border border-[#E8DED4] bg-[#FAF8F5] p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setSelectedPeriod("daily")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                          selectedPeriod === "daily"
                            ? "bg-[#70452D] text-white shadow-xs"
                            : "text-[#70523E] hover:text-[#342219] hover:bg-white/80"
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Daily</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPeriod("weekly")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                          selectedPeriod === "weekly"
                            ? "bg-[#70452D] text-white shadow-xs"
                            : "text-[#70523E] hover:text-[#342219] hover:bg-white/80"
                        }`}
                      >
                        Weekly
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPeriod("monthly")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                          selectedPeriod === "monthly"
                            ? "bg-[#70452D] text-white shadow-xs"
                            : "text-[#70523E] hover:text-[#342219] hover:bg-white/80"
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  {/* 3. Date Selection Input with Custom Modern Calendar (Col 8-10 on desktop) */}
                  <div className="sm:col-span-1 lg:col-span-3" ref={calendarPopoverRef}>
                    <label className="block text-xs font-bold text-[#342219] mb-2 flex items-center justify-between">
                      <span>Date</span>
                      <span className="text-[10px] font-semibold text-[#8C5835] uppercase tracking-wider">
                        {selectedPeriod === "daily" ? "Day" : selectedPeriod === "weekly" ? "Week" : "Month"}
                      </span>
                    </label>

                    <div className="relative">
                      {/* Interactive Custom Date Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCalendarOpen) {
                            // Initialize viewing month/year from current selection
                            if (selectedPeriod === "monthly" && selectedMonth) {
                              const [y, m] = selectedMonth.split("-").map(Number);
                              if (y && m) {
                                setCalendarViewYear(y);
                                setCalendarViewMonth(m - 1);
                              }
                            } else {
                              const refDate = selectedPeriod === "weekly" ? selectedWeeklyDate : selectedDailyDate;
                              if (refDate) {
                                const [y, m] = refDate.split("-").map(Number);
                                if (y && m) {
                                  setCalendarViewYear(y);
                                  setCalendarViewMonth(m - 1);
                                }
                              }
                            }
                            updateCalendarDropdownPos();
                            setIsCalendarOpen(true);
                            setEmployeeDropdownOpen(false);
                          } else {
                            setIsCalendarOpen(false);
                          }
                        }}
                        className="w-full flex items-center justify-between rounded-2xl border border-[#E8DED4] bg-[#FAF8F5] px-4 py-2.5 text-xs font-semibold text-[#342219] shadow-2xs hover:bg-[#F4EEE7] hover:border-[#D5C2B1] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Calendar className="w-4 h-4 text-[#8C5835] shrink-0" />
                          <span className="truncate">
                            {selectedPeriod === "daily" && formatFriendlyDisplayDate(selectedDailyDate)}
                            {selectedPeriod === "weekly" && (() => {
                              const base = new Date(selectedWeeklyDate ? `${selectedWeeklyDate}T00:00:00` : new Date());
                              const day = base.getDay();
                              const diffToMon = (day === 0 ? -6 : 1) - day;
                              const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon);
                              const sun = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon + 6);
                              return `${formatFriendlyDisplayDate(formatDateYMD(mon))} - ${formatFriendlyDisplayDate(formatDateYMD(sun))}`;
                            })()}
                            {selectedPeriod === "monthly" && (() => {
                              const [y, m] = selectedMonth.split("-").map(Number);
                              const d = new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
                              return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                            })()}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#8A7667] shrink-0 rotate-90" />
                      </button>

                      {/* Custom Glassmorphism Calendar Popover Rendered via React Portal */}
                      {isCalendarOpen &&
                        createPortal(
                          <div
                            ref={calendarMenuRef}
                            style={{
                              position: "fixed",
                              top: `${calendarDropdownPos.top}px`,
                              left: `${calendarDropdownPos.left}px`,
                              width: `${calendarDropdownPos.width}px`,
                              maxWidth: "calc(100vw - 32px)",
                              zIndex: 99999,
                            }}
                            className="rounded-2xl border border-[#EEE5DC] bg-white/98 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                          >
                            {/* Calendar Header: Month/Year and Prev/Next */}
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F4EBE2]">
                              <div className="text-xs font-extrabold text-[#342219]">
                                {selectedPeriod === "monthly" ? (
                                  <span>{calendarViewYear}</span>
                                ) : (
                                  <span>
                                    {new Date(calendarViewYear, calendarViewMonth).toLocaleDateString("en-US", {
                                      month: "long",
                                      year: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedPeriod === "monthly") {
                                      setCalendarViewYear((y) => y - 1);
                                    } else {
                                      if (calendarViewMonth === 0) {
                                        setCalendarViewMonth(11);
                                        setCalendarViewYear((y) => y - 1);
                                      } else {
                                        setCalendarViewMonth((m) => m - 1);
                                      }
                                    }
                                  }}
                                  className="p-1 rounded-xl text-[#70523E] hover:bg-[#FAF6F1] hover:text-[#342219] transition cursor-pointer"
                                  title="Previous"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  disabled={(() => {
                                    const today = new Date();
                                    if (selectedPeriod === "monthly") {
                                      return calendarViewYear >= today.getFullYear();
                                    }
                                    return (
                                      calendarViewYear > today.getFullYear() ||
                                      (calendarViewYear === today.getFullYear() && calendarViewMonth >= today.getMonth())
                                    );
                                  })()}
                                  onClick={() => {
                                    if (selectedPeriod === "monthly") {
                                      setCalendarViewYear((y) => y + 1);
                                    } else {
                                      if (calendarViewMonth === 11) {
                                        setCalendarViewMonth(0);
                                        setCalendarViewYear((y) => y + 1);
                                      } else {
                                        setCalendarViewMonth((m) => m + 1);
                                      }
                                    }
                                  }}
                                  className={`p-1 rounded-xl transition ${
                                    (() => {
                                      const today = new Date();
                                      const isNextDisabled =
                                        selectedPeriod === "monthly"
                                          ? calendarViewYear >= today.getFullYear()
                                          : calendarViewYear > today.getFullYear() ||
                                            (calendarViewYear === today.getFullYear() && calendarViewMonth >= today.getMonth());
                                      return isNextDisabled
                                        ? "text-[#D5C2B1] opacity-30 cursor-not-allowed"
                                        : "text-[#70523E] hover:bg-[#FAF6F1] hover:text-[#342219] cursor-pointer";
                                    })()
                                  }`}
                                  title="Next"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* MONTHLY PERIOD: 12-Month Grid */}
                            {selectedPeriod === "monthly" && (
                              <div>
                                <div className="grid grid-cols-3 gap-2">
                                  {Array.from({ length: 12 }, (_, idx) => {
                                    const today = new Date();
                                    const isFuture =
                                      calendarViewYear > today.getFullYear() ||
                                      (calendarViewYear === today.getFullYear() && idx > today.getMonth());
                                    const monthVal = `${calendarViewYear}-${String(idx + 1).padStart(2, "0")}`;
                                    const isSelected = selectedMonth === monthVal;
                                    const isCurrentMonth =
                                      today.getFullYear() === calendarViewYear && today.getMonth() === idx;

                                    const monthLabel = new Date(calendarViewYear, idx).toLocaleDateString("en-US", {
                                      month: "short",
                                    });

                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        disabled={isFuture}
                                        onClick={() => {
                                          setSelectedMonth(monthVal);
                                          setIsCalendarOpen(false);
                                        }}
                                        className={`py-2 px-1 text-xs font-bold rounded-xl transition ${
                                          isFuture
                                            ? "text-stone-300 opacity-40 cursor-not-allowed select-none"
                                            : isSelected
                                            ? "bg-[#70452D] text-white shadow-xs font-extrabold cursor-pointer"
                                            : isCurrentMonth
                                            ? "border border-[#8C5835] text-[#70452D] bg-[#FAF4ED] hover:bg-[#F3E7DC] cursor-pointer"
                                            : "text-[#342219] hover:bg-[#FAF8F5] cursor-pointer"
                                        }`}
                                      >
                                        {monthLabel}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="mt-3 pt-2 border-t border-[#F4EBE2] flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const today = new Date();
                                      const mVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
                                      setSelectedMonth(mVal);
                                      setCalendarViewYear(today.getFullYear());
                                      setCalendarViewMonth(today.getMonth());
                                      setIsCalendarOpen(false);
                                    }}
                                    className="text-xs font-bold text-[#8C5835] hover:text-[#70452D] cursor-pointer"
                                  >
                                    Current Month
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsCalendarOpen(false)}
                                    className="text-xs font-semibold text-[#8A7667] hover:text-[#342219] cursor-pointer"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* DAILY & WEEKLY PERIODS: Days Matrix */}
                            {selectedPeriod !== "monthly" && (
                              <div>
                                {/* Day-of-week Headers */}
                                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                                    <span key={i} className="text-[10px] font-bold text-[#8A7667] py-1">
                                      {d}
                                    </span>
                                  ))}
                                </div>

                                {/* Days Matrix */}
                                <div className="grid grid-cols-7 gap-1">
                                  {(() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const firstDayOfMonth = new Date(calendarViewYear, calendarViewMonth, 1);
                                    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
                                    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

                                    // Calculate weekly selection bounds if in weekly mode
                                    let weekStartStr = "";
                                    let weekEndStr = "";
                                    if (selectedPeriod === "weekly" && selectedWeeklyDate) {
                                      const base = new Date(`${selectedWeeklyDate}T00:00:00`);
                                      const day = base.getDay();
                                      const diffToMon = (day === 0 ? -6 : 1) - day;
                                      const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon);
                                      const sun = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon + 6);
                                      weekStartStr = formatDateYMD(mon);
                                      weekEndStr = formatDateYMD(sun);
                                    }

                                    const cells: React.ReactNode[] = [];

                                    // Padding days from previous month
                                    for (let i = 0; i < startDayOfWeek; i++) {
                                      cells.push(
                                        <div key={`empty-${i}`} className="h-8 w-8" />
                                      );
                                    }

                                    // Days of current viewing month
                                    for (let day = 1; day <= daysInMonth; day++) {
                                      const cellDate = new Date(calendarViewYear, calendarViewMonth, day);
                                      cellDate.setHours(0, 0, 0, 0);

                                      const isFuture = cellDate.getTime() > today.getTime();
                                      const ymd = formatDateYMD(cellDate);
                                      const isToday = cellDate.getTime() === today.getTime();

                                      const isDailySelected = selectedPeriod === "daily" && selectedDailyDate === ymd;
                                      const isInSelectedWeek =
                                        selectedPeriod === "weekly" &&
                                        weekStartStr &&
                                        weekEndStr &&
                                        ymd >= weekStartStr &&
                                        ymd <= weekEndStr;

                                      cells.push(
                                        <button
                                          key={day}
                                          type="button"
                                          disabled={isFuture}
                                          onClick={() => {
                                            if (selectedPeriod === "daily") {
                                              setSelectedDailyDate(ymd);
                                              setIsCalendarOpen(false);
                                            } else {
                                              // Weekly mode
                                              setSelectedWeeklyDate(ymd);
                                              setIsCalendarOpen(false);
                                            }
                                          }}
                                          className={`h-8 w-8 rounded-xl text-xs font-semibold flex items-center justify-center transition ${
                                            isFuture
                                              ? "text-stone-300 opacity-30 cursor-not-allowed select-none"
                                              : isDailySelected
                                              ? "bg-[#70452D] text-white font-bold shadow-xs cursor-pointer"
                                              : isInSelectedWeek
                                              ? "bg-[#FAF4ED] text-[#70452D] font-bold border border-[#E8D0BD] cursor-pointer"
                                              : isToday
                                              ? "border border-[#8C5835] text-[#70452D] font-bold hover:bg-[#FAF6F1] cursor-pointer"
                                              : "text-[#342219] hover:bg-[#FAF8F5] cursor-pointer"
                                          }`}
                                        >
                                          {day}
                                        </button>
                                      );
                                    }

                                    return cells;
                                  })()}
                                </div>

                                {/* Footer Actions */}
                                <div className="mt-3 pt-2 border-t border-[#F4EBE2] flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const today = new Date();
                                      const todayStr = formatDateYMD(today);
                                      if (selectedPeriod === "daily") {
                                        setSelectedDailyDate(todayStr);
                                      } else {
                                        setSelectedWeeklyDate(todayStr);
                                      }
                                      setCalendarViewYear(today.getFullYear());
                                      setCalendarViewMonth(today.getMonth());
                                      setIsCalendarOpen(false);
                                    }}
                                    className="text-xs font-bold text-[#8C5835] hover:text-[#70452D] cursor-pointer"
                                  >
                                    Today
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsCalendarOpen(false)}
                                    className="text-xs font-semibold text-[#8A7667] hover:text-[#342219] cursor-pointer"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>,
                          document.body
                        )}
                    </div>
                  </div>

                  {/* 4. Action Button: Apply Filter (Col 11-12 on desktop, full span on mobile) */}
                  <div className="sm:col-span-2 lg:col-span-2 flex items-center">
                    <button
                      type="button"
                      onClick={handleApplyFilter}
                      className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#6F3F24] via-[#854E2D] to-[#9A5F38] px-4 py-2.5 sm:py-3 text-xs font-bold text-white shadow-md shadow-[#754329]/20 hover:shadow-lg transition cursor-pointer active:scale-98 whitespace-nowrap"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Apply Filter</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* SECTION 2: 5 SUMMARY CARDS                                            */}
              {/* ===================================================================== */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                {/* 1. Total Orders Card (Warm Peach/Orange Accent) */}
                <div className="flex items-center justify-between rounded-3xl border border-[#F4E3D7] bg-[#FDF7F2] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6DEC9] text-[#A75D28] shadow-xs">
                      <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-[#8A7667] truncate">Orders</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xl sm:text-2xl font-black text-[#342219]">
                          {summaryMetrics.totalOrders}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-800 shrink-0">
                          ↑ 100%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Total Amount Card (Mint Green Accent) */}
                <div className="flex items-center justify-between rounded-3xl border border-[#D9EFE3] bg-[#F2FAF6] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D2F0E1] text-[#1E7E4E] shadow-xs">
                      <Banknote className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-[#6C897B] truncate">Total Amount</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xl sm:text-2xl font-black text-[#1D3B2E] truncate">
                          {formatPrice(summaryMetrics.totalAmount)}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-800 shrink-0">
                          ↑ 100%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Delivered Card (Soft Sky Blue Accent) */}
                <div className="flex items-center justify-between rounded-3xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#BFDBFE] text-[#1D4ED8] shadow-xs">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-[#607D9B] truncate">Delivered</span>
                      <span className="text-xl sm:text-2xl font-black text-[#1E3A5F] mt-0.5 block">
                        {summaryMetrics.deliveredOrders}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Pending Card (Warm Cream / Amber Accent) */}
                <div className="flex items-center justify-between rounded-3xl border border-[#FEF3C7] bg-[#FFFBEB] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FDE68A] text-[#B45309] shadow-xs">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-[#8C7650] truncate">Pending</span>
                      <span className="text-xl sm:text-2xl font-black text-[#4B3B1B] mt-0.5 block">
                        {summaryMetrics.pendingOrders}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Cancelled Card (Soft Rose Accent - spans 2 cols on mobile for balanced grid) */}
                <div className="col-span-2 md:col-span-1 flex items-center justify-between rounded-3xl border border-[#FFE4E6] bg-[#FFF1F2] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FECDD3] text-[#E11D48] shadow-xs">
                      <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-[#9C6D75] truncate">Cancelled</span>
                      <span className="text-xl sm:text-2xl font-black text-[#4C1D24] mt-0.5 block">
                        {summaryMetrics.cancelledOrders}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* SECTION 3: EMPLOYEE ORDERS TABLE CARD                                 */}
              {/* ===================================================================== */}
              <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 shadow-sm overflow-hidden backdrop-blur-md">
                {/* Header with Title and Export Button */}
                <div className="p-6 border-b border-[#EEE5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#FAF4ED] to-[#FAF8F5]">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#342219] flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-[#8C5835]" />
                      <span>Employee Orders</span>
                    </h2>
                    <p className="text-xs text-[#8A7667] mt-1">
                      Showing orders for{" "}
                      <span className="font-bold text-[#70452D]">
                        {appliedEmployeeOption ? appliedEmployeeOption.name : "All Employees"}
                      </span>{" "}
                      &bull; <span className="capitalize">{appliedFilters.period}</span> &bull;{" "}
                      {appliedFilters.displayDateLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-white px-3.5 py-1.5 font-bold text-xs text-[#70452D] border border-[#E8DED4] shadow-2xs">
                      {locationOrders.length} {locationOrders.length === 1 ? "Order" : "Orders"} Found
                    </span>

                    <button
                      type="button"
                      onClick={handleExportOrders}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-[#E8DED4] bg-white px-4 py-2 text-xs font-bold text-[#70452D] shadow-2xs hover:bg-[#FAF6F1] transition cursor-pointer"
                      title="Export Filtered Orders as CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Table Body */}
                {isLoading ? (
                  <div className="py-20 text-center">
                    <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C5835] mb-3" />
                    <p className="text-[#8A7667] text-sm font-medium">Loading orders...</p>
                  </div>
                ) : locationOrders.length === 0 ? (
                  <div className="py-20 text-center text-[#8A7667] space-y-2.5">
                    <div className="w-14 h-14 rounded-3xl bg-[#FAF4ED] text-[#8C5835] flex items-center justify-center mx-auto shadow-2xs">
                      <Coffee className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-[#342219]">No Orders Found</h3>
                    <p className="text-xs text-[#8A7667] max-w-sm mx-auto">
                      No order records match the selected employee and date filter for {selectedLocation?.name}.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#D5C2B1] scrollbar-track-[#FAF8F5]">
                    <table className="w-full min-w-[850px] text-left text-xs sm:text-sm">
                      <thead className="bg-[#FAF7F2] text-[#8A7667] text-[11px] font-bold uppercase tracking-wider border-b border-[#EEE5DC]">
                        <tr>
                          <th className="px-5 py-4 min-w-[200px]">Employee</th>
                          <th className="px-4 py-4 min-w-[130px] whitespace-nowrap">Seat</th>
                          <th className="px-4 py-4 min-w-[110px] whitespace-nowrap">Order ID</th>
                          <th className="px-5 py-4 min-w-[200px]">Items</th>
                          <th className="px-4 py-4 min-w-[120px] text-right whitespace-nowrap">Total Amount</th>
                          <th className="px-4 py-4 min-w-[120px] whitespace-nowrap">Order Time</th>
                          <th className="px-4 py-4 min-w-[110px] text-center whitespace-nowrap">Status</th>
                          <th className="px-5 py-4 min-w-[110px] text-right whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEE5DC]/70 text-[#342219]">
                        {locationOrders.map((order) => {
                          const displaySeat = formatOrderSeat(order, selectedLocation?.name);
                          const displayOrderId = formatOrderId(order);

                          // Formatted items summary string e.g. "Tea x1, Coffee x1"
                          const itemsSummary = (order.items || [])
                            .map((it) => `${it.name} × ${it.qty}`)
                            .join(", ");

                          return (
                            <tr
                              key={order.id}
                              onClick={() => setInspectedOrder(order)}
                              className="hover:bg-[#FAF7F2]/70 cursor-pointer transition-colors"
                            >
                              {/* 1. Employee with Avatar */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-[#EAD5C0] text-[#70452D] flex items-center justify-center font-bold text-xs uppercase shadow-2xs shrink-0">
                                    {(order.employeeName || "E").substring(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-[#342219] truncate">
                                      {order.employeeName || "Employee"}
                                    </div>
                                    <div className="text-[11px] text-[#8A7667] truncate">
                                      {order.employeeEmail || `${(order.employeeName || "user").toLowerCase().replace(/\s+/g, "")}@faaz.com`}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Seat Badge - No Line Break */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#FAF6F1] text-[#70452D] border border-[#EADBCE] whitespace-nowrap">
                                  {displaySeat}
                                </span>
                              </td>

                              {/* 3. Order ID Badge - No Line Break */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#FFF4ED] text-[#A75D28] border border-[#F8DCBF] whitespace-nowrap">
                                  {displayOrderId}
                                </span>
                              </td>

                              {/* 4. Items Summary */}
                              <td className="px-5 py-4 text-xs text-[#5C4535] max-w-xs">
                                <div className="line-clamp-2 leading-relaxed" title={itemsSummary}>
                                  {itemsSummary || "1 Item"}
                                </div>
                              </td>

                              {/* 5. Total Amount - No Line Break */}
                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                <span className="font-extrabold text-[#70452D] whitespace-nowrap">
                                  {formatPrice(order.total)}
                                </span>
                              </td>

                              {/* 6. Order Time - No Line Break */}
                              <td className="px-4 py-4 text-xs text-[#70523E] whitespace-nowrap">
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <Clock className="w-3.5 h-3.5 text-[#A8907E] shrink-0" />
                                  <span>{order.time || "Recent"}</span>
                                </div>
                              </td>

                              {/* 7. Status Badge */}
                              <td className="px-4 py-4 text-center whitespace-nowrap">
                                {renderStatusBadge(order.status)}
                              </td>

                              {/* 8. Action - No Line Break */}
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectedOrder(order);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#8C5835] hover:text-[#70452D] hover:underline cursor-pointer whitespace-nowrap"
                                >
                                  <span>View Order</span>
                                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL: SINGLE ORDER ITEM INSPECTION                                       */}
          {/* ========================================================================= */}
          {inspectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#EEE5DC] relative animate-in zoom-in-95 duration-150">
                {/* Close Button */}
                <button
                  onClick={() => setInspectedOrder(null)}
                  className="absolute right-5 top-5 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#8C5835]/10 text-[#8C5835]">
                    Order Details
                  </span>
                  <h3 className="text-xl font-bold text-[#342219] mt-1">
                    {formatOrderId(inspectedOrder)}
                  </h3>
                  <p className="text-xs text-[#8A7667]">
                    Placed by {inspectedOrder.employeeName} • {inspectedOrder.time}
                  </p>
                </div>

                {/* Context Info Cards */}
                <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#EEE5DC]">
                    <span className="text-[#8A7667] block text-[10px] uppercase font-bold">Location</span>
                    <span className="font-semibold text-[#342219]">
                      {inspectedOrder.locationName || selectedLocation?.name}
                    </span>
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#EEE5DC]">
                    <span className="text-[#8A7667] block text-[10px] uppercase font-bold">Seat / Seating</span>
                    <span className="font-semibold text-[#342219]">
                      {formatOrderSeat(inspectedOrder, selectedLocation?.name)}
                    </span>
                  </div>
                </div>

                {/* Ordered Items List */}
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-[#342219] uppercase tracking-wider mb-2.5">
                    Ordered Items ({inspectedOrder.items?.length || 0})
                  </h4>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {inspectedOrder.items && inspectedOrder.items.length > 0 ? (
                      inspectedOrder.items.map((item, idx) => {
                        const matchedItem = item.itemId ? itemsByIdMap[item.itemId] : undefined;
                        const rawName = (item.name || "").trim();
                        const cleanName = rawName.replace(/\s*\(.*?\)\s*$/, "").trim();
                        const effectiveImage = item.image || itemImagesMap[rawName.toLowerCase()] || itemImagesMap[cleanName.toLowerCase()] || matchedItem?.image;

                        return (
                          <div
                            key={item.id || idx}
                            className="flex items-center justify-between p-3 rounded-2xl border border-[#EEE5DC] bg-white shadow-2xs"
                          >
                            <div className="flex items-center gap-3">
                              {effectiveImage ? (
                                <img
                                  src={effectiveImage}
                                  alt={item.name}
                                  className="w-12 h-12 rounded-xl object-cover border border-[#EEE5DC]"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-[#FAF4ED] text-[#8C5835] flex items-center justify-center border border-[#EEE5DC]">
                                  <Coffee className="w-6 h-6" />
                                </div>
                              )}
                              <div>
                                <h5 className="font-bold text-xs text-[#342219]">
                                  {item.name}
                                </h5>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-[#8A7667]">
                                  <span>Unit Price: {formatPrice(item.price)}</span>
                                  <span className="text-stone-300">•</span>
                                  <span className="font-semibold text-[#70452D]">
                                    {formatOrderSeat(inspectedOrder, selectedLocation?.name)}
                                  </span>
                                </div>

                                {/* Preferences & Tags */}
                                {item.preference && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      <Flame className="w-2.5 h-2.5 text-amber-600" />
                                      {item.preference}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-xs font-bold text-[#8A7667]">
                                × {item.qty}
                              </div>
                              <div className="text-sm font-black text-[#342219] text-right min-w-[70px]">
                                {formatPrice(item.price * item.qty)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-[#8A7667] py-3 text-center">No detailed items recorded.</div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="pt-4 border-t border-[#EEE5DC] space-y-1.5 text-xs text-[#70523E] mb-6">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(inspectedOrder.subtotal ?? inspectedOrder.total)}</span>
                  </div>
                  {inspectedOrder.adjustmentAmount !== undefined && inspectedOrder.adjustmentAmount !== 0 && (
                    <div className="flex justify-between text-[#8A7667]">
                      <span>Adjustment</span>
                      <span>{formatPrice(inspectedOrder.adjustmentAmount)}</span>
                    </div>
                  )}
                  {inspectedOrder.discount !== undefined && inspectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount</span>
                      <span>-{formatPrice(inspectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[#342219] pt-2 border-t border-[#EEE5DC]">
                    <span>Total Amount</span>
                    <span className="text-[#8C5835]">{formatPrice(inspectedOrder.total)}</span>
                  </div>
                </div>

                {/* Status Footer */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8A7667]">Status:</span>
                    {renderStatusBadge(inspectedOrder.status)}
                  </div>
                  <button
                    onClick={() => setInspectedOrder(null)}
                    className="px-4 py-2 bg-[#70452D] hover:bg-[#5C3824] text-white text-xs font-bold rounded-2xl shadow-sm transition-colors cursor-pointer"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </Background>
  );
}

/**
 * Date formatting helpers
 */
function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFriendlyDisplayDate(ymd: string): string {
  try {
    const parts = ymd.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dt = new Date(year, month, day);
      return dt.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  } catch {}
  return ymd;
}
