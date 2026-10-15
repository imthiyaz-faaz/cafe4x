import React from "react";
import { X, Check } from "lucide-react";

export interface CreateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitText?: string;
  closeText?: string;
  isSubmitting?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export interface FormRowProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  labelAlign?: "center" | "top";
}

/**
 * Reusable Form Row adhering to the 12-column grid layout:
 * - Left label (col-span-3, font-bold text-[#342219])
 * - Right input / controls (col-span-9)
 */
export function FormRow({
  label,
  required = false,
  children,
  labelAlign = "center",
}: FormRowProps) {
  return (
    <div
      className={`grid grid-cols-12 gap-3 ${
        labelAlign === "top" ? "items-start pt-1" : "items-center"
      }`}
    >
      <label
        className={`col-span-3 font-bold text-[#342219] ${
          labelAlign === "top" ? "pt-1.5" : ""
        }`}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="col-span-9">{children}</div>
    </div>
  );
}

/**
 * Standard Create Form Modal Component
 * Matches the design aesthetics of Item Create:
 * - Clean white card with rounded-3xl border and soft shadow
 * - Top title with clean right X close button
 * - Form rows in 12-column layout
 * - Bottom action buttons: Green outline Submit (✓) & Red solid Close (✕)
 */
export default function CreateFormModal({
  isOpen,
  onClose,
  title,
  onSubmit,
  children,
  submitText = "Submit",
  closeText = "Close",
  isSubmitting = false,
  maxWidth = "lg",
}: CreateFormModalProps) {
  if (!isOpen) return null;

  const maxWidthClass =
    maxWidth === "sm"
      ? "max-w-sm"
      : maxWidth === "md"
      ? "max-w-md"
      : maxWidth === "xl"
      ? "max-w-2xl"
      : "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`relative w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-2xl`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 mb-5">
          <h3 className="text-xl font-bold text-[#342219] tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:text-gray-700 transition cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          {children}

          {/* Action Buttons: Green Submit (✓) & Red Close (✕) */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg border border-[#28A745] bg-white px-6 py-2 text-xs font-bold text-[#28A745] transition hover:bg-[#28A745] hover:text-white cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Check size={14} className="stroke-[2.5]" />
              <span>{isSubmitting ? "Submitting..." : submitText}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-[#DC3545] px-6 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#C82333] cursor-pointer disabled:opacity-50"
            >
              <X size={14} className="stroke-[2.5]" />
              <span>{closeText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
