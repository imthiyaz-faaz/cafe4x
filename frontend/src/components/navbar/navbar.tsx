import { useState } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import {
  Users,
  MapPin,
  ListTodo,
  Truck,
  Clock,
  UserCircle,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import logoImg from "../../assets/images/logo.png";
import { useAuth } from "../common/AuthContext";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const shortCode = params.shortCode;
  const { user: currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const basePath = shortCode ? `/${shortCode}` : "";

  const navItems = [
    { name: "Overview", icon: LayoutDashboard, href: `${basePath}/landing` },
    { name: "Users", icon: Users, href: `${basePath}/users` },
    { name: "Location", icon: MapPin, href: `${basePath}/location` },
    { name: "Items", icon: ListTodo, href: `${basePath}/items` },
    { name: "Orders", icon: Truck, href: `${basePath}/orders` },
    { name: "Working Hours", icon: Clock, href: `${basePath}/working-hours` },
  ];

  const isCurrent = (href: string) => {
    if (href.startsWith("#")) return false;
    return location.pathname === href;
  };

  const displayName = currentUser?.name || currentUser?.userName || "Admin User";
  const orgName = currentUser?.organization || (shortCode ? `${shortCode.toUpperCase()} Workspace` : "Admin Access");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-[#EEE5DC]/80 bg-white/90 px-4 backdrop-blur-md shadow-sm sm:px-6 lg:px-8">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between">
        {/* Brand with logo.png */}
        <Link to={shortCode ? `/${shortCode}/landing` : "/"} className="flex items-center gap-3">
          <img
            src={logoImg}
            alt="Cafe4X Logo"
            className="h-12 w-auto object-contain transition duration-200 hover:scale-105"
          />
          <div className="text-left">
            <h1 className="text-xl font-bold leading-tight text-[#342219]">
              Cafe<span className="text-[#A66C43]">4X</span>
            </h1>
            <p className="text-[9px] font-semibold tracking-[0.2em] text-[#A08C7D]">
              {shortCode ? `${shortCode.toUpperCase()} CAFE` : "OFFICE CAFE MANAGEMENT"}
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden items-center gap-1 lg:flex xl:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(item.href);

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-[#75472D] to-[#9A6747] text-white shadow-md shadow-[#75472D]/20"
                    : "text-[#75675D] hover:bg-[#FAF6F1] hover:text-[#342219]"
                }`}
              >
                <Icon
                  size={17}
                  className={active ? "text-white" : "text-[#A66C43]"}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Action / Profile */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            to="/home"
            title="Switch Organization"
            className="flex items-center gap-3 rounded-xl border border-[#EFE7DE] bg-[#FAF6F1] px-3.5 py-1.5 transition hover:border-[#DEC5B0] hover:bg-[#F5ECE0]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAD5C0] text-[#70452D]">
              <UserCircle size={24} />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[#342219]">{displayName}</p>
              <div className="flex items-center gap-1 text-[10px] text-[#9A8778]">
                {currentUser?.shortCode && (
                  <span className="rounded bg-[#E3D3C4] px-1 py-0.2 font-semibold text-[#633B22]">
                    {currentUser.shortCode}
                  </span>
                )}
                <span>{orgName}</span>
                <span className="ml-1 text-[9px] font-semibold text-[#009FB7]">⇄ Switch</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            title="Log out"
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EFE7DE] bg-white text-[#9A8778] transition hover:border-[#DEC5B0] hover:bg-[#FAF6F1] hover:text-[#70452D] cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Mobile menu toggle button */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EFE7DE] bg-[#FAF6F1] text-[#70452D]"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mx-auto mb-3 max-w-7xl rounded-2xl border border-[#EEE5DC] bg-white/95 p-4 shadow-xl backdrop-blur-md lg:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isCurrent(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-[#75472D] to-[#9A6747] text-white"
                      : "text-[#75675D] hover:bg-[#FAF6F1] hover:text-[#593A28]"
                  }`}
                >
                  <Icon
                    size={19}
                    className={active ? "text-white" : "text-[#A66C43]"}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#EFE7DE] pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAD5C0] text-[#70452D]">
                <UserCircle size={24} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-[#342219]">{displayName}</p>
                <p className="text-[10px] text-[#9A8778]">{orgName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-[#DEC5B0] px-3 py-1.5 text-xs font-semibold text-[#70452D] hover:bg-[#FAF6F1] cursor-pointer"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
