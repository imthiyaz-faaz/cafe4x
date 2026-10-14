import { Context } from "hono";

export interface UserModel {
  id: string;
  name: string;
  userName: string;
  password?: string;
  userType: "Admin" | "Provider" | "Staff";
  email: string;
  mobileNumber?: string;
  createdAt: string;
}

// In-memory persistent users store
export let usersStore: UserModel[] = [
  {
    id: "1",
    name: "Admin User",
    userName: "adminuser",
    password: "password123",
    email: "admin@gmail.com",
    mobileNumber: "9876543210",
    userType: "Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "FTS Admin",
    userName: "adminuser",
    password: "password123",
    email: "admin@faaztechsolutions.com",
    mobileNumber: "9876543211",
    userType: "Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Cafe Provider",
    userName: "provider",
    password: "provider123",
    email: "provider@cafe4x.com",
    mobileNumber: "9876543212",
    userType: "Provider",
    createdAt: new Date().toISOString(),
  },
];

export const userController = {
  // GET /api/users
  async getUsers(c: Context) {
    try {
      const type = c.req.query("type");
      let list = [...usersStore];
      if (type) {
        list = list.filter((u) => u.userType.toLowerCase() === type.toLowerCase());
      }
      const safeUsers = list.map(({ password: _, ...rest }) => rest);
      return c.json({ success: true, users: safeUsers });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/users/:id
  async getUserById(c: Context) {
    try {
      const id = c.req.param("id");
      const user = usersStore.find((u) => u.id === id);
      if (!user) {
        return c.json({ success: false, message: "User not found" }, 404);
      }
      const { password: _, ...safe } = user;
      return c.json({ success: true, user: safe });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/users (Created from Users Page or Signup)
  async createUser(c: Context) {
    try {
      const body = await c.req.json();
      const identifier = (body.email || body.userName || "").trim().toLowerCase();

      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Name is required" }, 400);
      }
      if (!body.userName || !body.userName.trim()) {
        return c.json({ success: false, message: "User Name is required" }, 400);
      }
      if (!body.password || !body.password.trim()) {
        return c.json({ success: false, message: "Password is required" }, 400);
      }
      if (!body.email || !body.email.trim()) {
        return c.json({ success: false, message: "Email is required" }, 400);
      }

      // Check if duplicate user exists
      const exists = usersStore.some(
        (u) =>
          u.email.toLowerCase() === body.email.trim().toLowerCase() ||
          u.userName.toLowerCase() === body.userName.trim().toLowerCase()
      );

      if (exists) {
        return c.json({
          success: false,
          message: "A user with this email or username already exists",
        }, 409);
      }

      const newUser: UserModel = {
        id: body.id ? String(body.id) : Date.now().toString(),
        name: body.name.trim(),
        userName: body.userName.trim(),
        password: body.password.trim(),
        email: body.email.trim().toLowerCase(),
        mobileNumber: body.mobileNumber ? String(body.mobileNumber).trim() : "",
        userType: body.userType || "Admin",
        createdAt: new Date().toISOString(),
      };

      usersStore.push(newUser);
      const { password: _, ...safeUser } = newUser;

      return c.json({
        success: true,
        message: "User created successfully",
        user: safeUser,
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/users/:id
  async updateUser(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const index = usersStore.findIndex((u) => u.id === id);

      if (index === -1) {
        return c.json({ success: false, message: "User not found" }, 404);
      }

      usersStore[index] = {
        ...usersStore[index],
        name: body.name !== undefined ? body.name : usersStore[index].name,
        userName: body.userName !== undefined ? body.userName : usersStore[index].userName,
        email: body.email !== undefined ? body.email.toLowerCase() : usersStore[index].email,
        mobileNumber: body.mobileNumber !== undefined ? body.mobileNumber : usersStore[index].mobileNumber,
        userType: body.userType !== undefined ? body.userType : usersStore[index].userType,
        password: body.password ? body.password : usersStore[index].password,
      };

      const { password: _, ...safe } = usersStore[index];
      return c.json({ success: true, user: safe });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/users/:id
  async deleteUser(c: Context) {
    try {
      const id = c.req.param("id");
      usersStore = usersStore.filter((u) => u.id !== id);
      return c.json({ success: true, message: "User deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
