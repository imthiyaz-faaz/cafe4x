import { Hono } from "hono";
import { qrSessionController } from "../controllers/qr-session.controller";

const qrRoutes = new Hono();

// ── Public endpoints ─────────────────────────────────────────────────────────
// POST /api/qr/session  — validate permanent token, create temporary session
qrRoutes.post("/session", qrSessionController.createSession);

// GET /api/qr/validate/:tempToken  — validate a temporary ordering session
qrRoutes.get("/validate/:tempToken", qrSessionController.validateSession);

// ── Admin-only endpoints ─────────────────────────────────────────────────────
// POST /api/qr/provision/:userId  — provision permanent QR for an employee
qrRoutes.post("/provision/:userId", qrSessionController.provisionPermanentToken);

// POST /api/qr/revoke/:userId  — revoke permanent QR credential
qrRoutes.post("/revoke/:userId", qrSessionController.revokePermanentToken);

// POST /api/qr/session/:sessionId/revoke  — revoke a specific session
qrRoutes.post("/session/:sessionId/revoke", qrSessionController.revokeSession);

// GET /api/qr/sessions  — list recent sessions (admin)
qrRoutes.get("/sessions", qrSessionController.listSessions);

export default qrRoutes;
