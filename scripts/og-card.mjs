// Builds src/og.svg, the source for the social sharing card. Rasterise it with:
//   rsvg-convert -w 1200 -h 630 src/og.svg -o assets/images/meta.png
// Re-run this whenever the kicker or the tagline in _data/band.yml changes.

import { readFile, writeFile } from "node:fs/promises";

const BRAND = "#ee352e";
const MUTED = "#8b8b91";
const FONT = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif";

function yamlValue(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) throw new Error(`${key} is missing from _data/band.yml`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const band = await readFile("_data/band.yml", "utf8");
const kicker = yamlValue(band, "kicker").toUpperCase();
const tagline = yamlValue(band, "tagline");

const logo = await readFile("assets/images/logo.svg", "utf8");
const paths = logo.slice(logo.indexOf(">", logo.indexOf("<svg")) + 1, logo.lastIndexOf("</svg>"));

const LOGO_WIDTH = 860;
const scale = LOGO_WIDTH / 3000;
const grid = [
  ...Array.from({ length: 16 }, (_, i) => `<path d="M${(i + 1) * 72} 0V630"/>`),
  ...Array.from({ length: 8 }, (_, i) => `<path d="M0 ${(i + 1) * 72}H1200"/>`),
].join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1">${grid}</g>
  <g transform="translate(${(1200 - LOGO_WIDTH) / 2} 168) scale(${scale.toFixed(5)})">${paths}</g>
  <text x="600" y="512" text-anchor="middle" font-family="${FONT}" font-size="27"
        font-weight="800" letter-spacing="7" fill="${BRAND}">${escape(kicker)}</text>
  <text x="600" y="556" text-anchor="middle" font-family="${FONT}" font-size="24"
        font-weight="600" letter-spacing="0.4" fill="${MUTED}">${escape(tagline)}</text>
  <rect x="0" y="618" width="1200" height="12" fill="${BRAND}"/>
</svg>
`;

await writeFile("src/og.svg", svg, "utf8");
process.stdout.write(`[og] wrote src/og.svg with "${kicker}" / "${tagline}"\n`);
