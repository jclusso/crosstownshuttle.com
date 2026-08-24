import { getStore } from "@netlify/blobs";

const STORE_NAME = "band";
const KEY = "shows";

function store() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const options = { name: STORE_NAME, consistency: "strong" };
  // Functions get credentials from the runtime; a build step has to be told.
  if (siteID && token) Object.assign(options, { siteID, token });
  return getStore(options);
}

/** Returns null when nothing has ever been saved, so callers can fall back. */
export async function readShows() {
  const value = await store().get(KEY, { type: "json" });
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? value : null;
}

export async function writeShows(shows) {
  await store().setJSON(KEY, shows);
}
