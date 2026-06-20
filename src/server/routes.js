const express = require('express');
const path = require('path');
const fs = require('fs');
const {
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
} = require('./database');

const router = express.Router();

// INR currency formatter for consistent pricing
const INR_FORMATTER = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const fmtMoney = (n) => INR_FORMATTER.format(Number(n)||0);

// Auth helpers (very simple session via signed cookie token)
const ADMIN_EMAIL = 'krishbhalerao9@gmail.com';

function getSessionUserId(req){
  return req.session && req.session.userId ? req.session.userId : null;
}

async function requireAuth(req, res, next){
  const uid = getSessionUserId(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const user = await getUserById(uid);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (e){
    res.status(500).json({ error: 'Auth error' });
  }
}

async function requireAdmin(req, res, next){
  const uid = getSessionUserId(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const user = await getUserById(uid);
    if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  } catch (e){
    res.status(500).json({ error: 'Auth error' });
  }
}

// ===== Auth routes =====
router.post('/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const user = await createUser({ first_name: firstName || null, last_name: lastName || null, email, password, role: email === ADMIN_EMAIL ? 'admin' : 'user' });
    req.session.userId = user.id;
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (e){
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await getUserByEmail(email);
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    if (remember) {
      // 30 days
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    } else {
      req.session.cookie.expires = false;
    }
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (e){
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/logout', (req, res) => {
  try {
    if (req.session) req.session.destroy(() => {});
  } catch {}
  res.json({ success: true });
});

router.get('/auth/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthenticated' });
    const user = await getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Unauthenticated' });
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (e){
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ===== User builds (auth required) =====
router.get('/builds', requireAuth, async (req, res) => {
  try {
    const list = await listUserBuilds(req.user.id);
    res.json(list.map(r => ({
      id: r.id,
      name: r.name,
      selected: JSON.parse(r.selected_json || '{}'),
      budget: r.budget,
      total_price: r.total_price,
      purpose: r.purpose,
      created_at: r.created_at,
    })));
  } catch (e){
    res.status(500).json({ error: 'Failed to list builds' });
  }
});

router.post('/builds', requireAuth, async (req, res) => {
  try {
    const { name, selected = {}, budget = null, totalPrice = null, purpose = null } = req.body || {};
    const saved = await createUserBuild({ userId: req.user.id, name, selected, budget, totalPrice, purpose });
    res.status(201).json({ id: saved.id });
  } catch (e){
    res.status(500).json({ error: 'Failed to save build' });
  }
});

// Categories
router.get('/categories', async (req, res) => {
  try {
    const cats = await listCategories();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories', details: String(err) });
  }
});

// Components CRUD
router.get('/components', async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const items = await getAllComponents(categoryId);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch components', details: String(err) });
  }
});

router.get('/components/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await getComponentById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch component', details: String(err) });
  }
});

router.post('/components', requireAdmin, async (req, res) => {
  try {
    const { name, category_id, price, specs, socket } = req.body;
    if (!name || !category_id || price === undefined) {
      return res.status(400).json({ error: 'name, category_id and price are required' });
    }
    const created = await createComponent({ name, category_id, price, specs, socket });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create component', details: String(err) });
  }
});

router.put('/components/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await updateComponent(id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update component', details: String(err) });
  }
});

router.delete('/components/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = await deleteComponent(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete component', details: String(err) });
  }
});

// Build validation
const compat = loadCompatibility();

function getField(comp, field) {
  if (field in comp) return comp[field];
  return comp.specs ? comp.specs[field] : undefined;
}

async function validateBuild(selectedMap, budget) {
  const result = { success: true, totalPrice: 0, budgetExceeded: false, issues: [] };
  
  // Check minimum budget requirement (20,000 INR)
  const MIN_BUDGET_INR = 20000;
  if (typeof budget === 'number' && budget > 0 && budget < MIN_BUDGET_INR) {
    result.success = false;
    result.issues.push(`Minimum budget of ${fmtMoney(MIN_BUDGET_INR)} required. Please increase your budget.`);
    return result;
  }

  // Fetch selected components by IDs
  const ids = Object.values(selectedMap).filter(Boolean);
  const comps = await getComponentsByIds(ids);
  const byCategory = {};
  for (const c of comps) {
    byCategory[c.category_name] = c;
  }

  // Sum price
  result.totalPrice = comps.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  if (typeof budget === 'number' && budget > 0 && result.totalPrice > budget) {
    result.budgetExceeded = true;
    result.issues.push(`Budget exceeded by ${fmtMoney(result.totalPrice - budget)}`);
  }

  // Evaluate rules
  for (const rule of compat.rules || []) {
    if (rule.type === 'field-equality') {
      const fromC = byCategory[rule.fromCategory];
      const toC = byCategory[rule.toCategory];
      if (fromC && toC) {
        const a = getField(fromC, rule.fromField);
        const b = getField(toC, rule.toField);
        if (!a || !b || String(a).toLowerCase() !== String(b).toLowerCase()) {
          result.issues.push(rule.message || `${rule.fromCategory} ${rule.fromField} must match ${rule.toCategory} ${rule.toField}`);
        }
      }
    } else if (rule.type === 'psu-min-wattage') {
      const gpu = byCategory['GPU'];
      const psu = byCategory['PSU'];
      if (gpu && psu) {
        const need = Number(getField(gpu, rule.gpuField));
        const have = Number(getField(psu, rule.psuField));
        if (Number.isFinite(need) && Number.isFinite(have)) {
          if (have < need) {
            result.issues.push(rule.message || `PSU wattage ${have}W is less than GPU requirement ${need}W`);
          }
        }
      }
    }
  }

  result.success = result.issues.length === 0;
  return result;
}

router.post('/build/validate', async (req, res) => {
  try {
    const { selected = {}, budget = null } = req.body || {};
    const result = await validateBuild(selected, typeof budget === 'number' ? budget : null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate build', details: String(err) });
  }
});

// --- Build Suggestion (AI-like heuristic) ---
function getWeights(purpose) {
  const presets = {
    gaming:      { GPU: 50, CPU: 20, Motherboard: 10, RAM: 8,  Storage: 7,  PSU: 4, Case: 1 },
    workstation: { GPU: 25, CPU: 30, Motherboard: 12, RAM: 14, Storage: 12, PSU: 5, Case: 2 },
    balanced:    { GPU: 35, CPU: 25, Motherboard: 12, RAM: 10, Storage: 12, PSU: 5, Case: 1 },
    office:      { GPU: 5,  CPU: 30, Motherboard: 15, RAM: 20, Storage: 20, PSU: 8, Case: 2 },
    coders:      { GPU: 20, CPU: 30, Motherboard: 12, RAM: 18, Storage: 15, PSU: 4, Case: 1 },
  };
  return presets[purpose] || presets.balanced;
}

function normalizePurpose(p) {
  const s = String(p||'').toLowerCase().trim();
  if (s.includes('office')) return 'office';
  if (s.includes('coder') || s.includes('dev') || s.includes('program')) return 'coders';
  if (s.includes('game')) return 'gaming';
  if (s.includes('work')) return 'workstation';
  if (!s) return 'balanced';
  return s;
}

function groupByCategoryName(items) {
  const out = {};
  for (const it of items) {
    const k = it.category_name;
    if (!out[k]) out[k] = [];
    out[k].push(it);
  }
  return out;
}

function pickBestUnder(list, target) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const byPriceAsc = [...list].sort((a,b) => Number(a.price) - Number(b.price));
  let best = null;
  for (const item of byPriceAsc) {
    if (Number(item.price) <= target) best = item; else break;
  }
  return best || byPriceAsc[0];
}

function pickCheapest(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return [...list].sort((a,b) => Number(a.price) - Number(b.price))[0];
}

function chooseCpuMobo(cpus, mobos, cpuTarget, moboTarget, opts = {}) {
  const preferAPU = !!opts.preferAPU;
  const pairs = [];
  for (const cpu of cpus || []) {
    for (const mb of (mobos || []).filter(m => m.socket && cpu.socket && m.socket === cpu.socket)) {
      const price = Number(cpu.price) + Number(mb.price);
      const isAPU = /\b(\d+G)\b/i.test(cpu.name) || /apu/i.test(cpu.name);
      const score = price + (preferAPU ? (isAPU ? -50 : 30) : 0); // nudge toward APUs for office
      pairs.push({ cpu, mb, price, score });
    }
  }
  if (pairs.length === 0) return { cpu: pickCheapest(cpus), mb: pickCheapest(mobos) };
  const target = (cpuTarget || 0) + (moboTarget || 0);
  // Sort by score first, then by price proximity to target
  const byScore = pairs.sort((a,b) => a.score - b.score || a.price - b.price);
  // Prefer the best-scored pair under target; otherwise the best overall
  let chosen = byScore[0];
  for (const p of byScore) {
    if (p.price <= target) { chosen = p; break; }
  }
  return { cpu: chosen.cpu, mb: chosen.mb };
}

router.post('/build/suggest', async (req, res) => {
    try {
      const { budget = 100000, purpose = 'balanced' } = req.body || {}; // Default 1 lakh INR
    const normPurpose = normalizePurpose(purpose);
    const weights = getWeights(normPurpose);

    // Budget profile factors: office uses less, coders mid, gaming full
    const budgetFactor = normPurpose === 'office' ? 0.7 : normPurpose === 'coders' ? 0.85 : 1.0;
    const rawBudget = Number(budget) || 0;
    // Keep effective budget <= user budget but never increase; for strict fit, don't inflate
    const effBudget = Math.max(0, Math.min(rawBudget, Math.round(rawBudget * budgetFactor)));

    const allComponents = await getAllComponents(null);
    const compsByCat = groupByCategoryName(allComponents);

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const gpuTarget = clamp((weights.GPU || 0) / 100 * effBudget, 0, effBudget * 0.55);
    const cpuTarget = clamp((weights.CPU || 0) / 100 * effBudget, 0, effBudget * 0.50);
    const mbTarget  = clamp((weights.Motherboard || 0) / 100 * effBudget, 0, effBudget * 0.35);
    const ramTarget = clamp((weights.RAM || 0) / 100 * effBudget, 0, effBudget * 0.25);
    const psuTarget = clamp((weights.PSU || 0) / 100 * effBudget, 0, effBudget * 0.25);
    const stoTarget = clamp((weights.Storage || 0) / 100 * effBudget, 0, effBudget * 0.25);
    const caseTarget = clamp((weights.Case || 0) / 100 * effBudget, 0, effBudget * 0.15);

    const result = { selected: {}, notes: [], purpose: normPurpose, budget, effectiveBudget: effBudget, weights, issues: [], totalPrice: 0 };

    // 1) CPU + Motherboard as a pair (for office, prefer APUs to skip GPU)
    const preferAPU = normPurpose === 'office';
    const cpuMobo = chooseCpuMobo(compsByCat['CPU'], compsByCat['Motherboard'], cpuTarget, mbTarget, { preferAPU });
    if (cpuMobo.cpu) result.selected['CPU'] = cpuMobo.cpu.id; else result.notes.push('No CPU available');
    if (cpuMobo.mb) result.selected['Motherboard'] = cpuMobo.mb.id; else result.notes.push('No Motherboard available');

    // 2) GPU: for office, try to skip if CPU is an APU; gaming prefers best under target; coders moderate
    let gpu = null;
    const cpuIsAPU = cpuMobo.cpu && (/\b(\d+G)\b/i.test(cpuMobo.cpu.name) || /apu/i.test(cpuMobo.cpu.name));
    const veryLowBudget = effBudget < 40000;
    if ((normPurpose === 'office' || veryLowBudget) && cpuIsAPU) {
      // skip GPU to keep efficiency and cost low
    } else {
      const gpuList = compsByCat['GPU'] || [];
      if (normPurpose === 'office') {
        // pick lowest power, cheapest GPU under tiny target if needed
        const byWattThenPrice = [...gpuList].sort((a,b) => (Number(a.specs?.recommended_psu_watts||9999) - Number(b.specs?.recommended_psu_watts||9999)) || (Number(a.price)-Number(b.price)));
        gpu = pickBestUnder(byWattThenPrice, Math.min(gpuTarget, effBudget * 0.35)) || byWattThenPrice[0];
      } else if (normPurpose === 'gaming') {
        gpu = pickBestUnder(gpuList, Math.min(gpuTarget, effBudget * 0.5)) || pickCheapest(gpuList);
      } else {
        // coders / others
        gpu = pickBestUnder(gpuList, Math.min(gpuTarget, effBudget * 0.45)) || pickCheapest(gpuList);
      }
      if (gpu) result.selected['GPU'] = gpu.id; else result.notes.push('No GPU available');
    }

    // 3) RAM: must match motherboard memory_type
    let ram = null;
    let mbSpecs = (cpuMobo.mb && cpuMobo.mb.specs) || {};
    const needType = (mbSpecs && mbSpecs.memory_type) ? String(mbSpecs.memory_type).toUpperCase() : null;
    const ramList = (compsByCat['RAM'] || []).filter(r => !needType || (r.specs && String(r.specs.type).toUpperCase() === needType));
    ram = pickBestUnder(ramList, ramTarget) || pickCheapest(ramList) || pickCheapest(compsByCat['RAM']);
    if (ram) result.selected['RAM'] = ram.id; else result.notes.push('No RAM available');

    // 4) Storage: NVMe >= 1TB normally; for low budgets allow SATA 240GB+ or NVMe 500GB+
    let storageCandidates = (compsByCat['Storage'] || []).filter(s => {
      const iface = s.specs && String(s.specs.interface||'');
      const cap = s.specs && Number(s.specs.capacity_gb || 0);
      if (veryLowBudget) return (String(iface).toUpperCase() === 'SATA' && cap >= 240) || (String(iface).toUpperCase() === 'NVME' && cap >= 500);
      return (String(iface).toUpperCase() === 'NVME') && cap >= 1000;
    });
    const storage = pickBestUnder(storageCandidates, stoTarget) || pickCheapest(storageCandidates) || pickCheapest(compsByCat['Storage']);
    if (storage) result.selected['Storage'] = storage.id;

    // 5) PSU: must meet GPU recommended_psu_watts
    let needWatts = 0;
    if (gpu && gpu.specs && Number(gpu.specs.recommended_psu_watts)) needWatts = Number(gpu.specs.recommended_psu_watts);
    const psuCandidates = (compsByCat['PSU'] || []).filter(p => {
      const w = Number(p.specs && p.specs.wattage);
      return (needWatts && Number.isFinite(needWatts) && needWatts > 0) ? w >= needWatts : w >= 400;
    });
    const psu = pickBestUnder(psuCandidates, psuTarget) || pickCheapest(psuCandidates) || pickCheapest(compsByCat['PSU']);
    if (psu) result.selected['PSU'] = psu.id; else result.notes.push('No PSU available');

    // 6) Case: pick affordable
    const pcCase = pickBestUnder(compsByCat['Case'], caseTarget) || pickCheapest(compsByCat['Case']);
    if (pcCase) result.selected['Case'] = pcCase.id;

    // Compute total and validate
    const ids = Object.values(result.selected).filter(Boolean);
    const chosen = await getComponentsByIds(ids);
    result.totalPrice = chosen.reduce((s, c) => s + Number(c.price||0), 0);

    const validation = await validateBuild(result.selected, budget);
    result.issues = validation.issues || [];
    result.success = validation.success;
    result.budgetExceeded = validation.budgetExceeded || (result.totalPrice > (Number(budget)||0));

    // If over effective budget, aggressively downgrade to fit budget
    async function recomputeTotal(){
      const ids2 = Object.values(result.selected).filter(Boolean);
      const chosen2 = await getComponentsByIds(ids2);
      return chosen2.reduce((s, c) => s + Number(c.price||0), 0);
    }

    if (effBudget && result.totalPrice > effBudget){
      // 1) If APU and very low budget/office, drop GPU entirely
      const veryLowBudget2 = effBudget < 40000;
      if ((normPurpose === 'office' || veryLowBudget2) && cpuIsAPU && result.selected['GPU']){
        delete result.selected['GPU'];
        result.totalPrice = await recomputeTotal();
      }
      // 2) Relax storage threshold if still over: allow SATA >= 240GB or NVMe >= 500GB
      if (!result.selected['Storage']) {
        const relaxed = (compsByCat['Storage'] || []).filter(s => {
          const iface = s.specs && String(s.specs.interface||'').toUpperCase();
          const cap = s.specs && Number(s.specs.capacity_gb || 0);
          return (iface === 'SATA' && cap >= 240) || (iface === 'NVME' && cap >= 500);
        });
        const s2 = pickBestUnder(relaxed, stoTarget) || pickCheapest(relaxed) || pickCheapest(compsByCat['Storage']);
        if (s2) {
          result.selected['Storage'] = s2.id;
          result.totalPrice = await recomputeTotal();
        }
      }

      // 3) Replace categories with absolute cheapest until under budget
      const order = ['GPU','CPU','Motherboard','RAM','Storage','PSU','Case'];
      for (const cat of order){
        if (result.totalPrice <= effBudget) break;
        const cheapest = pickCheapest(compsByCat[cat]);
        if (cheapest && result.selected[cat] !== cheapest.id){
          result.selected[cat] = cheapest.id;
          result.totalPrice = await recomputeTotal();
        }
      }

      // 4) As last resort, drop optional GPU if still over budget and not gaming
      if (result.totalPrice > effBudget && normPurpose !== 'gaming' && result.selected['GPU']){
        delete result.selected['GPU'];
        result.totalPrice = await recomputeTotal();
      }
      // Re-run validation
      const v2 = await validateBuild(result.selected, effBudget);
      result.issues = v2.issues || [];
      result.success = v2.success && (result.totalPrice <= effBudget);
      result.budgetExceeded = result.totalPrice > effBudget ? true : false;
    }

    // If significantly under budget (> 10% gap), try to upgrade parts to better fit the budget without exceeding it
    const targetBudget = rawBudget || effBudget;
    if (targetBudget && result.totalPrice < targetBudget * 0.9) {
      const underBudgetBy = targetBudget - result.totalPrice;
      const upgradeOrder = ['GPU','CPU','Motherboard','RAM','Storage','PSU','Case'];
      const current = await getComponentsByIds(Object.values(result.selected).filter(Boolean));
      const curByCat = {};
      for (const c of current) curByCat[c.category_name] = c;

      for (const cat of upgradeOrder) {
        if (result.totalPrice >= targetBudget * 0.98) break; // close enough
        const list = (compsByCat[cat] || []).slice().sort((a,b) => Number(a.price) - Number(b.price));
        const currentItem = curByCat[cat] || null;
        if (!currentItem) continue;
        // Find the best upgrade that keeps us within budget
        let bestUpgrade = null;
        for (const option of list) {
          if (option.id === currentItem.id) continue;
          const hypothetical = result.totalPrice - Number(currentItem.price||0) + Number(option.price||0);
          if (hypothetical <= targetBudget && (!bestUpgrade || Number(option.price) > Number(bestUpgrade.price))) {
            bestUpgrade = option;
          }
        }
        if (bestUpgrade) {
          result.selected[cat] = bestUpgrade.id;
          result.totalPrice = await recomputeTotal();
        }
      }

      // Re-validate after upgrades
      const v3 = await validateBuild(result.selected, targetBudget);
      result.issues = v3.issues || [];
      result.success = v3.success && (result.totalPrice <= targetBudget);
      result.budgetExceeded = result.totalPrice > targetBudget ? true : false;
    }

    // Rationale / summary
    const byCat = {};
    for (const c of chosen) byCat[c.category_name] = c;
    const lines = [];
    const prettyMoney = (n) => fmtMoney(n);
    lines.push(`Purpose: ${result.purpose} — using ${prettyMoney(result.effectiveBudget)} of your ${prettyMoney(result.budget)} budget.`);
    lines.push(`Budget allocation by category: ${Object.entries(result.weights).map(([k,v]) => `${k} ${v}%`).join(', ')}.`);

    if (byCat['CPU'] && byCat['Motherboard']) {
      lines.push(`CPU ${byCat['CPU'].name} with ${byCat['Motherboard'].name} because their sockets match (${byCat['CPU'].socket}).`);
    } else if (byCat['CPU']) {
      lines.push(`CPU ${byCat['CPU'].name} selected to fit target spend.`);
    }

    if (normPurpose === 'office' && cpuIsAPU && !byCat['GPU']) {
      lines.push(`No discrete GPU selected to maximize efficiency and reduce cost (APU provides integrated graphics).`);
    } else if (byCat['GPU']) {
      const needW = Number(byCat['GPU'].specs?.recommended_psu_watts||0);
      lines.push(`GPU ${byCat['GPU'].name} chosen to match purpose within budget${needW?`, requiring ~${needW}W PSU`:''}.`);
    }

    if (byCat['RAM'] && byCat['Motherboard']) {
      const rType = byCat['RAM'].specs?.type;
      const mType = byCat['Motherboard'].specs?.memory_type;
      if (rType && mType) lines.push(`RAM type ${rType} matches motherboard memory type ${mType}.`);
    }

    if (byCat['PSU'] && byCat['GPU']) {
      const need = Number(byCat['GPU'].specs?.recommended_psu_watts||0);
      const have = Number(byCat['PSU'].specs?.wattage||0);
      if (need && have) lines.push(`PSU ${have}W meets or exceeds GPU recommended ${need}W.`);
    } else if (byCat['PSU']) {
      lines.push(`PSU selected conservatively to balance efficiency and headroom.`);
    }

    if (byCat['Storage']) {
      const iface = byCat['Storage'].specs?.interface;
      const cap = byCat['Storage'].specs?.capacity_gb;
      if (iface) lines.push(`Storage favors ${iface} for responsiveness${cap?`, capacity ${cap}GB`:''}.`);
    }

    lines.push(`Estimated total: ${prettyMoney(result.totalPrice)}${result.budgetExceeded?' (over budget)':''}.`);
    if (result.issues?.length) lines.push(`Compatibility check surfaced ${result.issues.length} issue(s). You can tweak parts in the UI.`);
    result.summary = lines.join('\n');

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to suggest build', details: String(err) });
  }
});

module.exports = router;
