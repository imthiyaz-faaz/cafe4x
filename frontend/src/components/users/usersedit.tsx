import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import type { UserItem } from "../../pages/Admin/Userspage";
import { userApi } from "../../services/users";

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
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      setUsernameError(null);
      setUsernameAvailable(null);
      setUsernameChecking(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const checkUsernameAvailability = async (rawVal: string) => {
    const val = rawVal.trim();
    if (!val) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      setUsernameError("User Name is required");
      return;
    }

    if (val.length < 3) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      setUsernameError("Username must be at least 3 characters long");
      return;
    }

    // If unchanged from original username, it is valid and available
    if (user && val.toLowerCase() === (user.userName || "").trim().toLowerCase()) {
      setUsernameChecking(false);
      setUsernameAvailable(true);
      setUsernameError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setUsernameChecking(true);
    try {
      const res = await userApi.checkUsername(val, user.id, controller.signal);
      if (!res.available) {
        setUsernameAvailable(false);
        setUsernameError("This username is already taken. Please choose another username.");
      } else {
        setUsernameAvailable(true);
        setUsernameError(null);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.name === "CanceledError") return;
      setUsernameAvailable(null);
      setUsernameError(err?.message || "Unable to verify username availability.");
    } finally {
      if (!controller.signal.aborted) {
        setUsernameChecking(false);
      }
    }
  };

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setFormData((prev) => ({ ...prev, userName: nextVal }));
    setUsernameAvailable(null);
    setUsernameError(null);

    if (usernameTimerRef.current) {
      clearTimeout(usernameTimerRef.current);
    }

    const trimmed = nextVal.trim();
    if (!trimmed) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      return;
    }

    // Instant match if user reverted to their current username
    if (user && trimmed.toLowerCase() === (user.userName || "").trim().toLowerCase()) {
      setUsernameChecking(false);
      setUsernameAvailable(true);
      setUsernameError(null);
      return;
    }

    setUsernameChecking(true);
    usernameTimerRef.current = setTimeout(() => {
      checkUsernameAvailability(trimmed);
    }, 450);
  };

  const handleUserNameBlur = async () => {
    const val = formData.userName.trim();
    if (!val) {
      setUsernameError("User Name is required");
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    if (val.length < 3) {
      setUsernameError("Username must be at least 3 characters long");
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    if (usernameTimerRef.current) {
      clearTimeout(usernameTimerRef.current);
    }
    await checkUsernameAvailability(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.userName.trim()) {
      setError("User Name is required");
      return;
    }
    if (formData.userName.trim().length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }
    if (usernameAvailable === false || usernameError) {
      setError("Please choose an available username before saving.");
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
          <h3 className="text-xl font-semibold text-gray-800">Edit User</h3>
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

          {/* User Name * */}
          <div className="grid grid-cols-12 items-start gap-3">
            <label className="col-span-3 font-semibold text-gray-800 pt-2">
              User Name <span className="text-red-500">*</span>
            </label>
            <div className="col-span-9">
              <div className="relative w-full">
                <input
                  required
                  type="text"
                  placeholder="User Name"
                  value={formData.userName}
                  onBlur={handleUserNameBlur}
                  onChange={handleUserNameChange}
                  className={`w-full rounded-md border px-3 py-2 pr-9 text-gray-800 outline-none transition ${
                    usernameError
                      ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                      : usernameAvailable === true
                      ? "border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      : "border-gray-300 focus:border-[#28A745] focus:ring-1 focus:ring-[#28A745]/20"
                  }`}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                  {usernameChecking && (
                    <Loader2 className="w-4 h-4 text-[#8C5835] animate-spin" />
                  )}
                  {!usernameChecking && usernameAvailable === true && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
              </div>
              {usernameChecking ? (
                <p className="mt-1 text-xs font-medium text-[#8C5835]">Checking username availability...</p>
              ) : usernameError ? (
                <p className="mt-1 text-xs font-semibold text-red-500">{usernameError}</p>
              ) : usernameAvailable === true ? (
                <p className="mt-1 text-xs font-semibold text-emerald-600">Username is available.</p>
              ) : null}
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
