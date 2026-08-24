import { getStore } from "@netlify/blobs";

const STORE_NAME = "band";
const KEY = "shows";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
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
