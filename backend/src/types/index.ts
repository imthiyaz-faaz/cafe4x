export type Bindings = {
  DB: D1Database;
};

export interface AuthUser {
  id: string;
  name: string;
  userName: string;
  email: string;
  userType: "Admin" | "Provider" | "Staff";
  organizationId?: string;
  shortCode?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user?: AuthUser;
    organizationId?: string;
    shortCode?: string;
  };
};
