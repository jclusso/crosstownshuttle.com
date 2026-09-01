import { randomUUID } from "node:crypto";
import { LIMITS, byDate } from "./showtime.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function link(value) {
  const raw = text(value, LIMITS.url);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function realDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Trusts nothing from the browser. Returns clean rows plus per-row problems. */
export function sanitizeShows(input) {
  const errors = [];
  if (!Array.isArray(input)) return { shows: [], errors: ["Expected a list of shows."] };
  if (input.length > LIMITS.shows) {
    return { shows: [], errors: [`Too many shows. The limit is ${LIMITS.shows}.`] };
  }

  const shows = [];
  input.forEach((row, index) => {
    const position = index + 1;
    if (!row || typeof row !== "object") {
      errors.push(`Show ${position} is not valid.`);
      return;
    }

    const date = text(row.date, 10);
    const venue = text(row.venue, LIMITS.venue);
    const start = text(row.start_time, 5);
    const end = text(row.end_time, 5);

    if (!realDate(date)) {
      errors.push(`Show ${position} needs a real date.`);
      return;
    }
    if (!venue) {
      errors.push(`Show ${position} needs a venue name.`);
      return;
    }
    if (start && !TIME_RE.test(start)) {
      errors.push(`Show ${position} has a start time that is not valid.`);
      return;
    }
    if (end && !TIME_RE.test(end)) {
      errors.push(`Show ${position} has an end time that is not valid.`);
      return;
    }

    shows.push({
      id: text(row.id, 64) || randomUUID(),
      date,
      start_time: start,
      end_time: end,
      venue,
      city: text(row.city, LIMITS.city),
      map_url: link(row.map_url),
      url: link(row.url),
      notes: text(row.notes, LIMITS.notes),
    });
  });

  return { shows: shows.sort(byDate), errors };
}
