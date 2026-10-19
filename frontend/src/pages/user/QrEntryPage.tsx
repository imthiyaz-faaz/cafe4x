import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Lock, QrCode, AlertTriangle, RefreshCw } from "lucide-react";
import Background from "../../components/background";
import { qrApi } from "../../services/qrApi";

/**
 * QrEntryPage
 *
 * Handles the permanent employee QR entry route:
 *   /:shortCode/employee/:permanentToken
 *
 * Flow:
 *   1. Extract permanentToken from URL params (never stored in localStorage)
 *   2. POST /api/qr/session with permanentToken → receive tempToken
 *   3. Immediately redirect to /:shortCode/qrorder/:tempToken
 *   4. If the permanent token is revoked/invalid, show an appropriate error
 *
 * Security:
 *   - permanentToken is read from URL once and immediately sent to backend
 *   - tempToken is placed in the URL for the redirect, never persisted
 *   - No identity info is trusted from the frontend; all resolved server-side
 */
export default function QrEntryPage() {
  const { shortCode, permanentToken } = useParams<{
    shortCode?: string;
    permanentToken?: string;
  }>();
  const navigate = useNavigate();

  type Status = "creating" | "redirecting" | "invalid" | "revoked" | "error";
  const [status, setStatus] = useState<Status>("creating");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState(false);

  const createSessionAndRedirect = async () => {
    if (!permanentToken) {
      setStatus("invalid");
      setErrorMessage("No QR token found in this link.");
      return;
    }

    try {
      const res = await qrApi.createSession(permanentToken);

      if (!res.success || !res.tempToken) {
        // Determine if revoked vs just invalid
        const msg = res.message || "This QR link could not be validated.";
        if (msg.toLowerCase().includes("revoked")) {
          setStatus("revoked");
        } else {
          setStatus("invalid");
        }
        setErrorMessage(msg);
        return;
      }

      setStatus("redirecting");

      // Determine the correct shortCode for the redirect URL
      const effectiveShortCode = shortCode || res.shortCode;
      const targetPath = effectiveShortCode
        ? `/${effectiveShortCode}/qrorder/${res.tempToken}`
        : `/qrorder/${res.tempToken}`;

      // Small delay for UX, then redirect
      setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 300);
    } catch (err: any) {
      const msg = err.message || "Failed to validate QR link.";
      if (msg.toLowerCase().includes("revoked")) {
        setStatus("revoked");
      } else if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("invalid")) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
      setErrorMessage(msg);
    }
  };

  useEffect(() => {
    createSessionAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permanentToken, shortCode]);

  // ── Render: Creating session ──────────────────────────────────────────────
  if (status === "creating" || status === "redirecting") {
    return (
      <Background>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-[#EEE5DC] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#75472D] to-[#9A6747] text-white shadow-lg">
              {status === "redirecting" ? (
                <QrCode size={30} />
              ) : (
                <Lock size={28} className="animate-pulse" />
              )}
            </div>
            <h2 className="mt-5 text-xl font-black text-[#342219]">
              {status === "redirecting" ? "Starting Your Session…" : "Verifying QR Code…"}
            </h2>
            <p className="mt-2 text-sm text-[#8A7667]">
              {status === "redirecting"
                ? "A secure ordering session is ready. Redirecting you now."
                : "Authenticating your permanent QR credential with the server."}
            </p>
            <div className="mt-6 flex justify-center">
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[#F0E6DB]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#75472D] to-[#9A6747] animate-pulse"
                  style={{ width: status === "redirecting" ? "90%" : "55%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </Background>
    );
  }

  // ── Render: Revoked ───────────────────────────────────────────────────────
  if (status === "revoked") {
    return (
      <Background>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm">
              <AlertTriangle size={32} />
            </div>
            <h2 className="mt-5 text-xl font-black text-[#342219]">QR Access Revoked</h2>
            <p className="mt-2 text-sm text-[#8A7667]">
              {errorMessage || "Your QR ordering link has been revoked by an administrator."}
            </p>
            <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-xs text-rose-800">
              <p className="font-semibold">What to do next</p>
              <p className="mt-1 text-[11px] text-rose-700">
                Please contact your Cafe4x administrator to obtain a new QR code. Your old QR code
                cannot be re-activated.
              </p>
            </div>
          </div>
        </div>
      </Background>
    );
  }

  // ── Render: Invalid or general error ─────────────────────────────────────
  return (
    <Background>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#EEE5DC] bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          <h2 className="mt-5 text-xl font-black text-[#342219]">
            {status === "error" ? "Connection Error" : "Invalid QR Link"}
          </h2>
          <p className="mt-2 text-sm text-[#8A7667]">
            {errorMessage || "This QR ordering link is invalid or does not exist."}
          </p>

          {status === "error" && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={async () => {
                setIsRetrying(true);
                setStatus("creating");
                setErrorMessage("");
                await createSessionAndRedirect();
                setIsRetrying(false);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#704225] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5C3620] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={isRetrying ? "animate-spin" : ""} />
              Try Again
            </button>
          )}

          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-xs text-amber-900">
            <p className="font-semibold">Security Notice</p>
            <p className="mt-1 text-[11px] text-amber-800">
              For security reasons, only valid QR codes issued by your administrator can be used.
              Altered or expired QR links are automatically rejected.
            </p>
          </div>
        </div>
      </div>
    </Background>
  );
}
