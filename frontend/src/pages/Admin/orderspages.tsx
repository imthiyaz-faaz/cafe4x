import React, { useState, useMemo } from "react";
import {
  Search,
  Calendar,
  Filter,
  Plus,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";

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
  itemSummary: string; // e.g. "Chicken Burger, Fries +1"
  seat: string; // e.g. "A12"
  total: number;
  orderTime: string; // e.g. "Oct 13, 2026 11:45 AM"
  status: "Pending" | "Preparing" | "Ready" | "Completed";
}

const initialOrders: OrderRecord[] = [
  {
    id: "#ORD-1001",
    employeeName: "Rizwan Khan",
    department: "Development",
    avatarInitials: "RK",
    avatarBg: "bg-[#B8977E]",
    items: [
      {
        name: "Chicken Burger",
        price: 80,
        qty: 1,
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80",
      },
      {
        name: "French Fries",
        price: 50,
        qty: 1,
        image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=150&q=80",
      },
      {
        name: "Coke",
        price: 50,
        qty: 1,
        image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Chicken Burger, Fries +1",
    seat: "A12",
    total: 180,
    orderTime: "Oct 13, 2026 11:45 AM",
    status: "Pending",
  },
  {
    id: "#ORD-1002",
    employeeName: "Sarah Malik",
    department: "Design",
    avatarInitials: "SM",
    avatarBg: "bg-[#A68A77]",
    items: [
      {
        name: "Paneer Pizza",
        price: 80,
        qty: 1,
        image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Paneer Pizza",
    seat: "B05",
    total: 80,
    orderTime: "Oct 13, 2026 11:42 AM",
    status: "Preparing",
  },
  {
    id: "#ORD-1003",
    employeeName: "Arun Thomas",
    department: "Marketing",
    avatarInitials: "AT",
    avatarBg: "bg-[#9A7B68]",
    items: [
      {
        name: "Tea",
        price: 15,
        qty: 1,
        image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=150&q=80",
      },
      {
        name: "Vada",
        price: 20,
        qty: 1,
        image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Tea, Vada",
    seat: "C08",
    total: 35,
    orderTime: "Oct 13, 2026 11:30 AM",
    status: "Ready",
  },
  {
    id: "#ORD-1004",
    employeeName: "Nisha Patel",
    department: "HR",
    avatarInitials: "NP",
    avatarBg: "bg-[#B0927C]",
    items: [
      {
        name: "Coffee",
        price: 20,
        qty: 1,
        image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Coffee",
    seat: "A03",
    total: 20,
    orderTime: "Oct 13, 2026 11:15 AM",
    status: "Completed",
  },
  {
    id: "#ORD-1005",
    employeeName: "Vikram Kumar",
    department: "Sales",
    avatarInitials: "VK",
    avatarBg: "bg-[#C4A48A]",
    items: [
      {
        name: "Veg Burger",
        price: 40,
        qty: 1,
        image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=150&q=80",
      },
      {
        name: "French Fries",
        price: 50,
        qty: 1,
        image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=150&q=80",
      },
      {
        name: "Coke",
        price: 60,
        qty: 1,
        image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Veg Burger, Fries +1",
    seat: "D10",
    total: 150,
    orderTime: "Oct 13, 2026 11:05 AM",
    status: "Completed",
  },
  {
    id: "#ORD-1006",
    employeeName: "Lakshmi Priya",
    department: "Finance",
    avatarInitials: "LP",
    avatarBg: "bg-[#A3826D]",
    items: [
      {
        name: "Lemon Tea",
        price: 20,
        qty: 1,
        image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Lemon Tea",
    seat: "B08",
    total: 20,
    orderTime: "Oct 13, 2026 10:50 AM",
    status: "Completed",
  },
  {
    id: "#ORD-1007",
    employeeName: "Dinesh Singh",
    department: "Operations",
    avatarInitials: "DS",
    avatarBg: "bg-[#BFA088]",
    items: [
      {
        name: "Egg Bonda",
        price: 25,
        qty: 1,
        image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=150&q=80",
      },
      {
        name: "Tea",
        price: 20,
        qty: 1,
        image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Egg Bonda, Tea",
    seat: "C11",
    total: 45,
    orderTime: "Oct 13, 2026 10:40 AM",
    status: "Completed",
  },
  {
    id: "#ORD-1008",
    employeeName: "Karthik Anand",
    department: "IT",
    avatarInitials: "KA",
    avatarBg: "bg-[#967663]",
    items: [
      {
        name: "Chicken Sandwich",
        price: 60,
        qty: 1,
        image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=150&q=80",
      },
    ],
    itemSummary: "Chicken Sandwich",
    seat: "A01",
    total: 60,
    orderTime: "Oct 13, 2026 10:25 AM",
    status: "Completed",
  },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>("#ORD-1001");
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState("Select date");

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // New Order Modal State
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    employeeName: "",
    department: "Development",
    seat: "A15",
    itemName: "Coffee",
    price: "20",
    qty: "1",
  });

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchSearch =
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.itemSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.seat.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === "All" || order.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // Pagination calculation
  const totalRecords = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, validCurrentPage, pageSize]);

  // Selected Order for Right Drawer
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0] || null;
  }, [orders, selectedOrderId]);

  // Toggle Single Row Checkbox
  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Toggle All Rows Checkbox
  const allCurrentSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((o) => selectedRows[o.id]);

  const handleToggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedRows({});
    } else {
      const updated: Record<string, boolean> = {};
      paginatedOrders.forEach((o) => {
        updated[o.id] = true;
      });
      setSelectedRows(updated);
    }
  };

  // Submit New Order
  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.employeeName.trim()) return;

    const nextIdNum = 1000 + orders.length + 1;
    const newOrder: OrderRecord = {
      id: `#ORD-${nextIdNum}`,
      employeeName: newOrderForm.employeeName.trim(),
      department: newOrderForm.department,
      avatarInitials: newOrderForm.employeeName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      avatarBg: "bg-[#B8977E]",
      items: [
        {
          name: newOrderForm.itemName,
          price: parseFloat(newOrderForm.price) || 20,
          qty: parseInt(newOrderForm.qty, 10) || 1,
          image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=150&q=80",
        },
      ],
      itemSummary: newOrderForm.itemName,
      seat: newOrderForm.seat.toUpperCase(),
      total: (parseFloat(newOrderForm.price) || 20) * (parseInt(newOrderForm.qty, 10) || 1),
      orderTime: "Just now",
      status: "Pending",
    };

    setOrders([newOrder, ...orders]);
    setSelectedOrderId(newOrder.id);
    setIsNewOrderOpen(false);
    setNewOrderForm({
      employeeName: "",
      department: "Development",
      seat: "A15",
      itemName: "Coffee",
      price: "20",
      qty: "1",
    });
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* ========================================================
                TOP BANNER: ORDERS HEADER & 4 STATUS TILES
               ======================================================== */}
            <div className="relative mb-6 overflow-hidden rounded-3xl border border-[#EEE5DC] bg-gradient-to-r from-[#F9F5F0] via-[#FAF6F2] to-[#F5ECE1] p-6 shadow-xl shadow-[#70452D]/5 sm:p-7">
              {/* Top Banner Row: Title on Left, Cup of Coffee on Right */}
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFE6DC] text-[#704225] shadow-xs">
                      <Package size={28} />
                    </div>
                    <div>
                      <h1 className="text-3xl font-extrabold tracking-tight text-[#342219]">
                        Orders
                      </h1>
                      <p className="text-xs text-[#8A7667]">
                        Manage and track all cafe orders in real-time
                      </p>
                    </div>
                  </div>
                </div>

                {/* Coffee Cup Decorative Image matching screenshot top right */}
                <div className="hidden lg:block">
                  <div className="relative h-20 w-44 overflow-hidden rounded-2xl">
                    <img
                      src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80"
                      alt="Coffee Latte Art"
                      className="h-full w-full object-cover rounded-2xl shadow-md"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================
                MAIN CONTENT: ORDERS TABLE (LEFT) + ORDER DETAILS (RIGHT)
               ======================================================== */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

              {/* LEFT / CENTER: ORDERS TABLE (8 or 12 cols depending on Drawer) */}
              <div
                className={`flex flex-col transition-all duration-300 ${selectedOrder ? "lg:col-span-8" : "lg:col-span-12"
                  }`}
              >
                {/* Search & Action Filter Bar */}
                <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#EEE5DC] bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Search Bar */}
                  <div className="relative flex-1">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Search by order ID, employee name or item..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 outline-none transition placeholder-gray-400 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
                    />
                  </div>

                  {/* Right Filters & New Order Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date Picker Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setDateFilter(dateFilter === "Select date" ? "Today" : "Select date")
                        }
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50"
                      >
                        <Calendar size={14} className="text-gray-500" />
                        <span>{dateFilter}</span>
                      </button>
                    </div>

                    {/* Filter Button */}
                    <button
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === "All" ? "Pending" : "All")}
                      className="flex items-center gap-1.5 rounded-xl bg-[#6F4228] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5A331E]"
                    >
                      <Filter size={14} />
                      <span>Filter</span>
                    </button>

                    {/* New Order Button */}
                    <button
                      type="button"
                      onClick={() => setIsNewOrderOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#754329] px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-[#754329]/20 transition hover:bg-[#60351E] hover:-translate-y-0.5"
                    >
                      <Plus size={14} />
                      <span>New Order</span>
                    </button>
                  </div>
                </div>

                {/* Table Container */}
                <div className="overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      {/* Table Header matching screenshot */}
                      <thead className="border-b border-[#EEE5DC] bg-[#FAF8F5] text-[#704225]">
                        <tr>
                          <th className="w-10 px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={allCurrentSelected}
                              onChange={handleToggleSelectAll}
                              className="h-4 w-4 rounded border-gray-300 text-[#754329] focus:ring-[#754329]"
                            />
                          </th>
                          <th className="px-4 py-3.5 font-bold">Order ID</th>
                          <th className="px-4 py-3.5 font-bold">Employee</th>
                          <th className="px-4 py-3.5 font-bold">Items</th>
                          <th className="px-4 py-3.5 font-bold">Seat</th>
                          <th className="px-4 py-3.5 font-bold">Total</th>
                          <th className="px-4 py-3.5 font-bold">Order Time</th>
                        </tr>
                      </thead>

                      {/* Table Body */}
                      <tbody className="divide-y divide-[#F5EFE8] text-gray-700">
                        {paginatedOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-xs text-gray-500">
                              No orders found matching your search.
                            </td>
                          </tr>
                        ) : (
                          paginatedOrders.map((order) => {
                            const isSelected = selectedOrderId === order.id;
                            const isChecked = !!selectedRows[order.id];

                            return (
                              <tr
                                key={order.id}
                                onClick={() => setSelectedOrderId(order.id)}
                                className={`cursor-pointer transition duration-150 hover:bg-[#FAF6F2] ${isSelected ? "bg-[#FAF4ED]" : ""
                                  }`}
                              >
                                {/* Checkbox */}
                                <td
                                  className="px-4 py-3 text-center"
                                  onClick={(e) => handleToggleRow(order.id, e)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => { }}
                                    className="h-4 w-4 rounded border-gray-300 text-[#754329] focus:ring-[#754329]"
                                  />
                                </td>

                                {/* Order ID */}
                                <td className="px-4 py-3 font-bold text-gray-900">
                                  {order.id}
                                </td>

                                {/* Employee (Initials Avatar + Name + Dept) */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-[11px] text-white ${order.avatarBg || "bg-[#A68A77]"
                                        }`}
                                    >
                                      {order.avatarInitials}
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-900 leading-tight">
                                        {order.employeeName}
                                      </p>
                                      <p className="text-[11px] text-gray-500">
                                        {order.department}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Items (Thumbnail images + Count + Text) */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {/* Thumbnail strip */}
                                    <div className="flex items-center -space-x-1 overflow-hidden">
                                      {order.items.slice(0, 3).map((item, idx) => (
                                        <img
                                          key={idx}
                                          src={item.image}
                                          alt={item.name}
                                          className="inline-block h-7 w-7 rounded-md border border-white object-cover shadow-2xs"
                                        />
                                      ))}
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-900 leading-tight">
                                        {order.items.length}{" "}
                                        {order.items.length === 1 ? "item" : "items"}
                                      </p>
                                      <p className="line-clamp-1 text-[11px] text-gray-500">
                                        {order.itemSummary}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Seat */}
                                <td className="px-4 py-3 font-semibold text-gray-800">
                                  {order.seat}
                                </td>

                                {/* Total */}
                                <td className="px-4 py-3 font-bold text-gray-900">
                                  ₹{order.total}
                                </td>

                                {/* Order Time */}
                                <td className="px-4 py-3 text-[11px] text-gray-600 whitespace-nowrap">
                                  {order.orderTime}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Pagination matching screenshot */}
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

                      {/* Pagination Controls */}
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
                      Total Orders: <span className="font-bold text-gray-900">48</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  RIGHT: ORDER DETAILS DRAWER (MATCHING SCREENSHOT RIGHT PANEL)
                 ======================================================== */}
              {selectedOrder && (
                <div className="flex flex-col lg:col-span-4 animate-in fade-in slide-in-from-right duration-300">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h3 className="text-base font-bold text-gray-900">Order Details</h3>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(null)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Close details"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Order ID */}
                    <div className="mt-4">
                      <h2 className="text-xl font-extrabold text-gray-900">
                        {selectedOrder.id}
                      </h2>
                    </div>

                    {/* Employee & Timestamp Card */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full font-bold text-sm text-white ${selectedOrder.avatarBg || "bg-[#B8977E]"
                            }`}
                        >
                          {selectedOrder.avatarInitials}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">
                            {selectedOrder.employeeName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {selectedOrder.department}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-gray-500">
                        <p>{selectedOrder.orderTime.split(" ")[0]} {selectedOrder.orderTime.split(" ")[1]}, {selectedOrder.orderTime.split(" ")[2]}</p>
                        <p>{selectedOrder.orderTime.split(" ").slice(3).join(" ")}</p>
                      </div>
                    </div>

                    {/* Seat Number Box */}
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-100 bg-[#FAF8F5] p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFE6DC] text-[#704225]">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Seat Number
                        </span>
                        <p className="font-bold text-gray-900 text-sm">
                          {selectedOrder.seat}
                        </p>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <h4 className="text-xs font-bold text-gray-900">
                        Items ({selectedOrder.items.length})
                      </h4>

                      <div className="mt-3 space-y-3">
                        {selectedOrder.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-10 w-10 rounded-xl object-cover border border-gray-100"
                              />
                              <div>
                                <p className="font-bold text-gray-900 text-xs">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  ₹{item.price} × {item.qty}
                                </p>
                              </div>
                            </div>
                            <span className="font-extrabold text-xs text-gray-900">
                              ₹{item.price * item.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                      <span className="text-sm font-bold text-gray-800">Total Amount</span>
                      <span className="text-xl font-black text-gray-900">
                        ₹{selectedOrder.total}
                      </span>
                    </div>
                  </div>
                </div>
              )}
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

        {/* ========================================================
            MODAL: NEW ORDER
           ======================================================== */}
        {isNewOrderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">Create New Order</h3>
                <button
                  type="button"
                  onClick={() => setIsNewOrderOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateOrderSubmit} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-gray-800">
                    Employee Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newOrderForm.employeeName}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, employeeName: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 p-2 text-xs outline-none focus:border-[#754329]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold text-gray-800">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. IT"
                      value={newOrderForm.department}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, department: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 text-xs outline-none focus:border-[#754329]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-gray-800">
                      Seat *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. A12"
                      value={newOrderForm.seat}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, seat: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 text-xs outline-none focus:border-[#754329]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-gray-800">
                    Item Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Chicken Burger"
                    value={newOrderForm.itemName}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, itemName: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 p-2 text-xs outline-none focus:border-[#754329]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold text-gray-800">
                      Price (₹)
                    </label>
                    <input
                      required
                      type="number"
                      placeholder="80"
                      value={newOrderForm.price}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, price: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 text-xs outline-none focus:border-[#754329]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-gray-800">
                      Quantity
                    </label>
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="1"
                      value={newOrderForm.qty}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, qty: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 text-xs outline-none focus:border-[#754329]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsNewOrderOpen(false)}
                    className="rounded-md border border-gray-200 px-4 py-1.5 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-[#754329] px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-[#60351E]"
                  >
                    Create Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Background>
  );
}
