import { Hono } from "hono";

const app = new Hono();

// Root API
app.get("/", (c) => {
  return c.text("Cafe4X API is running!");
});

// Get all users
app.get("/api/users", (c) => {
  const users = [
    {
      id: 1,
      name: "Rizwi",
      email: "rizwi@example.com",
    },
    {
      id: 2,
      name: "Rahul",
      email: "rahul@example.com",
    },
  ];

  return c.json({
    success: true,
    message: "Users fetched successfully",
    users,
  }, 200);
});

export default app;
