import React, { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  User,
  ShieldAlert,
  ArrowRightLeft,
  UserPlus,
  Trash2,
  ExternalLink,
  Copy,
  Download,
  Check,
  QrCode,
} from "lucide-react";
import type { SeatItem } from "../../services/tableService";

interface SeatDetailPanelProps {
  seat: SeatItem | null;
  tableName: string;
  locationName?: string;
  shortCode?: string;
  onClose: () => void;
  onAssignEmployee: (seat: SeatItem) => void;
  onChangeEmployee: (seat: SeatItem) => void;
  onTransferSeat?: (seat: SeatItem) => void;
  onUnassignSeat: (seat: SeatItem) => void;
  onToggleStatus: (seat: SeatItem) => void;
  onViewEmployeeFullModal?: (seat: SeatItem) => void;
}

export const SeatDetailPanel: React.FC<SeatDetailPanelProps> = ({
  seat,
  tableName,
  locationName: _locationName,
  shortCode = "FTS",
  onClose,
  onAssignEmployee,
  onChangeEmployee,
  onTransferSeat: _onTransferSeat,
  onUnassignSeat,
  onToggleStatus,
  onViewEmployeeFullModal: _onViewEmployeeFullModal,
}) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!seat) {
    return null;
  }

  const isOccupied =
    seat.status === "occupied" ||
    Boolean(seat.employeeName && seat.employeeName.trim().length > 0) ||
    Boolean(seat.employeeEmail && seat.employeeEmail.trim().length > 0);
  const isBlocked = seat.status === "blocked";

  // Build full ordering URL pointing to employee's unique ordering page
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const relativeUrl = seat.orderUrl || (seat.qrToken ? `/${shortCode}/order/${seat.qrToken}` : "");
  const fullOrderUrl = relativeUrl ? `${origin}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}` : "";

  const handleCopyUrl = async () => {
    if (!fullOrderUrl) return;
    try {
      await navigator.clipboard.writeText(fullOrderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenOrderingPage = () => {
    if (!fullOrderUrl) return;
    window.open(fullOrderUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 300;
    canvas.height = 300;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        const safeName = (seat.employeeName || "Employee").replace(/\s+/g, "_");
        downloadLink.download = `QR_${safeName}_Seat_${seat.number}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="rounded-3xl border border-[#EEE5DC] bg-white/95 p-5 sm:p-6 shadow-sm backdrop-blur-md flex flex-col justify-between h-full space-y-6">
      {/* Panel Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-[#EEE5DC]">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                isBlocked
                  ? "bg-rose-100 text-rose-700"
                  : isOccupied
                  ? "bg-[#D1F7DE] text-[#0E7A38]"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {isBlocked ? <ShieldAlert className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-[#342219]">Seat {seat.number}</h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isBlocked
                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                    : isOccupied
                    ? "bg-[#D1F2D9] text-[#0E7A38] border border-[#A7E5B5]"
                    : "bg-stone-100 text-stone-600 border border-stone-200"
                }`}
              >
                {isBlocked ? "Blocked" : isOccupied ? "Occupied" : "Available"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF6F1] text-[#70452D] hover:bg-[#F0E6DC] flex items-center justify-center transition cursor-pointer"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content depending on seat status */}
        <div className="pt-4 space-y-5">
          {/* CASE 1: OCCUPIED SEAT */}
          {isOccupied && (
            <div className="space-y-4">
              {/* 1. EMPLOYEE DETAILS (Name and Email ONLY) */}
              <div>
                <div className="flex items-center gap-2 text-xs font-black text-[#342219] uppercase tracking-wider mb-2.5">
                  <User className="w-3.5 h-3.5 text-[#70452D]" />
                  <span>Employee Details</span>
                </div>

                <div className="space-y-2 text-xs bg-[#FAF8F5] border border-[#EEE5DC] rounded-2xl p-3.5">
                  <div className="flex items-center justify-between py-1 border-b border-[#FAF0E6]">
                    <span className="text-[#8A7667] flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-[#BBA697]" />
                      <span>Name</span>
                    </span>
                    <span className="font-bold text-[#342219] text-right truncate max-w-[200px]">
                      {seat.employeeName || "Assigned Employee"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#8A7667] flex items-center gap-1.5 font-medium">
                      <span className="text-xs">✉</span>
                      <span>Email</span>
                    </span>
                    <span className="font-medium text-[#70452D] text-right truncate max-w-[200px]">
                      {seat.employeeEmail || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. EMPLOYEE ORDERING QR CODE SECTION */}
              <div className="rounded-2xl border border-[#EEE5DC] bg-[#FAF8F5] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#342219] uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#70452D]" />
                    <span>Employee Ordering QR</span>
                  </span>
                  <span className="text-[10px] font-bold text-[#0E7A38] bg-[#D1F2D9] px-2 py-0.5 rounded-full border border-[#A7E5B5]">
                    Active
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="flex justify-center py-2">
                  <div
                    ref={qrRef}
                    className="p-3 bg-white border border-[#EEDBCE] rounded-2xl shadow-xs inline-flex items-center justify-center"
                  >
                    {fullOrderUrl ? (
                      <QRCodeSVG
                        value={fullOrderUrl}
                        size={140}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="w-[140px] h-[140px] bg-stone-100 flex items-center justify-center text-xs text-stone-400">
                        Generating QR...
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Download QR & Copy URL */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-[#EEE5DC] text-[#342219] text-xs font-bold hover:bg-[#FAF6F1] transition shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8C5835]" />
                    <span>Download QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-[#EEE5DC] text-[#342219] text-xs font-bold hover:bg-[#FAF6F1] transition shadow-2xs cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#8C5835]" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Open Ordering Page Button */}
                <button
                  type="button"
                  onClick={handleOpenOrderingPage}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#70452D] text-white text-xs font-bold hover:bg-[#5C3824] transition shadow-2xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Ordering Page</span>
                </button>

                {/* Ordering URL Display */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-[#8A7667] uppercase block mb-1">
                    Ordering URL:
                  </span>
                  <div className="p-2 bg-white border border-[#E8DED4] rounded-xl text-[11px] font-mono text-[#70452D] break-all select-all">
                    {fullOrderUrl || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CASE 2: AVAILABLE SEAT */}
          {!isOccupied && !isBlocked && (
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8A7667]">Table:</span>
                  <span className="font-bold text-[#342219]">{tableName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A7667]">Seat Identifier:</span>
                  <span className="font-mono text-[#70452D] font-bold">SEAT-{seat.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A7667]">Status:</span>
                  <span className="font-bold text-stone-600">Ready for Assignment</span>
                </div>
              </div>

              <p className="text-xs text-[#8A7667] leading-relaxed">
                This seat is currently available. You can assign an employee from your organization to this seat.
              </p>
            </div>
          )}

          {/* CASE 3: BLOCKED SEAT */}
          {isBlocked && (
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-rose-700">Seat Number:</span>
                  <span className="font-bold text-rose-900">Seat {seat.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700">Status:</span>
                  <span className="font-bold text-rose-900">Blocked</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700">Reason:</span>
                  <span className="font-medium text-rose-800">Seat temporarily disabled by administrator</span>
                </div>
              </div>

              <p className="text-xs text-[#8A7667] leading-relaxed">
                Employees cannot be assigned to or place orders from this seat while it is blocked.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons matching screenshot */}
      <div className="pt-4 border-t border-[#EEE5DC]">
        {isOccupied ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeEmployee(seat)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-[#EEE5DC] bg-white text-xs font-bold text-[#342219] hover:bg-[#FAF6F1] shadow-2xs transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#70452D]" />
              <span>Change Employee</span>
            </button>

            <button
              type="button"
              onClick={() => onUnassignSeat(seat)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-rose-200 bg-white text-xs font-bold text-rose-600 hover:bg-rose-50 shadow-2xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Assignment</span>
            </button>
          </div>
        ) : isBlocked ? (
          <button
            type="button"
            onClick={() => onToggleStatus(seat)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-2xs transition cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Unblock Seat</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAssignEmployee(seat)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl bg-[#70452D] text-white text-xs font-bold hover:bg-[#5C3824] shadow-2xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign Employee</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleStatus(seat)}
              className="inline-flex items-center justify-center py-2.5 px-3.5 rounded-2xl border border-rose-200 bg-white text-xs font-bold text-rose-600 hover:bg-rose-50 shadow-2xs transition cursor-pointer"
              title="Block Seat"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Block</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatDetailPanel;
