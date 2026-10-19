import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  Coffee,
  Cookie,
  Sparkles,
  ShieldCheck,
  ImageIcon,
} from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import { itemsApi, type MenuItem } from "../../services/itemsApi";
import CreateFormModal, { FormRow } from "../../components/common/CreateFormModal";

export interface PreferenceKeyOption {
  title: string; // Key, e.g. "Sugar"
  options: string[]; // Values, e.g. ["No", "Low", "Medium", "High"]
}

const categoryTabs = [
  { key: "All", label: "All Items", icon: Sparkles },
  { key: "Beverages", label: "Beverages", icon: Coffee },
  { key: "Snacks", label: "Snacks", icon: Cookie },
];

export default function Itemspage() {
  const params = useParams();
  const currentShortCode = params.shortCode ? params.shortCode.toUpperCase() : null;
  const storageKey = currentShortCode ? `cafe4x_items_${currentShortCode}` : "cafe4x_items";

  const [items, setItems] = useState<MenuItem[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  const saveItems = (newItems: MenuItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch { }
  };

  // Fetch items from backend on mount or organization switch
  useEffect(() => {
    let isMounted = true;
    itemsApi
      .getItems(currentShortCode || undefined)
      .then((serverItems) => {
        if (!isMounted) return;
        if (Array.isArray(serverItems)) {
          // ISSUE 2 RULE: Ensure Snacks items never hold legacy sugar preferences
          const cleaned = serverItems.map((it) => {
            if (it.type === "Snacks" && (it.preference || it.preferences)) {
              itemsApi.updateItem(it.id, { preference: "" }).catch(() => {});
              return { ...it, preference: "", preferences: "" };
            }
            return it;
          });
          setItems(cleaned);
          try {
            localStorage.setItem(storageKey, JSON.stringify(cleaned));
          } catch { }
        } else {
          setItems([]);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch items from backend:", err);
        setItems([]);
      });

    return () => {
      isMounted = false;
    };
  }, [storageKey, currentShortCode]);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // File Input Refs for user image upload
  const createImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);

  // Preference Key-Value State
  // preferenceKey e.g. "Sugar"
  // preferenceOptions e.g. ["No", "Low", "Medium", "High"]
  const [prefKey, setPrefKey] = useState<string>("Sugar");
  const [prefOptions, setPrefOptions] = useState<string[]>(["No", "Low", "Medium", "High"]);
  const [isAddingChoice, setIsAddingChoice] = useState<boolean>(false);
  const [newChoiceInput, setNewChoiceInput] = useState<string>("");

  // Form State for Item Create & Edit
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
    status: "Active" as "Active" | "Out of Stock",
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

  // Parse existing preference string into Key and Options tags
  const parsePreference = (prefStr?: string) => {
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
    return { key: "Preference", options: prefStr.split(",").map((s) => s.trim()).filter(Boolean) };
  };

  // Build preference string from Key and Options tags
  const buildPreferenceString = (key: string, options: string[]) => {
    if (!key.trim() && options.length === 0) return "";
    const cleanKey = key.trim() || "Sugar";
    return `${cleanKey} : ${options.join(",")}`;
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      name: "",
      description: "",
      image: "",
      status: "Active",
      amount: "",
      type: "Beverages",
    });
    setPrefKey("Sugar");
    setPrefOptions(["No", "Low", "Medium", "High"]);
    setIsAddingChoice(false);
    setNewChoiceInput("");
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
      amount: String(item.amount),
      type: item.type,
    });
    const parsed = parsePreference(item.preference || item.preferences);
    setPrefKey(parsed.key);
    setPrefOptions(parsed.options);
    setIsAddingChoice(false);
    setNewChoiceInput("");
    setIsEditOpen(true);
  };

  // Handle Image File Selection (Convert to base64 DataURL)
  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (img: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setter(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove single choice tag
  const handleRemoveOption = (idxToRemove: number) => {
    setPrefOptions((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Add new choice tag
  const handleAddChoice = () => {
    const trimmed = newChoiceInput.trim();
    if (trimmed && !prefOptions.includes(trimmed)) {
      setPrefOptions((prev) => [...prev, trimmed]);
    }
    setNewChoiceInput("");
    setIsAddingChoice(false);
  };

  // Submit Create Item
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    let currentOrgId = "";
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) currentOrgId = JSON.parse(stored).organizationId || "";
    } catch { }

    const isBeverage = formData.type === "Beverages";
    const preferenceStr = isBeverage ? buildPreferenceString(prefKey, prefOptions) : "";
    const newItemId = Date.now().toString();
    const newItem: MenuItem = {
      id: newItemId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      image: formData.image.trim(),
      status: formData.status,
      preference: preferenceStr,
      preferences: preferenceStr,
      amount: parseFloat(formData.amount) || 0,
      type: formData.type,
      category: formData.type === "Beverages" ? "Drinks" : "Food",
      shortCode: currentShortCode || undefined,
      organizationId: currentOrgId || undefined,
    };

    saveItems([newItem, ...items]);
    setIsCreateOpen(false);

    // Save to SQLite backend
    itemsApi.createItem(newItem).catch((err) => {
      console.warn("Could not save item to backend:", err);
    });
  };

  // Submit Edit Item
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formData.name.trim()) return;

    const isBeverage = formData.type === "Beverages";
    const preferenceStr = isBeverage ? buildPreferenceString(prefKey, prefOptions) : "";
    const updatedItem: MenuItem = {
      ...editingItem,
      name: formData.name.trim(),
      description: formData.description.trim(),
      image: formData.image.trim(),
      status: formData.status,
      preference: preferenceStr,
      preferences: preferenceStr,
      amount: parseFloat(formData.amount) || editingItem.amount,
      type: formData.type,
      category: formData.type === "Beverages" ? "Drinks" : "Food",
    };

    const updated = items.map((it) => (it.id === editingItem.id ? updatedItem : it));
    saveItems(updated);
    setIsEditOpen(false);
    setEditingItem(null);

    // Sync to SQLite backend
    itemsApi.updateItem(editingItem.id, updatedItem).catch((err) => {
      console.warn("Could not update item in backend:", err);
    });
  };

  // Delete Item
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this item?")) {
      saveItems(items.filter((it) => it.id !== id));
      itemsApi.deleteItem(id).catch((err) => {
        console.warn("Could not delete item from backend:", err);
      });
    }
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20">
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* TOOLBAR: CATEGORY TABS, SEARCH, AND + ADD ITEM BUTTON */}
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                {categoryTabs.map((tab) => {
                  const isActive = selectedCategory === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedCategory(tab.key)}
                      className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition duration-200 shadow-xs ${isActive
                        ? "bg-[#6A3F23] text-white shadow-[#6A3F23]/25"
                        : "bg-white/90 text-[#6B564A] hover:bg-white hover:text-[#342219] border border-[#EEE5DC]"
                        }`}
                    >
                      <tab.icon size={14} className={isActive ? "text-white" : "text-[#9A6747]"} />
                      <span>{tab.label}</span>
                      <span
                        className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] ${isActive
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
                <div className="relative flex-1 sm:w-64">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search items..."
                    className="w-full rounded-2xl border border-[#DEC5B0]/70 bg-white/90 py-2 pl-9 pr-3 text-xs text-[#342219] shadow-xs outline-none transition placeholder:text-[#A08C7D] focus:border-[#8C5835] focus:bg-white focus:ring-1 focus:ring-[#8C5835]"
                  />
                </div>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#754329] to-[#8C5835] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#70452D]/20 transition hover:opacity-95 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* ITEMS GRID */}
            {filteredItems.length === 0 ? (
              <div className="my-16 rounded-3xl border border-[#EEE5DC] bg-white/80 p-12 text-center backdrop-blur-md">
                <Sparkles className="mx-auto mb-3 h-12 w-12 text-[#A08C7D]" />
                <h3 className="text-lg font-bold text-[#342219]">No menu items found</h3>
                <p className="mt-1 text-sm text-[#897B71]">
                  Click the "Add Item" button above to create items in your database.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredItems.map((item) => {
                  const isOutOfStock = item.status === "Out of Stock";

                  return (
                    <div
                      key={item.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[#DEC5B0]/60 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      {/* Top Image Box with Status Badge and Hover Actions */}
                      <div className="relative h-44 w-full overflow-hidden bg-[#ECE8E1]">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F5EFEA] to-[#EAE0D5] text-[#9A7A66]">
                            <ImageIcon size={38} className="opacity-60" />
                          </div>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-3 left-3">
                          <span
                            className={`rounded-md px-2.5 py-1 text-[11px] font-bold shadow-xs ${isOutOfStock
                              ? "bg-[#DC3545] text-white"
                              : "bg-[#28A745] text-white"
                              }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* Hover Quick Action Buttons */}
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
                            {item.description || "No description provided"}
                          </p>

                          {/* Preferences (e.g., Sugar: No, Low, Med) - only for Beverages */}
                          {item.type === "Beverages" && (item.preference || item.preferences) && (
                            <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#8C5835]">
                              {item.preference || item.preferences}
                            </p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#F5EFE8]">
                          <div className="flex items-baseline">
                            <span className="text-base font-extrabold text-[#2A1C14]">
                              ₹{item.amount}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-stone-500">
                            {item.type}
                          </span>
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
            MODAL: ITEM CREATE (USING REUSABLE CREATEFORM MODAL)
           ======================================================== */}
        <CreateFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Item Create"
          onSubmit={handleCreateSubmit}
          maxWidth="xl"
        >
          {/* Name* */}
          <FormRow label="Name" required>
            <input
              required
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
            />
          </FormRow>

          {/* Description */}
          <FormRow label="Description">
            <input
              type="text"
              placeholder="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
            />
          </FormRow>

          {/* Image: Upload and Preview matching Screenshot */}
          <FormRow label="Image" labelAlign="top">
            <input
              type="file"
              ref={createImageInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                handleImageFileChange(e, (img) =>
                  setFormData((prev) => ({ ...prev, image: img }))
                )
              }
            />

            <div className="flex items-center gap-3.5">
              {/* Image Preview with Delete X button on top right */}
              {formData.image ? (
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200 shadow-2xs">
                  <img
                    src={formData.image}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, image: "" }))}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition"
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : null}

              {/* Clickable Change Image upload box matching user screenshot */}
              <div
                onClick={() => createImageInputRef.current?.click()}
                className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#DECFBE] bg-[#FAF8F5]/80 py-3 px-4 text-center hover:bg-[#FAF6F1] transition shadow-2xs"
              >
                <Upload size={20} className="text-[#8C5835] mb-1" />
                <span className="text-xs font-bold text-[#4A3B32]">
                  {formData.image ? "Change Image" : "Upload Image"}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG (Max 2MB)</span>
              </div>
            </div>
          </FormRow>

          {/* Status */}
          <FormRow label="Status">
            <div className="relative">
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as "Active" | "Out of Stock",
                  })
                }
                className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3.5 py-2 pl-7 text-xs font-semibold text-[#342219] outline-none focus:border-[#8C5835]"
              >
                <option value="Active">Active</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
              <span
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${formData.status === "Active" ? "bg-emerald-500" : "bg-rose-500"
                  }`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                ▼
              </span>
            </div>
          </FormRow>

          {/* Type */}
          <FormRow label="Type">
            <div className="relative">
              <select
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value as MenuItem["type"];
                  setFormData({
                    ...formData,
                    type: newType,
                  });
                  if (newType === "Snacks") {
                    setIsAddingChoice(false);
                  }
                }}
                className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#342219] outline-none focus:border-[#8C5835]"
              >
                <option value="Beverages">Beverages (Drinks)</option>
                <option value="Snacks">Snacks (Food)</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                ▼
              </span>
            </div>
          </FormRow>

          {/* Preference (Key-Value matching Screenshot tags UI) - ONLY FOR BEVERAGES */}
          {formData.type === "Beverages" && (
            <div className="grid grid-cols-12 items-start gap-3 pt-1">
              <div className="col-span-3 flex items-center justify-between pt-1">
                <label className="font-bold text-[#342219]">Sugar Preference</label>
                <button
                  type="button"
                  onClick={() => setIsAddingChoice(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8C5835] border border-[#DECFBE] hover:bg-[#F3EBE3] transition shadow-2xs"
                  title="Add choice tag"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="col-span-9 space-y-2">
                {/* Tags Flow matching Screenshot */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Preference Key Tag (e.g. Sugar) */}
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF4ED] px-3 py-1.5 text-xs font-bold text-[#704225] border border-[#E8DED4] shadow-2xs">
                    <input
                      type="text"
                      value={prefKey}
                      onChange={(e) => setPrefKey(e.target.value)}
                      placeholder="Key"
                      className="w-16 bg-transparent outline-none font-bold text-[#704225]"
                    />
                  </span>

                  {/* Options Tags (e.g. No x, Low x, Medium x, High x) */}
                  {prefOptions.map((opt, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-[#5A4538] border border-[#EEE5DC] shadow-2xs"
                    >
                      <span>{opt}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-gray-400 hover:text-red-600 transition"
                        title="Remove choice"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}

                  {/* Add Choice Input if active */}
                  {isAddingChoice && (
                    <div className="inline-flex items-center gap-1 rounded-lg border border-[#8C5835] bg-white px-2 py-1 shadow-xs">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Choice name..."
                        value={newChoiceInput}
                        onChange={(e) => setNewChoiceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddChoice();
                          } else if (e.key === "Escape") {
                            setIsAddingChoice(false);
                          }
                        }}
                        className="w-20 text-xs text-[#342219] outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddChoice}
                        className="rounded bg-[#8C5835] px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-[#774728]"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingChoice(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <FormRow label="Amount">
            <input
              required
              type="number"
              step="any"
              placeholder="Amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835]"
            />
          </FormRow>
        </CreateFormModal>


        {/* ========================================================
            MODAL: ITEM EDIT (MATCHING USER SCREENSHOT EXACTLY)
           ======================================================== */}
        {isEditOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white p-7 shadow-2xl">
              {/* Header matching screenshot: Item Edit */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-xl font-bold text-[#2D241E]">Item Edit</h3>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Form matching user screenshot layout */}
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-4 text-sm">
                {/* Name* */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-bold text-[#342219]">
                    Name<span className="text-red-500">*</span>
                  </label>
                  <div className="col-span-9">
                    <input
                      required
                      type="text"
                      placeholder="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] outline-none focus:border-[#8C5835]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-bold text-[#342219]">
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
                      className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] outline-none focus:border-[#8C5835]"
                    />
                  </div>
                </div>

                {/* Image matching Screenshot preview + upload box */}
                <div className="grid grid-cols-12 items-start gap-3">
                  <label className="col-span-3 font-bold text-[#342219] pt-2">
                    Image
                  </label>
                  <div className="col-span-9">
                    <input
                      type="file"
                      ref={editImageInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleImageFileChange(e, (img) =>
                          setFormData((prev) => ({ ...prev, image: img }))
                        )
                      }
                    />

                    <div className="flex items-center gap-3.5">
                      {formData.image ? (
                        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200 shadow-2xs">
                          <img
                            src={formData.image}
                            alt="preview"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, image: "" }))}
                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition"
                            title="Remove image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : null}

                      <div
                        onClick={() => editImageInputRef.current?.click()}
                        className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#DECFBE] bg-[#FAF8F5]/80 py-3 px-4 text-center hover:bg-[#FAF6F1] transition shadow-2xs"
                      >
                        <Upload size={20} className="text-[#8C5835] mb-1" />
                        <span className="text-xs font-bold text-[#4A3B32]">
                          {formData.image ? "Change Image" : "Upload Image"}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG (Max 2MB)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-bold text-[#342219]">
                    Status
                  </label>
                  <div className="col-span-9">
                    <div className="relative">
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as "Active" | "Out of Stock",
                          })
                        }
                        className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3.5 py-2 pl-7 text-xs font-semibold text-[#342219] outline-none focus:border-[#8C5835]"
                      >
                        <option value="Active">Active</option>
                        <option value="Out of Stock">Out of Stock</option>
                      </select>
                      <span
                        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${formData.status === "Active" ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                {/* Type */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-bold text-[#342219]">
                    Type
                  </label>
                  <div className="col-span-9">
                    <div className="relative">
                      <select
                        value={formData.type}
                        onChange={(e) => {
                          const newType = e.target.value as MenuItem["type"];
                          setFormData({
                            ...formData,
                            type: newType,
                          });
                          if (newType === "Snacks") {
                            setIsAddingChoice(false);
                          }
                        }}
                        className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#342219] outline-none focus:border-[#8C5835]"
                      >
                        <option value="Beverages">Beverages (Drinks)</option>
                        <option value="Snacks">Snacks (Food)</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preference Key-Value Tags - ONLY FOR BEVERAGES */}
                {formData.type === "Beverages" && (
                  <div className="grid grid-cols-12 items-start gap-3 pt-1">
                    <div className="col-span-3 flex items-center justify-between pt-1">
                      <label className="font-bold text-[#342219]">Sugar Preference</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingChoice(true)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8C5835] border border-[#DECFBE] hover:bg-[#F3EBE3] transition shadow-2xs"
                        title="Add choice tag"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="col-span-9 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF4ED] px-3 py-1.5 text-xs font-bold text-[#704225] border border-[#E8DED4] shadow-2xs">
                          <input
                            type="text"
                            value={prefKey}
                            onChange={(e) => setPrefKey(e.target.value)}
                            placeholder="Key"
                            className="w-16 bg-transparent outline-none font-bold text-[#704225]"
                          />
                        </span>

                        {prefOptions.map((opt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-[#5A4538] border border-[#EEE5DC] shadow-2xs"
                          >
                            <span>{opt}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              className="text-gray-400 hover:text-red-600 transition"
                              title="Remove choice"
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}

                        {isAddingChoice && (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-[#8C5835] bg-white px-2 py-1 shadow-xs">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Choice name..."
                              value={newChoiceInput}
                              onChange={(e) => setNewChoiceInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddChoice();
                                } else if (e.key === "Escape") {
                                  setIsAddingChoice(false);
                                }
                              }}
                              className="w-20 text-xs text-[#342219] outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddChoice}
                              className="rounded bg-[#8C5835] px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-[#774728]"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingChoice(false)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div className="grid grid-cols-12 items-center gap-3">
                  <label className="col-span-3 font-bold text-[#342219]">
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
                      className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] outline-none focus:border-[#8C5835]"
                    />
                  </div>
                </div>

                {/* Bottom Actions matching Screenshot: Green Update and Red Close */}
                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg border border-[#28A745] bg-white px-6 py-2 text-xs font-bold text-[#28A745] transition hover:bg-[#28A745] hover:text-white cursor-pointer shadow-2xs"
                  >
                    <span>✓</span>
                    <span>Update</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#DC3545] px-6 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#C82333] cursor-pointer"
                  >
                    <span>✕</span>
                    <span>Close</span>
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
