import {
  Users,
  MapPin,
  ListTodo,
  Truck,
  Clock,
  UserCircle,
} from "lucide-react";

const navItems = [
  { name: "Users", icon: Users },
  { name: "Location", icon: MapPin },
  { name: "Items", icon: ListTodo },
  { name: "Orders", icon: Truck },
  { name: "Working Hours", icon: Clock },
];

export default function Navbar() {
  return (
    <nav className="flex min-h-[86px] w-full items-center justify-between border border-gray-200 bg-white px-5 shadow-md sm:px-7">
      {/* Cafe Logo */}
      <a href="/" className="flex shrink-0 items-center gap-3">
        <div className="flex h-10 w-6 items-center justify-center border-2 border-[#754C35]">
          <span className="text-sm text-[#754C35]">♨</span>
        </div>

        <span className="text-xl text-[#573722] sm:text-2xl">Cafe</span>
      </a>

      {/* Navigation Links */}
      {/* Navigation Links */}
      <div className="flex items-center gap-8">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.name}
              href="#"
              className="flex items-center gap-2 whitespace-nowrap text-xl text-[#A47758] transition-colors hover:text-[#573722]"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.name}</span>
            </a>
          );
        })}
      </div>

      {/* Profile */}
      <button
        type="button"
        aria-label="User profile"
        className="shrink-0 text-black"
      >
        <UserCircle size={46} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
