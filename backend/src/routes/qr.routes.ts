import { Hono } from "hono";
import { qrSessionController } from "../controllers/qr-session.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const qrRoutes = new Hono();

// ── Public endpoints ─────────────────────────────────────────────────────────
// POST /api/qr/session  — validate permanent token, create temporary session
qrRoutes.post("/session", qrSessionController.createSession);

// POST /api/qr/seat-session — validate seat & employee, create temporary session
qrRoutes.post("/seat-session", qrSessionController.createSeatSession);

// GET /api/qr/validate/:tempToken  — validate a temporary ordering session
qrRoutes.get("/validate/:tempToken", qrSessionController.validateSession);

// ── Admin-only endpoints ─────────────────────────────────────────────────────
// POST /api/qr/provision/:userId  — provision permanent QR for an employee
qrRoutes.post("/provision/:userId", requireAuth, requireRole("Admin"), qrSessionController.provisionPermanentToken);

// POST /api/qr/revoke/:userId  — revoke permanent QR credential
qrRoutes.post("/revoke/:userId", requireAuth, requireRole("Admin"), qrSessionController.revokePermanentToken);

// POST /api/qr/session/:sessionId/revoke  — revoke a specific session
qrRoutes.post("/session/:sessionId/revoke", requireAuth, requireRole("Admin"), qrSessionController.revokeSession);

// GET /api/qr/sessions  — list recent sessions (admin)
qrRoutes.get("/sessions", requireAuth, requireRole("Admin"), qrSessionController.listSessions);

export default qrRoutes;
