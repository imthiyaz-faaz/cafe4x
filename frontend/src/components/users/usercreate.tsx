import React, { useState } from "react";
import type { UserItem } from "../../pages/Admin/Userspage";
import CreateFormModal, { FormRow } from "../common/CreateFormModal";
import { validateUserCreation, type UserValidationResult } from "../../utils/validation";
import { userApi } from "../../services/userApi";

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

  const [errors, setErrors] = useState<UserValidationResult["errors"]>({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrors({});
    setGeneralError("");
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");

    // Validate using common validation schema
    const validation = validateUserCreation(formData, { requireConfirmPassword: true });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const createdUser = await userApi.createUser({
        name: formData.name.trim(),
        userName: formData.userName.trim(),
        password: formData.password,
        userType: formData.userType || "Admin",
        email: formData.email.trim(),
        mobileNumber: formData.mobileNumber.trim(),
      });

      onUserCreated({
        ...createdUser,
        mobileNumber: createdUser.mobileNumber || "",
      });

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
      setErrors({});
      setGeneralError("");
      onClose();
    } catch (err: any) {
      console.error("Error creating user:", err);
      if (err?.data?.errors) {
        setErrors(err.data.errors);
      } else {
        const msg = err?.data?.message || err?.message || "Failed to create user. Please try again.";
        if (msg.toLowerCase().includes("email")) {
          setErrors((prev) => ({ ...prev, email: msg }));
        } else if (msg.toLowerCase().includes("username")) {
          setErrors((prev) => ({ ...prev, userName: msg }));
        } else {
          setGeneralError(msg);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CreateFormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="User Create"
      onSubmit={handleSubmit}
      submitText="Submit"
      closeText="Close"
      isSubmitting={isSubmitting}
      maxWidth="lg"
    >
      {generalError && (
        <div className="mb-2 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600 border border-red-200">
          {generalError}
        </div>
      )}

      {/* Name */}
      <FormRow label="Name" required>
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          className={`w-full rounded-md border px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none transition ${
            errors.name
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
              : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-xs font-semibold text-red-500">{errors.name}</p>
        )}
      </FormRow>

      {/* User Name */}
      <FormRow label="User Name" required>
        <input
          type="text"
          placeholder="User Name"
          value={formData.userName}
          onChange={(e) => {
            setFormData({ ...formData, userName: e.target.value });
            if (errors.userName) setErrors((prev) => ({ ...prev, userName: undefined }));
          }}
          className={`w-full rounded-md border px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none transition ${
            errors.userName
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
              : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
          }`}
        />
        {errors.userName && (
          <p className="mt-1 text-xs font-semibold text-red-500">{errors.userName}</p>
        )}
      </FormRow>

      {/* Password */}
      <FormRow label="Password" required>
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => {
            setFormData({ ...formData, password: e.target.value });
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          className={`w-full rounded-md border px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none transition ${
            errors.password
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
              : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
          }`}
        />
        {errors.password && (
          <p className="mt-1 text-xs font-semibold text-red-500">{errors.password}</p>
        )}
      </FormRow>

      {/* Confirm Password */}
      <FormRow label="Confirm Password" required>
        <input
          type="password"
          placeholder="ConfirmPassword"
          value={formData.confirmPassword}
          onChange={(e) => {
            setFormData({ ...formData, confirmPassword: e.target.value });
            if (errors.confirmPassword)
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          className={`w-full rounded-md border px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none transition ${
            errors.confirmPassword
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
              : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
          }`}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs font-semibold text-red-500">
            {errors.confirmPassword}
          </p>
        )}
      </FormRow>

      {/* User Type */}
      <FormRow label="User Type" required>
        <div className="relative">
          <select
            value={formData.userType}
            onChange={(e) => {
              setFormData({ ...formData, userType: e.target.value });
              if (errors.userType) setErrors((prev) => ({ ...prev, userType: undefined }));
            }}
            className={`w-full appearance-none rounded-md border bg-white px-3.5 py-2 text-xs font-semibold text-[#342219] outline-none transition ${
              errors.userType
                ? "border-red-500 focus:border-red-500"
                : "border-gray-200 focus:border-[#8C5835]"
            }`}
          >
            <option value="Admin">Admin</option>
            <option value="Provider">Provider</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
            ▼
          </span>
        </div>
        {errors.userType && (
          <p className="mt-1 text-xs font-semibold text-red-500">{errors.userType}</p>
        )}
      </FormRow>

      {/* Email */}
      <FormRow label="Email" required>
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => {
            setFormData({ ...formData, email: e.target.value });
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          className={`w-full rounded-md border px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none transition ${
            errors.email
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
              : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-xs font-semibold text-red-500">{errors.email}</p>
        )}
      </FormRow>

      {/* Mobile Number */}
      <FormRow label="Mobile Number" required>
        <input
          type="tel"
          placeholder="Mobile Number"
          value={formData.mobileNumber}
          onChange={(e) => {
            setFormData({ ...formData, mobileNumber: e.target.value });
            if (errors.mobileNumber)
              setErrors((prev) => ({ ...prev, mobileNumber: undefined }));
          }}
          className={`w-full rounded-md border px-3.5 py-2 text-[#342219] placeholder-gray-400 outline-none transition ${
            errors.mobileNumber
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
              : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
          }`}
        />
        {errors.mobileNumber && (
          <p className="mt-1 text-xs font-semibold text-red-500">
            {errors.mobileNumber}
          </p>
        )}
      </FormRow>
    </CreateFormModal>
  );
}
