import { Context } from "hono";
import { usersStore, UserModel } from "./user.controller";

export const authController = {
  async login(c: Context) {
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

      // Check matching user from centralized usersStore (including newly created users!)
      const matched = usersStore.find(
        (u) =>
          (u.email.toLowerCase() === identifier || u.userName.toLowerCase() === identifier) &&
          u.password === password
      );

      if (matched) {
        const { password: _, ...userSafe } = matched;
        return c.json({
          success: true,
          message: "Login successful",
          token: `cafe4x_token_${matched.id}_${Date.now()}`,
          user: userSafe,
        }, 200);
      }

      return c.json({
        success: false,
        message: "Invalid username/email or password.",
      }, 401);
    } catch (err: any) {
      return c.json({
        success: false,
        message: err.message || "An error occurred during login",
      }, 500);
    }
  },

  async signup(c: Context) {
    try {
      const body = await c.req.json();
      const email = (body.email || "").trim().toLowerCase();
      const userName = (body.userName || body.name || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      if (!email || !password) {
        return c.json({ success: false, message: "Email and password are required" }, 400);
      }

      const exists = usersStore.some(
        (u) => u.email.toLowerCase() === email || u.userName.toLowerCase() === userName
      );

      if (exists) {
        return c.json({ success: false, message: "User already exists" }, 409);
      }

      const newUser: UserModel = {
        id: body.id ? String(body.id) : Date.now().toString(),
        name: body.name || userName || "User",
        userName: userName || email.split("@")[0],
        email,
        password,
        mobileNumber: body.mobileNumber || "",
        userType: body.userType || "Admin",
        createdAt: new Date().toISOString(),
      };

      usersStore.push(newUser);
      const { password: _, ...userSafe } = newUser;

      return c.json({
        success: true,
        message: "User registered successfully",
        user: userSafe,
        token: `cafe4x_token_${newUser.id}_${Date.now()}`,
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message || "Invalid request" }, 400);
    }
  },

  // GET /api/auth/me (validates token/session)
  async me(c: Context) {
    const authHeader = c.req.header("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return c.json({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    // In-memory token parsing
    const parts = token.split("_");
    const userId = parts[2];
    const user = usersStore.find((u) => u.id === userId);

    if (user) {
      const { password: _, ...safe } = user;
      return c.json({ success: true, user: safe });
    }

    return c.json({ success: true, message: "Token valid" });
  },
};
