import { formatCurrency, getActiveOrgCurrency } from "../../utils/currencies";
import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  ChevronRight,
  MapPin,
  User,
  Clock,
  ArrowLeft,
  Calendar,
  RotateCw,
  Building2,
  Users,
  ShoppingBag,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  X,
} from "lucide-react";

import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import {
  orderApi,
  type LocationOrderSummary,
  type LocationEmployeeOrderSummary,
  type EmployeeOrderDetailProfile,
  type ProviderOrder,
} from "../../services/orderApi";
import { organizationApi } from "../../services/organizationApi";
import { workingHoursApi } from "../../services/workingHoursApi";
import { getDateStringsInTimezone } from "../../utils/orderTimeClassification";
import { formatSeatIdentifier } from "../../utils/seatFormatter";

type ActiveView = "locations" | "employees" | "orders";
type DateFilterType = "today" | "yesterday" | "custom";

export default function OrdersPage() {
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;

  // Organization Currency & Timezone
  const [currency, setCurrency] = useState<string | null>(null);
  const [orgTimezone, setOrgTimezone] = useState<string>("Asia/Dubai");

  // Navigation & Drill-Down State
  const [activeView, setActiveView] = useState<ActiveView>("locations");
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<LocationEmployeeOrderSummary | null>(null);

  // Date Filter State
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Data States
  const [locations, setLocations] = useState<LocationOrderSummary[]>([]);
  const [locationEmployees, setLocationEmployees] = useState<LocationEmployeeOrderSummary[]>([]);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeOrderDetailProfile | null>(null);
  const [employeeOrders, setEmployeeOrders] = useState<ProviderOrder[]>([]);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination for Employee Orders view
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modal for Viewing Single Order Details
  const [inspectedOrder, setInspectedOrder] = useState<ProviderOrder | null>(null);

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

  // Compute Active Start and End Dates based on Org Timezone
  const activeDateRange = useMemo(() => {
    const { todayStr, yesterdayStr } = getDateStringsInTimezone(orgTimezone);
    if (dateFilterType === "today") {
      return { startDate: todayStr, endDate: todayStr };
    } else if (dateFilterType === "yesterday") {
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    } else {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
  }, [dateFilterType, customStartDate, customEndDate, orgTimezone]);

  const formatPrice = (amount: number) => {
    return formatCurrency(amount, currency || getActiveOrgCurrency(currentShortCode));
  };

  // 1. Fetch Locations with Order Aggregates
  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const data = await orderApi.getOrderLocations({
        startDate: activeDateRange.startDate,
        endDate: activeDateRange.endDate,
      });
      setLocations(data || []);
    } catch (err) {
      console.error("Failed to fetch order locations:", err);
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Employees for a Selected Location
  const fetchLocationEmployees = async (locId: string) => {
    setIsLoading(true);
    try {
      const res = await orderApi.getLocationEmployees(locId, {
        startDate: activeDateRange.startDate,
        endDate: activeDateRange.endDate,
      });
      setLocationEmployees(res.employees || []);
      if (res.location) {
        setSelectedLocation(res.location);
      }
    } catch (err) {
      console.error("Failed to fetch location employees:", err);
      setLocationEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Fetch Orders for a Selected Employee
  const fetchEmployeeOrders = async (empId: string) => {
    setIsLoading(true);
    try {
      const res = await orderApi.getEmployeeOrders(empId, {
        startDate: activeDateRange.startDate,
        endDate: activeDateRange.endDate,
      });
      setEmployeeProfile(res.employee || null);
      setEmployeeOrders(res.orders || []);
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to fetch employee orders:", err);
      setEmployeeOrders([]);
      setEmployeeProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Data whenever View, Selected Target, or Date Filter changes
  useEffect(() => {
    if (activeView === "locations") {
      fetchLocations();
    } else if (activeView === "employees" && selectedLocation) {
      fetchLocationEmployees(selectedLocation.id);
    } else if (activeView === "orders" && selectedEmployee) {
      fetchEmployeeOrders(selectedEmployee.employeeId);
    }
  }, [activeView, selectedLocation?.id, selectedEmployee?.employeeId, activeDateRange]);

  // Handle Location Click
  const handleSelectLocation = (loc: LocationOrderSummary) => {
    setSelectedLocation({ id: loc.id, name: loc.name });
    setSelectedEmployee(null);
    setSearchQuery("");
    setActiveView("employees");
  };

  // Handle Employee Click
  const handleSelectEmployee = (emp: LocationEmployeeOrderSummary) => {
    setSelectedEmployee(emp);
    setSearchQuery("");
    setActiveView("orders");
  };

  // Status Badge Helper
  const renderStatusBadge = (status?: string) => {
    const s = (status || "Pending").toLowerCase();
    let badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
    if (s === "delivered" || s === "completed") {
      badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    } else if (s === "ready") {
      badgeClass = "bg-blue-100 text-blue-800 border-blue-200";
    } else if (s === "preparing") {
      badgeClass = "bg-purple-100 text-purple-800 border-purple-200";
    } else if (s === "cancelled" || s === "canceled") {
      badgeClass = "bg-rose-100 text-rose-800 border-rose-200";
    } else if (s === "none") {
      badgeClass = "bg-stone-100 text-stone-600 border-stone-200";
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
        {status || "Pending"}
      </span>
    );
  };

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.toLowerCase();
    return locations.filter((loc) => loc.name.toLowerCase().includes(q));
  }, [locations, searchQuery]);

  // Filtered Location Employees
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return locationEmployees;
    const q = searchQuery.toLowerCase();
    return locationEmployees.filter(
      (e) =>
        e.employeeName.toLowerCase().includes(q) ||
        (e.username && e.username.toLowerCase().includes(q)) ||
        (e.seat && e.seat.toLowerCase().includes(q))
    );
  }, [locationEmployees, searchQuery]);

  // Filtered Employee Orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return employeeOrders;
    const q = searchQuery.toLowerCase();
    return employeeOrders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        (o.displayId && o.displayId.toLowerCase().includes(q)) ||
        (o.seat && o.seat.toLowerCase().includes(q)) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [employeeOrders, searchQuery]);

  // Paginated Orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20 text-[#4A3E3D]">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {/* Top Header & Breadcrumbs */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center text-sm font-medium text-stone-500 mb-2 space-x-2">
              <button
                onClick={() => {
                  setActiveView("locations");
                  setSelectedLocation(null);
                  setSelectedEmployee(null);
                }}
                className={`hover:text-[#8C6D58] transition-colors ${
                  activeView === "locations" ? "text-[#8C6D58] font-bold" : ""
                }`}
              >
                Orders
              </button>

              {selectedLocation && (
                <>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                  <button
                    onClick={() => {
                      setActiveView("employees");
                      setSelectedEmployee(null);
                    }}
                    className={`hover:text-[#8C6D58] transition-colors ${
                      activeView === "employees" ? "text-[#8C6D58] font-bold" : ""
                    }`}
                  >
                    {selectedLocation.name}
                  </button>
                </>
              )}

              {selectedEmployee && (
                <>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                  <span className="text-[#8C6D58] font-bold">
                    {employeeProfile?.name || selectedEmployee.employeeName}
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                  <span className="text-stone-500 font-semibold">Employee Orders</span>
                </>
              )}
            </nav>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#382D2C] tracking-tight flex items-center gap-3">
              {activeView === "locations" && (
                <>
                  <Building2 className="w-8 h-8 text-[#8C6D58]" />
                  <span>Orders by Location</span>
                </>
              )}
              {activeView === "employees" && (
                <>
                  <Users className="w-8 h-8 text-[#8C6D58]" />
                  <span>{selectedLocation?.name} – Employees</span>
                </>
              )}
              {activeView === "orders" && (
                <>
                  <ShoppingBag className="w-8 h-8 text-[#8C6D58]" />
                  <span>Orders – {employeeProfile?.name || selectedEmployee?.employeeName}</span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {activeView === "locations" && "Select a location to inspect assigned employee orders and total spending."}
              {activeView === "employees" && `Displaying all employees and active order tallies for ${selectedLocation?.name}.`}
              {activeView === "orders" && `Seat: ${formatSeatIdentifier(employeeProfile?.seatIdentifier || selectedEmployee?.seat)} • Location: ${employeeProfile?.locationName || selectedLocation?.name}`}
            </p>
          </div>

          {/* Date Range Selector & Back Button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filters: Today | Yesterday | Custom */}
            <div className="inline-flex rounded-xl bg-white p-1 shadow-sm border border-stone-200">
              <button
                onClick={() => setDateFilterType("today")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateFilterType === "today"
                    ? "bg-[#8C6D58] text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilterType("yesterday")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateFilterType === "yesterday"
                    ? "bg-[#8C6D58] text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDateFilterType("custom")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateFilterType === "custom"
                    ? "bg-[#8C6D58] text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Date Pickers */}
            {dateFilterType === "custom" && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm text-xs">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-none text-stone-700 focus:outline-none text-xs"
                />
                <span className="text-stone-300">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-none text-stone-700 focus:outline-none text-xs"
                />
              </div>
            )}

            {/* Back Button (if inside sub-view) */}
            {activeView === "employees" && (
              <button
                onClick={() => {
                  setActiveView("locations");
                  setSelectedLocation(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 shadow-sm transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Locations
              </button>
            )}

            {activeView === "orders" && (
              <button
                onClick={() => {
                  setActiveView("employees");
                  setSelectedEmployee(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 shadow-sm transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Employees
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => {
                if (activeView === "locations") fetchLocations();
                else if (activeView === "employees" && selectedLocation) fetchLocationEmployees(selectedLocation.id);
                else if (activeView === "orders" && selectedEmployee) fetchEmployeeOrders(selectedEmployee.employeeId);
              }}
              title="Refresh Data"
              className="p-2 text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 shadow-sm transition-all"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#8C6D58]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeView === "locations"
                  ? "Search locations..."
                  : activeView === "employees"
                  ? "Search employees or seat..."
                  : "Search order ID, item name..."
              }
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C6D58] focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: LOCATIONS LIST VIEW                                              */}
        {/* ========================================================================= */}
        {activeView === "locations" && (
          <div>
            {isLoading ? (
              <div className="py-24 text-center">
                <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C6D58] mb-3" />
                <p className="text-stone-500 text-sm">Loading location order summaries from database...</p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
                <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-stone-800 mb-1">No Locations Found</h3>
                <p className="text-xs text-stone-500">
                  {searchQuery ? "No locations match your search query." : "No locations exist for this organization."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className="group relative cursor-pointer overflow-hidden rounded-3xl border border-[#EADBCE] bg-white p-5 shadow-xs hover:shadow-xl hover:border-[#8C6D58]/50 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Icon + Status Pill */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FDF8F3] to-[#F3E7DC] text-[#784D34] border border-[#E6D4C3] shadow-xs group-hover:scale-105 transition-transform duration-200">
                          <Building2 className="w-5 h-5 text-[#8C5835]" />
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-2xs ${
                            loc.status?.toLowerCase() === "inactive"
                              ? "bg-stone-100 text-stone-600 border border-stone-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              loc.status?.toLowerCase() === "inactive" ? "bg-stone-400" : "bg-emerald-500"
                            }`}
                          />
                          <span>{loc.status || "ACTIVE"}</span>
                        </span>
                      </div>

                      {/* Location Name & Subtitle */}
                      <div className="mb-4">
                        <h3 className="text-lg font-extrabold text-[#342219] group-hover:text-[#8C5835] transition-colors leading-snug truncate">
                          {loc.name}
                        </h3>
                        <p className="text-xs font-medium text-[#8A7667] mt-0.5 truncate">
                          {loc.locationType || "Office / Dining Area"}
                        </p>
                      </div>

                      {/* Primary Metrics Card */}
                      <div className="rounded-2xl border border-[#EEE5DC] bg-[#FAF8F5]/70 p-3.5 space-y-2.5 text-xs">
                        {/* Assigned Employees */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[#70523E] font-medium">
                            <Users className="w-4 h-4 text-[#A8907E]" />
                            <span>Assigned Employees:</span>
                          </span>
                          <span className="font-bold text-[#342219]">{loc.totalEmployees}</span>
                        </div>

                        {/* Total Orders */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[#70523E] font-medium">
                            <ShoppingBag className="w-4 h-4 text-[#A8907E]" />
                            <span>Total Orders:</span>
                          </span>
                          <span className="font-bold text-[#342219]">{loc.totalOrders}</span>
                        </div>

                        {/* Total Amount */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#EADBCE]/60">
                          <span className="flex items-center gap-2 text-[#70523E] font-medium">
                            <DollarSign className="w-4 h-4 text-[#8C5835]" />
                            <span>Total Amount:</span>
                          </span>
                          <span className="font-black text-sm text-[#784D34]">
                            {formatPrice(loc.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Order Status Breakdown: Pending & Delivered */}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        {/* Pending Orders */}
                        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                          <span className="flex items-center gap-1.5 font-bold text-[11px] text-amber-900">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Pending</span>
                          </span>
                          <span className="font-extrabold text-amber-900 text-xs">
                            {loc.pendingOrders}
                          </span>
                        </div>

                        {/* Delivered Orders */}
                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                          <span className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-900">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Delivered</span>
                          </span>
                          <span className="font-extrabold text-emerald-900 text-xs">
                            {loc.deliveredOrders}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer: View Employees Action */}
                    <div className="mt-5 pt-3.5 border-t border-[#EEE5DC] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#8C5835] group-hover:text-[#6F4228] transition-colors">
                        View Employees
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FAF6F1] text-[#8C5835] group-hover:bg-[#8C5835] group-hover:text-white transition-all shadow-2xs">
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: LOCATION EMPLOYEES VIEW                                          */}
        {/* ========================================================================= */}
        {activeView === "employees" && (
          <div className="bg-white rounded-3xl border border-[#EEE5DC] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#EEE5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCFAF7]">
              <div>
                <h2 className="text-lg font-bold text-[#342219] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#8C5835]" />
                  <span>{selectedLocation?.name} – Employee Orders</span>
                </h2>
                <p className="text-xs text-[#8A7667] mt-0.5">
                  Displaying employees who have placed orders for {selectedLocation?.name} within the selected date range.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF6F1] text-[#70452D] border border-[#EADBCE]">
                <span>{filteredEmployees.length} {filteredEmployees.length === 1 ? "Employee" : "Employees"} Ordered</span>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 text-center">
                <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C5835] mb-3" />
                <p className="text-[#8A7667] text-sm">Loading ordering employees for {selectedLocation?.name}...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-16 text-center text-[#8A7667] space-y-2">
                <User className="w-12 h-12 text-[#D5C2B1] mx-auto" />
                <p className="text-sm font-bold text-[#342219]">No employee orders found for this location.</p>
                <p className="text-xs text-[#8A7667] max-w-sm mx-auto">
                  Only employees who have placed at least one order within the selected date range appear in this list.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FAF7F2] text-stone-600 text-xs font-semibold uppercase tracking-wider border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-3.5">Employee</th>
                      <th className="px-6 py-3.5">Seat</th>
                      <th className="px-6 py-3.5 text-center">Total Orders</th>
                      <th className="px-6 py-3.5 text-right">Total Amount</th>
                      <th className="px-6 py-3.5 text-center">Latest Status</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    {filteredEmployees.map((emp) => (
                      <tr
                        key={emp.employeeId}
                        onClick={() => handleSelectEmployee(emp)}
                        className="hover:bg-[#FAF7F2]/60 cursor-pointer transition-colors"
                      >
                        {/* Employee Name & Username */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#8C6D58]/10 text-[#8C6D58] flex items-center justify-center font-bold text-xs uppercase">
                              {emp.employeeName.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-stone-900">{emp.employeeName}</div>
                              <div className="text-xs text-stone-400">
                                {emp.username ? `@${emp.username}` : emp.employeeEmail || "Active Employee"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Seat Identifier */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-stone-100 text-stone-700 border border-stone-200">
                            {formatSeatIdentifier(emp.seat)}
                          </span>
                        </td>

                        {/* Total Orders */}
                        <td className="px-6 py-4 text-center">
                          <span className="font-semibold text-stone-900">{emp.totalOrders}</span>
                        </td>

                        {/* Total Amount */}
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-[#8C6D58]">{formatPrice(emp.totalAmount)}</span>
                        </td>

                        {/* Latest Status */}
                        <td className="px-6 py-4 text-center">
                          {renderStatusBadge(emp.latestStatus)}
                        </td>

                        {/* Action Link */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEmployee(emp);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C6D58] hover:underline"
                          >
                            <span>View Orders</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: EMPLOYEE ORDER DETAILS VIEW                                      */}
        {/* ========================================================================= */}
        {activeView === "orders" && (
          <div className="space-y-6">
            {/* Employee Summary Profile Banner */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#8C6D58]/15 text-[#8C6D58] flex items-center justify-center font-extrabold text-lg uppercase shadow-inner">
                  {(employeeProfile?.name || selectedEmployee?.employeeName || "E").substring(0, 2)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-stone-900">
                    {employeeProfile?.name || selectedEmployee?.employeeName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-1">
                    {employeeProfile?.username && (
                      <span className="text-stone-700 font-medium">@{employeeProfile.username}</span>
                    )}
                    <span>•</span>
                    <span className="font-mono bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-stone-700">
                      {formatSeatIdentifier(employeeProfile?.seatIdentifier || selectedEmployee?.seat)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-stone-600">
                      <MapPin className="w-3.5 h-3.5 text-[#8C6D58]" />
                      {employeeProfile?.locationName || selectedLocation?.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-[#FAF7F2] p-3 rounded-xl border border-stone-200">
                  <div className="text-xs text-stone-500">Total Orders</div>
                  <div className="text-lg font-bold text-stone-900">{employeeProfile?.totalOrders ?? 0}</div>
                </div>
                <div className="bg-[#FAF7F2] p-3 rounded-xl border border-stone-200">
                  <div className="text-xs text-stone-500">Total Spend</div>
                  <div className="text-lg font-bold text-[#8C6D58]">
                    {formatPrice(employeeProfile?.totalSpend ?? 0)}
                  </div>
                </div>
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                  <div className="text-xs text-amber-700">Pending</div>
                  <div className="text-lg font-bold text-amber-900">{employeeProfile?.pendingOrders ?? 0}</div>
                </div>
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/60">
                  <div className="text-xs text-emerald-700">Delivered</div>
                  <div className="text-lg font-bold text-emerald-900">{employeeProfile?.deliveredOrders ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Individual Orders Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-[#FCFAF7]">
                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#8C6D58]" />
                  <span>Order History</span>
                </h3>
                <span className="text-xs text-stone-500">
                  {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"} found
                </span>
              </div>

              {isLoading ? (
                <div className="py-20 text-center">
                  <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C6D58] mb-3" />
                  <p className="text-stone-500 text-sm">Loading order details...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-16 text-center text-stone-500">
                  <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-700">No orders found for this employee.</p>
                  <p className="text-xs text-stone-400 mt-1">Try selecting a different date range or placing an order.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#FAF7F2] text-stone-600 text-xs font-semibold uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="px-6 py-3.5">Order ID</th>
                        <th className="px-6 py-3.5">Date & Time</th>
                        <th className="px-6 py-3.5">Items</th>
                        <th className="px-6 py-3.5 text-right">Subtotal</th>
                        <th className="px-6 py-3.5 text-right">Total</th>
                        <th className="px-6 py-3.5 text-center">Status</th>
                        <th className="px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-800">
                      {paginatedOrders.map((order) => (
                        <tr
                          key={order.id}
                          onClick={() => setInspectedOrder(order)}
                          className="hover:bg-[#FAF7F2]/60 cursor-pointer transition-colors"
                        >
                          {/* Order ID */}
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold text-stone-900 text-xs">
                              {order.displayId || order.id}
                            </span>
                          </td>

                          {/* Date & Time */}
                          <td className="px-6 py-4 text-xs text-stone-600">
                            <div>{order.createdAt ? order.createdAt.substring(0, 10) : "Today"}</div>
                            <div className="text-stone-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {order.time || "Recent"}
                            </div>
                          </td>

                          {/* Items List Preview */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {order.items && order.items.length > 0 ? (
                                order.items.map((item, idx) => (
                                  <div key={idx} className="text-xs text-stone-700 flex items-center gap-1.5">
                                    <span className="font-semibold text-stone-900">{item.name}</span>
                                    <span className="text-stone-400">×{item.qty}</span>
                                    {item.preference && (
                                      <span className="text-[10px] bg-stone-100 text-stone-600 px-1 rounded">
                                        {item.preference}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-stone-400">Standard Order</span>
                              )}
                            </div>
                          </td>

                          {/* Subtotal */}
                          <td className="px-6 py-4 text-right text-xs text-stone-600">
                            {formatPrice(order.subtotal ?? order.total)}
                          </td>

                          {/* Total */}
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-[#8C6D58] text-sm">
                              {formatPrice(order.total)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 text-center">
                            {renderStatusBadge(order.status)}
                          </td>

                          {/* View Detail Action */}
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedOrder(order);
                              }}
                              className="p-1.5 text-stone-400 hover:text-[#8C6D58] transition-colors rounded-lg hover:bg-white"
                              title="Inspect Order Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 bg-[#FCFAF7]">
                      <div>
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2 font-medium text-stone-800">{currentPage}</span>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: SINGLE ORDER ITEM INSPECTION                                      */}
      {/* ========================================================================= */}
      {inspectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 relative animate-scale-up">
            {/* Close Button */}
            <button
              onClick={() => setInspectedOrder(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#8C6D58]/10 text-[#8C6D58]">
                Order Details
              </span>
              <h3 className="text-xl font-bold text-stone-900 mt-1">
                {inspectedOrder.displayId || inspectedOrder.id}
              </h3>
              <p className="text-xs text-stone-500">
                Placed by {inspectedOrder.employeeName} • {inspectedOrder.time}
              </p>
            </div>

            {/* Context Info Cards */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <div className="bg-[#FAF7F2] p-3 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Location</span>
                <span className="font-semibold text-stone-800">{inspectedOrder.locationName}</span>
              </div>
              <div className="bg-[#FAF7F2] p-3 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Seat</span>
                <span className="font-mono font-semibold text-stone-800">
                  {formatSeatIdentifier(inspectedOrder.seatId || inspectedOrder.seat)}
                </span>
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                Ordered Items
              </h4>
              <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
                {inspectedOrder.items && inspectedOrder.items.length > 0 ? (
                  inspectedOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-stone-900">{item.name}</div>
                        {item.preference && (
                          <span className="text-[10px] text-stone-500">Sugar: {item.preference}</span>
                        )}
                        <span className="text-stone-400 ml-1">× {item.qty}</span>
                      </div>
                      <div className="font-bold text-stone-800">
                        {formatPrice(item.price * item.qty)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-stone-400 py-3 text-center">No detailed items recorded.</div>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="pt-4 border-t border-stone-200 space-y-1.5 text-xs text-stone-600 mb-6">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(inspectedOrder.subtotal ?? inspectedOrder.total)}</span>
              </div>
              {inspectedOrder.adjustmentAmount !== undefined && inspectedOrder.adjustmentAmount !== 0 && (
                <div className="flex justify-between text-stone-500">
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
              <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-100">
                <span>Total Amount</span>
                <span className="text-[#8C6D58]">{formatPrice(inspectedOrder.total)}</span>
              </div>
            </div>

            {/* Status Footer */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Status:</span>
                {renderStatusBadge(inspectedOrder.status)}
              </div>
              <button
                onClick={() => setInspectedOrder(null)}
                className="px-4 py-2 bg-[#8C6D58] hover:bg-[#785C49] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Background>
  );
}
