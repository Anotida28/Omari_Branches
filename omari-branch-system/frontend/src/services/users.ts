import { api } from "./api";

export type UserRole = "VIEWER" | "FULL_ACCESS" | "SUPER_ADMIN";

export type User = {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  VIEWER: "Viewer",
  FULL_ACCESS: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get<{ items: User[] }>("/api/users");
  return data.items;
}

export async function createUser(input: {
  username: string;
  role: UserRole;
}): Promise<User> {
  const { data } = await api.post<{ data: User }>("/api/users", input);
  return data.data;
}

export async function updateUser(
  id: string,
  input: { role?: UserRole; isActive?: boolean },
): Promise<User> {
  const { data } = await api.patch<{ data: User }>(`/api/users/${id}`, input);
  return data.data;
}
