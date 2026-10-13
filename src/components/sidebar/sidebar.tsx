import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Coffee,
  Users,
  MapPin,
  ListTodo,
  Truck,
  Clock,
  UserCircle,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { name: "Overview", icon: LayoutDashboard, href: "/landing" },
  { name: "Users", icon: Users, href: "/users" },
  { name: "Location", icon: MapPin, href: "#location" },
  { name: "Items", icon: ListTodo, href: "#items" },
  { name: "Orders", icon: Truck, href: "#orders" },
  { name: "Working Hours", icon: Clock, href: "#hours" },
];

interface SidebarProps {
  children?: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isCurrent = (href: string) => {
    if (href.startsWith("#")) return false;
    return location.pathname === href;
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#EEE5DC] bg-white/95 px-4 backdrop-blur-md lg:hidden">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#75472D] to-[#9A6747] text-[#F3D1A8] shadow-md shadow-[#75472D]/20">
            <Coffee size={20} />
          </div>
          <div>
            <span className="text-base font-bold text-[#342219]">
              Cafe<span className="text-[#A66C43]">4X</span>
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EFE7DE] bg-[#FAF6F1] text-[#70452D]"
          aria-label="Open navigation sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-[#EEE5DC] bg-white/95 p-5 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo & Close Button */}
          <div className="flex items-center justify-between pb-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#75472D] to-[#9A6747] text-[#F3D1A8] shadow-lg shadow-[#75472D]/25 ring-2 ring-[#F3D1A8]/20">
                <Coffee size={24} />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold tracking-tight text-[#342219]">
                  Cafe<span className="text-[#A66C43]">4X</span>
                </h1>
                <p className="text-[9px] font-semibold tracking-[0.2em] text-[#A08C7D]">
                  OFFICE CAFE MANAGEMENT
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl p-1.5 text-gray-400 hover:bg-[#FAF6F1] hover:text-gray-700 lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* Workspace Pill */}
          <div className="mb-6 flex items-center justify-between rounded-xl border border-[#EEE5DC] bg-[#FAF6F1] px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#9A6747]" />
              <span className="text-xs font-semibold text-[#593A28]">
                Café Management
              </span>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A08C7D]">
              Menu
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isCurrent(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-[#75472D] to-[#9A6747] text-white shadow-md shadow-[#75472D]/20"
                      : "text-[#75675D] hover:bg-[#FAF6F1] hover:text-[#342219]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-[#F7F2EB] text-[#8C5835] group-hover:bg-[#EFE6DC]"
                      }`}
                    >
                      <Icon size={17} />
                    </div>
                    <span>{item.name}</span>
                  </div>

                  <ChevronRight
                    size={15}
                    className={`transition-transform duration-200 ${
                      active
                        ? "translate-x-0.5 text-white/80"
                        : "text-[#CDB49F] group-hover:translate-x-1 group-hover:text-[#8C5835]"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Logout */}
        <div className="border-t border-[#EEE5DC] pt-4">
          <div className="flex items-center justify-between rounded-2xl border border-[#EEE5DC] bg-[#FAF6F1] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8DDD2] text-[#70452D] shadow-inner">
                <UserCircle size={26} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-[#342219]">Admin User</p>
                <p className="text-[10px] text-[#8C5835]">admin@cafe4x.com</p>
              </div>
            </div>

            <Link
              to="/login"
              title="Logout"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E8DED4] bg-white text-[#8C5835] transition hover:bg-[#F2E5D7] hover:text-[#593A28]"
            >
              <LogOut size={15} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Body */}
      {children && <div className="flex-1 overflow-x-hidden">{children}</div>}
    </div>
  );
}
