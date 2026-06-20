const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'server', 'data', 'pcbuilder.db');

const items = [
  // CPUs
  { id: 1201, name: 'Intel Core i5-14600K', category_id: 1, price: 28500, socket: 'LGA1700', specs: { cores: 14, threads: 20, base_ghz: 3.5, mrp_inr: 32990 } },
  { id: 1202, name: 'Intel Core i7-14700K', category_id: 1, price: 40500, socket: 'LGA1700', specs: { cores: 20, threads: 28, base_ghz: 3.4, mrp_inr: 46990 } },
  { id: 1203, name: 'AMD Ryzen 5 7600X', category_id: 1, price: 19990, socket: 'AM5', specs: { cores: 6, threads: 12, base_ghz: 4.7, mrp_inr: 22990 } },
  { id: 1204, name: 'AMD Ryzen 7 7800X3D', category_id: 1, price: 38990, socket: 'AM5', specs: { cores: 8, threads: 16, base_ghz: 4.2, mrp_inr: 42990 } },
  { id: 1205, name: 'AMD Ryzen 9 7950X', category_id: 1, price: 53990, socket: 'AM5', specs: { cores: 16, threads: 32, base_ghz: 4.5, mrp_inr: 59990 } },

  // Motherboards
  { id: 2201, name: 'ASUS TUF Gaming B650-PLUS WIFI', category_id: 2, price: 19990, socket: 'AM5', specs: { form_factor: 'ATX', memory_type: 'DDR5', mrp_inr: 21990 } },
  { id: 2202, name: 'MSI MAG B760 Tomahawk WIFI', category_id: 2, price: 21490, socket: 'LGA1700', specs: { form_factor: 'ATX', memory_type: 'DDR5', mrp_inr: 23990 } },
  { id: 2203, name: 'Gigabyte X670 AORUS Elite AX', category_id: 2, price: 28990, socket: 'AM5', specs: { form_factor: 'ATX', memory_type: 'DDR5', mrp_inr: 31990 } },

  // GPUs
  { id: 3201, name: 'NVIDIA GeForce RTX 4060 Ti 8GB', category_id: 3, price: 34990, specs: { vram_gb: 8, recommended_psu_watts: 550, mrp_inr: 36990 } },
  { id: 3202, name: 'NVIDIA GeForce RTX 4070 SUPER 12GB', category_id: 3, price: 59990, specs: { vram_gb: 12, recommended_psu_watts: 650, mrp_inr: 64990 } },
  { id: 3203, name: 'AMD Radeon RX 7800 XT 16GB', category_id: 3, price: 52990, specs: { vram_gb: 16, recommended_psu_watts: 700, mrp_inr: 56990 } },
  { id: 3204, name: 'NVIDIA GeForce RTX 4090 24GB', category_id: 3, price: 179990, specs: { vram_gb: 24, recommended_psu_watts: 850, mrp_inr: 199990 } },

  // PSUs
  { id: 4201, name: 'Corsair RM750e (750W) 80+ Gold', category_id: 4, price: 10490, specs: { wattage: 750, efficiency: '80+ Gold', mrp_inr: 11990 } },
  { id: 4202, name: 'Seasonic Focus GX-850 (850W) 80+ Gold', category_id: 4, price: 13990, specs: { wattage: 850, efficiency: '80+ Gold', mrp_inr: 15990 } },
  { id: 4203, name: 'ASUS ROG Thor 1000P2 (1000W) 80+ Platinum', category_id: 4, price: 31990, specs: { wattage: 1000, efficiency: '80+ Platinum', mrp_inr: 34990 } },

  // RAM
  { id: 5201, name: 'Corsair Vengeance 32GB (2x16GB) DDR5-6000', category_id: 5, price: 11490, specs: { size_gb: 32, speed_mhz: 6000, type: 'DDR5', mrp_inr: 12990 } },
  { id: 5202, name: 'G.Skill Trident Z5 RGB 32GB (2x16) DDR5-6400', category_id: 5, price: 15490, specs: { size_gb: 32, speed_mhz: 6400, type: 'DDR5', mrp_inr: 16990 } },
  { id: 5203, name: 'Kingston Fury Beast 64GB (2x32) DDR5-6000', category_id: 5, price: 22490, specs: { size_gb: 64, speed_mhz: 6000, type: 'DDR5', mrp_inr: 24990 } },

  // Storage
  { id: 6201, name: 'Samsung 990 PRO 2TB NVMe', category_id: 6, price: 16990, specs: { interface: 'NVMe', capacity_gb: 2000, mrp_inr: 18990 } },
  { id: 6202, name: 'WD Black SN850X 2TB NVMe', category_id: 6, price: 15990, specs: { interface: 'NVMe', capacity_gb: 2000, mrp_inr: 17990 } },
  { id: 6203, name: 'Crucial T700 2TB NVMe', category_id: 6, price: 22990, specs: { interface: 'NVMe', capacity_gb: 2000, mrp_inr: 24990 } },
  { id: 6204, name: 'Seagate FireCuda 530 1TB NVMe', category_id: 6, price: 10490, specs: { interface: 'NVMe', capacity_gb: 1000, mrp_inr: 11990 } },

  // Cases
  { id: 7201, name: 'Lian Li O11 Dynamic EVO', category_id: 7, price: 17990, specs: { form_factor: 'ATX', mrp_inr: 19990 } },
  { id: 7202, name: 'NZXT H7 Flow', category_id: 7, price: 14990, specs: { form_factor: 'ATX', mrp_inr: 16990 } },
  { id: 7203, name: 'Fractal Design North', category_id: 7, price: 15990, specs: { form_factor: 'ATX', mrp_inr: 17990 } },
];

function run() {
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    db.run('BEGIN');
    let inserted = 0;
    const stmt = db.prepare('INSERT OR IGNORE INTO components (id,name,category_id,price,specs,socket) VALUES (?,?,?,?,?,?)');
    for (const it of items) {
      stmt.run([it.id, it.name, it.category_id, it.price, JSON.stringify(it.specs || {}), it.socket || null], function(err){
        if (!err && this.changes > 0) inserted++;
      });
    }
    stmt.finalize(() => {
      db.run('COMMIT', () => {
        console.log( Seeded  INR components);
        db.all('SELECT COUNT(*) as c FROM components', [], (e, rows) => {
          if (!e) console.log('Total components:', rows[0].c);
          db.close();
        });
      });
    });
  });
}

run();
