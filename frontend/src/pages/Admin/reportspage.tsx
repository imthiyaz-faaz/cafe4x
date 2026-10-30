import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Calendar,
  Search,
  ChevronRight,
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
} from "lucide-react";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { reportApi } from "../../services/reports";
import type { ProviderOrder } from "../../services/orders";
import { itemsApi, type MenuItem } from "../../services/items";
import { workingHoursApi } from "../../services/workingHoursApi";
import {
  classifyOrderPeriod,
  DEFAULT_ORDER_PERIODS,
  getTimeInTimezone,
  type OrderPeriodConfig,
} from "../../utils/orderTimeClassification";

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

export default function AdminReportPage() {
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;

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
  useEffect(() => {
    workingHoursApi
      .getWorkingHours()
      .then((res: any) => {
        const tz = res?.workingHours?.timezone || res?.timezone;
        if (tz) setOrgTimezone(tz);

        const breaks = res?.workingHours?.breakSessions || [];
        if (Array.isArray(breaks) && breaks.length > 0) {
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

  // 4. Fetch orders for this month from API with fallback to local cached orders
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

  // 5. Aggregate Orders into Daily Records matching the screenshot table exactly
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
      if (o.status === "Canceled") return; // exclude canceled orders from report revenue

      const dateField = o.createdAt || new Date().toISOString();
      const { timeStr, dateStr, displayTime } = getTimeInTimezone(dateField, orgTimezone);
      if (!dateStr) return;

      // Filter by the selected year-month
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

      // Classify period: morning or evening.
      // If configured periods classify as morning, it's morning.
      // If classifyOrderPeriod returns 'other', use noon (12:00) as the intuitive boundary.
      const classified = classifyOrderPeriod(dateField, orgTimezone, periodConfig);
      let isMorning = true;
      if (classified === "morning") {
        isMorning = true;
      } else if (classified === "evening") {
        isMorning = false;
      } else {
        // Fallback: before 12:00 PM is morning, 12:00 PM or after is evening
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

      // Extract items resiliently whether array or itemsJson string
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
          orderId: o.displayId || o.id,
          seatId: o.seat || o.locationName || "-",
          orderTime: displayTime || o.time || "-",
          qty: itQty,
          preferences: it.preference || "-",
          amount: itTotal,
        });
      });
    });

    // Build array sorted by date descending (latest day first)
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
  }, [orders, orgTimezone, periodConfig, itemsByName]);

  // Monthly Spending Calculation (Office Cafe Expenses, not sales/revenue)
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
    }
  }, [dailyRecords]);

  // Filter records by search input (day number, weekday, full date, or items sold)
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

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            {/* Top Container: Left Reports Table + Right Daily Detail Panel */}
            <div className="flex flex-col gap-6 lg:flex-row items-start">
              {/* LEFT COLUMN: Daily Reports Table */}
              <div
                className={`transition-all duration-300 w-full ${
                  selectedDayRecord ? "lg:w-[63%] xl:w-[65%]" : "lg:w-full"
                }`}
              >
                {/* Header Title + Month Selector */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#1E140E]">
                      Daily Reports
                    </h1>
                    <p className="mt-1 text-sm font-medium text-[#7C6B5E]">
                      Monthly office cafe expenditure, daily spending, and order inspection
                    </p>
                  </div>

                  {/* Date Range Picker Input */}
                  <div className="relative flex items-center">
                    <label className="relative flex items-center gap-2 cursor-pointer rounded-2xl border border-[#DEC5B0] bg-white hover:bg-[#FAF8F5] transition-colors px-4 py-2.5 text-xs font-bold text-[#342219] shadow-sm">
                      <Calendar size={16} className="text-[#75472D] pointer-events-none" />
                      <span className="pointer-events-none">{activeDateRange.formattedRangeDisplay}</span>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedMonth(e.target.value);
                            setCurrentPage(1);
                          }
                        }}
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker?.();
                          } catch {}
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <ChevronDown size={15} className="ml-1 text-[#8A7667] pointer-events-none" />
                    </label>
                  </div>
                </div>

                {/* Monthly Cafe Spending Section (Office Expenditure) */}
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
                      ₹ {monthlySpendingSummary.totalSpending.toLocaleString("en-IN")}
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
                          ₹ {monthlySpendingSummary.morningSpending.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="h-7 w-[1px] bg-[#EEE5DC]"></div>
                      <div>
                        <span className="text-[10px] font-semibold text-[#8A7667] block">Evening</span>
                        <span className="text-sm font-extrabold text-[#1E140E]">
                          ₹ {monthlySpendingSummary.eveningSpending.toLocaleString("en-IN")}
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

                {/* Search Bar matching screenshot */}
                <div className="mb-5">
                  <div className="relative">
                    <Search
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A8778]"
                    />
                    <input
                      type="text"
                      value={searchDateQuery}
                      onChange={(e) => {
                        setSearchDateQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search by date (e.g. 22, Thu), or item name..."
                      className="w-full rounded-2xl border border-[#DEC5B0]/70 bg-white py-3 pl-11 pr-4 text-sm text-[#342219] placeholder:text-[#A8988B] outline-none transition focus:border-[#75472D] focus:ring-2 focus:ring-[#75472D]/15"
                    />
                  </div>
                </div>

                {/* Daily Reports Table Card */}
                <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#F0E6DD] bg-[#FAF8F5] text-xs font-bold text-[#6B574B]">
                        <tr>
                          <th className="py-4 pl-6 pr-4">Date</th>
                          <th className="px-4 py-4">
                            Morning <span className="block text-[11px] font-normal text-[#9A8778]">(Subtotal)</span>
                          </th>
                          <th className="px-4 py-4">
                            Evening <span className="block text-[11px] font-normal text-[#9A8778]">(Subtotal)</span>
                          </th>
                          <th className="px-4 py-4">Adjustment</th>
                          <th className="px-4 py-4">Discount</th>
                          <th className="px-4 py-4">Net Amount</th>
                          <th className="py-4 pl-2 pr-6 text-right"></th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#F4EFEA]">
                        {isLoading ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-sm text-[#8A7667]">
                              <div className="flex items-center justify-center gap-2">
                                <RotateCw size={18} className="animate-spin text-[#75472D]" />
                                <span>Loading report data...</span>
                              </div>
                            </td>
                          </tr>
                        ) : paginatedRecords.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-sm text-[#8A7667]">
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

                                <td className="px-4 py-4 font-semibold text-[#342219]">
                                  ₹ {row.morningSubtotal.toLocaleString("en-IN")}
                                </td>

                                <td className="px-4 py-4 font-semibold text-[#342219]">
                                  ₹ {row.eveningSubtotal.toLocaleString("en-IN")}
                                </td>

                                <td className="px-4 py-4 text-[#342219]">
                                  ₹ {row.adjustment.toLocaleString("en-IN")}
                                </td>

                                <td className="px-4 py-4 text-[#342219]">
                                  ₹ {row.discount.toLocaleString("en-IN")}
                                </td>

                                <td className="px-4 py-4 font-bold text-[#1E140E]">
                                  ₹ {row.netAmount.toLocaleString("en-IN")}
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
                        ₹ {selectedDayRecord.morningSubtotal.toLocaleString("en-IN")}
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
                        ₹ {selectedDayRecord.eveningSubtotal.toLocaleString("en-IN")}
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
                        ₹ {selectedDayRecord.adjustment.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {/* Discount */}
                    <div className="rounded-2xl border border-[#F0E6DD] bg-white p-2.5 text-center shadow-xs">
                      <Percent size={16} className="mx-auto mb-1 text-rose-500" />
                      <span className="block text-[10px] font-semibold text-[#8A7667]">Discount</span>
                      <span className="mt-1 block text-xs font-black text-[#1E140E]">
                        ₹ {selectedDayRecord.discount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Day Total (Net Amount) Banner */}
                  <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#FBF1E6] px-5 py-3.5 border border-[#DEC5B0]/50">
                    <span className="text-xs font-black text-[#6F4228]">Day Total (Net Amount)</span>
                    <span className="text-xl font-black text-[#1E140E]">
                      ₹ {selectedDayRecord.netAmount.toLocaleString("en-IN")}
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
                            Subtotal: ₹ {selectedDayRecord.morningSubtotal.toLocaleString("en-IN")}
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
                                        ₹ {item.totalAmount.toLocaleString("en-IN")}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp size={15} className="text-[#8A7667]" />
                                      ) : (
                                        <ChevronDown size={15} className="text-[#8A7667]" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded Seat & Order Breakdown Table matching screenshot */}
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
                                              {ord.seatId}
                                            </td>
                                            <td className="py-1.5 text-[#8A7667]">{ord.orderTime}</td>
                                            <td className="py-1.5">{ord.qty}</td>
                                            <td className="py-1.5 text-[#6B574B]">{ord.preferences}</td>
                                            <td className="py-1.5 pr-1 text-right font-bold text-[#1E140E]">
                                              ₹ {ord.amount.toLocaleString("en-IN")}
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
                            Subtotal: ₹ {selectedDayRecord.eveningSubtotal.toLocaleString("en-IN")}
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
                                        ₹ {item.totalAmount.toLocaleString("en-IN")}
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
                                              {ord.seatId}
                                            </td>
                                            <td className="py-1.5 text-[#8A7667]">{ord.orderTime}</td>
                                            <td className="py-1.5">{ord.qty}</td>
                                            <td className="py-1.5 text-[#6B574B]">{ord.preferences}</td>
                                            <td className="py-1.5 pr-1 text-right font-bold text-[#1E140E]">
                                              ₹ {ord.amount.toLocaleString("en-IN")}
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

                  {/* Daily Summary Bottom Bar matching screenshot */}
                  <div className="mt-6 rounded-2xl border border-[#F0E6DD] bg-[#FAF8F5] p-3.5">
                    <span className="block text-xs font-bold text-[#342219] mb-2">Daily Summary</span>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Day Total</span>
                        <span className="block text-xs font-black text-[#1E140E]">
                          ₹ {selectedDayRecord.dayTotal.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Total Adjustment</span>
                        <span className="block text-xs font-bold text-[#1E140E]">
                          ₹ {selectedDayRecord.adjustment.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Total Discount</span>
                        <span className="block text-xs font-bold text-[#1E140E]">
                          ₹ {selectedDayRecord.discount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8A7667]">Net Amount</span>
                        <span className="block text-xs font-black text-[#75472D]">
                          ₹ {selectedDayRecord.netAmount.toLocaleString("en-IN")}
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
