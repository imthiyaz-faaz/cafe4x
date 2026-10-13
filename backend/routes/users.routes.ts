import { Hono } from "hono";

const usersRoutes = new Hono();

usersRoutes.get("/", (c) => {
  const users = [
    { id: 1, name: "Rizwi", email: "rizwi@example.com" },
    { id: 2, name: "Rahul", email: "rahul@example.com" },
  ];

  return c.json(
    {
      success: true,
      message: "Users fetched successfully",
      users,
    },
    200,
  );
});

export default usersRoutes;
