import { config as authConfig, isSignedIn, json } from "../shared/auth.mjs";

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  return json({ configured: authConfig().ready, authenticated: isSignedIn(request) });
};

export const config = { path: "/api/session" };
