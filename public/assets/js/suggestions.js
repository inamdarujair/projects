(function(){
  const API_BASE = '/api';
  const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const money = v => moneyFmt.format(Number(v)||0);

  function $(sel, root=document){ return root.querySelector(sel); }

  async function fetchJSON(path, opts={}){
    const res = await fetch(path, { headers: { 'Content-Type':'application/json', ...(opts.headers||{}) }, ...opts });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    const go = $('#go');
    go.addEventListener('click', generate);
    const saveBtn = document.getElementById('save-suggested-build');
    if (saveBtn) saveBtn.addEventListener('click', onSaveSuggested);
    // Prefill from query params if provided, then auto-run once
    const params = new URLSearchParams(window.location.search);
    const qBudget = params.get('budget');
    const qPurpose = params.get('purpose');
    if (qBudget) { const n = Number(qBudget); if (Number.isFinite(n) && n > 0) { $('#budget').value = String(n); } }
    if (qPurpose) { $('#purpose').value = qPurpose; }
    try { await generate(); } catch {}
  }

  async function generate(){
    const budget = Number($('#budget').value) || 70000;
    if (budget < 20000) { alert('Please enter a budget more than ₹20,000.'); return; }
    const purpose = $('#purpose').value || 'gaming';

    const [cats, all] = await Promise.all([
      fetchJSON(`${API_BASE}/categories`),
      fetchJSON(`${API_BASE}/components`)
    ]);

    const compsById = new Map(all.map(c => [Number(c.id), c]));
    const compsByCat = {};
    for (const c of all){
      const k = c.category_name; if (!compsByCat[k]) compsByCat[k] = []; compsByCat[k].push(c);
    }

    const res = await fetchJSON(`${API_BASE}/build/suggest`, {
      method: 'POST',
      body: JSON.stringify({ budget, purpose })
    });

    renderBuild(res, compsById);
    // Show save button if authenticated
    const saveBtn = document.getElementById('save-suggested-build');
    if (saveBtn){
      try {
        const me = await fetchJSON('/api/auth/me', { credentials: 'include' });
        if (me && me.id) saveBtn.style.display = '';
        else saveBtn.style.display = 'none';
      } catch { saveBtn.style.display = 'none'; }
      saveBtn.dataset.payload = JSON.stringify({ suggest: res });
    }
    renderUpgrades(res.selected||{}, compsByCat);
    renderPerfScores(res.selected||{}, all);
  }

  async function onSaveSuggested(){
    const saveBtn = document.getElementById('save-suggested-build');
    const status = document.getElementById('save-status');
    if (!saveBtn || !saveBtn.dataset.payload) return;
    try {
      const { suggest } = JSON.parse(saveBtn.dataset.payload || '{}');
      const selected = suggest?.selected || {};
      const totalPrice = Number(suggest?.totalPrice || 0);
      const budget = Number(document.getElementById('budget')?.value || 0) || null;
      const purpose = document.getElementById('purpose')?.value || null;
      const name = prompt('Name this suggested build', 'Suggested Build') || 'Suggested Build';
      await fetchJSON('/api/builds', {
        method: 'POST',
        body: JSON.stringify({ name, selected, totalPrice, budget, purpose }),
        credentials: 'include'
      });
      if (status){ status.textContent = 'Saved!'; status.style.display = ''; setTimeout(()=>{ status.style.display='none'; }, 2000); }
    } catch (e){
      alert('Save failed. Please log in.');
    }
  }

  function renderPerfScores(selectedMap, all){
    const box = document.getElementById('perf-scores');
    if (!box) return;
    // Find selected CPU / GPU / RAM
    let cpu=null,gpu=null,ram=null;
    const byId = new Map(all.map(c => [Number(c.id), c]));
    for (const [cat,id] of Object.entries(selectedMap||{})){
      const c = byId.get(Number(id)); if (!c) continue;
      const catName = String(cat).toLowerCase();
      if (catName.includes('cpu')) cpu=c;
      else if (catName.includes('gpu') || catName.includes('graphics')) gpu=c;
      else if (catName.includes('ram') || catName.includes('memory')) ram=c;
    }
    if (!cpu || !gpu){
      box.innerHTML = '<div class="hint">Need CPU and GPU in the build to estimate performance.</div>';
      return;
    }

    // Build norms across dataset
    const cpus = all.filter(x => /cpu/i.test(x.category_name));
    const gpus = all.filter(x => /(gpu|graphics)/i.test(x.category_name));
    const rams = all.filter(x => /ram/i.test(x.category_name));
    const minmax = (arr, f) => {
      let mn=Infinity,mx=-Infinity; for (const x of arr){ const v=f(x); if (Number.isFinite(v)){ if (v<mn) mn=v; if (v>mx) mx=v; } }
      if (!Number.isFinite(mn) || !Number.isFinite(mx) || mn===mx) { mn=1; mx=2; }
      return [mn,mx];
    };
    const price = x => Number(x.price)||0;
    const [cpuMin,cpuMax] = minmax(cpus, price);
    const [gpuMin,gpuMax] = minmax(gpus, price);

    const norm = (v,min,max) => Math.max(0, Math.min(1, (v-min)/(max-min)));
    const cpuNorm = norm(price(cpu), cpuMin, cpuMax);
    const gpuNorm = norm(price(gpu), gpuMin, gpuMax);

    // RAM capacity (GB) parse from specs or name
    function ramGBOf(r){
      if (!r) return 16;
      const cap = Number(r?.specs?.capacity_gb || r?.specs?.size_gb || NaN);
      if (Number.isFinite(cap)) return cap;
      const m = String(r.name||'').match(/(\d+)\s?gb/i);
      return m ? Number(m[1]) : 16;
    }
    if (!ram){ ram = rams[0] || null; }
    const ramGB = ramGBOf(ram);
    const ramNorm = Math.max(0, Math.min(1, (ramGB - 8) / (64 - 8)));

    // CPU factor
    const cpuFactor = (cpu.performance && Number(cpu.performance.cpuBoundFactor)) || (0.7 + 0.3*cpuNorm);

    // Valorant FPS: prefer data if present
    const baseVal = gpu.performance && gpu.performance.fps && Number(gpu.performance.fps['Valorant']);
    const valorant = Number.isFinite(baseVal) ? Math.round(baseVal * Math.min(1, cpuFactor))
                   : Math.round(60 + 200 * gpuNorm * Math.min(1, cpuFactor));

    // Blender viewport FPS (heuristic)
    const blender = Math.round(15 + 45 * gpuNorm * (0.6 + 0.4*cpuNorm));

    // Chrome tabs smooth (count)
    let tabs = Math.round(10 + (ramGB-8)/2 + cpuNorm*5);
    tabs = Math.max(10, Math.min(60, tabs));

    // Basic apps score 0..100
    const basicScore = Math.round(50 + 50*cpuNorm + 20*ramNorm);

    // Performance score color coding
    const getScoreColor = (score, max) => {
      const percentage = score / max;
      if (percentage >= 0.8) return '#00ff88'; // Green for excellent
      if (percentage >= 0.6) return '#ffb347'; // Orange for good
      if (percentage >= 0.4) return '#ff6b35'; // Orange-red for fair
      return '#ff4d4d'; // Red for poor
    };

    const valorantColor = getScoreColor(valorant, 300);
    const blenderColor = getScoreColor(blender, 60);
    const tabsColor = getScoreColor(tabs, 50);
    const basicColor = getScoreColor(basicScore, 100);

    box.innerHTML = `
      <div class="perf-table">
        <div class="row head" style="display:grid;grid-template-columns:200px 1fr;gap:8px">
          <div>🎮 App / Game</div>
          <div>⚡ Performance</div>
        </div>
        <div class="row" style="display:grid;grid-template-columns:200px 1fr;gap:8px">
          <div>🎯 Valorant</div>
          <div style="color: ${valorantColor}; font-weight: 600;">${valorant} FPS</div>
        </div>
        <div class="row" style="display:grid;grid-template-columns:200px 1fr;gap:8px">
          <div>🎨 Blender (Viewport)</div>
          <div style="color: ${blenderColor}; font-weight: 600;">${blender} FPS</div>
        </div>
        <div class="row" style="display:grid;grid-template-columns:200px 1fr;gap:8px">
          <div>🌐 Chrome</div>
          <div style="color: ${tabsColor}; font-weight: 600;">~${tabs} smooth tabs</div>
        </div>
        <div class="row" style="display:grid;grid-template-columns:200px 1fr;gap:8px">
          <div>💻 Basic Apps</div>
          <div style="color: ${basicColor}; font-weight: 600;">Score ${basicScore}/100</div>
        </div>
      </div>
      <div class="hint" style="margin-top:8px">
        <span>📊</span>
        These are estimates based on relative component performance; actual results vary by workload and settings.
      </div>
    `;
  }

  function renderBuild(suggest, compsById){
    const table = $('#build-table');
    const summary = $('#build-summary');
    const issues = $('#build-issues');
    if (!suggest) { table.innerHTML = ''; summary.textContent = ''; issues.textContent=''; return; }

    const sel = suggest.selected || {};
    const rows = [];
    rows.push('<div class="row head" style="display:grid;grid-template-columns:160px 1fr 120px;gap:8px"><div>Category</div><div>Component</div><div>Price</div></div>');
    let total = 0;
    for (const [cat, id] of Object.entries(sel)){
      const c = compsById.get(Number(id));
      if (!c) continue;
      total += Number(c.price)||0;
      rows.push(`<div class="row" style="display:grid;grid-template-columns:160px 1fr 120px;gap:8px"><div>${cat}</div><div>${escapeHtml(c.name)}</div><div>${money(c.price)}</div></div>`);
    }
    rows.push(`<div class="row" style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;padding-top:6px"><strong>Total</strong><strong>${money(total)}</strong></div>`);
    table.innerHTML = rows.join('');

    summary.textContent = suggest.summary || '';

    if (suggest.issues && suggest.issues.length){
      issues.innerHTML = `<div class="issues"><strong>Issues</strong><ul>${suggest.issues.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`;
    } else {
      issues.textContent = '';
    }
  }

  function renderUpgrades(selectedMap, compsByCat){
    const container = $('#upgrade-ideas');
    const THRESH_ADD = 2000;
    const THRESH_CUT = 2000;

    const lines = [];

    function byPrice(cat){
      return (compsByCat[cat]||[]).slice().sort((a,b)=>Number(a.price)-Number(b.price));
    }

    for (const [cat, id] of Object.entries(selectedMap)){
      const list = byPrice(cat);
      const idx = list.findIndex(x => Number(x.id) === Number(id));
      if (idx === -1) continue;
      const current = list[idx];
      const higher = list[idx+1];
      const lower = list[idx-1];
      if (higher){
        const extra = Number(higher.price) - Number(current.price);
        if (extra > 0 && extra <= THRESH_ADD){
          lines.push(`For ${money(extra)} more: upgrade <strong>${cat}</strong> from <em>${escapeHtml(current.name)}</em> → <strong>${escapeHtml(higher.name)}</strong>.`);
        }
      }
      if (lower){
        const save = Number(current.price) - Number(lower.price);
        if (save > 0 && save <= THRESH_CUT){
          lines.push(`Save ${money(save)}: switch <strong>${cat}</strong> from <em>${escapeHtml(current.name)}</em> → <strong>${escapeHtml(lower.name)}</strong>.`);
        }
      }
    }

    if (!lines.length){
      container.innerHTML = '<div class="hint">No small-change ideas found. Try a different budget or purpose.</div>';
    } else {
      container.innerHTML = '<ul>' + lines.map(x => `<li>${x}</li>`).join('') + '</ul>';
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]||c));
  }
})();