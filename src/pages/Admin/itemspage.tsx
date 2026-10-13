import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Heart,
  Edit,
  Trash2,
  X,
  Upload,
  Coffee,
  Cookie,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";

export interface PreferenceOption {
  title: string; // e.g. "Sugar"
  options: string[]; // e.g. ["No", "Low", "Medium", "High"]
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  image: string;
  status: "Active" | "Out of Stock";
  preferences?: string; // e.g. "Sugar : No,Low,Medium,High"
  amount: number;
  type: "Beverages" | "Snacks";
  category: string; // Drinks, Food
  isLiked?: boolean;
}

const initialMenuItems: MenuItem[] = [
  {
    id: "1",
    name: "Coffee",
    description: "Freshly brewed coffee with rich aroma",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    preferences: "Sugar : No,Low,Medium,High",
    amount: 20,
    type: "Beverages",
    category: "Drinks",
  },
  {
    id: "2",
    name: "Tea",
    description: "Classic milk tea with aromatic spices",
    image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    preferences: "Sugar : No,Low,Medium,High",
    amount: 15,
    type: "Beverages",
    category: "Drinks",
  },
  {
    id: "3",
    name: "Black Tea",
    description: "Without milk, pure organic brew",
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    preferences: "Sugar : No,Low,Medium,High",
    amount: 15,
    type: "Beverages",
    category: "Drinks",
  },
  {
    id: "4",
    name: "Lemon Tea",
    description: "Refreshing lemon tea with citrus mint",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    preferences: "Sugar : No,Low,Medium,High",
    amount: 20,
    type: "Beverages",
    category: "Drinks",
  },
  {
    id: "5",
    name: "Milk",
    description: "Fresh and healthy steamed milk",
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    preferences: "Sugar : No,Low,Medium,High",
    amount: 18,
    type: "Beverages",
    category: "Drinks",
  },
  {
    id: "6",
    name: "Vada",
    description: "Crispy and tasty lentil vada",
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    amount: 20,
    type: "Snacks",
    category: "Food",
  },
  {
    id: "7",
    name: "Egg Bonda",
    description: "Spicy egg bonda fried golden brown",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    amount: 25,
    type: "Snacks",
    category: "Food",
  },
  {
    id: "8",
    name: "5rs Biscuit",
    description: "Crunchy baked butter biscuit",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    amount: 5,
    type: "Snacks",
    category: "Food",
  },
  {
    id: "9",
    name: "10rs Biscuit",
    description: "Premium almond cookies",
    image: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    amount: 10,
    type: "Snacks",
    category: "Food",
  },
  {
    id: "10",
    name: "French Fries",
    description: "Crispy golden salted fries",
    image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80",
    status: "Active",
    amount: 50,
    type: "Snacks",
    category: "Food",
  },
];

const categoryTabs = [
  { key: "All", label: "All Items", icon: Sparkles },
  { key: "Beverages", label: "Beverages", icon: Coffee },
  { key: "Snacks", label: "Snacks", icon: Cookie },
];

export default function Itemspage() {
  const [items, setItems] = useState<MenuItem[]>(initialMenuItems);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartBadgeCount, setCartBadgeCount] = useState<Record<string, number>>({});

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form State for Item Create & Edit matching screenshot:
  // Name*, Description, Image, Status, Preference, Amount, type
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
    status: "Active" as "Active" | "Out of Stock",
    preference: "",
    amount: "",
    type: "Beverages" as "Beverages" | "Snacks",
  });

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.type === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      name: "",
      description: "",
      image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
      status: "Active",
      preference: "Sugar : No,Low,Medium,High",
      amount: "",
      type: "Beverages",
    });
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      image: item.image,
      status: item.status,
      preference: item.preferences || "",
      amount: String(item.amount),
      type: item.type,
    });
    setIsEditOpen(true);
  };

  // Submit Create Item
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newItem: MenuItem = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      image:
        formData.image.trim() ||
        "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
      status: formData.status,
      preferences: formData.preference.trim() || undefined,
      amount: parseFloat(formData.amount) || 20,
      type: formData.type,
      category: formData.type === "Beverages" ? "Drinks" : "Food",
    };

    setItems((prev) => [newItem, ...prev]);
    setIsCreateOpen(false);
  };

  // Submit Edit Item
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formData.name.trim()) return;

    setItems((prev) =>
      prev.map((it) =>
        it.id === editingItem.id
          ? {
              ...it,
              name: formData.name.trim(),
              description: formData.description.trim(),
              image:
                formData.image.trim() ||
                "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
              status: formData.status,
              preferences: formData.preference.trim() || undefined,
              amount: parseFloat(formData.amount) || it.amount,
              type: formData.type,
              category: formData.type === "Beverages" ? "Drinks" : "Food",
            }
          : it
      )
    );
    setIsEditOpen(false);
    setEditingItem(null);
  };

  // Delete Item
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this item?")) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  // Toggle Heart Like
  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isLiked: !it.isLiked } : it))
    );
  };

  // Add to order count
  const handleAddItemCount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCartBadgeCount((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* ========================================================
                TOOLBAR: CATEGORY TABS, SEARCH, AND + ADD ITEM BUTTON
               ======================================================== */}
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Filter Pills matching screenshot */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                {categoryTabs.map((tab) => {
                  const isActive = selectedCategory === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedCategory(tab.key)}
                      className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition duration-200 shadow-xs ${
                        isActive
                          ? "bg-[#6A3F23] text-white shadow-[#6A3F23]/25"
                          : "bg-white/90 text-[#6B564A] hover:bg-white hover:text-[#342219] border border-[#EEE5DC]"
                      }`}
                    >
                      <tab.icon size={14} className={isActive ? "text-white" : "text-[#9A6747]"} />
                      <span>{tab.label}</span>
                      <span
                        className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-[#F5EDE4] text-[#7A5B49]"
                        }`}
                      >
                        ({items.filter((it) => tab.key === "All" || it.type === tab.key).length})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Add Item Button */}
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white/95 py-2 pl-9 pr-3 text-xs text-gray-800 outline-none transition placeholder-gray-400 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20 shadow-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex shrink-0 items-center gap-2 rounded-2xl bg-[#754329] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#754329]/20 transition duration-200 hover:bg-[#60351E] hover:-translate-y-0.5"
                >
                  <Plus size={16} />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* ========================================================
                ITEMS GRID (MATCHING CARDS IN SCREENSHOT 1)
               ======================================================== */}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#DACABE] bg-white/60 p-12 text-center">
                <Coffee size={40} className="text-[#A89485] mb-2" />
                <h3 className="text-base font-bold text-[#342219]">No items found</h3>
                <p className="mt-1 text-xs text-[#8A7667]">
                  Try searching for something else or add a new item using the button above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredItems.map((item) => {
                  const isOutOfStock = item.status === "Out of Stock";

                  return (
                    <div
                      key={item.id}
                      className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#EEE5DC] bg-white shadow-md shadow-[#70452D]/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#70452D]/12"
                    >
                      {/* Image Container with Badges */}
                      <div className="relative h-44 w-full overflow-hidden bg-gray-100">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80";
                          }}
                        />

                        {/* Status Badge (Active or Out of Stock) */}
                        <div className="absolute top-3 left-3">
                          <span
                            className={`rounded-md px-2.5 py-1 text-[11px] font-bold shadow-xs ${
                              isOutOfStock
                                ? "bg-[#DC3545] text-white"
                                : "bg-[#28A745] text-white"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* Top-Right Favorite / Like Button */}
                        <button
                          type="button"
                          onClick={(e) => toggleLike(item.id, e)}
                          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xs transition hover:scale-110 hover:bg-black/60"
                        >
                          <Heart
                            size={16}
                            className={item.isLiked ? "fill-red-500 text-red-500" : "text-white"}
                          />
                        </button>

                        {/* Hover Quick Action Buttons: Edit and Delete */}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => openEditModal(item, e)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#754329] shadow-lg transition hover:bg-[#FAF4ED] hover:scale-105"
                            title="Edit Item"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-red-600 shadow-lg transition hover:bg-red-50 hover:scale-105"
                            title="Delete Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-[#2A1C14] text-base leading-snug">
                              {item.name}
                            </h3>
                          </div>

                          <p className="mt-1 line-clamp-1 text-xs text-[#8A7667]">
                            {item.description}
                          </p>

                          {/* Preferences (e.g., Sugar: No, Low, Med) */}
                          {item.preferences && (
                            <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#8C5835]">
                              {item.preferences}
                            </p>
                          )}
                        </div>

                        {/* Price & Add (+) Button */}
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#F5EFE8]">
                          <div className="flex items-baseline">
                            <span className="text-base font-extrabold text-[#2A1C14]">
                              ₹{item.amount}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleAddItemCount(item.id, e)}
                            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#8C5835] text-white shadow-sm transition hover:bg-[#704225] hover:scale-105 active:scale-95"
                            title="Add item"
                          >
                            <Plus size={16} />
                            {cartBadgeCount[item.id] ? (
                              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-xs">
                                {cartBadgeCount[item.id]}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
            MODAL: ITEM CREATE (EXACT SCREENSHOT 2)
           ======================================================== */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-xl font-semibold text-gray-800">Item Create</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Form matching screenshot 2 layout & fields */}
              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4 text-sm">
                {/* Name* */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Name<span className="text-red-500">*</span>
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="text"
                      placeholder="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Description
                  </label>
                  <div className="col-span-9">
                    <input
                      type="text"
                      placeholder="Description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                    />
                  </div>
                </div>

                {/* Image Upload / URL Box */}
                <div className="grid grid-cols-12 items-start gap-3">
                  <label className="col-span-3 font-semibold text-gray-800 pt-2">
                    Image
                  </label>
                  <div className="col-span-9 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden text-gray-400 hover:border-[#8C5835]">
                        {formData.image ? (
                          <img
                            src={formData.image}
                            alt="preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center text-[10px]">
                            <Upload size={18} className="mb-1 text-gray-500" />
                            <span>Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Image URL (or Unsplash URL)"
                          value={formData.image}
                          onChange={(e) =>
                            setFormData({ ...formData, image: e.target.value })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745]"
                        />
                        <p className="mt-1 text-[11px] text-gray-400">
                          Paste image web URL or leave default preview
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Status
                  </label>
                  <div className="col-span-9">
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as "Active" | "Out of Stock",
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    >
                      <option value="Active">Active</option>
                      <option value="Out of Stock">Out of Stock</option>
                    </select>
                  </div>
                </div>

                {/* Preference */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Preference
                  </label>
                  <div className="col-span-9">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Sugar : No,Low,Medium,High"
                        value={formData.preference}
                        onChange={(e) =>
                          setFormData({ ...formData, preference: e.target.value })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            preference: "Sugar : No,Low,Medium,High",
                          }))
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        title="Add Sugar Preference"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Amount
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="number"
                      step="any"
                      placeholder="Amount"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 placeholder-gray-400 outline-none focus:border-[#28A745]"
                    />
                  </div>
                </div>

                {/* type */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    type
                  </label>
                  <div className="col-span-9">
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as MenuItem["type"],
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    >
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks">Snacks</option>
                    </select>
                  </div>
                </div>

                {/* Bottom Actions matching screenshot buttons */}
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="submit"
                    className="rounded-md border border-[#28A745] bg-white px-5 py-2 font-medium text-[#28A745] transition hover:bg-[#28A745] hover:text-white"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-md bg-[#DC3545] px-5 py-2 font-medium text-white shadow-xs transition hover:bg-[#C82333]"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL: ITEM EDIT (SAME FORM FIELDS & CONTROLS)
           ======================================================== */}
        {isEditOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-xl font-semibold text-gray-800">
                  Item Edit - {editingItem.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Form matching screenshot 2 layout */}
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-4 text-sm">
                {/* Name* */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Name<span className="text-red-500">*</span>
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="text"
                      placeholder="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Description
                  </label>
                  <div className="col-span-9">
                    <input
                      type="text"
                      placeholder="Description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    />
                  </div>
                </div>

                {/* Image */}
                <div className="grid grid-cols-12 items-start gap-3">
                  <label className="col-span-3 font-semibold text-gray-800 pt-2">
                    Image
                  </label>
                  <div className="col-span-9 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden text-gray-400">
                        {formData.image ? (
                          <img
                            src={formData.image}
                            alt="preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Upload size={18} className="text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Image URL"
                          value={formData.image}
                          onChange={(e) =>
                            setFormData({ ...formData, image: e.target.value })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#28A745]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Status
                  </label>
                  <div className="col-span-9">
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as "Active" | "Out of Stock",
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    >
                      <option value="Active">Active</option>
                      <option value="Out of Stock">Out of Stock</option>
                    </select>
                  </div>
                </div>

                {/* Preference */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Preference
                  </label>
                  <div className="col-span-9">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Sugar : No,Low,Medium,High"
                        value={formData.preference}
                        onChange={(e) =>
                          setFormData({ ...formData, preference: e.target.value })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            preference: "Sugar : No,Low,Medium,High",
                          }))
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        title="Add Sugar Preference"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    Amount
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="number"
                      step="any"
                      placeholder="Amount"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    />
                  </div>
                </div>

                {/* type */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-semibold text-gray-800">
                    type
                  </label>
                  <div className="col-span-9">
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as MenuItem["type"],
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
                    >
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks">Snacks</option>
                    </select>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="submit"
                    className="rounded-md border border-[#28A745] bg-white px-5 py-2 font-medium text-[#28A745] transition hover:bg-[#28A745] hover:text-white"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="rounded-md bg-[#DC3545] px-5 py-2 font-medium text-white shadow-xs transition hover:bg-[#C82333]"
                  >
                    Close
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
