const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'server', 'data', 'pcbuilder.db');

const CATEGORY_LIMITS = {
  CPU:        { min: 6000,  max: 80000 },
  GPU:        { min: 8000,  max: 140000 },
  Motherboard:{ min: 6000,  max: 40000 },
  RAM:        { min: 1800,  max: 20000 },
  Storage:    { min: 2500,  max: 20000 },
  PSU:        { min: 3000,  max: 20000 },
  Case:       { min: 2500,  max: 20000 },
};

function clamp(categoryName, price) {
  const limits = CATEGORY_LIMITS[categoryName];
  if (!limits) return Math.round(price);
  return Math.round(Math.min(limits.max, Math.max(limits.min, price)));
}

function adjustBySpecs(row) {
  const c = row.category_name;
  let price = Number(row.price) || 0;
  let s = {};
  try { s = row.specs ? JSON.parse(row.specs) : {}; } catch {}

  if (c === 'RAM') {
    const size = Number(s.size_gb || (row.name.match(/(\d+)GB/i) || [])[1] || 0);
    const speed = Number(s.speed_mhz || (row.name.match(/(\d{4,})/) || [])[1] || 0);
    if (size) price = Math.max(price, size * 250); // ~?250/GB floor
    if (speed) price += Math.max(0, (speed - 3000) / 10);
  }
  if (c === 'Storage') {
    const capMatch = row.name.match(/(\d+)(TB|GB)/i);
    let gb = Number(s.capacity_gb || 0);
    if (!gb && capMatch) gb = capMatch[2].toUpperCase() === 'TB' ? Number(capMatch[1]) * 1000 : Number(capMatch[1]);
    const iface = String((s.interface || '')).toUpperCase();
    if (gb) price = Math.max(price, gb * 3); // ~?3/GB floor
    if (iface === 'NVME') price += 1000;
  }
  if (c === 'GPU') {
    const vram = Number(s.vram_gb || (row.name.match(/(\d+)GB/i) || [])[1] || 0);
    if (vram) price = Math.max(price, vram * 2000);
  }
  if (c === 'PSU') {
    const watts = Number(s.wattage || (row.name.match(/(\d{3,4})W/) || [])[1] || 0);
    if (watts) price = Math.max(price, watts * 8);
  }
  return Math.round(price);
}

function run() {
  const db = new sqlite3.Database(dbPath);
  db.all(
    SELECT c.id, c.name, c.price, c.specs, cat.name AS category_name
    FROM components c
    JOIN categories cat ON c.category_id = cat.id
  , [], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
      process.exit(1);
    }

    db.run('BEGIN');
    let updated = 0;

    for (const row of rows) {
      let p = adjustBySpecs(row);
      p = clamp(row.category_name, p);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (p !== Number(row.price)) {
        db.run('UPDATE components SET price = ? WHERE id = ?', [p, row.id]);
        updated++;
      }
    }

    db.run('COMMIT', () => {
      console.log( Normalized prices. Updated  rows.);
      db.all('SELECT cat.name AS category_name, MIN(c.price) AS min, MAX(c.price) AS max, ROUND(AVG(c.price)) AS avg FROM components c JOIN categories cat ON c.category_id = cat.id GROUP BY cat.name ORDER BY cat.name', [], (e2, stats) => {
        if (e2) console.error(e2);
        else stats.forEach(s => console.log(${s.category_name}: min ? max ? avg ?));
        db.close();
      });
    });
  });
}

run();
