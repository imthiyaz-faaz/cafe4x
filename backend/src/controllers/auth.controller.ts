import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { getNextId, generateId, hashPassword, verifyPassword, sha256Hex } from "../utils/id-generator";
import { getAuthUser } from "../middleware/auth.middleware";
import { validateEmailFormat, validateAndNormalizeMobile } from "../utils/validation";
import { isSupportedCurrency, DEFAULT_CURRENCY } from "../utils/currencies";

export interface UserModel {
  id: string;
  displayId?: string;
  name: string;
  userName: string;
  password?: string;
  userType: "Admin" | "Provider" | "Staff";
  email: string;
  mobileNumber?: string;
  organization?: string;
  shortCode?: string;
  currency?: string;
  currencyCode?: string;
  organizationId?: string;
  createdAt: string;
}

export const authController = {
  async login(c: Context<AppEnv>) {
    try {
      const body = await c.req.json();
      const identifier = (body.usernameOrEmail || body.username || body.email || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      if (!identifier || !password) {
        return c.json({
          success: false,
          message: "Please provide both username/email and password",
        }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Query user(s) by email or user_name
      // If multiple users share the same username, authenticate against the matched records
      const candidates = (await db
        .prepare(
          `SELECT 
            u.id, 
            u.display_id as displayId,
            u.name, 
            u.user_name as userName, 
            u.password, 
            u.password_hash as passwordHash,
            u.email, 
            u.mobile_number as mobileNumber, 
            u.user_type as userType, 
            u.created_at as createdAt
          FROM users u
          WHERE LOWER(u.email) = ? OR LOWER(u.user_name) = ?`
        )
        .bind(identifier, identifier)
        .all()) as any[];

      if (!candidates || candidates.length === 0) {
        return c.json({
          success: false,
          message: "Invalid username/email or password.",
        }, 401);
      }

      // Check passwords against candidate users until a valid match is found
      let row: any = null;
      for (const candidate of candidates) {
        const storedHash = candidate.passwordHash || candidate.password;
        const isValid = await verifyPassword(password, storedHash);
        if (isValid) {
          row = candidate;
          break;
        }
      }

      if (!row) {
        return c.json({
          success: false,
          message: "Invalid username/email or password.",
        }, 401);
      }

      // If user had legacy plaintext password, transparently upgrade to password_hash
      if (!row.passwordHash) {
        try {
          const newHash = await hashPassword(password);
          await db
            .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
            .run(newHash, row.id);
        } catch {}
      }

      // Fetch organizations linked to this user in user_organizations
      let userOrgs: any[] = [];
      try {
        userOrgs = (await db
          .prepare(
            `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, o.currency_code as currencyCode, o.currency_code as currency, o.owner_user_id as ownerUserId, uo.role
             FROM organizations o
             JOIN user_organizations uo ON o.id = uo.organization_id
             WHERE uo.user_id = ?
             ORDER BY o.created_at DESC`
          )
          .bind(row.id)
          .all()) as any[];
      } catch {
        userOrgs = (await db
          .prepare(
            `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, 'INR' as currencyCode, 'INR' as currency, o.owner_user_id as ownerUserId, uo.role
             FROM organizations o
             JOIN user_organizations uo ON o.id = uo.organization_id
             WHERE uo.user_id = ?
             ORDER BY o.created_at DESC`
          )
          .bind(row.id)
          .all()) as any[];
      }

      const primaryOrg = userOrgs.length > 0 ? userOrgs[0] : null;

      const userSafe: UserModel = {
        id: String(row.id),
        displayId: row.displayId || `USR-${row.id}`,
        name: row.name,
        userName: row.userName,
        email: row.email,
        mobileNumber: row.mobileNumber || "",
        userType: row.userType,
        organizationId: primaryOrg ? primaryOrg.id : undefined,
        shortCode: primaryOrg ? primaryOrg.shortCode : undefined,
        organization: primaryOrg ? primaryOrg.name : undefined,
        currency: primaryOrg ? (primaryOrg.currencyCode || primaryOrg.currency || "INR") : "INR",
        currencyCode: primaryOrg ? (primaryOrg.currencyCode || primaryOrg.currency || "INR") : "INR",
        createdAt: row.createdAt,
      };

      const token = `cafe4x_token_${row.id}_${Date.now()}`;
      try {
        const tokenHash = await sha256Hex(token);
        const sessionId = await generateId(db, "SES");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare(
            `INSERT INTO user_sessions (id, token_hash, user_id, expires_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(sessionId, tokenHash, String(row.id), expiresAt)
          .run();
      } catch (sessErr) {
        console.warn("Could not record session:", sessErr);
      }

      return c.json({
        success: true,
        message: "Login successful",
        token,
        user: userSafe,
        organizations: userOrgs,
      }, 200);
    } catch (err: any) {
      return c.json({
        success: false,
        message: err.message || "An error occurred during login",
      }, 500);
    }
  },

  async checkUsername(c: Context<AppEnv>) {
    try {
      const username = (c.req.query("username") || "").trim().toLowerCase();
      if (!username) {
        return c.json({ success: false, available: false, message: "Username is required" }, 400);
      }

      if (username.length < 3) {
        return c.json({ success: false, available: false, message: "Username must be at least 3 characters long" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const existing = (await db
        .prepare(`SELECT id FROM users WHERE LOWER(TRIM(user_name)) = LOWER(?)`)
        .bind(username)
        .get()) as any;

      if (existing) {
        return c.json({
          success: true,
          available: false,
          message: "This username is already taken. Please choose another username.",
        });
      }

      return c.json({
        success: true,
        available: true,
        message: "Username is available.",
      });
    } catch (err: any) {
      console.error("checkUsername error:", err);
      return c.json({ success: false, message: "Error checking username availability" }, 500);
    }
  },

  async checkEmail(c: Context<AppEnv>) {
    try {
      const email = (c.req.query("email") || "").trim().toLowerCase();
      if (!email) {
        return c.json({ success: false, available: false, message: "Email is required" }, 400);
      }

      // Professional email format validation
      if (!validateEmailFormat(email)) {
        return c.json({ success: false, available: false, message: "Please enter a valid email address." }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const existing = (await db
        .prepare(`SELECT id FROM users WHERE LOWER(email) = ?`)
        .bind(email)
        .get()) as any;

      if (existing) {
        return c.json({
          success: true,
          available: false,
          message: "This email address is already registered. Please use another email.",
        });
      }

      return c.json({
        success: true,
        available: true,
        message: "Email address is available.",
      });
    } catch (err: any) {
      console.error("checkEmail error:", err);
      return c.json({ success: false, message: "Error checking email availability" }, 500);
    }
  },

  async signup(c: Context<AppEnv>) {
    try {
      const body = await c.req.json();
      const email = (body.email || "").trim().toLowerCase();
      const userName = (body.userName || body.name || "").trim().toLowerCase();
      const password = (body.password || "").trim();
      const rawMobile = (body.mobileNumber || body.mobile || "").trim();
      const countryCode = (body.countryCode || "IN").trim().toUpperCase();

      if (!email || !password || !userName) {
        return c.json({ success: false, message: "Username, email, and password are required" }, 400);
      }

      // Professional email format validation
      if (!validateEmailFormat(email)) {
        return c.json({ success: false, message: "Please enter a valid email address." }, 400);
      }

      if (userName.length < 3) {
        return c.json({ success: false, message: "Username must be at least 3 characters long" }, 400);
      }

      // International mobile number validation and E.164 normalization
      let normalizedMobile = "";
      const nationalInput = (body.nationalNumber || body.mobileNumber || body.mobile || "").trim();
      if (nationalInput) {
        const mobileCheck = validateAndNormalizeMobile(nationalInput, countryCode);
        if (!mobileCheck.isValid) {
          return c.json({ success: false, message: mobileCheck.message || "Please enter a valid mobile number." }, 400);
        }
        normalizedMobile = mobileCheck.e164 || nationalInput;
      }

      const db = getUniversalDb(c.env?.DB);



      // Check specifically if username already exists (usernames must be unique)
      const usernameExists = (await db
        .prepare(`SELECT id FROM users WHERE LOWER(TRIM(user_name)) = LOWER(?)`)
        .bind(userName)
        .get()) as any;

      if (usernameExists) {
        return c.json({
          success: false,
          code: "USERNAME_ALREADY_EXISTS",
          message: "This username is already taken. Please choose another username.",
        }, 409);
      }

      // Check specifically if email already exists (emails must be globally unique)
      const emailExists = (await db
        .prepare(`SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(?)`)
        .bind(email)
        .get()) as any;

      if (emailExists) {
        return c.json({ success: false, message: "This email address is already registered." }, 409);
      }

      const orgName = (body.organization || "").trim().replace(/\s+/g, " ");
      const orgShort = (body.shortCode || "").trim().toUpperCase();
            const orgCurrency = (body.currencyCode || body.currency || DEFAULT_CURRENCY).trim().toUpperCase();
      const now = new Date().toISOString();

      if (!orgName || !orgShort) {
        return c.json({ success: false, message: "Organization name and short code are required" }, 400);
      }

      if (!isSupportedCurrency(orgCurrency)) {
        return c.json({ success: false, message: `Unsupported currency code: ${orgCurrency}` }, 400);
      }

      // Check organization short code uniqueness before inserting user or organization (org names can be duplicate, short codes must be unique)
      const orgCodeExists = (await db
        .prepare(`SELECT id FROM organizations WHERE LOWER(TRIM(short_code)) = LOWER(?)`)
        .bind(orgShort)
        .get()) as any;

      if (orgCodeExists) {
        return c.json({
          success: false,
          message: "This organization code is already taken. Please choose another code.",
        }, 409);
      }

      // Generate standardized sequential 6-digit IDs
      const orgId = await generateId(db, "ORG");
      const newUserId = await generateId(db, "USR");
      const userDisplayId = newUserId;
      const orgDisplayId = orgId;
      const hashedPassword = await hashPassword(password);

      // Perform atomic insertion of Organization, User, and UserOrganization link
      // Never use ON CONFLICT DO UPDATE on organizations here; public signup creates NEW organizations only
      await db
        .prepare(
          `INSERT INTO organizations (id, display_id, name, short_code, currency_code, owner_user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(orgId, orgDisplayId, orgName, orgShort, orgCurrency, newUserId, now);

      const actualOrgId = orgId;
      const actualOrgDisplayId = orgDisplayId;

      // 2. Insert user with hashed password and readable display_id
      await db
        .prepare(
          `INSERT INTO users (id, display_id, name, user_name, password, password_hash, email, mobile_number, user_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newUserId,
          userDisplayId,
          body.name || userName || "User",
          userName || email.split("@")[0],
          password, // for backward-compatibility if referenced
          hashedPassword,
          email,
          normalizedMobile || body.mobileNumber || "",
          body.userType || "Admin",
          now
        );

      // 3. Link user as Owner in user_organizations
      const uorId = await generateId(db, "UOR");
      await db
        .prepare(
          `INSERT INTO user_organizations (id, user_id, organization_id, role, created_at)
           VALUES (?, ?, ?, 'Owner', ?)`
        )
        .run(uorId, newUserId, actualOrgId, now);

      const userSafe: UserModel = {
        id: newUserId,
        displayId: userDisplayId,
        name: body.name || userName || "User",
        userName: userName || email.split("@")[0],
        email,
        mobileNumber: normalizedMobile || body.mobileNumber || "",
        organization: orgName,
        shortCode: orgShort,
        organizationId: actualOrgId,
        currency: orgCurrency,
        currencyCode: orgCurrency,
        userType: body.userType || "Admin",
        createdAt: now,
      };

      const token = `cafe4x_token_${newUserId}_${Date.now()}`;
      try {
        const tokenHash = await sha256Hex(token);
        const sessionId = await generateId(db, "SES");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare(
            `INSERT INTO user_sessions (id, token_hash, user_id, expires_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(sessionId, tokenHash, String(newUserId), expiresAt)
          .run();
      } catch (sessErr) {
        console.warn("Could not record session:", sessErr);
      }

      return c.json({
        success: true,
        message: "User registered successfully",
        user: userSafe,
        token,
        organizations: [
          {
            id: actualOrgId,
            displayId: actualOrgDisplayId,
            name: orgName,
            shortCode: orgShort,
            currency: orgCurrency,
            currencyCode: orgCurrency,
            role: "Owner",
          },
        ],
      }, 201);
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (errMsg.includes("organizations.short_code") || errMsg.includes("idx_organizations_short_code_nocase")) {
        return c.json({
          success: false,
          message: "This organization code is already taken. Please choose another code.",
        }, 409);
      }

      if (errMsg.includes("USERNAME_ALREADY_EXISTS") || errMsg.includes("users.user_name") || errMsg.includes("idx_users_username_nocase")) {
        return c.json({
          success: false,
          code: "USERNAME_ALREADY_EXISTS",
          message: "This username is already taken. Please choose another username.",
        }, 409);
      }

      if (errMsg.includes("users.email") || errMsg.includes("idx_users_email_nocase")) {
        return c.json({
          success: false,
          code: "EMAIL_ALREADY_EXISTS",
          message: "This email address is already registered. Please use another email.",
        }, 409);
      }
      return c.json({ success: false, message: err.message || "Registration failed. Please check your information." }, 400);
    }
  },

  // GET /api/auth/me (validates token/session)
  async me(c: Context<AppEnv>) {
    const authUser = await getAuthUser(c);
    if (!authUser) {
      return c.json({ success: false, message: "Unauthorized. Session is invalid or has expired." }, 401);
    }

    const db = getUniversalDb(c.env?.DB);
    const user = (await db
      .prepare(
        `SELECT id, display_id as displayId, name, user_name as userName, email, mobile_number as mobileNumber, user_type as userType, created_at as createdAt
         FROM users WHERE id = ?`
      )
      .bind(authUser.id)
      .get()) as any;

    if (!user) {
      return c.json({ success: false, message: "User not found." }, 404);
    }

    let userOrgs: any[] = [];
    try {
      userOrgs = (await db
        .prepare(
          `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, o.currency_code as currencyCode, o.currency_code as currency, o.owner_user_id as ownerUserId, uo.role
           FROM organizations o
           JOIN user_organizations uo ON o.id = uo.organization_id
           WHERE uo.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .bind(user.id)
        .all()) as any[];
    } catch {
      userOrgs = (await db
        .prepare(
          `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, 'INR' as currencyCode, 'INR' as currency, o.owner_user_id as ownerUserId, uo.role
           FROM organizations o
           JOIN user_organizations uo ON o.id = uo.organization_id
           WHERE uo.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .bind(user.id)
        .all()) as any[];
    }

    const primaryOrg = userOrgs.length > 0 ? userOrgs[0] : null;

    return c.json({
      success: true,
      user: {
        id: String(user.id),
        displayId: user.displayId || `USR-${user.id}`,
        name: user.name,
        userName: user.userName,
        email: user.email,
        mobileNumber: user.mobileNumber || "",
        userType: user.userType,
        organizationId: primaryOrg ? primaryOrg.id : undefined,
        shortCode: primaryOrg ? primaryOrg.shortCode : undefined,
        organization: primaryOrg ? primaryOrg.name : undefined,
        currency: primaryOrg ? (primaryOrg.currencyCode || primaryOrg.currency || "INR") : "INR",
        currencyCode: primaryOrg ? (primaryOrg.currencyCode || primaryOrg.currency || "INR") : "INR",
        createdAt: user.createdAt,
      },
      organizations: userOrgs,
    });
  },

  // POST /api/auth/logout (revokes current session)
  async logout(c: Context<AppEnv>) {
    const authHeader = c.req.header("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const rawToken = authHeader.replace("Bearer ", "").trim();
      try {
        const db = getUniversalDb(c.env?.DB);
        const tokenHash = await sha256Hex(rawToken);
        const nowIso = new Date().toISOString();
        await db
          .prepare(`UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ?`)
          .bind(nowIso, tokenHash)
          .run();
      } catch (err) {
        console.warn("Error revoking session:", err);
      }
    }
    return c.json({ success: true, message: "Logged out successfully" });
  },
};
