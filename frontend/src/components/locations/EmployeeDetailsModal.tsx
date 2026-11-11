import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Download,
  Copy,
  ExternalLink,
  Printer,
  Share2,
  Check,
  RotateCw,
  ArrowRightLeft,
  UserMinus,
  Edit2,
  AlertCircle,
} from "lucide-react";
import { tableService, type EmployeeSeatProfileDetails, type SeatItem } from "../../services/tableService";

interface EmployeeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatId: string | null;
  onEditAssignment?: (seat: SeatItem) => void;
  onTransferSeat?: (seat: SeatItem) => void;
  onUnassignSeat?: (seat: SeatItem) => void;
}

export const EmployeeDetailsModal: React.FC<EmployeeDetailsModalProps> = ({
  isOpen,
  onClose,
  seatId,
  onEditAssignment,
  onTransferSeat,
  onUnassignSeat,
}) => {
  const [details, setDetails] = useState<EmployeeSeatProfileDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !seatId) return;
    setIsLoading(true);
    setError(null);

    tableService
      .getSeatDetails(seatId)
      .then((data) => {
        setDetails(data);
      })
      .catch((err) => {
        console.error("Failed to load employee seat details:", err);
        setError(err?.response?.data?.message || err?.message || "Failed to load employee details.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, seatId]);

  if (!isOpen) return null;

  // Build full ordering URL
  const origin = typeof window !== "undefined" ? window.location.origin : "https://preview.cafe4x.com";
  const relativeUrl = details?.orderUrl || (details?.qrToken ? `/${details.shortCode || "FTS"}/order/${details.qrToken}` : "");
  const fullOrderUrl = relativeUrl ? `${origin}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}` : "";

  // Actions
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

  const handleShareUrl = async () => {
    if (!fullOrderUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${details?.employeeName || "Employee"} Ordering Link`,
          text: `Scan or click to order from Cafe4x:`,
          url: fullOrderUrl,
        });
      } catch {}
    } else {
      handleCopyUrl();
    }
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
        downloadLink.download = `QR_${details?.employeeName?.replace(/\s+/g, "_") || "Employee"}_Seat_${details?.seatNumber}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintQr = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR - ${details?.employeeName || "Employee"}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; color: #342219; }
            .card { border: 2px solid #EBE4DC; border-radius: 24px; padding: 30px; display: inline-block; max-width: 360px; }
            h2 { margin: 0 0 5px 0; font-size: 22px; }
            p { margin: 4px 0; color: #70452D; font-size: 14px; }
            .seat-tag { background: #FAF6F1; border: 1px solid #EADBCE; border-radius: 8px; padding: 4px 12px; font-weight: bold; margin-top: 10px; display: inline-block; }
            .qr-box { margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>${details?.employeeName || "Employee"}</h2>
            <p>${details?.employeeEmail || details?.employeeId || ""}</p>
            <div class="seat-tag">${details?.tableName} • Seat ${details?.seatNumber}</div>
            <div class="qr-box">
              ${qrRef.current?.innerHTML || ""}
            </div>
            <p style="font-size: 11px; color: #8A7667;">Scan QR code to open your employee ordering page</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Convert details into a SeatItem for parent modal handlers
  const seatItemEquivalent: SeatItem = {
    id: details?.seatId || seatId || "",
    tableId: details?.tableId || 0,
    locationId: details?.locationId || 0,
    number: details?.seatNumber || 0,
    status: (details?.seatStatus as any) || "occupied",
    employeeId: details?.employeeId,
    employeeName: details?.employeeName,
    employeeEmail: details?.employeeEmail,
    employeeUserName: details?.employeeUserName,
    employeeStatus: details?.employeeRole,
    qrToken: details?.qrToken,
    orderUrl: details?.orderUrl,
  };

  const initials = (details?.employeeName || "EA")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 transition-all">
      <div className="w-full max-w-2xl bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#EBE4DC] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-white/95 px-6 py-4 border-b border-[#EEE5DC] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF0E6] text-[#70452D] flex items-center justify-center font-bold text-sm shadow-xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[#342219]">
                  {details?.employeeName || "Employee Details"}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D1F2D9] text-[#0E7A38] border border-[#A7E5B5]">
                  Active
                </span>
              </div>
              <p className="text-xs text-[#8A7667]">
                {details?.tableName} &bull; Seat {details?.seatNumber} ({details?.seatIdentifier})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5EFE9] text-[#70452D] hover:bg-[#EADFD5] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="py-24 text-center">
            <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C5835] mb-3" />
            <p className="text-xs text-[#8A7667] font-medium">Loading employee information...</p>
          </div>
        ) : error || !details ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-[#342219]">Could not load employee details</h3>
            <p className="text-xs text-[#8A7667] mt-1">{error || "Seat details not found."}</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            
            {/* Section 1: Employee & Seat Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profile Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#EEE5DC] shadow-2xs space-y-2.5">
                <span className="text-[11px] font-black uppercase text-[#8C5835] tracking-wider block">
                  Employee Profile
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#FAF6F1]">
                    <span className="text-[#8A7667]">Full Name:</span>
                    <span className="font-bold text-[#342219]">{details.employeeName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#FAF6F1]">
                    <span className="text-[#8A7667]">Email:</span>
                    <span className="font-medium text-[#70452D] truncate max-w-[160px]">{details.employeeEmail || "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#FAF6F1]">
                    <span className="text-[#8A7667]">Employee ID:</span>
                    <span className="font-mono text-[#342219] font-bold">{details.employeeId || "—"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#8A7667]">Role:</span>
                    <span className="font-medium text-[#342219]">{details.employeeRole || "Employee"}</span>
                  </div>
                </div>
              </div>

              {/* Assignment Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#EEE5DC] shadow-2xs space-y-2.5">
                <span className="text-[11px] font-black uppercase text-[#8C5835] tracking-wider block">
                  Location & Seat
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#FAF6F1]">
                    <span className="text-[#8A7667]">Location:</span>
                    <span className="font-bold text-[#342219]">{details.locationName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#FAF6F1]">
                    <span className="text-[#8A7667]">Table:</span>
                    <span className="font-bold text-[#8C5835]">{details.tableName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#FAF6F1]">
                    <span className="text-[#8A7667]">Seat:</span>
                    <span className="font-bold text-[#0E7A38]">Seat {details.seatNumber}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#8A7667]">Assigned At:</span>
                    <span className="font-medium text-[#8A7667]">
                      {details.assignmentDate ? new Date(details.assignmentDate).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: QR Code & Ordering URL Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#EEE5DC] shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase text-[#8C5835] tracking-wider block">
                  Employee Ordering QR & Link
                </span>
                <span className="text-[11px] font-bold text-[#0E7A38] bg-[#D1F2D9] px-2 py-0.5 rounded-md border border-[#A7E5B5]">
                  Instant Ordering Enabled
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Visual QR Container */}
                <div
                  ref={qrRef}
                  className="p-3 bg-white border-2 border-[#EEDBCE] rounded-2xl shadow-xs shrink-0 flex items-center justify-center"
                >
                  {fullOrderUrl ? (
                    <QRCodeSVG
                      value={fullOrderUrl}
                      size={130}
                      level="M"
                      includeMargin={false}
                    />
                  ) : (
                    <div className="w-[130px] h-[130px] bg-stone-100 flex items-center justify-center text-xs text-stone-400">
                      Generating QR...
                    </div>
                  )}
                </div>

                {/* QR Actions & URL Box */}
                <div className="flex-1 w-full space-y-3 min-w-0">
                  <div>
                    <label className="text-[11px] font-bold text-[#8A7667] block mb-1">
                      Ordering Page URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={fullOrderUrl}
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E8DED4] rounded-xl text-xs font-mono text-[#342219] select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="p-2 rounded-xl bg-[#FAF0E6] text-[#70452D] hover:bg-[#F0E2D5] transition shrink-0 cursor-pointer"
                        title="Copy Ordering URL"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons Bar */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleOpenOrderingPage}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#70452D] text-white text-xs font-bold hover:bg-[#5C3824] transition shadow-2xs cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Ordering Page</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#EEE5DC] text-[#342219] text-xs font-bold hover:bg-[#FAF6F1] transition shadow-2xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#8C5835]" />
                      <span>Download PNG</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintQr}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#EEE5DC] text-[#342219] text-xs font-bold hover:bg-[#FAF6F1] transition shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#8C5835]" />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#EEE5DC] text-[#342219] text-xs font-bold hover:bg-[#FAF6F1] transition shadow-2xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#8C5835]" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Employee Actions Footer Bar */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#EEE5DC] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {onEditAssignment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditAssignment(seatItemEquivalent);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#EEE5DC] text-xs font-bold text-[#342219] hover:bg-[#F5EFE9] transition shadow-2xs cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#70452D]" />
                    <span>Edit Profile</span>
                  </button>
                )}

                {onTransferSeat && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTransferSeat(seatItemEquivalent);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#EEE5DC] text-xs font-bold text-[#8C5835] hover:bg-[#F5EFE9] transition shadow-2xs cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Change Seat</span>
                  </button>
                )}

                {onUnassignSeat && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUnassignSeat(seatItemEquivalent);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50 transition shadow-2xs cursor-pointer"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Remove Assignment</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-[#70452D] text-white text-xs font-bold hover:bg-[#5C3824] transition shadow-2xs cursor-pointer ml-auto"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetailsModal;
