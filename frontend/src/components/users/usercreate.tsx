import React, { useState, useRef, useEffect } from "react";
import { Loader2, CheckCircle2, MapPin, Check, X, Search, ChevronDown } from "lucide-react";
import type { UserItem } from "../../pages/Admin/Userspage";
import CreateFormModal, { FormRow } from "../common/CreateFormModal";
import { validateUserCreation, validateEmailFormat, type UserValidationResult } from "../../utils/validation";
import { userApi } from "../../services/userApi";
import { locationApi, type LocationItem } from "../../services/locations";

interface UserCreateProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (newUser: UserItem) => void;
  shortCode?: string | null;
}

export default function UserCreate({
  isOpen,
  onClose,
  onUserCreated,
  shortCode,
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

  // Available locations for assignment when userType is Provider
  const [availableLocations, setAvailableLocations] = useState<LocationItem[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement | null>(null);

  const [errors, setErrors] = useState<UserValidationResult["errors"]>({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const usernameTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch available locations when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingLocations(true);
    locationApi
      .getLocations(undefined, shortCode || undefined)
      .then((locs) => {
        if (!isMounted) return;
        setAvailableLocations(Array.isArray(locs) ? locs : []);
      })
      .catch((err) => {
        console.warn("Could not fetch locations for assignment:", err);
        if (isMounted) setAvailableLocations([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLocations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, shortCode]);

  // Click outside listener for location dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        locationDropdownRef.current &&
        !locationDropdownRef.current.contains(e.target as Node)
      ) {
        setIsLocationDropdownOpen(false);
      }
    };
    if (isLocationDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLocationDropdownOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setErrors({});
    setGeneralError("");
    setIsSubmitting(false);
    setUsernameChecking(false);
    setUsernameAvailable(null);
    setSelectedLocationIds([]);
    setIsLocationDropdownOpen(false);
    setLocationSearchQuery("");
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

      // 4. If creating a Provider and locations were selected, assign them via existing API
      if (
        (formData.userType || "").toLowerCase() === "provider" &&
        selectedLocationIds.length > 0 &&
        createdUser?.id
      ) {
        try {
          const assignPromises = selectedLocationIds.map(async (locId) => {
            // Fetch current providers for this location
            const existingLoc = availableLocations.find((l) => String(l.id) === String(locId));
            const existingProviderIds = (existingLoc?.assignedProviders || [])
              .map((p) => p.id)
              .filter(Boolean);

            const mergedProviderIds = Array.from(
              new Set([...existingProviderIds, createdUser.id])
            );

            return locationApi.assignProvider(locId, {
              providerIds: mergedProviderIds,
              assignedProviderId: mergedProviderIds[0],
              assignedProviderName:
                mergedProviderIds[0] === createdUser.id
                  ? createdUser.name
                  : existingLoc?.assignedProviderName,
              assignedProviderEmail:
                mergedProviderIds[0] === createdUser.id
                  ? createdUser.email
                  : existingLoc?.assignedProviderEmail,
            });
          });

          await Promise.all(assignPromises);
        } catch (assignErr) {
          console.warn("Could not assign locations during provider creation:", assignErr);
        }
      }

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
      setSelectedLocationIds([]);
      setIsLocationDropdownOpen(false);
      setLocationSearchQuery("");
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
              const nextType = e.target.value;
              setFormData((prev) => ({ ...prev, userType: nextType }));
              if (errors.userType) setErrors((prev) => ({ ...prev, userType: undefined }));
              if (nextType !== "Provider") {
                setSelectedLocationIds([]);
              }
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

      {/* Locations Assignment (Only shown when User Type is Provider) */}
      {(formData.userType || "").toLowerCase() === "provider" && (
        <FormRow label="Assign Locations" labelAlign="top">
          <div className="relative w-full" ref={locationDropdownRef}>
            {/* Trigger Button */}
            <button
              type="button"
              onClick={() => setIsLocationDropdownOpen((prev) => !prev)}
              className="w-full flex items-center justify-between rounded-md border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#342219] outline-none transition hover:border-[#8C5835] focus:border-[#8C5835] cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin size={14} className="text-[#8C5835] shrink-0" />
                <span className="truncate">
                  {selectedLocationIds.length === 0
                    ? "Select locations (optional)..."
                    : `${selectedLocationIds.length} location(s) selected`}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-500 transition-transform ${
                  isLocationDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Selected Location Badges */}
            {selectedLocationIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedLocationIds.map((locId) => {
                  const loc = availableLocations.find((l) => String(l.id) === String(locId));
                  return (
                    <span
                      key={locId}
                      className="inline-flex items-center gap-1 rounded-md border border-[#EAD7C8] bg-[#FAF3EB] px-2 py-0.5 text-[11px] font-semibold text-[#704225]"
                    >
                      <span>{loc?.name || `Location ${locId}`}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLocationIds((prev) => prev.filter((id) => id !== locId));
                        }}
                        className="rounded-full p-0.5 text-[#8A7667] hover:bg-[#EAD7C8] hover:text-[#2B180D] transition cursor-pointer"
                      >
                        <X size={10} className="stroke-[2.5]" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Dropdown Menu */}
            {isLocationDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-[#DEC5B0]/80 bg-white p-3 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
                {/* Search Bar */}
                <div className="relative mb-2">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A08C7D]"
                  />
                  <input
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full rounded-lg border border-[#E8DED4] bg-[#FAF8F5]/80 py-1.5 pl-8 pr-2.5 text-xs text-[#342219] placeholder:text-[#A08C7D] outline-none focus:border-[#8C5835] focus:bg-white"
                  />
                </div>

                {/* Locations list */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {isLoadingLocations ? (
                    <div className="py-4 text-center text-xs text-[#8A7667] flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin text-[#8C5835]" />
                      <span>Loading locations...</span>
                    </div>
                  ) : availableLocations.length === 0 ? (
                    <p className="py-3 text-center text-xs text-[#8A7667]">
                      No locations found in this organization.
                    </p>
                  ) : (
                    availableLocations
                      .filter((l) => {
                        const q = locationSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          l.name.toLowerCase().includes(q) ||
                          (l.displayId && l.displayId.toLowerCase().includes(q))
                        );
                      })
                      .map((loc) => {
                        const isSelected = selectedLocationIds.includes(String(loc.id));
                        return (
                          <div
                            key={loc.id}
                            onClick={() => {
                              const sId = String(loc.id);
                              setSelectedLocationIds((prev) =>
                                prev.includes(sId)
                                  ? prev.filter((id) => id !== sId)
                                  : [...prev, sId]
                              );
                            }}
                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition ${
                              isSelected
                                ? "bg-[#FAF3EB] text-[#75472D]"
                                : "hover:bg-[#FAF8F5] text-[#342219]"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  isSelected
                                    ? "border-[#75472D] bg-[#75472D] text-white"
                                    : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check size={11} className="stroke-[3]" />}
                              </div>
                              <span className="truncate">{loc.name}</span>
                            </div>
                            <span className="text-[10px] text-[#8A7667] shrink-0">
                              {loc.totalSeats || 0} seats
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        </FormRow>
      )}

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
