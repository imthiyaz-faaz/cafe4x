import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { UserItem } from "../../pages/Admin/Userspage";

interface UsersEditProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onUserUpdated: (updatedUser: UserItem) => void;
}

export default function UsersEdit({
  isOpen,
  user,
  onClose,
  onUserUpdated,
}: UsersEditProps) {
  const [formData, setFormData] = useState({
    name: "",
    userName: "",
    userType: "Admin",
    email: "",
    mobileNumber: "",
  });
  const [error, setError] = useState("");

  // Sync form data whenever active user changes or modal opens
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        userName: user.userName || "",
        userType: user.userType || "Admin",
        email: user.email || "",
        mobileNumber: user.mobileNumber || "",
      });
      setError("");
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!formData.mobileNumber.trim()) {
      setError("Mobile Number is required");
      return;
    }

    const updated: UserItem = {
      ...user,
      name: formData.name.trim(),
      userName: formData.userName.trim() || user.userName,
      userType: formData.userType || "Admin",
      email: formData.email.trim(),
      mobileNumber: formData.mobileNumber.trim(),
    };

    onUserUpdated(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        {/* Header matching screenshot: Title 'User Create' with X */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-xl font-semibold text-gray-800">User Create</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
          >
            <X size={22} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600 border border-red-200">
            {error}
          </div>
        )}

        {/* Form matching user screenshot */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-sm">
          {/* Name * */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label className="col-span-3 font-semibold text-gray-800">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="col-span-9">
              <input
                required
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
              />
            </div>
          </div>

          {/* User Name * (Prefilled gray input like screenshot) */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label className="col-span-3 font-semibold text-gray-800">
              User Name <span className="text-red-500">*</span>
            </label>
            <div className="col-span-9">
              <input
                required
                type="text"
                placeholder="User Name"
                value={formData.userName}
                onChange={(e) =>
                  setFormData({ ...formData, userName: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
              />
            </div>
          </div>

          {/* User Type * */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label className="col-span-3 font-semibold text-gray-800">
              User Type <span className="text-red-500">*</span>
            </label>
            <div className="col-span-9">
              <select
                value={formData.userType}
                onChange={(e) =>
                  setFormData({ ...formData, userType: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-800 outline-none focus:border-[#28A745]"
              >
                <option value="Admin">Admin</option>
                <option value="Provider">Provider</option>
              </select>
            </div>
          </div>

          {/* Email * */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label className="col-span-3 font-semibold text-gray-800">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="col-span-9">
              <input
                required
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
              />
            </div>
          </div>

          {/* Mobile Number * */}
          <div className="grid grid-cols-12 items-center gap-3">
            <label className="col-span-3 font-semibold text-gray-800">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="col-span-9">
              <input
                required
                type="tel"
                placeholder="Mobile Number"
                value={formData.mobileNumber}
                onChange={(e) =>
                  setFormData({ ...formData, mobileNumber: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
              />
            </div>
          </div>

          {/* Bottom Buttons: Update and Close matching screenshot */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              className="rounded-md border border-[#28A745] bg-white px-5 py-2 font-medium text-[#28A745] transition hover:bg-[#28A745] hover:text-white"
            >
              Update
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[#DC3545] px-5 py-2 font-medium text-white shadow-xs transition hover:bg-[#C82333]"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
