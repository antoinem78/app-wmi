// Role helpers. Roles are stamped into the login token by an Auth0 post-login
// Action under this namespaced claim (must match the Action code in the Auth0
// dashboard exactly).
export const ROLES_CLAIM = "https://ppcmastery.app/roles";

export type AppRole = "agency_admin" | "client";

// Auth0's user object is an open bag of claims, so we read the claim defensively.
export function getRoles(
  user: Record<string, unknown> | null | undefined,
): string[] {
  const raw = user?.[ROLES_CLAIM];
  return Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string") : [];
}

export function isAgencyAdmin(
  user: Record<string, unknown> | null | undefined,
): boolean {
  return getRoles(user).includes("agency_admin");
}
