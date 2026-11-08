import React, { useState, useRef } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { UserItem } from "../../pages/Admin/Userspage";
import CreateFormModal, { FormRow } from "../common/CreateFormModal";
import { validateUserCreation, validateEmailFormat, type UserValidationResult } from "../../utils/validation";
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
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const usernameTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setErrors({});
    setGeneralError("");
    setIsSubmitting(false);
    setUsernameChecking(false);
    setUsernameAvailable(null);
    onClose();
  };

  // Perform debounced username availability check
  const checkUsernameAvailability = async (rawVal: string) => {
    const val = rawVal.trim();
    if (!val) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      return;
    }

    if (val.length < 3) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      setErrors((prev) => ({
        ...prev,
        userName: "Username must be at least 3 characters long",
      }));
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setUsernameChecking(true);
    try {
      const res = await userApi.checkUsername(val, undefined, controller.signal);
      if (!res.available) {
        setUsernameAvailable(false);
        setErrors((prev) => ({
          ...prev,
          userName: "This username is already taken. Please choose another username.",
        }));
      } else {
        setUsernameAvailable(true);
        setErrors((prev) => ({ ...prev, userName: undefined }));
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.name === "CanceledError") {
        return; // Ignore canceled requests
      }
      setUsernameAvailable(null);
      setErrors((prev) => ({
        ...prev,
        userName: err?.message || "Unable to verify username availability.",
      }));
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
    if (errors.userName) setErrors((prev) => ({ ...prev, userName: undefined }));

    if (usernameTimerRef.current) {
      clearTimeout(usernameTimerRef.current);
    }

    const trimmed = nextVal.trim();
    if (!trimmed) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      return;
    }

    setUsernameChecking(true);
    usernameTimerRef.current = setTimeout(() => {
      checkUsernameAvailability(trimmed);
    }, 450);
  };

  // Real-time onBlur validation for Username
  const handleUserNameBlur = async () => {
    const val = formData.userName.trim();
    if (!val) {
      setErrors((prev) => ({ ...prev, userName: "User Name is required" }));
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    if (val.length < 3) {
      setErrors((prev) => ({ ...prev, userName: "Username must be at least 3 characters long" }));
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }

    if (usernameTimerRef.current) {
      clearTimeout(usernameTimerRef.current);
    }
    await checkUsernameAvailability(val);
  };

  // Real-time onBlur validation for Email
  const handleEmailBlur = async () => {
    const val = formData.email.trim();
    if (!val) {
      setErrors((prev) => ({ ...prev, email: "Email is required" }));
      return;
    }
    if (!validateEmailFormat(val)) {
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      return;
    }

    try {
      const res = await userApi.checkEmail(val);
      if (!res.available) {
        setErrors((prev) => ({
          ...prev,
          email: "This email address is already registered. Please use another email.",
        }));
      } else {
        setErrors((prev) => ({ ...prev, email: undefined }));
      }
    } catch {
      // Ignore background network errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setGeneralError("");

    // 1. Validate fields format using common validation schema
    const validation = validateUserCreation(formData, { requireConfirmPassword: true });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Validate username and email availability before creating
      const [usernameRes, emailRes] = await Promise.all([
        userApi.checkUsername(formData.userName.trim()),
        userApi.checkEmail(formData.email.trim()),
      ]);

      const duplicateErrors: UserValidationResult["errors"] = {};
      if (!usernameRes.available) {
        duplicateErrors.userName = "This username is already taken. Please choose another username.";
      }
      if (!emailRes.available) {
        duplicateErrors.email = "This email address is already registered. Please use another email.";
      }

      if (Object.keys(duplicateErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...duplicateErrors }));
        setIsSubmitting(false);
        return;
      }

      // 3. Create user via API
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

      // Reset Form & close on success
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
      const errData = err?.data;
      if (errData?.errors) {
        setErrors((prev) => ({ ...prev, ...errData.errors }));
      } else {
        const msg = String(errData?.message || err?.message || "");
        const lower = msg.toLowerCase();
        if (lower.includes("username") || lower.includes("user_name")) {
          setErrors((prev) => ({
            ...prev,
            userName: "This username is already taken. Please choose another username.",
          }));
        } else if (lower.includes("email")) {
          setErrors((prev) => ({
            ...prev,
            email: "This email address is already registered. Please use another email.",
          }));
        } else if (
          !lower.includes("d1_error") &&
          !lower.includes("sqlite") &&
          !lower.includes("unique constraint")
        ) {
          setGeneralError(msg || "Failed to create user. Please try again.");
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
      isSubmitting={isSubmitting || usernameChecking || usernameAvailable === false}
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
            setFormData((prev) => ({ ...prev, name: e.target.value }));
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
        <div className="relative w-full">
          <input
            type="text"
            placeholder="User Name"
            value={formData.userName}
            onBlur={handleUserNameBlur}
            onChange={handleUserNameChange}
            className={`w-full rounded-md border px-3.5 py-2 pr-9 text-[#342219] placeholder-gray-400 outline-none transition ${
              errors.userName
                ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                : usernameAvailable === true
                ? "border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                : "border-gray-200 focus:border-[#8C5835] focus:ring-1 focus:ring-[#8C5835]/20"
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
          <p className="mt-1 text-xs font-medium text-[#8C5835] flex items-center gap-1.5">
            <span>Checking username availability...</span>
          </p>
        ) : errors.userName ? (
          <p className="mt-1 text-xs font-semibold text-red-500">{errors.userName}</p>
        ) : usernameAvailable === true ? (
          <p className="mt-1 text-xs font-semibold text-emerald-600">Username is available.</p>
        ) : null}
      </FormRow>

      {/* Password */}
      <FormRow label="Password" required>
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, password: e.target.value }));
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
            setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }));
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
              setFormData((prev) => ({ ...prev, userType: e.target.value }));
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
          onBlur={handleEmailBlur}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, email: e.target.value }));
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
            setFormData((prev) => ({ ...prev, mobileNumber: e.target.value }));
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
