import { Context } from "hono";

// Default seed accounts
const users = [
  {
    id: "1",
    email: "admin@gmail.com",
    userName: "adminuser",
    password: "password123",
    name: "Admin User",
    userType: "Admin",
  },
  {
    id: "2",
    email: "admin@faaztechsolutions.com",
    userName: "adminuser",
    password: "password123",
    name: "FTS Admin",
    userType: "Admin",
  },
  {
    id: "3",
    email: "provider@cafe4x.com",
    userName: "provider",
    password: "provider123",
    name: "Cafe Provider",
    userType: "Provider",
  },
];

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

      // Check matching user
      const matched = users.find(
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

      // Allow provider/admin dynamic demo access or reject
      if (identifier.includes("provider") && password.length >= 4) {
        return c.json({
          success: true,
          message: "Login successful (Provider)",
          token: `cafe4x_token_prov_${Date.now()}`,
          user: {
            id: String(Date.now()),
            email: identifier,
            userName: identifier,
            name: identifier,
            userType: "Provider",
          },
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
      return c.json({
        success: true,
        message: "Signup successful",
        user: { ...body, userType: "Admin" },
        token: `mock_token_${Date.now()}`,
      }, 201);
    } catch {
      return c.json({ success: false, message: "Invalid request" }, 400);
    }
  },
};
