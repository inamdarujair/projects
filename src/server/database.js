const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbFile = process.env.DB_FILE || path.join(__dirname, 'data/pcbuilder.db');
const schemaPath = path.join(__dirname, 'data/schema.sql');
const compatPath = path.join(__dirname, 'data/compatibility.json');

let db;

function getDb() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    
    db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Set pragma options
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
      resolve(db);
    });
  });
}

async function ensureSchema() {
  const database = await getDb();
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  
  return new Promise((resolve, reject) => {
    database.exec(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// ===== Users helpers =====
async function getUserByEmail(email) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.get('SELECT id, first_name, last_name, email, password, role FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function getUserById(id) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.get('SELECT id, first_name, last_name, email, password, role FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function createUser({ first_name, last_name, email, password, role = 'user' }) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO users (first_name, last_name, email, password, role) VALUES (?,?,?,?,?)`;
    database.run(stmt, [first_name || null, last_name || null, email, password, role], function(err){
      if (err) return reject(err);
      database.get('SELECT id, first_name, last_name, email, password, role FROM users WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return reject(err2);
        resolve(row);
      });
    });
  });
}

function parseComponent(row) {
  if (!row) return null;
  let specs = {};
  try {
    specs = row.specs ? JSON.parse(row.specs) : {};
  } catch (e) {
    specs = {};
  }
  return {
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    category_name: row.category_name || undefined,
    price: Number(row.price),
    socket: row.socket,
    specs,
  };
}

async function listCategories() {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.all('SELECT id, name FROM categories ORDER BY id', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getAllComponents(categoryId = null) {
  const database = await getDb();
  
  return new Promise((resolve, reject) => {
    let query, params;
    
    if (categoryId) {
      query = `SELECT c.*, cat.name as category_name
               FROM components c
               JOIN categories cat ON c.category_id = cat.id
               WHERE c.category_id = ?
               ORDER BY c.name`;
      params = [categoryId];
    } else {
      query = `SELECT c.*, cat.name as category_name
               FROM components c
               JOIN categories cat ON c.category_id = cat.id
               ORDER BY c.category_id, c.name`;
      params = [];
    }
    
    database.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(parseComponent));
      }
    });
  });
}

async function getComponentById(id) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const query = `SELECT c.*, cat.name as category_name
                   FROM components c
                   JOIN categories cat ON c.category_id = cat.id
                   WHERE c.id = ?`;
    
    database.get(query, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(parseComponent(row));
      }
    });
  });
}

async function createComponent({ name, category_id, price, specs = {}, socket = null }) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO components (name, category_id, price, specs, socket)
                   VALUES (?, ?, ?, ?, ?)`;
    const params = [name, category_id, price, JSON.stringify(specs || {}), socket];
    
    database.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        // this.lastID contains the inserted row ID
        getComponentById(this.lastID).then(resolve).catch(reject);
      }
    });
  });
}

async function updateComponent(id, { name, category_id, price, specs, socket }) {
  const existing = await getComponentById(id);
  if (!existing) return null;
  
  const newName = name ?? existing.name;
  const newCat = category_id ?? existing.category_id;
  const newPrice = price ?? existing.price;
  const newSpecs = specs !== undefined ? specs : existing.specs;
  const newSocket = socket !== undefined ? socket : existing.socket;

  const database = await getDb();
  return new Promise((resolve, reject) => {
    const query = `UPDATE components
                   SET name = ?, category_id = ?, price = ?, specs = ?, socket = ?
                   WHERE id = ?`;
    const params = [newName, newCat, newPrice, JSON.stringify(newSpecs || {}), newSocket, id];
    
    database.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        getComponentById(id).then(resolve).catch(reject);
      }
    });
  });
}

async function deleteComponent(id) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.run('DELETE FROM components WHERE id = ?', [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
}

async function getComponentsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT c.*, cat.name as category_name
                   FROM components c
                   JOIN categories cat ON c.category_id = cat.id
                   WHERE c.id IN (${placeholders})`;
    
    database.all(query, ids, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(parseComponent));
      }
    });
  });
}

function loadCompatibility() {
  const text = fs.readFileSync(compatPath, 'utf-8');
  return JSON.parse(text);
}

// ===== User builds =====
async function createUserBuild({ userId, name, selected, budget, totalPrice, purpose }){
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO user_builds (user_id, name, selected_json, budget, total_price, purpose) VALUES (?,?,?,?,?,?)`;
    database.run(stmt, [userId, name || null, JSON.stringify(selected || {}), budget ?? null, totalPrice ?? null, purpose || null], function(err){
      if (err) return reject(err);
      database.get('SELECT * FROM user_builds WHERE id = ?', [this.lastID], (e, row) => {
        if (e) return reject(e);
        resolve(row);
      });
    });
  });
}

async function listUserBuilds(userId){
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.all('SELECT * FROM user_builds WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  ensureSchema,
  listCategories,
  getAllComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getComponentsByIds,
  loadCompatibility,
  getUserByEmail,
  getUserById,
  createUser,
  createUserBuild,
  listUserBuilds,
};
