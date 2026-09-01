import { expiredCookie, json } from "../shared/auth.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  return json({ ok: true }, 200, { "set-cookie": expiredCookie(request) });
};

export const config = { path: "/api/logout" };
