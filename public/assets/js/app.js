(function(){
  const API_BASE = '/api';

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const money = v => moneyFmt.format(Number(v)||0);

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('user-app')) initUserPanel();
    if (document.getElementById('admin-app')) initAdminPanel();
    
    // Enhanced panel hover effects
    initPanelHoverEffects();

    // Hide admin link for non-admin users
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('not auth');
        const me = await res.json();
        const adminLink = document.querySelector('a[href="/admin.html"]');
        if (adminLink && (!me || me.email !== 'krishbhalerao9@gmail.com')) adminLink.style.display = 'none';
        // Toggle auth nav
        const loginLink = document.getElementById('login-link');
        const signupLink = document.getElementById('signup-link');
        const profileLink = document.getElementById('profile-link');
        const logoutLink = document.getElementById('logout-link');
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (profileLink) profileLink.style.display = '';
        if (logoutLink) logoutLink.style.display = '';
        if (logoutLink) logoutLink.addEventListener('click', async (e) => {
          e.preventDefault();
          try { await fetchJSON('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
          window.location.href = '/login.html';
        });
      } catch (e){
        const adminLink = document.querySelector('a[href="/admin.html"]');
        if (adminLink) adminLink.style.display = 'none';
        // Show login/signup when not authenticated
        const loginLink = document.getElementById('login-link');
        const signupLink = document.getElementById('signup-link');
        const profileLink = document.getElementById('profile-link');
        const logoutLink = document.getElementById('logout-link');
        if (loginLink) loginLink.style.display = '';
        if (signupLink) signupLink.style.display = '';
        if (profileLink) profileLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'none';
      }
    })();
  });

  function initPanelHoverEffects() {
    const panels = document.querySelectorAll('.panel');
    
    panels.forEach(panel => {
      panel.addEventListener('mousemove', (e) => {
        const rect = panel.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        panel.style.setProperty('--mouse-x', x + '%');
        panel.style.setProperty('--mouse-y', y + '%');
      });
      
      panel.addEventListener('mouseleave', () => {
        panel.style.setProperty('--mouse-x', '50%');
        panel.style.setProperty('--mouse-y', '50%');
      });
    });
  }

  async function fetchJSON(path, opts={}){
    const res = await fetch(path, { headers: { 'Content-Type':'application/json', ...(opts.headers||{}) }, ...opts });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // ===== User Panel =====
  async function initUserPanel(){
    const selectsContainer = document.getElementById('category-selects');
    const detailsPanel = document.getElementById('details-panel');
    const summaryList = document.getElementById('summary-list');
    const totalPriceEl = document.getElementById('total-price');
    const budgetInput = document.getElementById('budget');
    const validateBtn = document.getElementById('validate-btn');
    const validationResult = document.getElementById('validation-result');

    const allCategories = await fetchJSON(`${API_BASE}/categories`);
    const allComponents = await fetchJSON(`${API_BASE}/components`);

    const showCats = ['CPU', 'Motherboard', 'GPU', 'PSU', 'RAM'];
    const catByName = Object.fromEntries(allCategories.map(c => [c.name, c]));
    const compsByCatName = {};
    for (const c of allComponents){
      const name = c.category_name;
      if(!compsByCatName[name]) compsByCatName[name] = [];
      compsByCatName[name].push(c);
    }

    const state = { selected: {} }; // { CategoryName: componentId }

    for (const catName of showCats){
      const wrap = document.createElement('div');
      wrap.className = 'row';
      const label = document.createElement('label');
      label.textContent = catName;
      const select = document.createElement('select');
      select.dataset.category = catName;
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = `-- Select ${catName} --`;
      select.appendChild(emptyOpt);
      (compsByCatName[catName] || []).forEach(comp => {
        const opt = document.createElement('option');
        opt.value = comp.id;
        opt.textContent = `${comp.name} (${money(comp.price)})`;
        select.appendChild(opt);
      });
      select.addEventListener('change', async () => {
        const id = select.value ? Number(select.value) : null;
        state.selected[catName] = id;
        if (id){
          const comp = await fetchJSON(`${API_BASE}/components/${id}`);
          renderDetails(comp);
        }
        renderSummary();
      });
      wrap.appendChild(label);
      wrap.appendChild(select);
      selectsContainer.appendChild(wrap);
    }

    $('#budget').addEventListener('input', renderSummary);
    validateBtn.addEventListener('click', onValidate);
    // Save build is managed on suggestions page; none here

    // Suggest Build
    const suggestBtn = document.getElementById('suggest-btn');
    const purposeEl = document.getElementById('suggest-purpose');
    if (suggestBtn) {
      suggestBtn.addEventListener('click', onSuggest);
    }

    // Auto-suggest on first load (disabled to avoid redirect on page load)
    // try { await onSuggest(); } catch {}

    async function onSuggest(){
      const budget = Number(budgetInput.value) || 100000; // Default 1 lakh INR
      
      // Budget validation - minimum 20,000 INR
      if (budget < 20000) {
        alert('Please enter a budget more than ₹20,000. A minimum of ₹20,000 is required to build a functional PC.');
        budgetInput.focus();
        return;
      }
      
      const purpose = purposeEl ? purposeEl.value : 'balanced';
      // Redirect to dedicated suggestions page with query params
      const url = `/suggestions.html?budget=${encodeURIComponent(budget)}&purpose=${encodeURIComponent(purpose)}`;
      window.location.href = url;
    }

    function renderDetails(comp){
      const lines = [];
      lines.push(`<div class="item"><strong>${escapeHtml(comp.name)}</strong></div>`);
      lines.push(`<div class="item">📂 Category: ${escapeHtml(comp.category_name)}</div>`);
      if (comp.socket) lines.push(`<div class="item">🔌 Socket: ${escapeHtml(comp.socket)}</div>`);
      lines.push(`<div class="item">💰 Price: ${money(comp.price)}</div>`);
      if (comp.specs && typeof comp.specs === 'object'){
        lines.push(`<div class="item"><strong>⚙️ Specifications</strong></div>`);
        for (const [k,v] of Object.entries(comp.specs)){
          lines.push(`<div class="item">${escapeHtml(k)}: ${escapeHtml(String(v))}</div>`);
        }
      }
      
      // Add animation class
      detailsPanel.classList.add('loading');
      setTimeout(() => {
        detailsPanel.innerHTML = lines.join('');
        detailsPanel.classList.remove('loading');
      }, 200);
    }

    function renderSummary(){
      const items = Object.entries(state.selected)
        .filter(([_, id]) => !!id)
        .map(([cat, id]) => allComponents.find(c => c.id === Number(id)))
        .filter(Boolean);
      summaryList.innerHTML = items.map(c => (
        `<div class=\"item\"><span>${escapeHtml(c.category_name)} - ${escapeHtml(c.name)}</span><span>${money(c.price)}</span></div>`
      )).join('');
      const total = items.reduce((s, c) => s + Number(c.price), 0);
      totalPriceEl.textContent = money(total);
      validationResult.innerHTML = '';
      renderUpgradeSuggestions(items, total);
    }

    // === Upgrade Suggestions (small +/- budget deltas) ===
    function renderUpgradeSuggestions(selectedItems, total){
      const container = document.getElementById('upgrade-suggestions');
      if (!container) return;
      const THRESH_ADD = 2000;  // ₹ you might add
      const THRESH_CUT = 2000;  // ₹ you might save
      const budget = Number(document.getElementById('budget')?.value || 0) || 0;

      const lines = [];
      const byCat = {};
      for (const c of selectedItems) byCat[c.category_name] = c;

      function byPrice(catName){
        const arr = (compsByCatName[catName] || []).slice().sort((a,b) => Number(a.price)-Number(b.price));
        return arr;
      }

      for (const catName of Object.keys(byCat)){
        const current = byCat[catName];
        const list = byPrice(catName);
        const idx = list.findIndex(x => x.id === current.id);
        if (idx === -1) continue;
        // Upgrades within small extra spend
        const higher = list[idx+1];
        if (higher){
          const extra = Number(higher.price) - Number(current.price);
          if (extra > 0 && extra <= THRESH_ADD){
            lines.push(`For ${money(extra)} more: upgrade <strong>${catName}</strong> from <em>${escapeHtml(current.name)}</em> → <strong>${escapeHtml(higher.name)}</strong>.`);
          }
        }
        // Cheaper alternatives within small savings
        const lower = list[idx-1];
        if (lower){
          const save = Number(current.price) - Number(lower.price);
          if (save > 0 && save <= THRESH_CUT){
            lines.push(`Save ${money(save)}: switch <strong>${catName}</strong> from <em>${escapeHtml(current.name)}</em> → <strong>${escapeHtml(lower.name)}</strong>.`);
          }
        }
      }

      if (!lines.length){
        container.innerHTML = '<div class="hint">No small-change upgrade ideas found. Try changing a part or budget.</div>';
      } else {
        container.innerHTML = '<ul>' + lines.map(x => `<li>${x}</li>`).join('') + '</ul>';
      }
    }

    async function onValidate(){
      const budget = Number(budgetInput.value) || null;
      
      // Budget validation - minimum 20,000 INR
      if (budget && budget < 20000) {
        validationResult.innerHTML = '<div class="issues"><strong>Budget Error:</strong> Please enter a budget more than ₹20,000. A minimum of ₹20,000 is required to build a functional PC.</div>';
        return;
      }
      
      const payload = { selected: state.selected, budget };
      try {
        const res = await fetchJSON(`${API_BASE}/build/validate`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const { success, issues, totalPrice, budgetExceeded } = res;
        if (success){
          validationResult.innerHTML = `<div class="ok">Build is valid! Total: ${money(totalPrice)}</div>`;
        } else {
          const list = (issues||[]).map(x => `<li>${escapeHtml(x)}</li>`).join('');
          validationResult.innerHTML = `<div class="issues"><strong>Issues</strong><ul>${list}</ul></div>`;
        }
      } catch (e){
        validationResult.textContent = 'Validation failed.';
      }
    }

    // No profile list on home page
  }

  // ===== Admin Panel =====
  async function initAdminPanel(){
    const adminIdentity = document.getElementById('admin-identity');
    const form = document.getElementById('component-form');
    const idEl = document.getElementById('comp-id');
    const nameEl = document.getElementById('comp-name');
    const catEl = document.getElementById('comp-category');
    const priceEl = document.getElementById('comp-price');
    const socketEl = document.getElementById('comp-socket');
    const specsEl = document.getElementById('comp-specs');
    const resetBtn = document.getElementById('reset-form');
    const table = document.getElementById('components-table');

    // Show current admin identity (email)
    try {
      const me = await fetchJSON('/api/auth/me', { credentials: 'include' });
      if (adminIdentity){
        adminIdentity.innerHTML = `<div class="row"><div>Name / Email</div><div><strong>${escapeHtml(me.email)}</strong></div></div>`;
      }
    } catch {
      if (adminIdentity){
        adminIdentity.innerHTML = '<div class="hint">Not signed in</div>';
      }
    }

    const categories = await fetchJSON(`${API_BASE}/categories`);
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.id} - ${c.name}`;
      catEl.appendChild(opt);
    });

    async function loadTable(){
      const items = await fetchJSON(`${API_BASE}/components`);
      const head = `<div class="row head"><div>Name</div><div>Category</div><div>Price</div><div>Socket</div><div>Actions</div></div>`;
      const rows = items.map(c => (
        `<div class="row"><div>${escapeHtml(c.name)}</div><div>${escapeHtml(c.category_name)}</div><div>${money(c.price)}</div><div>${escapeHtml(c.socket||'')}</div><div class="actions"><button class="btn-secondary" data-edit="${c.id}">Edit</button><button class="btn-secondary" data-del="${c.id}">Delete</button></div></div>`
      )).join('');
      table.innerHTML = head + rows;

      $all('button[data-edit]', table).forEach(btn => btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.edit);
        const comp = await fetchJSON(`${API_BASE}/components/${id}`);
        idEl.value = comp.id;
        nameEl.value = comp.name;
        catEl.value = comp.category_id;
        priceEl.value = comp.price;
        socketEl.value = comp.socket || '';
        specsEl.value = JSON.stringify(comp.specs || {}, null, 2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }));

      $all('button[data-del]', table).forEach(btn => btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.del);
        if (!confirm('Delete this component?')) return;
        try {
          await fetchJSON(`${API_BASE}/components/${id}`, { method: 'DELETE', headers: {} , credentials: 'include' });
          await loadTable();
        } catch (e){
          alert('Delete failed');
        }
      }));
    }

    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      idEl.value = '';
      nameEl.value = '';
      catEl.value = categories[0]?.id || '';
      priceEl.value = '';
      socketEl.value = '';
      specsEl.value = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let specs = {};
      if (specsEl.value.trim()){
        try { specs = JSON.parse(specsEl.value); } catch { return alert('Specs must be valid JSON'); }
      }
      const body = {
        name: nameEl.value.trim(),
        category_id: Number(catEl.value),
        price: Number(priceEl.value),
        socket: socketEl.value.trim() || null,
        specs,
      };
      try {
        if (idEl.value){
          await fetchJSON(`${API_BASE}/components/${Number(idEl.value)}`, { method: 'PUT', body: JSON.stringify(body), headers: {}, credentials: 'include' });
        } else {
          await fetchJSON(`${API_BASE}/components`, { method: 'POST', body: JSON.stringify(body), headers: {}, credentials: 'include' });
        }
        await loadTable();
        alert('Saved!');
      } catch (e){
        alert('Save failed');
      }
    });

    await loadTable();
  }

  // Utils
  function escapeHtml(s){
    return s.replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]));
  }
})();
