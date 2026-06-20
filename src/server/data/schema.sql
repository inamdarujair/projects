PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Basic users table for auth
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
);

-- Saved builds per user
CREATE TABLE IF NOT EXISTS user_builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT,
  selected_json TEXT NOT NULL,
  budget REAL,
  total_price REAL,
  purpose TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_builds_user ON user_builds(user_id);

CREATE TABLE IF NOT EXISTS components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  price REAL NOT NULL,
  specs TEXT,
  socket TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_name ON components(name);

-- Seed categories (stable IDs)
INSERT OR IGNORE INTO categories (id, name) VALUES
  (1, 'CPU'),
  (2, 'Motherboard'),
  (3, 'GPU'),
  (4, 'PSU'),
  (5, 'RAM'),
  (6, 'Storage'),
  (7, 'Case');

-- Seed admin user (requested credentials)
INSERT OR IGNORE INTO users (id, first_name, last_name, email, password, role) VALUES
  (1, 'Host', 'Admin', 'krishbhalerao9@gmail.com', '123456789', 'admin');

-- Seed components (sample data)
INSERT OR IGNORE INTO components (id, name, category_id, price, specs, socket) VALUES
  (101, 'Intel Core i5-12400', 1, 28999.00, '{"cores":6,"threads":12,"base_ghz":2.5}', 'LGA1700'),
  (102, 'AMD Ryzen 5 5600X', 1, 24999.00, '{"cores":6,"threads":12,"base_ghz":3.7}', 'AM4'),

  (201, 'ASUS TUF Gaming B660-PLUS WIFI D4', 2, 22000.00, '{"form_factor":"ATX","memory_type":"DDR4"}', 'LGA1700'),
  (202, 'MSI MAG B550 TOMAHAWK', 2, 19999.00, '{"form_factor":"ATX","memory_type":"DDR4"}', 'AM4'),
  (203, 'ASUS ROG Strix Z690-A Gaming WiFi D5', 2, 39999.00, '{"form_factor":"ATX","memory_type":"DDR5"}', 'LGA1700'),

  (301, 'NVIDIA GeForce RTX 3060 12GB', 3, 34999.00, '{"vram_gb":12,"chip":"GA106","recommended_psu_watts":550}', NULL),
  (302, 'AMD Radeon RX 6700 XT 12GB', 3, 37999.00, '{"vram_gb":12,"chip":"Navi22","recommended_psu_watts":650}', NULL),

  (401, 'Corsair RM650x (650W) 80+ Gold', 4, 13999.00, '{"wattage":650,"efficiency":"80+ Gold"}', NULL),
  (402, 'EVGA SuperNOVA 750 G5 (750W) 80+ Gold', 4, 16999.00, '{"wattage":750,"efficiency":"80+ Gold"}', NULL),

  (501, 'G.Skill Ripjaws V 16GB (2x8GB) DDR4-3200', 5, 6999.00, '{"size_gb":16,"speed_mhz":3200,"type":"DDR4"}', NULL),
  (502, 'Corsair Vengeance 32GB (2x16GB) DDR5-6000', 5, 19999.00, '{"size_gb":32,"speed_mhz":6000,"type":"DDR5"}', NULL);

-- Additional seed components (auto-inserted on startup)
INSERT OR IGNORE INTO components (id, name, category_id, price, specs, socket) VALUES
  (103, 'Intel Core i7-12700F', 1, 42999.00, '{"cores":12,"threads":20,"base_ghz":2.1}', 'LGA1700'),
  (104, 'Intel Core i9-12900K', 1, 79999.00, '{"cores":16,"threads":24,"base_ghz":3.2}', 'LGA1700'),
  (105, 'AMD Ryzen 7 5800X', 1, 33999.00, '{"cores":8,"threads":16,"base_ghz":3.8}', 'AM4'),
  (106, 'AMD Ryzen 9 5900X', 1, 49999.00, '{"cores":12,"threads":24,"base_ghz":3.7}', 'AM4'),
  (107, 'AMD Ryzen 5 7600', 1, 25999.00, '{"cores":6,"threads":12,"base_ghz":3.8}', 'AM5'),
  (108, 'AMD Ryzen 7 7700X', 1, 37999.00, '{"cores":8,"threads":16,"base_ghz":4.5}', 'AM5'),
  (109, 'Intel Core i5-13400F', 1, 27999.00, '{"cores":10,"threads":16,"base_ghz":2.5}', 'LGA1700'),
  (110, 'Intel Core i7-13700K', 1, 54999.00, '{"cores":16,"threads":24,"base_ghz":3.4}', 'LGA1700'),
  (111, 'AMD Ryzen 5 5600G', 1, 22999.00, '{"cores":6,"threads":12,"base_ghz":3.9}', 'AM4'),
  (112, 'Intel Core i3-12100F', 1, 13999.00, '{"cores":4,"threads":8,"base_ghz":3.3}', 'LGA1700'),

  (204, 'Gigabyte B660M DS3H AX DDR4', 2, 16999.00, '{"form_factor":"mATX","memory_type":"DDR4"}', 'LGA1700'),
  (205, 'MSI PRO Z690-A DDR5', 2, 27999.00, '{"form_factor":"ATX","memory_type":"DDR5"}', 'LGA1700'),
  (206, 'ASUS PRIME B550-PLUS', 2, 15999.00, '{"form_factor":"ATX","memory_type":"DDR4"}', 'AM4'),
  (207, 'Gigabyte X570 AORUS ELITE', 2, 21999.00, '{"form_factor":"ATX","memory_type":"DDR4"}', 'AM4'),
  (208, 'MSI PRO B650M-A WiFi', 2, 21999.00, '{"form_factor":"mATX","memory_type":"DDR5"}', 'AM5'),
  (209, 'ASUS TUF Gaming B650-PLUS WiFi', 2, 24999.00, '{"form_factor":"ATX","memory_type":"DDR5"}', 'AM5'),
  (210, 'ASRock B660M Pro RS', 2, 15999.00, '{"form_factor":"mATX","memory_type":"DDR4"}', 'LGA1700'),
  (211, 'ASUS PRIME Z790-P WiFi', 2, 32999.00, '{"form_factor":"ATX","memory_type":"DDR5"}', 'LGA1700'),
  (212, 'Gigabyte B550M DS3H', 2, 12999.00, '{"form_factor":"mATX","memory_type":"DDR4"}', 'AM4'),
  (213, 'ASRock B650E Steel Legend', 2, 28999.00, '{"form_factor":"ATX","memory_type":"DDR5"}', 'AM5'),

  (303, 'NVIDIA GeForce RTX 3050 8GB', 3, 24999.00, '{"vram_gb":8,"recommended_psu_watts":450}', NULL),
  (304, 'NVIDIA GeForce RTX 3060 Ti 8GB', 3, 44999.00, '{"vram_gb":8,"recommended_psu_watts":600}', NULL),
  (305, 'NVIDIA GeForce RTX 3070 8GB', 3, 54999.00, '{"vram_gb":8,"recommended_psu_watts":650}', NULL),
  (306, 'NVIDIA GeForce RTX 4060 8GB', 3, 35999.00, '{"vram_gb":8,"recommended_psu_watts":550}', NULL),
  (307, 'NVIDIA GeForce RTX 4070 12GB', 3, 74999.00, '{"vram_gb":12,"recommended_psu_watts":650}', NULL),
  (308, 'AMD Radeon RX 6600 8GB', 3, 27999.00, '{"vram_gb":8,"recommended_psu_watts":500}', NULL),
  (309, 'AMD Radeon RX 6700 10GB', 3, 34999.00, '{"vram_gb":10,"recommended_psu_watts":600}', NULL),
  (310, 'AMD Radeon RX 6800 16GB', 3, 59999.00, '{"vram_gb":16,"recommended_psu_watts":650}', NULL),
  (311, 'AMD Radeon RX 7600 8GB', 3, 31999.00, '{"vram_gb":8,"recommended_psu_watts":550}', NULL),
  (312, 'NVIDIA GeForce GTX 1660 Super 6GB', 3, 23999.00, '{"vram_gb":6,"recommended_psu_watts":450}', NULL),

  (403, 'Corsair CX550M (550W) 80+ Bronze', 4, 7999.00, '{"wattage":550,"efficiency":"80+ Bronze"}', NULL),
  (404, 'Seasonic Focus GX-650 (650W) 80+ Gold', 4, 12999.00, '{"wattage":650,"efficiency":"80+ Gold"}', NULL),
  (405, 'EVGA 600 BR (600W) 80+ Bronze', 4, 6999.00, '{"wattage":600,"efficiency":"80+ Bronze"}', NULL),
  (406, 'Cooler Master MWE Gold 750 V2 (750W)', 4, 12499.00, '{"wattage":750,"efficiency":"80+ Gold"}', NULL),
  (407, 'Corsair RM850x (850W) 80+ Gold', 4, 16999.00, '{"wattage":850,"efficiency":"80+ Gold"}', NULL),
  (408, 'be quiet! Pure Power 12 M (750W)', 4, 15499.00, '{"wattage":750,"efficiency":"80+ Gold"}', NULL),
  (409, 'Thermaltake Toughpower GF1 (650W)', 4, 11999.00, '{"wattage":650,"efficiency":"80+ Gold"}', NULL),

  (503, 'Kingston Fury Beast 16GB (2x8) DDR4-3200', 5, 5999.00, '{"size_gb":16,"speed_mhz":3200,"type":"DDR4"}', NULL),
  (504, 'Corsair Vengeance LPX 32GB (2x16) DDR4-3600', 5, 13999.00, '{"size_gb":32,"speed_mhz":3600,"type":"DDR4"}', NULL),
  (505, 'Crucial Ballistix 16GB (2x8) DDR4-3200', 5, 5499.00, '{"size_gb":16,"speed_mhz":3200,"type":"DDR4"}', NULL),
  (506, 'G.Skill Trident Z5 32GB (2x16) DDR5-6000', 5, 24999.00, '{"size_gb":32,"speed_mhz":6000,"type":"DDR5"}', NULL),
  (507, 'Kingston Fury Beast 32GB (2x16) DDR5-6000', 5, 23999.00, '{"size_gb":32,"speed_mhz":6000,"type":"DDR5"}', NULL),
  (508, 'Corsair Vengeance 64GB (2x32) DDR5-5600', 5, 42999.00, '{"size_gb":64,"speed_mhz":5600,"type":"DDR5"}', NULL),
  (509, 'Team T-Force Vulcan Z 16GB (2x8) DDR4-3200', 5, 4999.00, '{"size_gb":16,"speed_mhz":3200,"type":"DDR4"}', NULL),

  (601, 'Samsung 970 EVO Plus 1TB NVMe', 6, 14999.00, '{"interface":"NVMe","capacity_gb":1000}', NULL),
  (602, 'WD Blue SN570 1TB NVMe', 6, 10999.00, '{"interface":"NVMe","capacity_gb":1000}', NULL),
  (603, 'Crucial MX500 1TB SATA SSD', 6, 9999.00, '{"interface":"SATA","capacity_gb":1000}', NULL),
  (604, 'Samsung 980 Pro 2TB NVMe', 6, 25999.00, '{"interface":"NVMe","capacity_gb":2000}', NULL),
  (605, 'Seagate Barracuda 2TB HDD', 6, 7999.00, '{"interface":"SATA","capacity_gb":2000}', NULL),
  (606, 'WD Black SN850X 1TB NVMe', 6, 19999.00, '{"interface":"NVMe","capacity_gb":1000}', NULL),
  (607, 'Kingston NV2 1TB NVMe', 6, 8999.00, '{"interface":"NVMe","capacity_gb":1000}', NULL),

  (701, 'NZXT H510 (ATX Mid Tower)', 7, 9999.00, '{"form_factor":"ATX"}', NULL),
  (702, 'Corsair 4000D Airflow (ATX Mid Tower)', 7, 12999.00, '{"form_factor":"ATX"}', NULL),
  (703, 'Cooler Master NR200 (Mini-ITX)', 7, 11999.00, '{"form_factor":"Mini-ITX"}', NULL),
  (704, 'Fractal Design Meshify C (ATX Mid Tower)', 7, 13999.00, '{"form_factor":"ATX"}', NULL);

-- Ultra-budget additions for better low-cost builds
INSERT OR IGNORE INTO components (id, name, category_id, price, specs, socket) VALUES
  (113, 'AMD Athlon 3000G', 1, 5499.00, '{"cores":2,"threads":4,"base_ghz":3.5}', 'AM4'),
  (114, 'Intel Pentium Gold G6400', 1, 7499.00, '{"cores":2,"threads":4,"base_ghz":4.0}', 'LGA1200'),

  (214, 'ASRock A320M-HDV', 2, 4499.00, '{"form_factor":"mATX","memory_type":"DDR4"}', 'AM4'),
  (215, 'Gigabyte H410M S2', 2, 4999.00, '{"form_factor":"mATX","memory_type":"DDR4"}', 'LGA1200'),

  (313, 'NVIDIA GT 1030 2GB', 3, 7499.00, '{"vram_gb":2,"recommended_psu_watts":300}', NULL),
  (314, 'AMD Radeon RX 560 4GB', 3, 8999.00, '{"vram_gb":4,"recommended_psu_watts":350}', NULL),

  (410, 'Ant Esports VS450 (450W) 80+ Standard', 4, 3499.00, '{"wattage":450,"efficiency":"80+"}', NULL),
  (411, 'Zebronics ZEB-450W (450W)', 4, 2999.00, '{"wattage":450}', NULL),

  (510, 'ADATA Premier 8GB DDR4-2666', 5, 2499.00, '{"size_gb":8,"speed_mhz":2666,"type":"DDR4"}', NULL),
  (511, 'Crucial 8GB DDR4-3200', 5, 2699.00, '{"size_gb":8,"speed_mhz":3200,"type":"DDR4"}', NULL),

  (608, 'Kingston A400 240GB SATA SSD', 6, 2999.00, '{"interface":"SATA","capacity_gb":240}', NULL),
  (609, 'Crucial BX500 240GB SATA SSD', 6, 3199.00, '{"interface":"SATA","capacity_gb":240}', NULL),

  (705, 'Zebronics Zeb-Cab ZEB101 (mATX)', 7, 2999.00, '{"form_factor":"mATX"}', NULL),
  (706, 'Generic mATX Budget Case', 7, 2499.00, '{"form_factor":"mATX"}', NULL);
