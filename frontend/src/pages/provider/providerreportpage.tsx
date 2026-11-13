import { useOrgCurrency } from '../../utils/currencies';
import { formatProviderOrderId } from "../../utils/providerOrderFormatter";
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Coffee,
  RotateCw,
  Sun,
  Moon,
  Receipt,
  Percent,
  Wallet,
  TrendingUp,
  Filter,
  ArrowLeft,
  Clock,
  Check,
} from "lucide-react";

import Background from "../../components/background";
import ProviderNavbar from "../../components/navbar/providernavbar";
import { reportApi } from "../../services/reports";
import type { ProviderOrder } from "../../services/orders";
import { itemsApi, type MenuItem } from "../../services/items";
import { workingHoursApi, type BreakSession } from "../../services/workingHoursApi";
import { useAuth } from "../../components/common/AuthContext";
import {
  classifyOrderPeriod,
  DEFAULT_ORDER_PERIODS,
  getTimeInTimezone,
  type OrderPeriodConfig,
} from "../../utils/orderTimeClassification";
import { formatSeatIdentifier } from "../../utils/seatFormatter";

// Order item detail with preference & seat
export interface DailyOrderItemDetail {
  orderId: string;
  seatId: string;
  orderTime: string; // e.g. "09:05 AM"
  qty: number;
  preferences?: string;
  amount: number;
}

export interface DailyItemSummary {
  name: string;
  quantitySold: number;
  totalAmount: number;
  image?: string;
  orders: DailyOrderItemDetail[];
}

export interface DayReportRecord {
  dateStr: string; // "YYYY-MM-DD"
  displayDate: string; // "Oct 20, 2026"
  dayOfWeek: string; // "Mon"
  fullDayOfWeek: string; // "Monday"
  morningSubtotal: number;
  morningOrdersCount: number;
  morningItems: DailyItemSummary[];
  eveningSubtotal: number;
  eveningOrdersCount: number;
  eveningItems: DailyItemSummary[];
  adjustment: number;
  discount: number;
  netAmount: number;
  dayTotal: number;
}

export default function ProviderReportPage() {
  const { formatPrice } = useOrgCurrency();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentShortCode = currentUser?.shortCode || "";

  // Timezone & working period config
  const [orgTimezone, setOrgTimezone] = useState<string>("Asia/Dubai");
  const [periodConfig, setPeriodConfig] = useState<OrderPeriodConfig>(DEFAULT_ORDER_PERIODS);

  // Month / Date Range Picker State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Search input
  const [searchDateQuery, setSearchDateQuery] = useState("");

  // Raw orders & Menu item catalog
  const [orders, setOrders] = useState<ProviderOrder[]>([]);
  const [itemsByName, setItemsByName] = useState<Record<string, MenuItem>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Selected Day for Right Drawer Panel
  const [selectedDayRecord, setSelectedDayRecord] = useState<DayReportRecord | null>(null);

  // Expanded items in the side panel: itemKey -> boolean
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Pagination for left table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 1. Fetch Working Hours to get configured breaks and timezone
  const [configuredBreaks, setConfiguredBreaks] = useState<BreakSession[]>([]);

  // Break filter state
  const [selectedBreakId, setSelectedBreakId] = useState<string>("");
  const [isBreakDropdownOpen, setIsBreakDropdownOpen] = useState(false);
  const [breakDropdownSearch, setBreakDropdownSearch] = useState("");
  const breakDropdownRef = useRef<HTMLDivElement | null>(null);

  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  // Spending period filter option: "daily" | "weekly" | "monthly"
  const [spendingPeriodMode, setSpendingPeriodMode] = useState<"daily" | "weekly" | "monthly">("daily");
  // Whether to show custom date range picker
  const [showCustomDateRange, setShowCustomDateRange] = useState<boolean>(false);

  // Custom Calendar Popover state for "from", "to", and "month" pickers
  const [calendarOpenField, setCalendarOpenField] = useState<"from" | "to" | "month" | null>(null);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());
  const fromDatePickerRef = useRef<HTMLDivElement | null>(null);
  const toDatePickerRef = useRef<HTMLDivElement | null>(null);
  const monthPickerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (breakDropdownRef.current && !breakDropdownRef.current.contains(target)) {
        setIsBreakDropdownOpen(false);
      }
      if (
        calendarOpenField === "from" &&
        fromDatePickerRef.current &&
        !fromDatePickerRef.current.contains(target)
      ) {
        setCalendarOpenField(null);
      }
      if (
        calendarOpenField === "to" &&
        toDatePickerRef.current &&
        !toDatePickerRef.current.contains(target)
      ) {
        setCalendarOpenField(null);
      }
      if (
        calendarOpenField === "month" &&
        monthPickerRef.current &&
        !monthPickerRef.current.contains(target)
      ) {
        setCalendarOpenField(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [calendarOpenField]);

  // Active applied break filter
  const [appliedBreakFilter, setAppliedBreakFilter] = useState<{
    breakSession: BreakSession;
    fromDate: string;
    toDate: string;
  } | null>(null);

  // Orders for break filter view
  const [breakFilteredOrders, setBreakFilteredOrders] = useState<ProviderOrder[]>([]);
  const [isBreakFiltering, setIsBreakFiltering] = useState(false);
  const [breakFilterError, setBreakFilterError] = useState<string | null>(null);
  const [breakSearchQuery, setBreakSearchQuery] = useState("");
  const [breakCurrentPage, setBreakCurrentPage] = useState(1);
  const breakPageSize = 10;

  // Selected date when drilling down into a date from Weekly or Monthly summary table
  const [selectedBreakDateDrilldown, setSelectedBreakDateDrilldown] = useState<string | null>(null);

  useEffect(() => {
    workingHoursApi
      .getWorkingHours()
      .then((res: any) => {
        const tz = res?.workingHours?.timezone || res?.timezone;
        if (tz) setOrgTimezone(tz);

        const breaks = res?.workingHours?.breakSessions || [];
        if (Array.isArray(breaks) && breaks.length > 0) {
          setConfiguredBreaks(breaks);
          const morningBreaks = breaks.filter((b: any) => (b.startTime || "00:00") < "13:00" && b.isEnabled !== false);
          const eveningBreaks = breaks.filter((b: any) => (b.startTime || "00:00") >= "13:00" && b.isEnabled !== false);

          const mStart = morningBreaks.length > 0 ? morningBreaks[0].startTime : DEFAULT_ORDER_PERIODS.morningStart;
          const mEnd = morningBreaks.length > 0 ? morningBreaks[morningBreaks.length - 1].endTime : DEFAULT_ORDER_PERIODS.morningEnd;
          const eStart = eveningBreaks.length > 0 ? eveningBreaks[0].startTime : DEFAULT_ORDER_PERIODS.eveningStart;
          const eEnd = eveningBreaks.length > 0 ? eveningBreaks[eveningBreaks.length - 1].endTime : DEFAULT_ORDER_PERIODS.eveningEnd;

          setPeriodConfig({
            morningStart: mStart,
            morningEnd: mEnd,
            eveningStart: eStart,
            eveningEnd: eEnd,
          });
        } else {
          setConfiguredBreaks([]);
        }
      })
      .catch(() => {});
  }, [currentShortCode]);

  // 2. Fetch Menu Items to get images
  useEffect(() => {
    itemsApi
      .getItems(currentShortCode || undefined)
      .then((list) => {
        if (Array.isArray(list)) {
          const map: Record<string, MenuItem> = {};
          list.forEach((it) => {
            if (it.name) {
              map[it.name.trim().toLowerCase()] = it;
            }
          });
          setItemsByName(map);
        }
      })
      .catch(() => {});
  }, [currentShortCode]);

  // 3. Compute Start Date & End Date for selected month
  const activeDateRange = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    return {
      startDate: fmt(firstDay),
      endDate: fmt(lastDay),
      formattedRangeDisplay: `${firstDay.toLocaleString("en-US", { month: "short" })} 01, ${year} - ${lastDay.toLocaleString("en-US", { month: "short" })} ${String(lastDay.getDate()).padStart(2, "0")}, ${year}`,
    };
  }, [selectedMonth]);

  // 4. Fetch orders for this month from API
  const fetchMonthOrders = () => {
    setIsLoading(true);
    reportApi
      .getReportOrders({
        startDate: activeDateRange.startDate,
        endDate: activeDateRange.endDate,
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
        } else {
          setOrders([]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch report orders:", err);
        setOrders([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchMonthOrders();
  }, [selectedMonth, currentShortCode]);

  // Helper to format Date to YYYY-MM-DD
  const formatDateToIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Helper to get Today's date range
  const getTodayDateRange = () => {
    const today = formatDateToIso(new Date());
    return { start: today, end: today };
  };

  // Helper to get this week's start (Monday) and end (Sunday)
  const getThisWeekDateRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: formatDateToIso(monday),
      end: formatDateToIso(sunday),
    };
  };

  // Helper to get this month's start and end date
  const getThisMonthDateRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: formatDateToIso(firstDay),
      end: formatDateToIso(lastDay),
    };
  };

  // Handler for applying Break and Spending Filter
  const handleApplyBreakFilter = async (overridePeriod?: "daily" | "weekly" | "monthly") => {
    const activePeriod = overridePeriod || spendingPeriodMode;

    if (!selectedBreakId) {
      setBreakFilterError("Please select a break session to filter.");
      return;
    }
    const targetBreak = configuredBreaks.find((b) => b.id === selectedBreakId);
    if (!targetBreak) {
      setBreakFilterError("The selected break session is not configured.");
      return;
    }

    let effectiveFrom = filterFromDate;
    let effectiveTo = filterToDate;

    if (showCustomDateRange && filterFromDate && filterToDate) {
      if (filterFromDate > filterToDate) {
        setBreakFilterError("From Date cannot be later than To Date.");
        return;
      }
      effectiveFrom = filterFromDate;
      effectiveTo = filterToDate;
    } else {
      if (activePeriod === "daily") {
        const todayRange = getTodayDateRange();
        effectiveFrom = todayRange.start;
        effectiveTo = todayRange.end;
      } else if (activePeriod === "weekly") {
        const weekRange = getThisWeekDateRange();
        effectiveFrom = weekRange.start;
        effectiveTo = weekRange.end;
      } else {
        const monthRange = getThisMonthDateRange();
        effectiveFrom = monthRange.start;
        effectiveTo = monthRange.end;
      }
    }

    setBreakFilterError(null);
    setIsBreakFiltering(true);
    setBreakCurrentPage(1);
    setSelectedDayRecord(null);
    setSelectedBreakDateDrilldown(null);

    try {
      const fetchedOrders = await reportApi.getReportOrders({
        startDate: effectiveFrom,
        endDate: effectiveTo,
      });

      // Filter fetched orders specifically for the break's configured start and end time in orgTimezone
      const matchingOrders = (fetchedOrders || []).filter((o) => {
        if (o.status === "Canceled") return false;
        const dateField = o.createdAt || new Date().toISOString();
        const { dateStr, timeStr } = getTimeInTimezone(dateField, orgTimezone);
        if (!dateStr || dateStr < effectiveFrom || dateStr > effectiveTo) return false;

        const breakStart = targetBreak.startTime || "00:00";
        const breakEnd = targetBreak.endTime || "23:59";

        // Check if order time falls within the break start and end boundaries
        if (breakStart <= breakEnd) {
          return timeStr >= breakStart && timeStr <= breakEnd;
        } else {
          // Overnight break boundary
          return timeStr >= breakStart || timeStr <= breakEnd;
        }
      });

      setBreakFilteredOrders(matchingOrders);
      setAppliedBreakFilter({
        breakSession: targetBreak,
        fromDate: effectiveFrom,
        toDate: effectiveTo,
      });
    } catch (err: any) {
      console.error("Failed to fetch break filtered orders:", err);
      setBreakFilterError(err?.message || "Failed to load orders for the selected break.");
    } finally {
      setIsBreakFiltering(false);
    }
  };

  // Back Button to return to normal Monthly Reports view
  const handleBackToMonthlyReports = () => {
    setAppliedBreakFilter(null);
    setSelectedBreakId("");
    setFilterFromDate("");
    setFilterToDate("");
    setBreakFilteredOrders([]);
    setBreakFilterError(null);
    setBreakSearchQuery("");
    setBreakCurrentPage(1);
    setSelectedBreakDateDrilldown(null);
    if (dailyRecords.length > 0) {
      setSelectedDayRecord(dailyRecords[0]);
    }
  };

  // Flattened order items for break report view: Date, Item Name, Quantity, Total Amount
  interface BreakReportRow {
    id: string;
    orderId: string;
    displayOrderId: string;
    dateStr: string;
    displayDate: string;
    displayTime: string;
    periodGroup: string;
    seat: string;
    locationName: string;
    employeeName: string;
    itemName: string;
    quantity: number;
    price: number;
    amount: number;
  }

  const breakReportRows = useMemo(() => {
    if (!appliedBreakFilter) return [];

    const rows: BreakReportRow[] = [];

    breakFilteredOrders.forEach((o) => {
      const dateField = o.createdAt || new Date().toISOString();
      const { dateStr, displayTime } = getTimeInTimezone(dateField, orgTimezone);

      let formattedDate = dateStr;
      let periodGroup = dateStr;
      try {
        const [y, m, d] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        formattedDate = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        if (spendingPeriodMode === "daily") {
          periodGroup = formattedDate;
        } else if (spendingPeriodMode === "weekly") {
          const day = dateObj.getDay();
          const diffToMon = day === 0 ? -6 : 1 - day;
          const mon = new Date(dateObj);
          mon.setDate(dateObj.getDate() + diffToMon);
          const sun = new Date(mon);
          sun.setDate(mon.getDate() + 6);
          periodGroup = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        } else {
          periodGroup = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        }
      } catch {}

      const locationLabel = (o.locationName || (o as any).location || "").trim() || "office";
      const empLabel = (o.employeeName || (o as any).userName || (o as any).name || "").trim() || "Employee";

      let itemsList: any[] = [];
      if (Array.isArray(o.items) && o.items.length > 0) {
        itemsList = o.items;
      } else if ((o as any).itemsJson) {
        try {
          itemsList = JSON.parse((o as any).itemsJson);
        } catch {}
      }

      if (itemsList.length === 0) {
        rows.push({
          id: `${o.id}-generic`,
          orderId: o.id,
          displayOrderId: formatProviderOrderId(o),
          dateStr,
          displayDate: formattedDate,
          displayTime: displayTime || o.time || "-",
          periodGroup,
          seat: o.seat || "-",
          locationName: locationLabel,
          employeeName: empLabel,
          itemName: "Order " + formatProviderOrderId(o),
          quantity: 1,
          price: Number(o.total) || 0,
          amount: Number(o.total) || 0,
        });
      } else {
        itemsList.forEach((it, idx) => {
          const qty = Number(it.qty) || 1;
          const price = Number(it.price) || 0;
          const itTotal = qty * price;
          rows.push({
            id: `${o.id}-${idx}`,
            orderId: o.id,
            displayOrderId: formatProviderOrderId(o),
            dateStr,
            displayDate: formattedDate,
            displayTime: displayTime || o.time || "-",
            periodGroup,
            seat: o.seat || "-",
            locationName: locationLabel,
            employeeName: empLabel,
            itemName: (it.name || "Item").trim(),
            quantity: qty,
            price,
            amount: itTotal,
          });
        });
      }
    });

    return rows;
  }, [appliedBreakFilter, breakFilteredOrders, orgTimezone, spendingPeriodMode]);

  // Calculate Total Net Amount for all matching orders during the break filter
  const breakTotalNetAmount = useMemo(() => {
    return breakFilteredOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  }, [breakFilteredOrders]);

  // Aggregate break orders by Date for Weekly and Monthly summary table views
  interface BreakDateSummary {
    dateStr: string;
    displayDate: string;
    dayOfWeek: string;
    totalQuantity: number;
    totalAmount: number;
    ordersCount: number;
  }

  const breakDateSummaries = useMemo(() => {
    if (!appliedBreakFilter) return [];

    const map: Record<string, BreakDateSummary> = {};

    breakFilteredOrders.forEach((o) => {
      const dateField = o.createdAt || new Date().toISOString();
      const { dateStr } = getTimeInTimezone(dateField, orgTimezone);
      if (!dateStr) return;

      let formattedDate = dateStr;
      let dayOfWeek = "";
      try {
        const [y, m, d] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        formattedDate = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      } catch {}

      if (!map[dateStr]) {
        map[dateStr] = {
          dateStr,
          displayDate: formattedDate,
          dayOfWeek,
          totalQuantity: 0,
          totalAmount: 0,
          ordersCount: 0,
        };
      }

      let orderQty = 0;
      if (Array.isArray(o.items) && o.items.length > 0) {
        orderQty = o.items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
      } else if ((o as any).itemsJson) {
        try {
          const parsed = JSON.parse((o as any).itemsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            orderQty = parsed.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
          } else {
            orderQty = 1;
          }
        } catch {
          orderQty = 1;
        }
      } else {
        orderQty = 1;
      }

      map[dateStr].totalQuantity += orderQty;
      map[dateStr].totalAmount += Number(o.total) || 0;
      map[dateStr].ordersCount += 1;
    });

    return Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [appliedBreakFilter, breakFilteredOrders, orgTimezone]);

  // Filtered Date Summaries based on breakSearchQuery
  const filteredBreakDateSummaries = useMemo(() => {
    const q = breakSearchQuery.trim().toLowerCase();
    if (!q) return breakDateSummaries;
    return breakDateSummaries.filter(
      (s) =>
        s.displayDate.toLowerCase().includes(q) ||
        s.dayOfWeek.toLowerCase().includes(q) ||
        s.dateStr.includes(q)
    );
  }, [breakDateSummaries, breakSearchQuery]);

  const breakDateTotalPages = Math.ceil(filteredBreakDateSummaries.length / breakPageSize) || 1;
  const paginatedBreakDateSummaries = useMemo(() => {
    const start = (breakCurrentPage - 1) * breakPageSize;
    return filteredBreakDateSummaries.slice(start, start + breakPageSize);
  }, [filteredBreakDateSummaries, breakCurrentPage, breakPageSize]);

  // Search filtering for Break report individual rows
  const filteredBreakRows = useMemo(() => {
    let sourceRows = breakReportRows;
    if (selectedBreakDateDrilldown) {
      sourceRows = sourceRows.filter((r) => r.dateStr === selectedBreakDateDrilldown);
    }

    const q = breakSearchQuery.trim().toLowerCase();
    if (!q) return sourceRows;
    return sourceRows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.displayDate.toLowerCase().includes(q) ||
        r.displayOrderId.toLowerCase().includes(q) ||
        r.seat.toLowerCase().includes(q) ||
        r.locationName.toLowerCase().includes(q) ||
        r.employeeName.toLowerCase().includes(q)
    );
  }, [breakReportRows, selectedBreakDateDrilldown, breakSearchQuery]);

  const breakTotalPages = Math.ceil(filteredBreakRows.length / breakPageSize) || 1;
  const paginatedBreakRows = useMemo(() => {
    const start = (breakCurrentPage - 1) * breakPageSize;
    return filteredBreakRows.slice(start, start + breakPageSize);
  }, [filteredBreakRows, breakCurrentPage, breakPageSize]);

  // 5. Aggregate Orders into Daily Records
  const dailyRecords = useMemo(() => {
    const daysMap: Record<
      string,
      {
        morningSubtotal: number;
        morningOrdersCount: number;
        morningItemsMap: Record<string, DailyItemSummary>;
        eveningSubtotal: number;
        eveningOrdersCount: number;
        eveningItemsMap: Record<string, DailyItemSummary>;
        adjustment: number;
        discount: number;
        netAmount: number;
        dayTotal: number;
      }
    > = {};

    orders.forEach((o) => {
      if (o.status === "Canceled") return;

      const dateField = o.createdAt || new Date().toISOString();
      const { timeStr, dateStr, displayTime } = getTimeInTimezone(dateField, orgTimezone);
      if (!dateStr) return;

      if (!dateStr.startsWith(selectedMonth)) {
        return;
      }

      if (!daysMap[dateStr]) {
        daysMap[dateStr] = {
          morningSubtotal: 0,
          morningOrdersCount: 0,
          morningItemsMap: {},
          eveningSubtotal: 0,
          eveningOrdersCount: 0,
          eveningItemsMap: {},
          adjustment: 0,
          discount: 0,
          netAmount: 0,
          dayTotal: 0,
        };
      }

      const rec = daysMap[dateStr];

      const classified = classifyOrderPeriod(dateField, orgTimezone, periodConfig);
      let isMorning = true;
      if (classified === "morning") {
        isMorning = true;
      } else if (classified === "evening") {
        isMorning = false;
      } else {
        isMorning = timeStr < "12:00";
      }

      const orderSubtotal = Number(o.subtotal) || Number(o.total) || 0;
      const orderAdjustment = Number(o.adjustmentAmount) || 0;
      const orderDiscount = Number(o.discount) || 0;
      const orderTotal = Number(o.total) || 0;

      rec.adjustment += orderAdjustment;
      rec.discount += orderDiscount;
      rec.netAmount += orderTotal;
      rec.dayTotal += orderSubtotal;

      if (isMorning) {
        rec.morningSubtotal += orderSubtotal;
        rec.morningOrdersCount += 1;
      } else {
        rec.eveningSubtotal += orderSubtotal;
        rec.eveningOrdersCount += 1;
      }

      const targetMap = isMorning ? rec.morningItemsMap : rec.eveningItemsMap;

      let itemsList: any[] = [];
      if (Array.isArray(o.items) && o.items.length > 0) {
        itemsList = o.items;
      } else if ((o as any).itemsJson) {
        try {
          itemsList = JSON.parse((o as any).itemsJson);
        } catch {}
      }

      itemsList.forEach((it) => {
        const rawName = (it.name || "Item").trim();
        const itemKey = rawName.toLowerCase();
        const itQty = Number(it.qty) || 1;
        const itPrice = Number(it.price) || 0;
        const itTotal = itQty * itPrice;

        if (!targetMap[itemKey]) {
          const menuItem = itemsByName[itemKey];
          targetMap[itemKey] = {
            name: rawName,
            quantitySold: 0,
            totalAmount: 0,
            image: it.image || menuItem?.image,
            orders: [],
          };
        }

        targetMap[itemKey].quantitySold += itQty;
        targetMap[itemKey].totalAmount += itTotal;
        targetMap[itemKey].orders.push({
          orderId: formatProviderOrderId(o),
          seatId: o.seat || o.locationName || "-",
          orderTime: displayTime || o.time || "-",
          qty: itQty,
          preferences: it.preference || "-",
          amount: itTotal,
        });
      });
    });

    const sortedDates = Object.keys(daysMap).sort((a, b) => b.localeCompare(a));

    const records: DayReportRecord[] = sortedDates.map((dateStr) => {
      const data = daysMap[dateStr];
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);

      const displayDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const fullDayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "long" });

      const morningItems = Object.values(data.morningItemsMap).sort(
        (a, b) => b.quantitySold - a.quantitySold
      );
      const eveningItems = Object.values(data.eveningItemsMap).sort(
        (a, b) => b.quantitySold - a.quantitySold
      );

      return {
        dateStr,
        displayDate,
        dayOfWeek,
        fullDayOfWeek,
        morningSubtotal: data.morningSubtotal,
        morningOrdersCount: data.morningOrdersCount,
        morningItems,
        eveningSubtotal: data.eveningSubtotal,
        eveningOrdersCount: data.eveningOrdersCount,
        eveningItems,
        adjustment: data.adjustment,
        discount: data.discount,
        netAmount: data.netAmount,
        dayTotal: data.dayTotal,
      };
    });

    return records;
  }, [orders, orgTimezone, periodConfig, itemsByName, selectedMonth]);

  // Monthly Spending Summary
  const monthlySpendingSummary = useMemo(() => {
    let totalSpending = 0;
    let morningSpending = 0;
    let eveningSpending = 0;
    let totalOrdersCount = 0;
    let totalDaysActive = dailyRecords.length;

    dailyRecords.forEach((r) => {
      totalSpending += r.netAmount;
      morningSpending += r.morningSubtotal;
      eveningSpending += r.eveningSubtotal;
      totalOrdersCount += r.morningOrdersCount + r.eveningOrdersCount;
    });

    return {
      totalSpending,
      morningSpending,
      eveningSpending,
      totalOrdersCount,
      totalDaysActive,
    };
  }, [dailyRecords]);

  // Keep first record selected by default or update if selectedDayRecord is set
  useEffect(() => {
    if (dailyRecords.length > 0) {
      if (!selectedDayRecord) {
        setSelectedDayRecord(dailyRecords[0]);
      } else {
        const stillExists = dailyRecords.find((r) => r.dateStr === selectedDayRecord.dateStr);
        if (stillExists) {
          setSelectedDayRecord(stillExists);
        } else {
          setSelectedDayRecord(dailyRecords[0]);
        }
      }
    } else {
      setSelectedDayRecord(null);
      setSelectedBreakDateDrilldown(null);
    }
  }, [dailyRecords]);

  // Filter records by search input
  const filteredRecords = useMemo(() => {
    const rawQ = searchDateQuery.trim();
    if (!rawQ) return dailyRecords;
    const q = rawQ.toLowerCase();
    const numMatch = rawQ.match(/^\d{1,2}$/);
    const dayNum = numMatch ? String(parseInt(numMatch[0], 10)).padStart(2, "0") : null;

    return dailyRecords.filter((r) => {
      if (dayNum && r.dateStr.endsWith("-" + dayNum)) return true;
      if (
        r.displayDate.toLowerCase().includes(q) ||
        r.dayOfWeek.toLowerCase().includes(q) ||
        r.fullDayOfWeek.toLowerCase().includes(q) ||
        r.dateStr.includes(q)
      ) {
        return true;
      }
      const hasItem = [...r.morningItems, ...r.eveningItems].some((it) =>
        it.name.toLowerCase().includes(q)
      );
      return hasItem;
    });
  }, [dailyRecords, searchDateQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Toggle item expansion in drawer
  const toggleItemExpansion = (key: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Pending orders count for Provider Navbar badge
  const pendingOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === "Pending" || (o as any).orderStatus === "Pending").length;
  }, [orders]);

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <ProviderNavbar
          activeTab={"reports" as any}
          onTabChange={(tab) => {
            if (tab === "provider") navigate("/provider");
            else if (tab === "pendingOrders") navigate("/provider/pending-orders");
          }}
          pendingOrdersCount={pendingOrdersCount}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            {/* Top Container: Left Reports Table + Right Daily Detail Panel */}
            <div className="flex flex-col gap-6 lg:flex-row items-start">
              {/* LEFT COLUMN: Reports Table */}
              <div
                className={`transition-all duration-300 w-full ${
                  selectedDayRecord ? "lg:w-[63%] xl:w-[65%]" : "lg:w-full"
                }`}
              >
                {/* Header Title + Month Selector / Filter Controls */}
                <div className="mb-6 flex flex-col gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h1 className="text-3xl font-extrabold tracking-tight text-[#1E140E]">
                        {appliedBreakFilter ? "Break Reports" : "Daily Reports"}
                      </h1>
                      <p className="mt-1 text-sm font-medium text-[#7C6B5E]">
                        {appliedBreakFilter
                          ? `Orders placed during "${appliedBreakFilter.breakSession.name}" (${appliedBreakFilter.breakSession.startTime} - ${appliedBreakFilter.breakSession.endTime}) from ${appliedBreakFilter.fromDate} to ${appliedBreakFilter.toDate}`
                          : "Monthly office cafe expenditure, daily spending, and order inspection"}
                      </p>
                    </div>

                    {/* Right Action: Date Range Picker / Back Button */}
                    <div className="flex items-center gap-3">
                      {appliedBreakFilter ? (
                        <button
                          type="button"
                          onClick={handleBackToMonthlyReports}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[#DEC5B0] bg-white px-4 py-2.5 text-xs font-bold text-[#75472D] shadow-sm transition hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          <ArrowLeft size={16} />
                          <span>Back to Monthly Reports</span>
                        </button>
                      ) : (
                        <div className="relative flex items-center" ref={monthPickerRef}>
                          <button
                            type="button"
                            onClick={() => {
                              const [y, m] = selectedMonth.split("-").map(Number);
                              setCalendarViewDate(new Date(y, m - 1, 1));
                              setCalendarOpenField((prev) => (prev === "month" ? null : "month"));
                            }}
                            className="relative flex items-center gap-2 cursor-pointer rounded-2xl border border-[#DEC5B0] bg-white hover:bg-[#FAF8F5] transition-colors px-4 py-2 text-xs font-bold text-[#342219] shadow-sm"
                          >
                            <Calendar size={15} className="text-[#75472D]" />
                            <span>{activeDateRange.formattedRangeDisplay}</span>
                            <ChevronDown size={14} className="ml-1 text-[#8A7667]" />
                          </button>

                          {/* Custom Month Picker Popover */}
                          {calendarOpenField === "month" && (
                            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#DEC5B0]/70 bg-white p-4 shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 text-[#342219]">
                              <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                                <h3 className="text-sm font-bold text-[#342219]">
                                  {calendarViewDate.getFullYear()}
                                </h3>
                                <div className="flex items-center gap-1 text-[#75472D]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCalendarViewDate(
                                        new Date(
                                          calendarViewDate.getFullYear() - 1,
                                          calendarViewDate.getMonth(),
                                          1
                                        )
                                      )
                                    }
                                    className="p-1 rounded-lg hover:bg-[#FAF8F5] cursor-pointer transition"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCalendarViewDate(
                                        new Date(
                                          calendarViewDate.getFullYear() + 1,
                                          calendarViewDate.getMonth(),
                                          1
                                        )
                                      )
                                    }
                                    className="p-1 rounded-lg hover:bg-[#FAF8F5] cursor-pointer transition"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              </div>

                              {/* Month Grid (12 months) */}
                              <div className="grid grid-cols-3 gap-2 pt-3 text-xs">
                                {[
                                  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                                ].map((mName, idx) => {
                                  const y = calendarViewDate.getFullYear();
                                  const monthKey = `${y}-${String(idx + 1).padStart(2, "0")}`;
                                  const isSelected = selectedMonth === monthKey;

                                  return (
                                    <button
                                      key={mName}
                                      type="button"
                                      onClick={() => {
                                        setSelectedMonth(monthKey);
                                        setCurrentPage(1);
                                        setCalendarOpenField(null);
                                      }}
                                      className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                                        isSelected
                                          ? "bg-[#70452D] text-white font-bold shadow-xs"
                                          : "hover:bg-[#FAF8F5] text-[#342219]"
                                      }`}
                                    >
                                      {mName}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-4 pt-3 border-t border-[#F0E6DD] flex items-center justify-between text-xs font-bold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const now = new Date();
                                    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                                    setSelectedMonth(curMonth);
                                    setCurrentPage(1);
                                    setCalendarOpenField(null);
                                  }}
                                  className="text-[#75472D] hover:underline cursor-pointer"
                                >
                                  This Month
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCalendarOpenField(null)}
                                  className="text-[#8A7667] hover:text-[#342219] cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 1: Filter Controls Card (Break Filter, From Date, To Date, Filter Button, Back Button) */}
                  <div className="relative z-40 rounded-2xl border border-[#EEE5DC] bg-white/90 p-4 shadow-sm backdrop-blur-xs">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Filter Controls Fields */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Break Filter Dropdown (Custom Searchable Dropdown) */}
                        <div className="relative flex items-center gap-2" ref={breakDropdownRef}>
                          <label className="text-xs font-bold text-[#75472D] flex items-center gap-1.5 whitespace-nowrap">
                            <Coffee size={14} className="text-[#75472D]" />
                            <span>Break:</span>
                          </label>

                          {/* Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIsBreakDropdownOpen((prev) => !prev)}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-[#DEC5B0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#342219] shadow-2xs outline-none transition focus:border-[#75472D] hover:bg-[#FAF8F5] cursor-pointer min-w-[210px]"
                          >
                            <span className="truncate">
                              {(() => {
                                const selected = configuredBreaks.find((b) => b.id === selectedBreakId);
                                if (!selected) return "Select Break Session...";
                                return `${selected.name} (${selected.startTime} - ${selected.endTime})`;
                              })()}
                            </span>
                            <ChevronDown
                              size={15}
                              className={`text-[#8A7667] transition-transform duration-200 ${
                                isBreakDropdownOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {/* Dropdown Menu Modal / Popover */}
                          {isBreakDropdownOpen && (
                            <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[#DEC5B0]/70 bg-white p-3 shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150">
                              {/* Search Input */}
                              <div className="relative mb-2.5">
                                <Search
                                  size={15}
                                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                                />
                                <input
                                  type="text"
                                  value={breakDropdownSearch}
                                  onChange={(e) => setBreakDropdownSearch(e.target.value)}
                                  placeholder="Search break sessions..."
                                  autoFocus
                                  className="w-full rounded-2xl border border-[#E8DED4] bg-[#FAF8F5]/80 py-2 pl-9 pr-3 text-xs text-[#342219] placeholder:text-[#A08C7D] outline-none transition focus:border-[#75472D] focus:bg-white focus:ring-1 focus:ring-[#75472D]/20"
                                />
                              </div>

                              <div className="h-[1px] w-full bg-[#F0E6DD] mb-2" />

                              {/* Break Options List */}
                              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                {configuredBreaks
                                  .filter((b) => {
                                    const q = breakDropdownSearch.trim().toLowerCase();
                                    if (!q) return true;
                                    return (
                                      b.name.toLowerCase().includes(q) ||
                                      (b.startTime && b.startTime.includes(q)) ||
                                      (b.endTime && b.endTime.includes(q))
                                    );
                                  })
                                  .map((b) => {
                                    const isSelected = selectedBreakId === b.id;
                                    const initials = b.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase() || "BR";

                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedBreakId(b.id);
                                          setBreakFilterError(null);
                                          setIsBreakDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                                          isSelected
                                            ? "bg-[#FAF3EB] text-[#75472D]"
                                            : "hover:bg-[#FAF8F5] text-[#342219]"
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                              isSelected
                                                ? "bg-[#D9C4B3] text-[#5C3620]"
                                                : "bg-[#EADBCE]/80 text-[#75472D]"
                                            }`}
                                          >
                                            {initials}
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold leading-tight">
                                              {b.name}
                                            </p>
                                            <p className="text-[11px] text-[#8A7667] leading-tight mt-0.5">
                                              {b.startTime} - {b.endTime}
                                            </p>
                                          </div>
                                        </div>

                                        {isSelected && (
                                          <Check size={16} className="text-[#75472D] stroke-[2.5]" />
                                        )}
                                      </button>
                                    );
                                  })}

                                {configuredBreaks.length === 0 ? (
                                  <p className="py-4 text-center text-xs text-[#8A7667]">
                                    No break sessions configured in Working Hours.
                                  </p>
                                ) : configuredBreaks.filter((b) => {
                                    const q = breakDropdownSearch.trim().toLowerCase();
                                    if (!q) return true;
                                    return (
                                      b.name.toLowerCase().includes(q) ||
                                      (b.startTime && b.startTime.includes(q)) ||
                                      (b.endTime && b.endTime.includes(q))
                                    );
                                  }).length === 0 ? (
                                  <p className="py-4 text-center text-xs text-[#8A7667]">
                                    No matching break sessions found.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Spending Filters: Daily, Weekly, Monthly (Alongside Break Dropdown) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSpendingPeriodMode("daily");
                              setBreakFilterError(null);
                              if (selectedBreakId && appliedBreakFilter) {
                                handleApplyBreakFilter("daily");
                              }
                            }}
                            className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                              spendingPeriodMode === "daily"
                                ? "bg-[#75472D] text-white shadow-xs"
                                : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF8F5]"
                            }`}
                          >
                            Daily
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSpendingPeriodMode("weekly");
                              setBreakFilterError(null);
                              if (selectedBreakId && appliedBreakFilter) {
                                handleApplyBreakFilter("weekly");
                              }
                            }}
                            className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                              spendingPeriodMode === "weekly"
                                ? "bg-[#75472D] text-white shadow-xs"
                                : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF8F5]"
                            }`}
                          >
                            Weekly
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSpendingPeriodMode("monthly");
                              setBreakFilterError(null);
                              if (selectedBreakId && appliedBreakFilter) {
                                handleApplyBreakFilter("monthly");
                              }
                            }}
                            className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                              spendingPeriodMode === "monthly"
                                ? "bg-[#75472D] text-white shadow-xs"
                                : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF8F5]"
                            }`}
                          >
                            Monthly
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomDateRange((prev) => !prev);
                              setBreakFilterError(null);
                            }}
                            className={`rounded-2xl px-3.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                              showCustomDateRange
                                ? "bg-[#75472D] text-white shadow-xs"
                                : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF8F5]"
                            }`}
                          >
                            Custom
                          </button>
                        </div>

                        {/* Custom Date Range Pill */}
                        {showCustomDateRange && (
                          <div className="flex items-center rounded-2xl border border-[#DEC5B0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#342219] shadow-2xs gap-2.5">
                            {/* From Date Trigger */}
                            <div className="relative flex items-center gap-1.5" ref={fromDatePickerRef}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (filterFromDate) {
                                    const [y, m, d] = filterFromDate.split("-").map(Number);
                                    setCalendarViewDate(new Date(y, m - 1, d));
                                  } else {
                                    setCalendarViewDate(new Date());
                                  }
                                  setCalendarOpenField((prev) => (prev === "from" ? null : "from"));
                                }}
                                className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[#342219] outline-none"
                              >
                                <Calendar size={14} className="text-[#8A7667]" />
                                <span className={filterFromDate ? "text-[#342219] font-medium" : "text-[#8A7667]"}>
                                  {filterFromDate
                                    ? (() => {
                                        const [y, m, d] = filterFromDate.split("-");
                                        return `${d}-${m}-${y}`;
                                      })()
                                    : "dd-mm-yyyy"}
                                </span>
                              </button>

                              {/* Custom Calendar Popover for From */}
                              {calendarOpenField === "from" && (
                                <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#DEC5B0]/70 bg-white p-4 shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 text-[#342219]">
                                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                                    <h3 className="text-sm font-bold text-[#342219]">
                                      {calendarViewDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
                                    </h3>
                                    <div className="flex items-center gap-1 text-[#75472D]">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCalendarViewDate(
                                            new Date(
                                              calendarViewDate.getFullYear(),
                                              calendarViewDate.getMonth() - 1,
                                              1
                                            )
                                          )
                                        }
                                        className="p-1 rounded-lg hover:bg-[#FAF8F5] cursor-pointer transition"
                                      >
                                        <ChevronLeft size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCalendarViewDate(
                                            new Date(
                                              calendarViewDate.getFullYear(),
                                              calendarViewDate.getMonth() + 1,
                                              1
                                            )
                                          )
                                        }
                                        className="p-1 rounded-lg hover:bg-[#FAF8F5] cursor-pointer transition"
                                      >
                                        <ChevronRight size={16} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 pt-3 text-center text-xs font-semibold text-[#8A7667]">
                                    <span>Su</span>
                                    <span>Mo</span>
                                    <span>Tu</span>
                                    <span>We</span>
                                    <span>Th</span>
                                    <span>Fr</span>
                                    <span>Sa</span>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 pt-2 text-center text-xs">
                                    {(() => {
                                      const year = calendarViewDate.getFullYear();
                                      const month = calendarViewDate.getMonth();
                                      const firstDayIndex = new Date(year, month, 1).getDay();
                                      const totalDays = new Date(year, month + 1, 0).getDate();
                                      const days = [];

                                      for (let i = 0; i < firstDayIndex; i++) {
                                        days.push(<div key={`empty-${i}`} className="h-8" />);
                                      }

                                      for (let day = 1; day <= totalDays; day++) {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                        const isSelected = filterFromDate === dateStr;

                                        days.push(
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                              setFilterFromDate(dateStr);
                                              setBreakFilterError(null);
                                              setCalendarOpenField(null);
                                            }}
                                            className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full font-medium transition cursor-pointer ${
                                              isSelected
                                                ? "bg-[#70452D] text-white font-bold shadow-xs"
                                                : "hover:bg-[#FAF8F5] text-[#342219]"
                                            }`}
                                          >
                                            {day}
                                          </button>
                                        );
                                      }
                                      return days;
                                    })()}
                                  </div>

                                  <div className="mt-4 pt-3 border-t border-[#F0E6DD] flex items-center justify-between text-xs font-bold">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const now = new Date();
                                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                                        setFilterFromDate(todayStr);
                                        setBreakFilterError(null);
                                        setCalendarOpenField(null);
                                      }}
                                      className="text-[#75472D] hover:underline cursor-pointer"
                                    >
                                      Today
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCalendarOpenField(null)}
                                      className="text-[#8A7667] hover:text-[#342219] cursor-pointer"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <span className="text-[#C4B2A3] text-xs font-normal">to</span>

                            {/* To Date Trigger */}
                            <div className="relative flex items-center gap-1.5" ref={toDatePickerRef}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (filterToDate) {
                                    const [y, m, d] = filterToDate.split("-").map(Number);
                                    setCalendarViewDate(new Date(y, m - 1, d));
                                  } else if (filterFromDate) {
                                    const [y, m, d] = filterFromDate.split("-").map(Number);
                                    setCalendarViewDate(new Date(y, m - 1, d));
                                  } else {
                                    setCalendarViewDate(new Date());
                                  }
                                  setCalendarOpenField((prev) => (prev === "to" ? null : "to"));
                                }}
                                className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[#342219] outline-none"
                              >
                                <span className={filterToDate ? "text-[#342219] font-medium" : "text-[#8A7667]"}>
                                  {filterToDate
                                    ? (() => {
                                        const [y, m, d] = filterToDate.split("-");
                                        return `${d}-${m}-${y}`;
                                      })()
                                    : "dd-mm-yyyy"}
                                </span>
                                <Calendar size={14} className="text-[#8A7667]" />
                              </button>

                              {/* Custom Calendar Popover for To */}
                              {calendarOpenField === "to" && (
                                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#DEC5B0]/70 bg-white p-4 shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 text-[#342219]">
                                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                                    <h3 className="text-sm font-bold text-[#342219]">
                                      {calendarViewDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
                                    </h3>
                                    <div className="flex items-center gap-1 text-[#75472D]">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCalendarViewDate(
                                            new Date(
                                              calendarViewDate.getFullYear(),
                                              calendarViewDate.getMonth() - 1,
                                              1
                                            )
                                          )
                                        }
                                        className="p-1 rounded-lg hover:bg-[#FAF8F5] cursor-pointer transition"
                                      >
                                        <ChevronLeft size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCalendarViewDate(
                                            new Date(
                                              calendarViewDate.getFullYear(),
                                              calendarViewDate.getMonth() + 1,
                                              1
                                            )
                                          )
                                        }
                                        className="p-1 rounded-lg hover:bg-[#FAF8F5] cursor-pointer transition"
                                      >
                                        <ChevronRight size={16} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 pt-3 text-center text-xs font-semibold text-[#8A7667]">
                                    <span>Su</span>
                                    <span>Mo</span>
                                    <span>Tu</span>
                                    <span>We</span>
                                    <span>Th</span>
                                    <span>Fr</span>
                                    <span>Sa</span>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 pt-2 text-center text-xs">
                                    {(() => {
                                      const year = calendarViewDate.getFullYear();
                                      const month = calendarViewDate.getMonth();
                                      const firstDayIndex = new Date(year, month, 1).getDay();
                                      const totalDays = new Date(year, month + 1, 0).getDate();
                                      const days = [];

                                      for (let i = 0; i < firstDayIndex; i++) {
                                        days.push(<div key={`empty-${i}`} className="h-8" />);
                                      }

                                      for (let day = 1; day <= totalDays; day++) {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                        const isSelected = filterToDate === dateStr;

                                        days.push(
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                              setFilterToDate(dateStr);
                                              setBreakFilterError(null);
                                              setCalendarOpenField(null);
                                            }}
                                            className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full font-medium transition cursor-pointer ${
                                              isSelected
                                                ? "bg-[#70452D] text-white font-bold shadow-xs"
                                                : "hover:bg-[#FAF8F5] text-[#342219]"
                                            }`}
                                          >
                                            {day}
                                          </button>
                                        );
                                      }
                                      return days;
                                    })()}
                                  </div>

                                  <div className="mt-4 pt-3 border-t border-[#F0E6DD] flex items-center justify-between text-xs font-bold">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const now = new Date();
                                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                                        setFilterToDate(todayStr);
                                        setBreakFilterError(null);
                                        setCalendarOpenField(null);
                                      }}
                                      className="text-[#75472D] hover:underline cursor-pointer"
                                    >
                                      Today
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCalendarOpenField(null)}
                                      className="text-[#8A7667] hover:text-[#342219] cursor-pointer"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Action Buttons (Filter) */}
                      <div className="flex items-center gap-2.5 pt-1 lg:pt-0">
                        <button
                          type="button"
                          onClick={() => handleApplyBreakFilter()}
                          disabled={isBreakFiltering}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#75472D] to-[#9A6747] px-4.5 py-2 text-xs font-bold text-white shadow-sm transition hover:shadow hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isBreakFiltering ? (
                            <>
                              <RotateCw size={13} className="animate-spin" />
                              <span>Filtering…</span>
                            </>
                          ) : (
                            <>
                              <Filter size={13} />
                              <span>Apply Filter</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Filter error message */}
                    {breakFilterError && (
                      <p className="mt-2.5 text-xs font-semibold text-rose-600">
                        {breakFilterError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Monthly Cafe Spending Section */}
                {appliedBreakFilter ? (
                  /* Break Filter Mode: Total Net Amount Summary Card */
                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Total Net Amount for Filtered Orders */}
                    <div className="rounded-2xl border border-[#DEC5B0] bg-gradient-to-br from-white to-[#FAF6F1] p-4.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#75472D] uppercase tracking-wide">
                          {spendingPeriodMode === "daily"
                            ? "Daily Total Net Amount"
                            : spendingPeriodMode === "weekly"
                            ? "Weekly Total Net Amount"
                            : "Monthly Total Net Amount"}
                        </span>
                        <div className="rounded-full bg-[#75472D]/10 p-1.5 text-[#75472D]">
                          <Wallet size={16} />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-[#1E140E]">
                        {formatPrice(breakTotalNetAmount)}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8A7667]">
                        {spendingPeriodMode === "daily"
                          ? `Daily spend during ${appliedBreakFilter.breakSession.name}`
                          : spendingPeriodMode === "weekly"
                          ? `Weekly spend during ${appliedBreakFilter.breakSession.name}`
                          : `Monthly spend during ${appliedBreakFilter.breakSession.name}`}
                      </p>
                    </div>

                    {/* Total Orders Placed in Break */}
                    <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#6B574B] uppercase tracking-wide">
                          Matching Orders
                        </span>
                        <div className="rounded-full bg-emerald-50 p-1.5 text-emerald-600">
                          <TrendingUp size={16} />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-[#1E140E]">
                        {breakFilteredOrders.length}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8A7667]">
                        {breakReportRows.length} item line(s) between {appliedBreakFilter.fromDate} and {appliedBreakFilter.toDate}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Total Monthly Spending */}
                    <div className="rounded-2xl border border-[#DEC5B0] bg-gradient-to-br from-white to-[#FAF6F1] p-4.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#75472D] uppercase tracking-wide">
                          Monthly Total Spending
                        </span>
                        <div className="rounded-full bg-[#75472D]/10 p-1.5 text-[#75472D]">
                          <Wallet size={16} />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-[#1E140E]">
                        {formatPrice(monthlySpendingSummary.totalSpending)}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8A7667]">
                        Office cafe expense across {monthlySpendingSummary.totalDaysActive} active days
                      </p>
                    </div>

                    {/* Morning vs Evening Breakdown */}
                    <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#6B574B] uppercase tracking-wide">
                          Session Spending
                        </span>
                        <div className="flex items-center gap-1 text-[#8E6548]">
                          <Sun size={15} className="text-amber-500" />
                          <Moon size={15} className="text-orange-500" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <div>
                          <span className="text-[10px] font-semibold text-[#8A7667] block">Morning</span>
                          <span className="text-sm font-extrabold text-[#1E140E]">
                            {formatPrice(monthlySpendingSummary.morningSpending)}
                          </span>
                        </div>
                        <div className="h-7 w-[1px] bg-[#EEE5DC]"></div>
                        <div>
                          <span className="text-[10px] font-semibold text-[#8A7667] block">Evening</span>
                          <span className="text-sm font-extrabold text-[#1E140E]">
                            {formatPrice(monthlySpendingSummary.eveningSpending)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total Office Orders Placed */}
                    <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#6B574B] uppercase tracking-wide">
                          Total Office Orders
                        </span>
                        <div className="rounded-full bg-emerald-50 p-1.5 text-emerald-600">
                          <TrendingUp size={16} />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-[#1E140E]">
                        {monthlySpendingSummary.totalOrdersCount}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8A7667]">
                        Employee cafe orders fulfilled this month
                      </p>
                    </div>
                  </div>
                )}

                {/* Search Bar matching screenshot */}
                <div className="mb-5">
                  <div className="relative">
                    <Search
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A8778]"
                    />
                    <input
                      type="text"
                      value={appliedBreakFilter ? breakSearchQuery : searchDateQuery}
                      onChange={(e) => {
                        if (appliedBreakFilter) {
                          setBreakSearchQuery(e.target.value);
                          setBreakCurrentPage(1);
                        } else {
                          setSearchDateQuery(e.target.value);
                          setCurrentPage(1);
                        }
                      }}
                      placeholder={
                        appliedBreakFilter
                          ? "Search by item name, date, order ID, seat, or employee..."
                          : "Search by date (e.g. 22, Thu), or item name..."
                      }
                      className="w-full rounded-2xl border border-[#DEC5B0]/70 bg-white py-3 pl-11 pr-4 text-sm text-[#342219] placeholder:text-[#A8988B] outline-none transition focus:border-[#75472D] focus:ring-2 focus:ring-[#75472D]/15"
                    />
                  </div>
                </div>

                {/* Reports Table Card: Break-Filtered Orders OR Normal Monthly Reports */}
                {appliedBreakFilter ? (
                  spendingPeriodMode !== "daily" && !selectedBreakDateDrilldown ? (
                    /* Weekly & Monthly Summary Table View: Date, Total Quantity, Total Amount */
                    <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-[#F0E6DD] bg-[#FAF8F5] text-xs font-bold text-[#6B574B]">
                            <tr>
                              <th className="py-4 pl-6 pr-4">Date</th>
                              <th className="px-4 py-4 text-center">Total Quantity</th>
                              <th className="px-4 py-4 text-right pr-6">Total Amount</th>
                              <th className="py-4 pr-6 text-right w-12"></th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-[#F4EFEA]">
                            {isBreakFiltering ? (
                              <tr>
                                <td colSpan={4} className="py-12 text-center text-sm text-[#8A7667]">
                                  <div className="flex items-center justify-center gap-2">
                                    <RotateCw size={18} className="animate-spin text-[#75472D]" />
                                    <span>Loading summary data...</span>
                                  </div>
                                </td>
                              </tr>
                            ) : paginatedBreakDateSummaries.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-12 text-center text-sm text-[#8A7667]">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Coffee size={28} className="text-[#B39B88]" />
                                    <p className="font-semibold text-[#342219]">
                                      No orders found for the selected break and date range.
                                    </p>
                                    <p className="text-xs text-[#8A7667]">
                                      No cafe orders were placed between {appliedBreakFilter.breakSession.startTime} and {appliedBreakFilter.breakSession.endTime} from {appliedBreakFilter.fromDate} to {appliedBreakFilter.toDate}.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              paginatedBreakDateSummaries.map((summary) => (
                                <tr
                                  key={summary.dateStr}
                                  onClick={() => {
                                    setSelectedBreakDateDrilldown(summary.dateStr);
                                    setBreakCurrentPage(1);
                                  }}
                                  className="group hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                                >
                                  <td className="py-4 pl-6 pr-4">
                                    <div className="font-bold text-[#231812] text-sm">
                                      {summary.displayDate}
                                    </div>
                                    <div className="text-xs text-[#8A7667] mt-0.5">
                                      {summary.dayOfWeek} &bull; {summary.ordersCount} order(s)
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 text-center font-bold text-[#342219]">
                                    {summary.totalQuantity}
                                  </td>

                                  <td className="px-4 py-4 text-right pr-6 font-bold text-[#1E140E]">
                                    {formatPrice(summary.totalAmount)}
                                  </td>

                                  <td className="py-4 pr-6 text-right">
                                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#E8DED4] bg-white text-[#9A8778] group-hover:border-[#DEC5B0] group-hover:text-[#75472D] transition">
                                      <ChevronRight size={16} />
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Table Footer: Count & Pagination for Date Summaries */}
                      <div className="flex flex-col items-center justify-between gap-3 border-t border-[#F0E6DD] bg-white px-6 py-4 sm:flex-row">
                        <span className="text-xs font-medium text-[#7C6B5E]">
                          Showing {paginatedBreakDateSummaries.length > 0 ? (breakCurrentPage - 1) * breakPageSize + 1 : 0} to{" "}
                          {Math.min(breakCurrentPage * breakPageSize, filteredBreakDateSummaries.length)} of {filteredBreakDateSummaries.length} days
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBreakCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={breakCurrentPage === 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEC5B0] bg-white text-[#75472D] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF6F1]"
                          >
                            <ChevronRight size={14} className="rotate-180" />
                          </button>

                          {Array.from({ length: breakDateTotalPages }).map((_, idx) => {
                            const pageNum = idx + 1;
                            const isActive = breakCurrentPage === pageNum;
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setBreakCurrentPage(pageNum)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                                  isActive
                                    ? "bg-[#75472D] text-white shadow-sm"
                                    : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF6F1]"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => setBreakCurrentPage((p) => Math.min(breakDateTotalPages, p + 1))}
                            disabled={breakCurrentPage === breakDateTotalPages || breakDateTotalPages === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEC5B0] bg-white text-[#75472D] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF6F1]"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Detailed Orders Table (for Daily mode OR drilled-down Date in Weekly/Monthly mode) */
                    <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                      {/* Drilldown Header with Back button when drilled down from Weekly/Monthly */}
                      {selectedBreakDateDrilldown && (
                        <div className="flex items-center justify-between border-b border-[#F0E6DD] bg-[#FAF8F5] px-6 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBreakDateDrilldown(null);
                                setBreakCurrentPage(1);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DEC5B0] bg-white px-3 py-1.5 text-xs font-bold text-[#75472D] shadow-2xs hover:bg-[#FAF6F1] transition cursor-pointer"
                            >
                              <ArrowLeft size={13} />
                              <span>Back to {spendingPeriodMode === "weekly" ? "Weekly" : "Monthly"} Summary</span>
                            </button>
                            <span className="text-xs font-bold text-[#342219]">
                              Orders for {(() => {
                                const [y, m, d] = selectedBreakDateDrilldown.split("-").map(Number);
                                return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                });
                              })()}
                            </span>
                          </div>

                          <span className="text-xs font-semibold text-[#8A7667]">
                            {filteredBreakRows.length} item line(s)
                          </span>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-[#F0E6DD] bg-[#FAF8F5] text-xs font-bold text-[#6B574B]">
                            <tr>
                              <th className="py-4 pl-6 pr-4">Date</th>
                              <th className="px-4 py-4">Item Name</th>
                              <th className="px-4 py-4">Quantity</th>
                              <th className="px-4 py-4">Price</th>
                              <th className="px-4 py-4 text-right pr-6">Total Amount</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-[#F4EFEA]">
                            {isBreakFiltering ? (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-sm text-[#8A7667]">
                                  <div className="flex items-center justify-center gap-2">
                                    <RotateCw size={18} className="animate-spin text-[#75472D]" />
                                    <span>Loading break orders...</span>
                                  </div>
                                </td>
                              </tr>
                            ) : paginatedBreakRows.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-sm text-[#8A7667]">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Coffee size={28} className="text-[#B39B88]" />
                                    <p className="font-semibold text-[#342219]">
                                      No orders found for the selected break and date range.
                                    </p>
                                    <p className="text-xs text-[#8A7667]">
                                      No cafe orders were placed between {appliedBreakFilter.breakSession.startTime} and {appliedBreakFilter.breakSession.endTime} from {appliedBreakFilter.fromDate} to {appliedBreakFilter.toDate}.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              paginatedBreakRows.map((row) => (
                                <tr key={row.id} className="hover:bg-[#FAF8F5] transition-colors">
                                  <td className="py-4 pl-6 pr-4">
                                    <div className="font-bold text-[#231812] text-sm">
                                      {row.displayDate}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-[#8A7667] mt-0.5 whitespace-nowrap">
                                      <Clock size={11} className="text-[#75472D] shrink-0" />
                                      <span>{row.displayTime}</span>
                                      <span>&bull;</span>
                                      <span>{row.locationName}</span>
                                      <span>&bull;</span>
                                      <span>{row.employeeName}</span>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-[#342219]">
                                      {row.itemName}
                                    </div>
                                    <div className="text-[11px] text-[#8A7667]">
                                      Order #{row.displayOrderId}
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 font-bold text-[#342219]">
                                    {row.quantity}
                                  </td>

                                  <td className="px-4 py-4 text-[#342219]">
                                    {formatPrice(row.price)}
                                  </td>

                                  <td className="px-4 py-4 text-right pr-6 font-bold text-[#1E140E]">
                                    {formatPrice(row.amount)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Table Footer: Count & Pagination for Break View */}
                      <div className="flex flex-col items-center justify-between gap-3 border-t border-[#F0E6DD] bg-white px-6 py-4 sm:flex-row">
                        <span className="text-xs font-medium text-[#7C6B5E]">
                          Showing {paginatedBreakRows.length > 0 ? (breakCurrentPage - 1) * breakPageSize + 1 : 0} to{" "}
                          {Math.min(breakCurrentPage * breakPageSize, filteredBreakRows.length)} of {filteredBreakRows.length} items
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBreakCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={breakCurrentPage === 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEC5B0] bg-white text-[#75472D] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF6F1]"
                          >
                            <ChevronRight size={14} className="rotate-180" />
                          </button>

                          {Array.from({ length: breakTotalPages }).map((_, idx) => {
                            const pageNum = idx + 1;
                            const isActive = breakCurrentPage === pageNum;
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setBreakCurrentPage(pageNum)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                                  isActive
                                    ? "bg-[#75472D] text-white shadow-sm"
                                    : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF6F1]"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => setBreakCurrentPage((p) => Math.min(breakTotalPages, p + 1))}
                            disabled={breakCurrentPage === breakTotalPages || breakTotalPages === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEC5B0] bg-white text-[#75472D] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF6F1]"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  /* Existing Daily Reports Table Card */
                  <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-[#F0E6DD] bg-[#FAF8F5] text-xs font-bold text-[#6B574B]">
                          <tr>
                            <th className="py-4 pl-6 pr-4">Date</th>
                            <th className="px-4 py-4">Adjustment</th>
                            <th className="px-4 py-4">Discount</th>
                            <th className="px-4 py-4">Net Amount</th>
                            <th className="py-4 pl-2 pr-6 text-right"></th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-[#F4EFEA]">
                          {isLoading ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-sm text-[#8A7667]">
                                <div className="flex items-center justify-center gap-2">
                                  <RotateCw size={18} className="animate-spin text-[#75472D]" />
                                  <span>Loading report data...</span>
                                </div>
                              </td>
                            </tr>
                          ) : paginatedRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-sm text-[#8A7667]">
                                No daily reports found for this period.
                              </td>
                            </tr>
                          ) : (
                            paginatedRecords.map((row) => {
                              const isSelected = selectedDayRecord?.dateStr === row.dateStr;

                              return (
                                <tr
                                  key={row.dateStr}
                                  onClick={() => setSelectedDayRecord(row)}
                                  className={`group cursor-pointer transition-colors duration-150 ${
                                    isSelected
                                      ? "bg-[#FBF1E6]"
                                      : "hover:bg-[#FAF8F5]"
                                  }`}
                                >
                                  <td className="py-4 pl-6 pr-4">
                                    <div className="font-bold text-[#231812] text-sm">
                                      {row.displayDate}
                                    </div>
                                    <div className="text-xs text-[#8A7667]">{row.dayOfWeek}</div>
                                  </td>

                                  <td className="px-4 py-4 text-[#342219]">
                                    {formatPrice(row.adjustment)}
                                  </td>

                                  <td className="px-4 py-4 text-[#342219]">
                                    {formatPrice(row.discount)}
                                  </td>

                                  <td className="px-4 py-4 font-bold text-[#1E140E]">
                                    {formatPrice(row.netAmount)}
                                  </td>

                                  <td className="py-4 pl-2 pr-6 text-right">
                                    <div
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                                        isSelected
                                          ? "border-[#DEC5B0] bg-white text-[#75472D]"
                                          : "border-[#E8DED4] bg-white text-[#9A8778] group-hover:border-[#DEC5B0] group-hover:text-[#75472D]"
                                      }`}
                                    >
                                      <ChevronRight size={16} />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer: Count & Pagination */}
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-[#F0E6DD] bg-white px-6 py-4 sm:flex-row">
                      <span className="text-xs font-medium text-[#7C6B5E]">
                        Showing {paginatedRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
                        {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} days
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEC5B0] bg-white text-[#75472D] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF6F1]"
                        >
                          <ChevronRight size={14} className="rotate-180" />
                        </button>

                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          const isActive = currentPage === pageNum;
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                                isActive
                                  ? "bg-[#75472D] text-white shadow-sm"
                                  : "border border-[#DEC5B0] bg-white text-[#75472D] hover:bg-[#FAF6F1]"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages || totalPages === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEC5B0] bg-white text-[#75472D] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF6F1]"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Daily Detail Panel */}
              {selectedDayRecord && (
                <div className="w-full lg:w-[37%] xl:w-[35%] rounded-3xl border border-[#EEE5DC] bg-white p-6 shadow-xl shadow-[#70452D]/5">
                  {/* Panel Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-black text-[#1E140E]">Daily Detail</h2>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#7C6B5E]">
                        <Calendar size={14} className="text-[#75472D]" />
                        <span>
                          {selectedDayRecord.displayDate} ({selectedDayRecord.fullDayOfWeek})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDayRecord(null)}
                      className="rounded-full p-1.5 text-[#A08C7D] hover:bg-[#FAF6F1] hover:text-[#342219]"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* 4 Summary Cards (Morning, Evening, Adjustment, Discount) */}
                  <div className="mb-4 grid grid-cols-4 gap-2">
                    {/* Morning */}
                    <div className="rounded-2xl border border-[#F0E6DD] bg-white p-2.5 text-center shadow-xs">
                      <Sun size={16} className="mx-auto mb-1 text-amber-500" />
                      <span className="block text-[10px] font-semibold text-[#8A7667]">Morning</span>
                      <span className="block text-xs font-black text-[#1E140E]">
                        {formatPrice(selectedDayRecord.morningSubtotal)}
                      </span>
                      <span className="block text-[9px] text-[#A08C7D]">
                        ({selectedDayRecord.morningOrdersCount} orders)
                      </span>
                    </div>

                    {/* Evening */}
                    <div className="rounded-2xl border border-[#F0E6DD] bg-white p-2.5 text-center shadow-xs">
                      <Moon size={16} className="mx-auto mb-1 text-orange-500" />
                      <span className="block text-[10px] font-semibold text-[#8A7667]">Evening</span>
                      <span className="block text-xs font-black text-[#1E140E]">
                        {formatPrice(selectedDayRecord.eveningSubtotal)}
                      </span>
                      <span className="block text-[9px] text-[#A08C7D]">
                        ({selectedDayRecord.eveningOrdersCount} orders)
                      </span>
                    </div>

                    {/* Adjustment */}
                    <div className="rounded-2xl border border-[#F0E6DD] bg-white p-2.5 text-center shadow-xs">
                      <Receipt size={16} className="mx-auto mb-1 text-red-500" />
                      <span className="block text-[10px] font-semibold text-[#8A7667]">Adjustment</span>
                      <span className="mt-1 block text-xs font-black text-[#1E140E]">
                        {formatPrice(selectedDayRecord.adjustment)}
                      </span>
                    </div>

                    {/* Discount */}
                    <div className="rounded-2xl border border-[#F0E6DD] bg-white p-2.5 text-center shadow-xs">
                      <Percent size={16} className="mx-auto mb-1 text-rose-500" />
                      <span className="block text-[10px] font-semibold text-[#8A7667]">Discount</span>
                      <span className="mt-1 block text-xs font-black text-[#1E140E]">
                        {formatPrice(selectedDayRecord.discount)}
                      </span>
                    </div>
                  </div>

                  {/* Day Total (Net Amount) Banner */}
                  <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#FBF1E6] px-5 py-3.5 border border-[#DEC5B0]/50">
                    <span className="text-xs font-black text-[#6F4228]">Day Total (Net Amount)</span>
                    <span className="text-xl font-black text-[#1E140E]">
                      {formatPrice(selectedDayRecord.netAmount)}
                    </span>
                  </div>

                  {/* SESSIONS BREAKDOWN */}
                  <div className="space-y-6 max-h-[580px] overflow-y-auto pr-1">
                    {/* 1. Morning Session Header & Items */}
                    <div>
                      <div className="mb-3 flex items-center justify-between border-b border-[#F0E6DD] pb-2">
                        <div className="flex items-center gap-1.5">
                          <Sun size={17} className="text-amber-500" />
                          <span className="text-xs font-extrabold text-[#231812]">Morning Session</span>
                          <span className="text-[10px] text-[#9A8778]">
                            ({periodConfig.morningStart} - {periodConfig.morningEnd})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-[#75472D]">
                            Subtotal: {formatPrice(selectedDayRecord.morningSubtotal)}
                          </span>
                          <ChevronUp size={15} className="text-[#8A7667]" />
                        </div>
                      </div>

                      {/* Header row for items */}
                      <div className="flex items-center justify-between px-2 text-[10px] font-bold text-[#9A8778] uppercase mb-1">
                        <span>Item</span>
                        <div className="flex items-center gap-8">
                          <span>Quantity Sold</span>
                          <span>Total Amount</span>
                        </div>
                      </div>

                      {/* Morning Items list */}
                      {selectedDayRecord.morningItems.length === 0 ? (
                        <p className="py-4 text-center text-xs text-[#A08C7D]">
                          No items sold during the morning session.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDayRecord.morningItems.map((item, idx) => {
                            const itemKey = `morning_${item.name}_${idx}`;
                            const isExpanded = !!expandedItems[itemKey];

                            return (
                              <div
                                key={itemKey}
                                className="rounded-2xl border border-[#EEE5DC] bg-white overflow-hidden"
                              >
                                {/* Main Item Header row */}
                                <div
                                  onClick={() => toggleItemExpansion(itemKey)}
                                  className="flex cursor-pointer items-center justify-between p-2.5 transition hover:bg-[#FAF8F5]"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="h-9 w-9 rounded-xl object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF1E8] text-[#75472D]">
                                        <Coffee size={18} />
                                      </div>
                                    )}
                                    <span className="text-xs font-bold text-[#231812]">{item.name}</span>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    <span className="w-12 text-center text-xs font-bold text-[#342219]">
                                      {item.quantitySold}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-[#1E140E]">
                                        {formatPrice(item.totalAmount)}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp size={15} className="text-[#8A7667]" />
                                      ) : (
                                        <ChevronDown size={15} className="text-[#8A7667]" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded Seat & Order Breakdown Table */}
                                {isExpanded && (
                                  <div className="border-t border-[#F0E6DD] bg-[#FAF8F5] p-2.5">
                                    <table className="w-full text-left text-[11px]">
                                      <thead>
                                        <tr className="text-[10px] font-bold text-[#8A7667] border-b border-[#EFE7DE]">
                                          <th className="pb-1.5 pl-1">Seat ID</th>
                                          <th className="pb-1.5">Order Time</th>
                                          <th className="pb-1.5">Quantity</th>
                                          <th className="pb-1.5">Preferences</th>
                                          <th className="pb-1.5 pr-1 text-right">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#F2EAE2]">
                                        {item.orders.map((ord, oIdx) => (
                                          <tr key={oIdx} className="text-[#342219]">
                                            <td className="py-1.5 pl-1 font-mono font-semibold text-[#75472D]">
                                              {formatSeatIdentifier(ord.seatId)}
                                            </td>
                                            <td className="py-1.5 text-[#8A7667]">{ord.orderTime}</td>
                                            <td className="py-1.5">{ord.qty}</td>
                                            <td className="py-1.5 text-[#6B574B]">{ord.preferences}</td>
                                            <td className="py-1.5 pr-1 text-right font-bold text-[#1E140E]">
                                              {formatPrice(ord.amount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 2. Evening Session Header & Items */}
                    <div>
                      <div className="mb-3 flex items-center justify-between border-b border-[#F0E6DD] pb-2">
                        <div className="flex items-center gap-1.5">
                          <Moon size={17} className="text-orange-500" />
                          <span className="text-xs font-extrabold text-[#231812]">Evening Session</span>
                          <span className="text-[10px] text-[#9A8778]">
                            ({periodConfig.eveningStart} - {periodConfig.eveningEnd})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-[#75472D]">
                            Subtotal: {formatPrice(selectedDayRecord.eveningSubtotal)}
                          </span>
                          <ChevronUp size={15} className="text-[#8A7667]" />
                        </div>
                      </div>

                      {/* Header row for items */}
                      <div className="flex items-center justify-between px-2 text-[10px] font-bold text-[#9A8778] uppercase mb-1">
                        <span>Item</span>
                        <div className="flex items-center gap-8">
                          <span>Quantity Sold</span>
                          <span>Total Amount</span>
                        </div>
                      </div>

                      {/* Evening Items list */}
                      {selectedDayRecord.eveningItems.length === 0 ? (
                        <p className="py-4 text-center text-xs text-[#A08C7D]">
                          No items sold during the evening session.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDayRecord.eveningItems.map((item, idx) => {
                            const itemKey = `evening_${item.name}_${idx}`;
                            const isExpanded = !!expandedItems[itemKey];

                            return (
                              <div
                                key={itemKey}
                                className="rounded-2xl border border-[#EEE5DC] bg-white overflow-hidden"
                              >
                                <div
                                  onClick={() => toggleItemExpansion(itemKey)}
                                  className="flex cursor-pointer items-center justify-between p-2.5 transition hover:bg-[#FAF8F5]"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="h-9 w-9 rounded-xl object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF1E8] text-[#75472D]">
                                        <Coffee size={18} />
                                      </div>
                                    )}
                                    <span className="text-xs font-bold text-[#231812]">{item.name}</span>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    <span className="w-12 text-center text-xs font-bold text-[#342219]">
                                      {item.quantitySold}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-[#1E140E]">
                                        {formatPrice(item.totalAmount)}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp size={15} className="text-[#8A7667]" />
                                      ) : (
                                        <ChevronDown size={15} className="text-[#8A7667]" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="border-t border-[#F0E6DD] bg-[#FAF8F5] p-2.5">
                                    <table className="w-full text-left text-[11px]">
                                      <thead>
                                        <tr className="text-[10px] font-bold text-[#8A7667] border-b border-[#EFE7DE]">
                                          <th className="pb-1.5 pl-1">Seat ID</th>
                                          <th className="pb-1.5">Order Time</th>
                                          <th className="pb-1.5">Quantity</th>
                                          <th className="pb-1.5">Preferences</th>
                                          <th className="pb-1.5 pr-1 text-right">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#F2EAE2]">
                                        {item.orders.map((ord, oIdx) => (
                                          <tr key={oIdx} className="text-[#342219]">
                                            <td className="py-1.5 pl-1 font-mono font-semibold text-[#75472D]">
                                              {formatSeatIdentifier(ord.seatId)}
                                            </td>
                                            <td className="py-1.5 text-[#8A7667]">{ord.orderTime}</td>
                                            <td className="py-1.5">{ord.qty}</td>
                                            <td className="py-1.5 text-[#6B574B]">{ord.preferences}</td>
                                            <td className="py-1.5 pr-1 text-right font-bold text-[#1E140E]">
                                              {formatPrice(ord.amount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Daily Summary Bottom Bar */}
                  <div className="mt-6 rounded-2xl border border-[#F0E6DD] bg-[#FAF8F5] p-3.5">
                    <span className="block text-xs font-bold text-[#342219] mb-2">Daily Summary</span>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Day Total</span>
                        <span className="block text-xs font-black text-[#1E140E]">
                          {formatPrice(selectedDayRecord.dayTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Total Adjustment</span>
                        <span className="block text-xs font-bold text-[#1E140E]">
                          {formatPrice(selectedDayRecord.adjustment)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Total Discount</span>
                        <span className="block text-xs font-bold text-[#1E140E]">
                          {formatPrice(selectedDayRecord.discount)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Net Amount</span>
                        <span className="block text-xs font-black text-[#75472D]">
                          {formatPrice(selectedDayRecord.netAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </Background>
  );
}
