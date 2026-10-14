import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Coffee,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Plus,
  Minus,
  X,
  MapPin,
} from "lucide-react";
import Background from "../../components/background";
import { orderApi } from "../../services/orderApi";


export interface MenuItem {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  category: string;
}

const defaultMenu: MenuItem[] = [
  {
    id: "1",
    name: "Tea",
    description: "Milk Tea brewed with freshly grounded spices",
    image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
    price: 18,
    category: "Beverages",
  },
  {
    id: "2",
    name: "Coffee",
    description: "Freshly brewed artisan coffee with rich crema",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    price: 20,
    category: "Beverages",
  },
  {
    id: "3",
    name: "Black Tea",
    description: "Without milk, pure organic infusion",
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    price: 18,
    category: "Beverages",
  },
  {
    id: "4",
    name: "Lemon Tea",
    description: "Zesty lemon brew with crisp mint leaves",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
    price: 20,
    category: "Beverages",
  },
  {
    id: "5",
    name: "Black Coffee",
    description: "Rich dark roast coffee for maximum focus",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
    price: 18,
    category: "Beverages",
  },
  {
    id: "6",
    name: "Milk",
    description: "Pure warm steamed whole milk",
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    price: 18,
    category: "Beverages",
  },
];

export default function UserOrderPage() {
  const { locationId, seatNumber } = useParams<{
    locationId?: string;
    seatNumber?: string;
  }>();
  const [searchParams] = useSearchParams();

  // Try finding location name and seat employee from localStorage or parameters
  const [locationName, setLocationName] = useState<string>("Office");
  const [seatId, setSeatId] = useState<string>("");
  const [employeeEmail, setEmployeeEmail] = useState<string>("");
  const [employeeName, setEmployeeName] = useState<string>("");

  // Items quantity state: { [itemId]: number }
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const activeSeatNumber = seatNumber || searchParams.get("seat") || "01";
  const activeLocationId = locationId || "3"; // default to 'office' (id: 3)

  useEffect(() => {
    // 1. Identify location name from localStorage
    try {
      const storedLocs = localStorage.getItem("cafe4x_locations");
      if (storedLocs) {
        const parsed = JSON.parse(storedLocs);
        const found = parsed.find(
          (l: any) =>
            String(l.id) === String(activeLocationId) ||
            l.name.toLowerCase() === "office" ||
            l.name.toLowerCase() === activeLocationId?.toLowerCase()
        );
        if (found) {
          setLocationName(found.name);
        }
      }
    } catch {}

    // 2. Identify seat information and assigned employee
    try {
      const storedSeats = localStorage.getItem("cafe4x_seatsByLoc");
      if (storedSeats) {
        const parsed = JSON.parse(storedSeats);
        const locSeats = parsed[activeLocationId] || parsed["3"] || parsed["1"] || [];
        const foundSeat = locSeats.find(
          (s: any) =>
            String(s.number).padStart(2, "0") === String(activeSeatNumber).padStart(2, "0")
        );
        if (foundSeat) {
          setSeatId(foundSeat.id || `Seat-${activeSeatNumber}`);
          if (foundSeat.employee) {
            setEmployeeEmail(foundSeat.employee);
            const prefix = foundSeat.employee.split("@")[0];
            setEmployeeName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
      }
    } catch {}

    // Fallbacks if not stored yet:
    // Check known mapped employees
    const seatMap: Record<string, { email: string; name: string; id: string }> = {
      "01": { email: "rizwi@faaztech", name: "Rizwan", id: "S003-F1-01" },
      "1": { email: "rizwi@faaztech", name: "Rizwan", id: "S003-F1-01" },
      "02": { email: "imthi@faaztech", name: "Imthiyaz", id: "S003-F1-02" },
      "2": { email: "imthi@faaztech", name: "Imthiyaz", id: "S003-F1-02" },
      "03": { email: "saif@faaztech", name: "Saif", id: "S003-F1-03" },
      "3": { email: "saif@faaztech", name: "Saif", id: "S003-F1-03" },
    };

    const padded = String(activeSeatNumber).padStart(2, "0");
    if (seatMap[padded]) {
      setEmployeeEmail((prev) => prev || seatMap[padded].email);
      setEmployeeName((prev) => prev || seatMap[padded].name);
      setSeatId((prev) => prev || seatMap[padded].id);
    } else {
      setSeatId((prev) => prev || `S003-F1-${padded}`);
      setEmployeeName((prev) => prev || `Seat ${padded} Guest`);
    }
  }, [activeLocationId, activeSeatNumber]);

  const updateQuantity = (itemId: string, delta: number) => {
    setCartQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const selectedItems = useMemo(() => {
    return defaultMenu
      .filter((item) => (cartQuantities[item.id] || 0) > 0)
      .map((item) => ({
        ...item,
        qty: cartQuantities[item.id],
        totalPrice: item.price * cartQuantities[item.id],
      }));
  }, [cartQuantities]);

  const totalItemCount = useMemo(() => {
    return Object.values(cartQuantities).reduce((acc, count) => acc + count, 0);
  }, [cartQuantities]);

  const grandTotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [selectedItems]);

  const handleSendOrder = () => {
    if (selectedItems.length === 0) {
      alert("Please select at least 1 item to place an order.");
      return;
    }

    const orderIdNum = Math.floor(1000 + Math.random() * 9000);
    const newOrder = {
      id: `#ORD-${orderIdNum}`,
      seat: String(activeSeatNumber).padStart(2, "0"),
      locationName: locationName || "Office",
      employeeName: employeeName || employeeEmail || `Seat ${activeSeatNumber}`,
      items: selectedItems.map((it) => ({
        name: it.name,
        qty: it.qty,
        price: it.price,
      })),
      total: grandTotal,
      time: "Just now",
      status: "Pending",
      notes: specialInstructions.trim() || undefined,
    };

    // 1. Sync to localStorage "cafe4x_provider_orders" so Provider Page receives it immediately
    try {
      const existingStr = localStorage.getItem("cafe4x_provider_orders");
      const existingOrders = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem("cafe4x_provider_orders", JSON.stringify([newOrder, ...existingOrders]));
    } catch {}

    // 2. Also sync to backend API
    orderApi.createOrder({
      id: newOrder.id,
      seat: newOrder.seat,
      locationName: newOrder.locationName,
      locationId: activeLocationId,
      employeeName: newOrder.employeeName,
      items: newOrder.items,
      total: newOrder.total,
      notes: newOrder.notes,
    }).catch((err) => {
      console.warn("Could not sync order to backend:", err);
    });

    // 3. Also sync to admin orders in localStorage
    try {
      const existingStr = localStorage.getItem("cafe4x_admin_orders");
      const existingOrders = existingStr ? JSON.parse(existingStr) : [];
      const adminOrderRecord = {
        id: newOrder.id,
        employeeName: newOrder.employeeName,
        department: "Office Team",
        avatarInitials: newOrder.employeeName.slice(0, 2).toUpperCase(),
        items: newOrder.items.map((i: any) => ({
          name: i.name,
          price: i.price,
          qty: i.qty,
          image: defaultMenu.find((m) => m.name === i.name)?.image || defaultMenu[0].image,
        })),
        itemSummary: newOrder.items.map((i: any) => `${i.name} x${i.qty}`).join(", "),
        seat: `Seat ${newOrder.seat}`,
        total: newOrder.total,
        orderTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "Pending",
      };
      localStorage.setItem("cafe4x_admin_orders", JSON.stringify([adminOrderRecord, ...existingOrders]));
    } catch {}


    setLastOrderDetails(newOrder);
    setOrderSentSuccess(true);
    setIsModalOpen(false);
  };

  return (
    <Background>
      {/* User / Employee Dedicated Header */}
      <header className="sticky top-0 z-40 border-b border-[#EEE5DC] bg-white/90 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#75472D] to-[#9A6747] text-white shadow-md">
              <Coffee size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-[#342219]">Cafe4X</h1>
                <span className="rounded-full bg-[#EFE8E1] px-2 py-0.5 text-[10px] font-bold text-[#70452D]">
                  EmpOrder
                </span>
              </div>
              <p className="text-xs text-[#8A7667]">
                Quick Office Refreshments &bull; Fast Delivery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick seat badge */}
            <div className="flex items-center gap-2 rounded-xl border border-[#DEC5B0] bg-[#FAF8F5] px-3 py-1.5 shadow-2xs">
              <MapPin size={14} className="text-[#8C5835]" />
              <div className="text-right">
                <div className="text-[10px] font-semibold text-[#8A7667]">
                  {locationName} &bull; Seat {String(activeSeatNumber).padStart(2, "0")}
                </div>
                <div className="text-xs font-bold text-[#342219]">
                  {employeeEmail ? employeeEmail : seatId}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:opacity-95"
            >
              <ShoppingBag size={14} />
              <span>New Order</span>
              {totalItemCount > 0 && (
                <span className="ml-1 rounded-full bg-white px-1.5 py-0.2 text-[10px] font-black text-[#754329]">
                  {totalItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Banner with Greeting */}
        <div className="mb-8 rounded-3xl border border-[#EEE5DC] bg-white/90 p-6 shadow-md shadow-[#70452D]/5 backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E9D7C6] bg-[#FAF6F1] px-3 py-1 text-xs font-semibold text-[#80563C]">
                <Sparkles size={14} />
                Welcome {employeeName ? employeeName : "Employee"}
              </div>
              <h2 className="text-2xl font-black text-[#342219] sm:text-3xl">
                Ready for a fresh cup?
              </h2>
              <p className="text-sm text-[#8A7667]">
                Your orders are routed straight to the office provider kitchen and delivered directly to your chair.
              </p>
            </div>

            {/* Seat info card */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#DEC5B0] bg-gradient-to-br from-[#FFFDFB] to-[#F9F5F0] p-4 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#75472D] text-lg font-black text-white shadow-md">
                {String(activeSeatNumber).padStart(2, "0")}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#8A7667]">Assigned Workspace</div>
                <div className="text-sm font-bold text-[#342219]">Seat {activeSeatNumber} ({locationName})</div>
                <div className="text-xs font-medium text-[#70452D] truncate max-w-[180px]">
                  {employeeEmail}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Success Banner (If placed) */}
        {orderSentSuccess && lastOrderDetails && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/90 p-6 shadow-md backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-emerald-950">
                    Order {lastOrderDetails.id} Placed Successfully!
                  </h3>
                  <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                    Sent to Kitchen Provider
                  </span>
                </div>
                <p className="mt-1 text-xs text-emerald-800">
                  Your refreshments are being prepared. The café provider will deliver them to Seat{" "}
                  {lastOrderDetails.seat} ({lastOrderDetails.locationName}) shortly.
                </p>

                <div className="mt-3 flex flex-wrap gap-4 border-t border-emerald-200/60 pt-3 text-xs font-semibold text-emerald-900">
                  <div>
                    Items:{" "}
                    <span className="font-bold">
                      {lastOrderDetails.items.map((i: any) => `${i.name} x${i.qty}`).join(", ")}
                    </span>
                  </div>
                  <div>
                    Total: <span className="font-bold">₹{lastOrderDetails.total}</span>
                  </div>
                  <div>
                    Time: <span className="font-bold">{lastOrderDetails.time}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCartQuantities({});
                      setOrderSentSuccess(false);
                      setIsModalOpen(true);
                    }}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
                  >
                    Place Another Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Menu Cards Display on page as well */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#342219]">Café Menu</h3>
            <p className="text-xs text-[#8A7667]">Click on items or open the Order popup to customize</p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#D5C2B1] bg-white px-3.5 py-1.5 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1]"
          >
            <span>Open Order Window</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {defaultMenu.map((item) => {
            const count = cartQuantities[item.id] || 0;
            return (
              <div
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#EEE5DC] bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="relative h-44 w-full overflow-hidden bg-[#FAF6F1]">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-2.5 right-2.5 rounded-lg bg-black/60 px-2 py-0.5 text-xs font-black text-white backdrop-blur-xs">
                    ₹{item.price}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h4 className="text-base font-bold text-[#342219]">{item.name}</h4>
                  <p className="mt-1 flex-1 text-xs text-[#8A7667] line-clamp-2">{item.description}</p>

                  <div className="mt-4 flex items-center justify-between border-t border-[#F0E6DB] pt-3">
                    <span className="text-sm font-black text-[#754329]">₹{item.price}</span>
                    <div className="flex items-center gap-2 rounded-xl border border-[#DEC5B0] bg-[#FAF8F5] p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#70452D] shadow-2xs hover:bg-[#FAF6F1]"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-[#342219]">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#70452D] text-white shadow-2xs hover:bg-[#593A28]"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* =========================================================================
          POPUP MODAL: ITEMS ORDER SCREEN (MATCHING USER'S EXACT SCREENSHOT)
         ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header matching Screenshot */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Items</h2>
                <span className="text-xs font-semibold text-amber-800">
                  seatId: {employeeName || employeeEmail || `Seat-${activeSeatNumber}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-400 font-bold text-white transition hover:bg-rose-500 shadow-2xs"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Grid of 6 Items Cards matching Screenshot */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {defaultMenu.map((item) => {
                  const qty = cartQuantities[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-3 shadow-2xs transition hover:border-gray-300"
                    >
                      {/* Image Thumbnail */}
                      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {/* Content & Counter */}
                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900">{item.name}</h4>
                            <p className="text-[11px] text-gray-500 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                          <span className="font-sans text-xs font-bold text-gray-800">
                            ₹ {item.price}
                          </span>
                        </div>

                        {/* Quantity Counter Pill */}
                        <div className="mt-2.5 flex items-center justify-start">
                          <div className="flex items-center rounded-lg border border-gray-300 bg-gray-50/80 px-2 py-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-1.5 py-0.5 text-xs font-bold text-gray-600 hover:text-black"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-gray-900">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="px-1.5 py-0.5 text-xs font-bold text-gray-600 hover:text-black"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Special instructions / notes */}
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Special Request (Optional):
                </label>
                <input
                  type="text"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g., Less sugar, extra hot, etc."
                  className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-800 outline-none focus:border-amber-700"
                />
              </div>

              {/* Live Order Summary */}
              {selectedItems.length > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 border border-amber-200 text-xs">
                  <div className="text-amber-900">
                    <span className="font-bold">{totalItemCount} item(s)</span> selected
                  </div>
                  <div className="font-bold text-amber-900 text-sm">
                    Grand Total: ₹{grandTotal}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer matching Screenshot */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg bg-gray-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-gray-700 shadow-2xs"
              >
                Close
              </button>

              <button
                type="button"
                disabled={totalItemCount === 0}
                onClick={handleSendOrder}
                className={`rounded-lg px-6 py-2 text-xs font-bold text-white shadow-md transition ${
                  totalItemCount > 0
                    ? "bg-[#A68A77] hover:bg-[#8F7462] cursor-pointer"
                    : "bg-[#C4B7AC] cursor-not-allowed opacity-75"
                }`}
              >
                Send Order
              </button>
            </div>
          </div>
        </div>
      )}
    </Background>
  );
}
