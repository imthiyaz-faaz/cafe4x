import React, { useState } from "react";
import type { UserItem } from "../../pages/Admin/Userspage";
import CreateFormModal, { FormRow } from "../common/CreateFormModal";

interface UserCreateProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (newUser: UserItem) => void;
}

export default function UserCreate({
  isOpen,
  onClose,
  onUserCreated,
}: UserCreateProps) {
  const [formData, setFormData] = useState({
    name: "",
    userName: "",
    password: "",
    confirmPassword: "",
    userType: "Admin",
    email: "",
    mobileNumber: "",
  });
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
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
    if (!formData.password) {
      setError("Password is required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
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

    const created: UserItem = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      userName: formData.userName.trim(),
      password: formData.password,
      userType: formData.userType || "Admin",
      email: formData.email.trim(),
      mobileNumber: formData.mobileNumber.trim(),
    };

    onUserCreated(created);

    // Reset Form
    setFormData({
      name: "",
      userName: "",
      password: "",
      confirmPassword: "",
      userType: "Admin",
      email: "",
      mobileNumber: "",
    });
    onClose();
  };

  return (
    <CreateFormModal
      isOpen={isOpen}
      onClose={onClose}
      title="User Create"
      onSubmit={handleSubmit}
      submitText="Submit"
      closeText="Close"
      maxWidth="lg"
    >
      {error && (
        <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600 border border-red-200">
          {error}
        </div>
      )}

      {/* Name */}
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

      {/* User Name */}
      <FormRow label="User Name" required>
        <input
          required
          type="text"
          placeholder="User Name"
          value={formData.userName}
          onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
        />
      </FormRow>

      {/* Password */}
      <FormRow label="Password" required>
        <input
          required
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
        />
      </FormRow>

      {/* Confirm Password */}
      <FormRow label="Confirm Password" required>
        <input
          required
          type="password"
          placeholder="ConfirmPassword"
          value={formData.confirmPassword}
          onChange={(e) =>
            setFormData({ ...formData, confirmPassword: e.target.value })
          }
          className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
        />
      </FormRow>

      {/* User Type */}
      <FormRow label="User Type" required>
        <div className="relative">
          <select
            value={formData.userType}
            onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
            className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#342219] outline-none focus:border-[#8C5835]"
          >
            <option value="Admin">Admin</option>
            <option value="Provider">Provider</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
            ▼
          </span>
        </div>
      </FormRow>

      {/* Email */}
      <FormRow label="Email" required>
        <input
          required
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
        />
      </FormRow>

      {/* Mobile Number */}
      <FormRow label="Mobile Number" required>
        <input
          required
          type="tel"
          placeholder="Mobile Number"
          value={formData.mobileNumber}
          onChange={(e) =>
            setFormData({ ...formData, mobileNumber: e.target.value })
          }
          className="w-full rounded-md border border-gray-200 px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
        />
      </FormRow>
    </CreateFormModal>
  );
}
