import { config as authConfig, passwordMatches, issueToken, sessionCookie, json } from "../shared/auth.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const { password, ready } = authConfig();
  if (!ready) {
    return json({ error: "The admin panel is not set up yet. Ask Jarrett to add ADMIN_PASSWORD." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }

  const given = typeof body?.password === "string" ? body.password : "";
  // Slows a script that tries one password after another.
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (!given || !passwordMatches(given, password)) {
    return json({ error: "That password is not right." }, 401);
  }

  return json({ ok: true }, 200, { "set-cookie": sessionCookie(issueToken(), request) });
};

export const config = { path: "/api/login" };
