const fs = require("fs");
const path = require("path");

const PLANETS = ["Promitor", "Avalon", "Boucher"];
const STARTS = {
  Promitor: new Date("2026-02-12T20:00:00Z"),
  Avalon:   new Date("2026-02-12T20:00:00Z"),
  Boucher:  new Date("2026-02-16T20:00:00Z"),
};
const DURATION_MS = 7 * 24 * 3600000;

function formatDate(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

function cleanName(name) {
  name = name.replace(/^-+|-+$/g, "");
  if (name === name.toUpperCase() && name !== name.toLowerCase()) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return name;
}

function parseCell(text) {
  const results = {};
  if (!text || !text.trim()) return results;
  for (const line of text.trim().split("\n")) {
    let parts = line.split("\t");
    if (parts.length < 2) parts = line.trim().split(/  +/);
    if (parts.length >= 2) {
      results[cleanName(parts[1])] = parseInt(parts[0], 10);
    }
  }
  return results;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n") {
      row.push(cell); rows.push(row); row = []; cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

module.exports = function () {
  const csvPath = path.join(__dirname, "voting.csv");
  const rows = parseCSV(fs.readFileSync(csvPath, "utf-8"));

  const timestamps = [];
  for (const ts of rows[0].slice(1)) {
    const trimmed = ts.trim();
    if (trimmed) timestamps.push(new Date(trimmed.replace(" ", "T") + "Z"));
  }

  const planetData = {};
  for (const row of rows.slice(1)) {
    const planet = row[0].trim();
    if (!PLANETS.includes(planet)) continue;

    const snapshots = row.slice(1).map(parseCell);
    const allCandidates = new Set();
    for (const snap of snapshots) Object.keys(snap).forEach(n => allCandidates.add(n));

    const start = STARTS[planet];
    const end = new Date(start.getTime() + DURATION_MS);
    const started = timestamps.length > 0 && timestamps[timestamps.length - 1] >= start;

    const series = [];
    for (const candidate of allCandidates) {
      const points = [];
      for (let i = 0; i < snapshots.length; i++) {
        if (i < timestamps.length) {
          const hours = (timestamps[i] - start) / 3600000;
          if (hours < 0) continue;
          points.push([Math.round(hours * 100) / 100, snapshots[i][candidate] || 0]);
        }
      }
      series.push({ name: candidate, data: points });
    }

    series.sort((a, b) => {
      const aLast = a.data.length ? a.data[a.data.length - 1][1] : 0;
      const bLast = b.data.length ? b.data[b.data.length - 1][1] : 0;
      return bLast - aLast;
    });

    planetData[planet.toLowerCase()] = {
      start: formatDate(start),
      end: formatDate(end),
      started,
      series,
    };
  }

  return planetData;
};
