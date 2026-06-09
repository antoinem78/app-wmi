// The single Auth0 client, used server-side anywhere we need the logged-in user.
// It reads its config from the environment (AUTH0_DOMAIN, AUTH0_CLIENT_ID,
// AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL) — see .env.local / .env.example.
//
// IMPORTANT (v4 behaviour): by default the SDK strips every non-standard claim
// from the session, keeping only sub/name/email/etc. Our Auth0 post-login Action
// adds a custom roles claim to the ID token, so without intervention it gets
// dropped before our role check runs. The `beforeSessionSaved` hook below keeps
// the standard claims AND carries our roles claim through into the session.
import {
  Auth0Client,
  filterDefaultIdTokenClaims,
} from "@auth0/nextjs-auth0/server";
import { ROLES_CLAIM } from "./roles";

export const auth0 = new Auth0Client({
  async beforeSessionSaved(session) {
    const claims = session.user as Record<string, unknown>;
    const roles = Array.isArray(claims[ROLES_CLAIM]) ? claims[ROLES_CLAIM] : [];
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(claims),
        [ROLES_CLAIM]: roles,
      } as typeof session.user,
    };
  },
});
