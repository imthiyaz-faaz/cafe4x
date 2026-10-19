import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Coffee,
  CheckCircle2,
  ShoppingBag,
  Plus,
  Minus,
  ImageIcon,
  AlertTriangle,
  Lock,
  UserCheck,
  X,
  ChevronUp,
  Clock,
  QrCode,
} from "lucide-react";
import Background from "../../components/background";
import { orderApi } from "../../services/orders";
import { itemsApi } from "../../services/items";
import { locationApi } from "../../services/locations";
import { userApi } from "../../services/userApi";
import { qrApi } from "../../services/qrApi";


export interface UserOrderItem {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  category: string;
  preferenceKey?: string;
  preferenceOptions?: string[];
  selectedPreference?: string;
}

export default function UserOrderPage() {
  const { locationId, seatNumber, shortCode, qrToken } = useParams<{
    locationId?: string;
    seatNumber?: string;
    shortCode?: string;
    qrToken?: string;
  }>();
  const [searchParams] = useSearchParams();

  // Token validation state
  // "checking" = validating, "valid" = session active, "invalid" = bad/revoked, "expired" = expired, "none" = no token
  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid" | "expired" | "none">(
    qrToken ? "checking" : "none"
  );
  const [tokenErrorMessage, setTokenErrorMessage] = useState<string>("");
  const [authenticatedEmployee, setAuthenticatedEmployee] = useState<any>(null);
  // Active session expiry time (ISO string) — used for countdown display
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  // Permanent QR entry URL so employee can re-scan after expiry
  const [permanentQrHref, setPermanentQrHref] = useState<string>("");

  // Try finding location name and seat employee from backend, localStorage or parameters
  const [locationName, setLocationName] = useState<string>("Office");
  const [seatId, setSeatId] = useState<string>("");
  const [employeeEmail, setEmployeeEmail] = useState<string>("employee@office.com");
  const [employeeName, setEmployeeName] = useState<string>("");

  // Live menu loaded from backend database
  const [menuItems, setMenuItems] = useState<UserOrderItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  // Items quantity state: { [itemId]: number }
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  // Selected preferences for items: { [itemId]: string } e.g. { "1": "Medium" }
  const [itemPreferences, setItemPreferences] = useState<Record<string, string>>({});

  // Placed order tracking
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  // Validation errors for missing beverage preferences: { [itemId]: string } or string message
  const [preferenceErrors, setPreferenceErrors] = useState<Record<string, string>>({});
  const [orderValidationError, setOrderValidationError] = useState<string | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const activeSeatNumber = seatNumber || searchParams.get("seat") || "";
  const activeLocationId = locationId || searchParams.get("locationId") || "";

  // Helper to parse key-value preference string e.g. "Sugar : No,Low,Medium,High"
  const parsePref = (prefStr?: string) => {
    if (!prefStr || !prefStr.trim()) {
      return { key: "Sugar", options: ["No", "Low", "Medium", "High"] };
    }
    if (prefStr.includes(":")) {
      const parts = prefStr.split(":");
      const key = parts[0].trim() || "Sugar";
      const opts = parts[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return { key, options: opts.length > 0 ? opts : ["No", "Low", "Medium", "High"] };
    }
    return {
      key: "Preference",
      options: prefStr.split(",").map((s) => s.trim()).filter(Boolean),
    };
  };

  // 1. Resolve organization shortCode
  const [effectiveShortCode, setEffectiveShortCode] = useState<string>(shortCode || "");

  // Validate QR Token if present
  // New flow: use /api/qr/validate/:tempToken (two-tier sessions)
  // Legacy fallback: use /api/users/qr-token/:token (permanent tokens)
  useEffect(() => {
    if (!qrToken) {
      setTokenStatus("none");
      return;
    }

    setTokenStatus("checking");

    // Try new two-tier session validation first
    qrApi
      .validateSession(qrToken)
      .then((res) => {
        if (res && res.success && res.employee) {
          // ── New two-tier session valid ──────────────────────────────────
          setTokenStatus("valid");
          setAuthenticatedEmployee(res.employee);
          setEmployeeName(res.employee.name);
          setEmployeeEmail(res.employee.email);
          if (res.expiresAt) {
            setSessionExpiresAt(res.expiresAt);
          }
          if (res.organization?.shortCode) {
            setEffectiveShortCode(res.organization.shortCode.toUpperCase());
            // Build the permanent QR entry URL so we can show it on expiry
            setPermanentQrHref(""); // permanent token not exposed to frontend
          }
        } else if (res && res.expired) {
          // ── Session expired ───────────────────────────────────────────
          setTokenStatus("expired");
          setTokenErrorMessage(
            res.message || "Your ordering session has expired. Please scan your QR code again."
          );
        } else if (res && (res.revoked || !res.success)) {
          // ── Session revoked or invalid ────────────────────────────────
          setTokenStatus("invalid");
          setTokenErrorMessage(res.message || "This session is no longer valid.");
        }
      })
      .catch(() => {
        // If /api/qr/validate returns 404 (token not found in sessions table),
        // fall back to legacy permanent token validation for backward compat
        userApi
          .validateQrToken(qrToken)
          .then((res) => {
            if (res && res.success && res.employee) {
              setTokenStatus("valid");
              setAuthenticatedEmployee(res.employee);
              setEmployeeName(res.employee.name);
              setEmployeeEmail(res.employee.email);
              if (res.organization?.shortCode) {
                setEffectiveShortCode(res.organization.shortCode.toUpperCase());
              }

              // Legacy: check localStorage for seat assignment
              try {
                const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("cafe4x_seatsByLoc"));
                for (const k of allKeys) {
                  const storedSeats = localStorage.getItem(k);
                  if (storedSeats) {
                    const parsed = JSON.parse(storedSeats);
                    for (const locKey of Object.keys(parsed)) {
                      const locSeats = parsed[locKey] || [];
                      const assignedSeat = locSeats.find(
                        (s: any) =>
                          s.employee &&
                          (s.employee.toLowerCase() === res.employee.email.toLowerCase() ||
                           s.employee.toLowerCase() === res.employee.name.toLowerCase())
                      );
                      if (assignedSeat) {
                        setSeatId(assignedSeat.id || `Seat-${assignedSeat.number}`);
                        break;
                      }
                    }
                  }
                }
              } catch {}
            } else {
              setTokenStatus("invalid");
              setTokenErrorMessage(res.message || "Invalid or revoked QR code.");
            }
          })
          .catch((err) => {
            setTokenStatus("invalid");
            setTokenErrorMessage(
              err.response?.data?.message || err.message || "Invalid, revoked or expired QR ordering token."
            );
          });
      });
  }, [qrToken]);


  useEffect(() => {
    if (shortCode) {
      setEffectiveShortCode(shortCode.toUpperCase());
      return;
    }
    locationApi
      .getLocations()
      .then((locs) => {
        if (Array.isArray(locs)) {
          const found = locs.find((l) => String(l.id) === String(activeLocationId));
          if (found) {
            setLocationName(found.name);
            if (found.shortCode) {
              setEffectiveShortCode(found.shortCode.toUpperCase());
            }
          }
        }
      })
      .catch(() => { });

    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.shortCode) {
          setEffectiveShortCode((prev) => prev || u.shortCode.toUpperCase());
        }
      }
    } catch { }
  }, [shortCode, activeLocationId]);

  // 2. Fetch live items strictly from organization's items in database
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMenu(true);
    itemsApi
      .getItems(effectiveShortCode || undefined)
      .then((dbItems) => {
        if (!isMounted) return;
        if (Array.isArray(dbItems)) {
          const filtered = effectiveShortCode
            ? dbItems.filter(
              (it) =>
                !it.shortCode ||
                it.shortCode.toUpperCase() === effectiveShortCode.toUpperCase()
            )
            : dbItems;

          const mapped: UserOrderItem[] = filtered
            .filter((it) => it.status !== "Out of Stock")
            .map((it) => {
              const isBeverage = (it.type || it.category) === "Beverages";
              const parsed = isBeverage ? parsePref(it.preference || it.preferences) : { key: "", options: [] };
              return {
                id: it.id,
                name: it.name,
                description: it.description || "",
                image: it.image || "",
                price: Number(it.amount) || 0,
                category: it.type || it.category || "Beverages",
                preferenceKey: isBeverage ? parsed.key : undefined,
                preferenceOptions: isBeverage ? parsed.options : undefined,
              };
            });

          setMenuItems(mapped);
        }
        setIsLoadingMenu(false);
      })
      .catch((err) => {
        console.warn("Could not load items from backend:", err);
        try {
          const cacheKey = effectiveShortCode ? `cafe4x_items_${effectiveShortCode}` : "cafe4x_items";
          const cached = localStorage.getItem(cacheKey);
          if (cached && isMounted) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const mapped: UserOrderItem[] = parsed
                .filter((it: any) => it.status !== "Out of Stock")
                .map((it: any) => {
                  const isBeverage = (it.type || it.category) === "Beverages";
                  const p = isBeverage ? parsePref(it.preference || it.preferences) : { key: "", options: [] };
                  return {
                    id: it.id,
                    name: it.name,
                    description: it.description || "",
                    image: it.image || "",
                    price: Number(it.amount) || 0,
                    category: it.type || it.category || "Beverages",
                    preferenceKey: isBeverage ? p.key : undefined,
                    preferenceOptions: isBeverage ? p.options : undefined,
                  };
                });
              setMenuItems(mapped);
            }
          }
        } catch { }
        if (isMounted) setIsLoadingMenu(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveShortCode]);

  // 3. Fetch location and seat details
  useEffect(() => {
    const seatIdParam = searchParams.get("seatId");
    if (seatIdParam) {
      setSeatId(seatIdParam);
    }

    locationApi
      .getLocations(undefined, effectiveShortCode || undefined)
      .then((locs) => {
        if (Array.isArray(locs)) {
          const found = locs.find(
            (l) =>
              String(l.id) === String(activeLocationId) ||
              l.name.toLowerCase() === activeLocationId?.toLowerCase()
          );
          if (found) {
            setLocationName(found.name);
          }
        }
      })
      .catch(() => { });

    try {
      const storedLocs = localStorage.getItem("cafe4x_locations");
      if (storedLocs) {
        const parsed = JSON.parse(storedLocs);
        const found = parsed.find(
          (l: any) =>
            String(l.id) === String(activeLocationId) ||
            l.name.toLowerCase() === activeLocationId?.toLowerCase()
        );
        if (found) {
          setLocationName(found.name);
        }
      }
    } catch { }

    try {
      const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("cafe4x_seatsByLoc"));
      for (const k of allKeys) {
        const storedSeats = localStorage.getItem(k);
        if (storedSeats) {
          const parsed = JSON.parse(storedSeats);
          const locSeats = parsed[activeLocationId] || [];
          const foundSeat = locSeats.find(
            (s: any) =>
              String(s.number).padStart(2, "0") === String(activeSeatNumber).padStart(2, "0")
          );
          if (foundSeat) {
            setSeatId((prev) => prev || foundSeat.id || `Seat-${activeSeatNumber}`);
            if (foundSeat.employee) {
              setEmployeeEmail(foundSeat.employee);
              const prefix = foundSeat.employee.split("@")[0];
              setEmployeeName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
            }
            break;
          }
        }
      }
    } catch { }

    const padded = String(activeSeatNumber).padStart(2, "0");
    setSeatId((prev) => prev || `S00${activeLocationId}-F1-${padded}`);
    setEmployeeName((prev) => prev || `Seat ${padded} Employee`);
  }, [activeLocationId, activeSeatNumber, effectiveShortCode, searchParams]);

  // Periodic polling for status update of placed order
  useEffect(() => {
    if (!placedOrder?.id) return;
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem("cafe4x_provider_orders");
        if (raw) {
          const orders = JSON.parse(raw);
          const matched = orders.find((o: any) => o.id === placedOrder.id);
          if (matched && matched.status !== placedOrder.status) {
            setPlacedOrder((prev: any) => ({ ...prev, status: matched.status }));
          }
        }
      } catch { }
    }, 4000);
    return () => clearInterval(interval);
  }, [placedOrder]);

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

  const currentDisplayMenu = menuItems;

  const selectedItems = useMemo(() => {
    return currentDisplayMenu
      .filter((item) => (cartQuantities[item.id] || 0) > 0)
      .map((item) => {
        const selectedPref = itemPreferences[item.id] || "";
        return {
          ...item,
          qty: cartQuantities[item.id],
          preferenceChoice: selectedPref,
          totalPrice: item.price * cartQuantities[item.id],
        };
      });
  }, [cartQuantities, currentDisplayMenu, itemPreferences]);

  const totalItemCount = useMemo(() => {
    return Object.values(cartQuantities).reduce((acc, count) => acc + count, 0);
  }, [cartQuantities]);

  const grandTotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [selectedItems]);

  const handlePlaceOrder = async () => {
    if (selectedItems.length === 0) {
      setOrderValidationError("Please select at least 1 item to place an order.");
      setTimeout(() => setOrderValidationError(null), 5000);
      return;
    }

    // Validation: Every ordered beverage MUST have an explicitly selected sugar preference
    const missingErrors: Record<string, string> = {};
    const missingNames: string[] = [];

    for (const it of selectedItems) {
      const isBeverage = (it.category || "Beverages") === "Beverages";
      if (isBeverage && (!it.preferenceChoice || !it.preferenceChoice.trim())) {
        missingErrors[it.id] = `Please select a sugar preference for ${it.name}.`;
        missingNames.push(it.name);
      }
    }

    if (missingNames.length > 0) {
      setPreferenceErrors(missingErrors);
      setOrderValidationError(
        missingNames.length === 1
          ? `Please select a sugar preference for ${missingNames[0]}.`
          : `Please select a sugar preference for: ${missingNames.join(", ")}.`
      );

      // Automatically clear notification after 6 seconds
      setTimeout(() => {
        setOrderValidationError(null);
      }, 6000);

      // Scroll to the first item with error so the employee sees it immediately
      const firstMissingId = Object.keys(missingErrors)[0];
      const el = document.getElementById(`menu-item-${firstMissingId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Clear any leftover validation errors
    setPreferenceErrors({});
    setOrderValidationError(null);

    setIsSubmittingOrder(true);
    const orderIdNum = Math.floor(1000 + Math.random() * 9000);
    const orderData = {
      id: `#ORD-${orderIdNum}`,
      seat: activeSeatNumber ? String(activeSeatNumber).padStart(2, "0") : (seatId || ""),
      locationName: locationName || "Office",
      locationId: activeLocationId || undefined,
      employeeName: employeeName || employeeEmail || (activeSeatNumber ? `Seat ${activeSeatNumber}` : "Employee"),
      qrToken: qrToken || undefined,
      tempSessionToken: qrToken || undefined,
      items: selectedItems.map((it) => {
        const isBeverage = (it.category || "Beverages") === "Beverages";
        const hasPref = isBeverage && it.preferenceChoice && it.preferenceChoice.trim().length > 0;
        return {
          itemId: it.id,
          name: hasPref ? `${it.name} (${it.preferenceChoice})` : it.name,
          qty: it.qty,
          price: it.price,
          image: it.image || "",
          preference: hasPref ? it.preferenceChoice : undefined,
        };
      }),
      total: grandTotal,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "Pending" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Sync to localStorage "cafe4x_provider_orders"
    try {
      const existingStr = localStorage.getItem("cafe4x_provider_orders");
      const existingOrders = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem(
        "cafe4x_provider_orders",
        JSON.stringify([orderData, ...existingOrders])
      );
    } catch { }

    // 2. Sync to backend API
    try {
      await orderApi.createOrder({
        id: orderData.id,
        seat: orderData.seat,
        locationName: orderData.locationName,
        locationId: activeLocationId || undefined,
        employeeName: orderData.employeeName,
        qrToken: qrToken || undefined,
        tempSessionToken: qrToken || undefined,
        items: orderData.items,
        total: orderData.total,
        time: orderData.time,
        createdAt: orderData.createdAt,
      });
    } catch (err: any) {
      console.warn("Could not sync order to backend:", err);
      if (err?.response?.data?.message) {
        setOrderValidationError(err.response.data.message);
        setIsSubmittingOrder(false);
        return;
      }
    }

    // 3. Sync to admin orders in localStorage
    try {
      const existingStr = localStorage.getItem("cafe4x_admin_orders");
      const existingOrders = existingStr ? JSON.parse(existingStr) : [];
      const adminOrderRecord = {
        id: orderData.id,
        employeeName: orderData.employeeName,
        department: "Office Team",
        avatarInitials: orderData.employeeName.slice(0, 2).toUpperCase(),
        items: orderData.items.map((i: any) => ({
          name: i.name,
          price: i.price,
          qty: i.qty,
          image: i.image || (currentDisplayMenu.find((m) => m.id === i.itemId)?.image) || "",
        })),
        itemSummary: orderData.items.map((i: any) => `${i.name} x${i.qty}`).join(", "),
        seat: `Seat ${orderData.seat}`,
        total: orderData.total,
        orderTime: orderData.time,
        status: "Pending",
      };
      localStorage.setItem(
        "cafe4x_admin_orders",
        JSON.stringify([adminOrderRecord, ...existingOrders])
      );
    } catch { }

    setPlacedOrder(orderData);
    setCartQuantities({});
    setIsSubmittingOrder(false);

    // Smooth scroll down to order details view
    setTimeout(() => {
      document.getElementById("placed-order-section")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Preparing":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Ready":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "Delivered":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Canceled":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // If scanning via QR token and it's invalid / revoked
  if (tokenStatus === "invalid") {
    return (
      <Background>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm">
              <AlertTriangle size={32} />
            </div>
            <h2 className="mt-5 text-xl font-black text-[#342219]">Invalid or Revoked QR Link</h2>
            <p className="mt-2 text-sm text-[#8A7667]">
              {tokenErrorMessage || "This employee ordering link is no longer active or does not exist."}
            </p>
            <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-xs text-rose-800">
              <p className="font-semibold">Security Notice</p>
              <p className="mt-1 text-[11px] text-rose-700">
                For security reasons, old or altered QR links cannot be used. Please contact your Cafe4x administrator to obtain a fresh QR code.
              </p>
            </div>
          </div>
        </div>
      </Background>
    );
  }

  // Session expired — show friendly message with instructions to re-scan
  if (tokenStatus === "expired") {
    return (
      <Background>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
              <Clock size={32} />
            </div>
            <h2 className="mt-5 text-xl font-black text-[#342219]">Session Expired</h2>
            <p className="mt-2 text-sm text-[#8A7667]">
              {tokenErrorMessage || "Your 30-minute ordering session has expired."}
            </p>

            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-xs text-amber-900">
              <p className="font-semibold flex items-center justify-center gap-1.5">
                <QrCode size={13} />
                To start a new session
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                Scan your personal QR code again. Each scan creates a fresh 30-minute ordering window.
                Your permanent QR code remains unchanged.
              </p>
            </div>

            {permanentQrHref && (
              <a
                href={permanentQrHref}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#704225] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5C3620]"
              >
                <QrCode size={15} />
                Open My Entry Link
              </a>
            )}
          </div>
        </div>
      </Background>
    );
  }

  // If token is being validated
  if (tokenStatus === "checking") {
    return (
      <Background>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-8 text-center shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6ECE2] text-[#8C5835]">
              <Lock size={28} className="animate-pulse" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#342219]">Validating Session…</h2>
            <p className="mt-1 text-xs text-[#8A7667]">Verifying your secure ordering session</p>
          </div>
        </div>
      </Background>
    );
  }

  return (
    <Background>
      {/* Clean, minimalist customer ordering header */}
      <header className="sticky top-0 z-40 border-b border-[#EEE5DC] bg-white/90 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#75472D] to-[#9A6747] text-white shadow-md">
              <Coffee size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-[#342219]">Cafe4X</h1>
                <span className="rounded-full bg-[#EFE8E1] px-2 py-0.5 text-[10px] font-bold text-[#70452D]">
                  {authenticatedEmployee ? "Employee Ordering" : "Customer Order"}
                </span>
                {authenticatedEmployee && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <UserCheck size={10} />
                    Verified
                  </span>
                )}
                {sessionExpiresAt && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    Expires {new Date(sessionExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8A7667]">
                {employeeName ? <span className="font-semibold text-[#342219]">{employeeName} &bull; </span> : null}
                {locationName}
                {activeSeatNumber ? ` &bull; Seat ${String(activeSeatNumber).padStart(2, "0")}` : (seatId ? ` &bull; ${seatId}` : "")}
              </p>
            </div>
          </div>

          {/* Quick status pill if order placed */}
          {placedOrder && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadge(placedOrder.status)}`}>
                <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                Order {placedOrder.id}: {placedOrder.status}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container - Focused purely on Menu & Ordering */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-36 sm:px-6">
        {/* Café Menu Section Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[#342219]">Café Menu</h2>
            <p className="text-xs text-[#8A7667] mt-0.5">
              Choose your items, select your preferences, and tap Order Now.
            </p>
          </div>

          {/* Floating / Header Order Action Indicator */}
          {totalItemCount > 0 && (
            <div className="flex flex-col sm:items-end gap-1.5">
              <div className="flex items-center gap-3 bg-[#FAF4ED] border border-[#E8DED4] px-4 py-2 rounded-2xl shadow-xs">
                <div className="text-xs text-[#704225]">
                  <span className="font-bold">{totalItemCount}</span> item{totalItemCount > 1 ? "s" : ""} selected &bull; <span className="font-bold text-[#342219]">₹{grandTotal}</span>
                </div>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder}
                  className="flex items-center gap-1.5 rounded-xl bg-[#704225] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#59341D] cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag size={13} />
                  <span>{isSubmittingOrder ? "Placing..." : "Order Now"}</span>
                </button>
              </div>
              {orderValidationError && (
                <div className="rounded-xl border border-[#DEC5B0] bg-[#FAF4ED] px-3 py-1 text-[11px] font-semibold text-[#704225] shadow-xs animate-in fade-in duration-150">
                  {orderValidationError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading Menu State */}
        {isLoadingMenu ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-[#EEE5DC] bg-white p-16 text-center shadow-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#8C5835] border-t-transparent" />
            <p className="mt-3 text-xs font-semibold text-[#8A7667]">Loading café menu...</p>
          </div>
        ) : currentDisplayMenu.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#DEC5B0] bg-white/70 p-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF6F1] text-[#8C5835]">
              <Coffee size={28} />
            </div>
            <h4 className="mt-3 text-base font-bold text-[#342219]">No Menu Items Available</h4>
            <p className="mt-1 max-w-sm text-xs text-[#8A7667]">
              There are currently no items available for ordering at this location.
            </p>
          </div>
        ) : (
          /* Café Menu Grid */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {currentDisplayMenu.map((item) => {
              const count = cartQuantities[item.id] || 0;
              const hasError = !!preferenceErrors[item.id];
              const isBeverage = (item.category || "Beverages") === "Beverages";
              const currentChoice = itemPreferences[item.id] || "";

              return (
                <div
                  id={`menu-item-${item.id}`}
                  key={item.id}
                  className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                    hasError
                      ? "border-[#B06A42] ring-2 ring-[#B06A42]/40"
                      : count > 0
                      ? "border-[#8C5835] ring-1 ring-[#8C5835]/30"
                      : "border-[#EEE5DC]"
                  }`}
                >
                  {/* Item Image with Price Tag */}
                  <div className="relative h-48 w-full overflow-hidden bg-[#FAF6F1]">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
                        <ImageIcon size={36} />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 rounded-lg bg-black/65 px-2.5 py-1 text-xs font-black text-white backdrop-blur-xs shadow-xs">
                      ₹{item.price}
                    </div>
                  </div>

                  {/* Item Content */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-base font-bold text-[#342219]">{item.name}</h3>
                      <span className="text-[11px] font-semibold text-[#8C5835] bg-[#FAF4ED] px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    </div>

                    <p className="mt-1 flex-1 text-xs text-[#8A7667] line-clamp-2">
                      {item.description || "Freshly made refreshments."}
                    </p>

                    {/* Available Customization Options (Preferences) - strictly for Beverages */}
                    {isBeverage && item.preferenceOptions && item.preferenceOptions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#F5EFE8]">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[#8C5835] mb-1.5">
                          <span>
                            {item.preferenceKey || "Sugar"}:{" "}
                            <span className="text-[10px] text-[#A66E4E] font-normal">(Required)</span>
                          </span>
                          <span className={`font-bold ${currentChoice ? "text-[#342219]" : "text-[#B06A42] italic"}`}>
                            {currentChoice || "Select preference"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.preferenceOptions.map((opt) => {
                            const isSelected = currentChoice === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setItemPreferences((prev) => ({ ...prev, [item.id]: opt }));
                                  setPreferenceErrors((prev) => {
                                    if (!prev[item.id]) return prev;
                                    const copy = { ...prev };
                                    delete copy[item.id];
                                    return copy;
                                  });
                                  setOrderValidationError(null);
                                }}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                                  isSelected
                                    ? "bg-[#704225] text-white shadow-2xs"
                                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {/* Subtle validation prompt when preference is missing for this beverage */}
                        {hasError && (
                          <div className="mt-2 rounded-lg border border-[#DEC5B0] bg-[#FAF4ED] px-2.5 py-1 text-[11px] font-medium text-[#704225] animate-in fade-in duration-200">
                            {preferenceErrors[item.id]}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price & Quantity Controls */}
                    <div className="mt-4 flex items-center justify-between border-t border-[#F0E6DB] pt-3">
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase tracking-wider">Price</span>
                        <span className="text-base font-black text-[#754329]">₹{item.price}</span>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-[#DEC5B0] bg-[#FAF8F5] p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={count === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#70452D] shadow-2xs hover:bg-[#FAF6F1] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-[#342219]">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#70452D] text-white shadow-2xs hover:bg-[#593A28] cursor-pointer"
                          title="Increase quantity"
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
        )}

        {/* Floating Bottom Bar: Order Now action and expandable Order Summary */}
        {totalItemCount > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl flex flex-col gap-2">
            {orderValidationError && (
              <div className="flex items-center justify-between rounded-xl border border-[#DEC5B0] bg-[#FAF4ED] px-4 py-2.5 text-xs font-semibold text-[#704225] shadow-lg animate-in slide-in-from-bottom-2 duration-200">
                <span>{orderValidationError}</span>
                <button
                  type="button"
                  onClick={() => setOrderValidationError(null)}
                  className="text-stone-400 hover:text-stone-700 ml-2 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Expandable Order Summary Panel */}
            {isCartDrawerOpen && (
              <div className="rounded-2xl border border-[#DEC5B0] bg-[#FAF8F5] p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 text-[#342219]">
                <div className="flex items-center justify-between border-b border-[#EEE5DC] pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#8C5835]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#754329]">
                      Order Summary ({totalItemCount} items)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCartDrawerOpen(false)}
                    className="rounded-lg p-1 text-stone-500 hover:bg-[#EFE5DC] transition cursor-pointer"
                    title="Close summary"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-[#EFE5DC] pr-1 space-y-2">
                  {selectedItems.map((it) => {
                    const isBev = (it.category || "Beverages") === "Beverages";
                    const hasMissingPref = isBev && !it.preferenceChoice;

                    return (
                      <div key={it.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {it.image && (
                            <img
                              src={it.image}
                              alt={it.name}
                              className="h-9 w-9 rounded-lg object-cover shrink-0 border border-[#E8DED4]"
                            />
                          )}
                          <div className="truncate">
                            <span className="font-bold text-[#342219] block truncate">{it.name}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isBev ? (
                                hasMissingPref ? (
                                  <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                                    Preference required
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#704225] bg-[#EFE8E1] px-1.5 py-0.5 rounded">
                                    Sugar: {it.preferenceChoice}
                                  </span>
                                )
                              ) : null}
                              <span className="text-[10px] text-stone-500">₹{it.price} each</span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity adjuster inside summary */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 rounded-lg border border-[#DEC5B0] bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(it.id, -1)}
                              className="h-6 w-6 flex items-center justify-center rounded text-stone-600 hover:bg-[#FAF6F1] cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-[#342219]">{it.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(it.id, 1)}
                              className="h-6 w-6 flex items-center justify-center rounded bg-[#70452D] text-white cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                          <span className="w-14 text-right font-bold text-[#342219]">₹{it.totalPrice}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#DEC5B0] flex items-center justify-between text-xs font-bold">
                  <span className="text-[#8A7667]">Item Total</span>
                  <span className="text-sm font-black text-[#754329]">₹{grandTotal}</span>
                </div>
              </div>
            )}

            {/* Bottom Bar Main Action */}
            <div className="flex items-center justify-between rounded-2xl border border-[#DEC5B0] bg-[#342219] px-5 py-3.5 text-white shadow-2xl backdrop-blur-md">
              <div
                onClick={() => setIsCartDrawerOpen((prev) => !prev)}
                className="flex items-center gap-3 cursor-pointer group"
                title="Click to view/hide order summary"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-amber-200 group-hover:bg-white/20 transition">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <div className="text-xs text-stone-300 flex items-center gap-1.5">
                    <span className="font-bold text-white">{totalItemCount} item{totalItemCount > 1 ? "s" : ""}</span> in cart
                    <span className="text-[10px] text-amber-300 underline underline-offset-2">
                      {isCartDrawerOpen ? "Hide summary" : "View summary"}
                    </span>
                  </div>
                  <div className="text-base font-black text-amber-300">
                    Total: ₹{grandTotal}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen((prev) => !prev)}
                  className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  <span>Summary</span>
                  <ChevronUp
                    size={13}
                    className={`transition-transform duration-200 ${isCartDrawerOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#28A745] to-[#208337] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmittingOrder ? "Placing..." : "Order Now"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AFTER ORDER PLACED: ORDER DETAILS SECTION */}
        {placedOrder && (
          <section id="placed-order-section" className="mt-12 pt-8 border-t border-[#DEC5B0]">
            <div className="overflow-hidden rounded-3xl border border-[#DEC5B0] bg-white shadow-md">
              {/* Status Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE5DC] bg-gradient-to-r from-[#FAF4ED] to-[#FAF8F5] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-[#342219]">Order Details</h3>
                      <span className="text-xs font-bold text-[#704225] bg-[#EFE8E1] px-2 py-0.5 rounded-md">
                        {placedOrder.id}
                      </span>
                    </div>
                    <p className="text-xs text-[#8A7667] mt-0.5">
                      Placed at {placedOrder.time} &bull; Delivered to Seat {placedOrder.seat} ({placedOrder.locationName})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#8A7667]">Status:</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold ${getStatusBadge(placedOrder.status)}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {placedOrder.status}
                  </span>
                </div>
              </div>

              {/* Items Table / List */}
              <div className="p-6">
                <h4 className="text-xs font-bold text-[#8C5835] uppercase tracking-wider mb-3">
                  Ordered Items ({placedOrder.items?.length || 0})
                </h4>

                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {placedOrder.items?.map((it: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-white text-xs">
                      <div>
                        <span className="font-bold text-[#342219] text-sm">{it.name}</span>
                        <span className="text-gray-500 ml-2">x {it.qty}</span>
                      </div>
                      <div className="font-bold text-[#342219] text-sm">
                        ₹{Number(it.price) * Number(it.qty)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Summary Row */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[#FAF6F1] p-4 border border-[#EFE8E1]">
                  <div>
                    <span className="text-xs font-semibold text-[#8A7667] block">Grand Total</span>
                    <span className="text-xs text-gray-500">Includes all taxes and delivery to desk</span>
                  </div>
                  <div className="text-xl font-black text-[#754329]">
                    ₹{placedOrder.total}
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-xl border border-[#D5C2B1] bg-white px-5 py-2 text-xs font-bold text-[#6F4228] transition hover:bg-[#FAF6F1] cursor-pointer"
                  >
                    Order More Refreshments
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </Background>
  );
}

