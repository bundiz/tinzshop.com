// Tinzshop back office — mockup interactions (data lives in memory; a real build calls the API).
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baht = n => Number(n).toLocaleString('en-US');
  const ico = (n, c = 'ico-sm') => `<svg class="ico ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  /* ---------- toast ---------- */
  const toastEl = $('[data-toast]'); let tt;
  const toast = msg => { if (!toastEl) return; $('[data-toast-msg]', toastEl).textContent = msg; toastEl.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('is-on'), 2800); };
  window.admToast = toast;

  /* ---------- sidebar (mobile) ---------- */
  const side = $('#sidenav'), mb = $('.topnav .menu-btn'), scrim = $('[data-scrim]');
  let lastFocus;
  const closeAll = () => {
    side?.classList.remove('is-open'); mb?.setAttribute('aria-expanded', 'false');
    $$('.sheet.is-on,.modal.is-on').forEach(x => x.classList.remove('is-on'));
    scrim?.classList.remove('is-on'); lastFocus?.focus?.();
  };
  mb?.addEventListener('click', () => { side.classList.add('is-open'); mb.setAttribute('aria-expanded', 'true'); scrim.classList.add('is-on'); lastFocus = mb; });
  scrim?.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  const openLayer = el => { lastFocus = document.activeElement; el.classList.add('is-on'); scrim?.classList.add('is-on'); setTimeout(() => el.querySelector('input:not([type=hidden]),select,button')?.focus(), 60); };
  window.admOpen = openLayer; window.admClose = closeAll;
  $$('[data-close-sheet],[data-close-modal]').forEach(b => b.addEventListener('click', closeAll));

  /* ---------- small widgets ---------- */
  $$('.lang').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === b)); toast(b.textContent === 'EN' ? 'Back office language: English' : 'ภาษาหลังร้าน: ไทย'); }));
  $$('.ltabs').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', g).forEach(x => x.setAttribute('aria-selected', x === b));
    if (b.dataset.lt) $$('[data-lp]').forEach(p => p.hidden = p.dataset.lp !== b.dataset.lt);
  }));
  // token inputs (tags, option values)
  $$('[data-tagin], .tagin').forEach(box => {
    const inp = $('input', box);
    box.addEventListener('click', e => { const x = e.target.closest('.tok button'); if (x) { x.parentElement.remove(); inp?.focus(); } else if (e.target === box) inp?.focus(); });
    inp?.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) { e.preventDefault(); const v = esc(inp.value.trim().replace(/,$/, '')); inp.insertAdjacentHTML('beforebegin', `<span class="tok">${v}<button type="button" aria-label="ลบ ${v}">${ico('x')}</button></span>`); inp.value = ''; }
      else if (e.key === 'Backspace' && !inp.value) inp.previousElementSibling?.matches('.tok') && inp.previousElementSibling.remove();
    });
  });
  // sale type radios on product edit
  $$('[data-stype]').forEach(r => r.addEventListener('change', () => { $('[data-stype-pre]').hidden = r.value !== 'pre'; $('[data-stype-drop]').hidden = r.value !== 'drop'; }));
  $('[data-save-product]')?.addEventListener('click', () => toast('บันทึกสินค้าแล้ว · บันทึกลงประวัติการแก้ไข'));
  $('[data-add-opt]')?.addEventListener('click', () => {
    $('[data-opts]').insertAdjacentHTML('beforeend', `<div class="opt-row"><input class="input" placeholder="เช่น ความจุ" aria-label="ชื่อตัวเลือก"><div class="tagin"><input aria-label="ค่าของตัวเลือก" placeholder="พิมพ์แล้วกด Enter"></div><button class="row-act icon-b" type="button" aria-label="ลบตัวเลือก">${ico('trash')}</button></div>`);
    const row = $('[data-opts]').lastElementChild; $('input', row).focus();
    const box = $('.tagin', row), inp = $('input', box);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); inp.insertAdjacentHTML('beforebegin', `<span class="tok">${esc(inp.value.trim())}<button type="button" aria-label="ลบ">${ico('x')}</button></span>`); inp.value = ''; } });
    box.addEventListener('click', e => { const x = e.target.closest('.tok button'); if (x) x.parentElement.remove(); });
  });
  $('[data-opts]')?.addEventListener('click', e => { const d = e.target.closest('.opt-row > .row-act'); if (d) d.closest('.opt-row').remove(); });

  /* ---------- generic table helpers ---------- */
  const pager = (el, page, pages, go) => {
    if (!el) return;
    el.innerHTML = pages <= 1 ? '' : `<button type="button" aria-label="หน้าก่อนหน้า" ${page === 1 ? 'disabled' : ''} data-p="${page - 1}">${ico('chev-l')}</button>` +
      Array.from({ length: pages }, (_, i) => `<button type="button" data-p="${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('') +
      `<button type="button" aria-label="หน้าถัดไป" ${page === pages ? 'disabled' : ''} data-p="${page + 1}">${ico('chev-r')}</button>`;
    el.onclick = e => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) go(+b.dataset.p); };
  };

  /* ================= USERS ================= */
  const uData = $('#udata');
  if (uData) {
    const D = JSON.parse(uData.textContent);
    const ROLE = { top: ['r-top', 'Admin สูงสุด'], admin: ['r-admin', 'Admin'], sales: ['r-sales', 'Sale-manager'], blog: ['r-blog', 'Blogger'], cust: ['r-cust', 'ลูกค้า'] };
    const STAT = { active: ['p-ok', 'ใช้งานอยู่'], invited: ['p-warn', 'รอยืนยันอีเมล'], suspended: ['p-bad', 'ระงับการใช้งาน'] };
    let tab = 'staff', page = 1, sel = new Set(), nextId = 500;
    const PER = 10;
    const body = $('[data-ubody]'), q = $('[data-uq]'), fr = $('[data-urole]'), fs = $('[data-ustatus]');
    const list = () => D[tab].filter(u => {
      const t = q.value.trim().toLowerCase();
      return (!t || [u.name, u.email, u.phone].some(x => x.toLowerCase().includes(t))) && (!fr.value || u.role === fr.value) && (!fs.value || u.status === fs.value);
    });
    const initials = n => n.replace(/^(คุณ|พนักงาน|นักเขียน)\s*/, '').trim().charAt(0);
    const render = () => {
      const all = list(), pages = Math.max(1, Math.ceil(all.length / PER)); page = Math.min(page, pages);
      const rows = all.slice((page - 1) * PER, page * PER);
      const cust = tab === 'cust';
      $$('[data-col-orders]').forEach(c => c.hidden = !cust);
      $('[data-col-role]').hidden = cust; fr.hidden = cust;
      body.innerHTML = rows.length ? rows.map(u => `<tr class="${sel.has(u.id) ? 'is-sel' : ''}">
        <td class="cb"><input type="checkbox" data-sel="${u.id}" ${sel.has(u.id) ? 'checked' : ''} aria-label="เลือก ${esc(u.name)}"${u.role === 'top' ? ' disabled' : ''}></td>
        <td><div class="who"><span class="av" aria-hidden="true">${esc(initials(u.name))}</span><span><b>${esc(u.name)}</b><small>${esc(u.email)}</small></span></div></td>
        <td class="muted">${esc(u.phone || '—')}</td>
        ${cust ? '' : `<td><span class="role ${ROLE[u.role][0]}">${ROLE[u.role][1]}</span></td>`}
        ${cust ? `<td class="num">${u.orders}</td><td class="num">฿${baht(u.spend)}</td>` : ''}
        <td><span class="pill ${STAT[u.status][0]}">${STAT[u.status][1]}</span></td>
        <td class="muted">${esc(u.last)}</td>
        <td class="act"><span class="row-act"><button type="button" data-edit="${u.id}" aria-label="แก้ไข ${esc(u.name)}">${ico('edit')}</button>${u.role === 'top' ? `<button type="button" disabled aria-label="ลบบัญชีเจ้าของร้านไม่ได้" title="ลบบัญชีเจ้าของร้านไม่ได้" style="opacity:.3">${ico('lock')}</button>` : `<button class="del" type="button" data-del="${u.id}" aria-label="ลบ ${esc(u.name)}">${ico('trash')}</button>`}</span></td></tr>`).join('')
        : `<tr><td colspan="9"><div class="empty"><b>ไม่พบผู้ใช้ที่ตรงกับการค้นหา</b>ลองเปลี่ยนคำค้นหรือตัวกรอง</div></td></tr>`;
      $('[data-ucount]').textContent = `${all.length} คน`;
      $('[data-urange]').textContent = all.length ? `แสดง ${(page - 1) * PER + 1}–${Math.min(page * PER, all.length)} จาก ${all.length}` : '';
      $('[data-n=staff]').textContent = D.staff.length; $('[data-n=cust]').textContent = D.cust.length;
      pager($('[data-upager]'), page, pages, p => { page = p; render(); });
      const bulk = $('[data-ubulk]'); bulk.classList.toggle('is-on', sel.size > 0); $('[data-ubulk-n]').textContent = `เลือก ${sel.size} คน`;
      $('[data-bulk-role]').hidden = cust;
      const ua = $('[data-uall]'), selectable = rows.filter(u => u.role !== 'top');
      ua.checked = selectable.length > 0 && selectable.every(u => sel.has(u.id)); ua.indeterminate = !ua.checked && selectable.some(u => sel.has(u.id));
    };
    [q, fr, fs].forEach(x => x.addEventListener('input', () => { page = 1; render(); }));
    $$('[data-utab]').forEach(b => b.addEventListener('click', () => {
      $$('[data-utab]').forEach(x => x.setAttribute('aria-selected', x === b));
      const perm = b.dataset.utab === 'perm';
      $('[data-upanel=list]').hidden = perm; $('[data-upanel=perm]').hidden = !perm;
      if (!perm) { tab = b.dataset.utab; sel.clear(); page = 1; fr.value = ''; render(); }
    }));
    body.addEventListener('change', e => { const c = e.target.closest('[data-sel]'); if (!c) return; const id = +c.dataset.sel; c.checked ? sel.add(id) : sel.delete(id); render(); });
    $('[data-uall]').addEventListener('change', e => { const rows = list().slice((page - 1) * PER, page * PER).filter(u => u.role !== 'top'); rows.forEach(u => e.target.checked ? sel.add(u.id) : sel.delete(u.id)); render(); });
    $('[data-bulk-clear]').addEventListener('click', () => { sel.clear(); render(); });
    const bulkSet = (k, v, msg) => { D[tab].forEach(u => { if (sel.has(u.id)) u[k] = v; }); toast(`${msg} ${sel.size} คน`); sel.clear(); render(); };
    $('[data-bulk-suspend]').addEventListener('click', () => bulkSet('status', 'suspended', 'ระงับการใช้งาน'));
    $('[data-bulk-activate]').addEventListener('click', () => bulkSet('status', 'active', 'เปิดใช้งาน'));
    $('[data-bulk-role]').addEventListener('change', e => { if (e.target.value) { bulkSet('role', e.target.value, 'เปลี่ยนตำแหน่ง'); e.target.value = ''; } });

    // create / edit
    const sheet = $('[data-usheet]'), form = $('[data-uform]');
    const setErr = (i, m) => { const f = i.closest('.field'), er = $('.err', f); f.classList.toggle('is-bad', !!m); er.hidden = !m; er.textContent = m || ''; i.setAttribute('aria-invalid', !!m); };
    const openForm = u => {
      form.reset(); $$('.field', form).forEach(f => { f.classList.remove('is-bad'); const er = $('.err', f); if (er) er.hidden = true; });
      $('[data-usheet-title]').textContent = u ? 'แก้ไขผู้ใช้' : (tab === 'cust' ? 'เพิ่มลูกค้า' : 'เพิ่มพนักงาน');
      form.id.value = u?.id || ''; form.name.value = u?.name || ''; form.email.value = u?.email || ''; form.phone.value = u?.phone || '';
      form.role.value = u?.role || (tab === 'cust' ? 'cust' : 'sales'); form.active.checked = !u || u.status !== 'suspended';
      form.role.disabled = u?.role === 'top';
      $('[data-invite-note]').hidden = !!u || form.role.value === 'cust'; $('[data-reset-row]').hidden = !u;
      openLayer(sheet);
    };
    form.role.addEventListener('change', () => { $('[data-invite-note]').hidden = !!form.id.value || form.role.value === 'cust'; });
    $('[data-new-user]').addEventListener('click', () => openForm(null));
    body.addEventListener('click', e => {
      const ed = e.target.closest('[data-edit]'); if (ed) return openForm(D[tab].find(u => u.id === +ed.dataset.edit));
      const dl = e.target.closest('[data-del]'); if (dl) return askDelete([+dl.dataset.del]);
    });
    $('[data-reset-pw]').addEventListener('click', () => toast(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${form.email.value} แล้ว`));
    $('[data-usave]').addEventListener('click', () => {
      let bad = null;
      const chk = (i, m) => { setErr(i, m); if (m && !bad) bad = i; };
      chk(form.name, form.name.value.trim() ? '' : 'กรุณากรอกชื่อ');
      chk(form.email, !form.email.value.trim() ? 'กรุณากรอกอีเมล' : !/^\S+@\S+\.\S+$/.test(form.email.value) ? 'รูปแบบอีเมลไม่ถูกต้อง' :
        [...D.staff, ...D.cust].some(u => u.email === form.email.value.trim() && u.id !== +form.id.value) ? 'อีเมลนี้มีผู้ใช้อยู่แล้ว' : '');
      chk(form.phone, form.phone.value && form.phone.value.replace(/\D/g, '').length < 9 ? 'เบอร์โทรไม่ครบ' : '');
      if (bad) return bad.focus();
      const role = form.role.value, target = role === 'cust' ? 'cust' : 'staff';
      if (form.id.value) {
        const id = +form.id.value, srcTab = D.staff.some(u => u.id === id) ? 'staff' : 'cust';
        const u = D[srcTab].find(x => x.id === id);
        Object.assign(u, { name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(), role: u.role === 'top' ? 'top' : role, status: form.active.checked ? (u.status === 'invited' ? 'invited' : 'active') : 'suspended' });
        if (srcTab !== target && u.role !== 'top') { D[srcTab] = D[srcTab].filter(x => x !== u); D[target].unshift(u); }
        toast('บันทึกการแก้ไขแล้ว');
      } else {
        D[target].unshift({ id: nextId++, name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(), role, status: role === 'cust' ? 'active' : (form.active.checked ? 'invited' : 'suspended'), last: '—', created: 'วันนี้', orders: 0, spend: 0 });
        toast(role === 'cust' ? 'เพิ่มลูกค้าแล้ว' : `ส่งอีเมลเชิญไปที่ ${form.email.value.trim()} แล้ว`);
        if (target !== tab) $(`[data-utab=${target}]`).click();
      }
      closeAll(); page = 1; render();
    });

    // delete
    const dm = $('[data-delmodal]'); let pending = [];
    const askDelete = ids => {
      pending = ids; const u = D[tab].find(x => x.id === ids[0]);
      $('[data-del-title]').textContent = ids.length > 1 ? `ลบผู้ใช้ ${ids.length} คน?` : `ลบ ${u.name}?`;
      openLayer(dm);
    };
    $('[data-bulk-del]').addEventListener('click', () => askDelete([...sel]));
    $('[data-del-confirm]', dm).addEventListener('click', () => { D[tab] = D[tab].filter(u => !pending.includes(u.id)); pending.forEach(id => sel.delete(id)); closeAll(); toast(`ลบผู้ใช้ ${pending.length} คนแล้ว`); render(); });

    // export
    $('[data-export-users]').addEventListener('click', () => {
      const rows = [['ชื่อ', 'อีเมล', 'เบอร์โทร', 'ตำแหน่ง', 'สถานะ'], ...D[tab].map(u => [u.name, u.email, u.phone, ROLE[u.role][1], STAT[u.status][1]])];
      download(`tinzshop-${tab}.csv`, rows); toast('ส่งออกรายชื่อแล้ว');
    });

    // permissions
    const save = $('[data-perm-save]'), initial = $$('[data-perm]').map(c => c.checked);
    $$('[data-perm]').forEach(c => c.addEventListener('change', () => { save.disabled = $$('[data-perm]').every((x, i) => x.checked === initial[i]); }));
    save.addEventListener('click', () => { $$('[data-perm]').forEach((x, i) => initial[i] = x.checked); save.disabled = true; toast('บันทึกสิทธิ์แล้ว มีผลเมื่อพนักงานเข้าสู่ระบบครั้งถัดไป'); });
    $('[data-perm-reset]').addEventListener('click', () => { $$('[data-perm]').forEach((x, i) => x.checked = initial[i]); save.disabled = true; });
    render();
  }

  /* ---------- CSV download ---------- */
  function download(name, rows) {
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ================= PRODUCTS ================= */
  const pData = $('#pdata');
  if (pData) {
    const P = JSON.parse(pData.textContent);
    const TYPE = { norm: ['st-norm', 'ขายปกติ'], pre: ['st-pre', 'พรีออเดอร์'], drop: ['st-drop', 'DropShip'] };
    const body = $('[data-pbody]'), q = $('[data-pq]'), fc = $('[data-pcat]');
    let tab = '', open = new Set([1]), sel = new Set(), dirty = new Map();
    const key = (pi, vi) => `${pi}:${vi}`;
    const pub = (v, p) => v[4] === 'off' ? ['p-off', 'ซ่อนจากหน้าร้าน'] : p.type === 'drop' ? ['p-warn', 'สั่งจากตัวแทน'] : v[3] > 0 ? ['p-ok', p.type === 'pre' ? 'เปิดจอง' : 'มีสินค้า'] : ['p-bad', 'สินค้าหมด'];
    const visible = () => P.filter(p => {
      const t = q.value.trim().toLowerCase();
      const hit = !t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.v.some(v => v[1].toLowerCase().includes(t));
      const tabOk = !tab || (tab === 'out' ? p.v.some(v => v[3] === 0) : p.type === tab);
      return hit && tabOk && (!fc.value || p.cat.includes(fc.value) || (fc.value === 'Nintendo Switch' && p.cat.includes('Nintendo')));
    });
    const render = () => {
      const list = visible();
      body.innerHTML = list.map(p => {
        const pi = p.id, stock = p.v.reduce((s, v) => s + (v[3] || 0), 0), allSel = p.v.every((_, vi) => sel.has(key(pi, vi)));
        const prices = p.v.map(v => v[2]), lo = Math.min(...prices), hi = Math.max(...prices);
        const isOpen = open.has(pi);
        return `<tr class="prow">
          <td class="cb"><input type="checkbox" data-psel="${pi}" ${allSel ? 'checked' : ''} aria-label="เลือกทุกรุ่นของ ${esc(p.name)}"></td>
          <td><div class="pcell"><button class="exp" type="button" data-exp="${pi}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'ซ่อน' : 'แสดง'}รุ่นย่อยของ ${esc(p.name)}">${ico('chev-r')}</button><div class="media ${p.m}"><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:1"><use href="#i-a-${p.a}"/></svg></div><span><b>${esc(p.name)}</b><small>${p.sku} · ${p.v.length} รุ่น</small><small style="display:block;font-family:inherit">${p.cat}</small></span></div></td>
          <td><span class="stype ${TYPE[p.type][0]}">${TYPE[p.type][1]}</span>${p.pre ? `<div class="muted" style="margin-top:4px">${p.pre}</div>` : ''}</td>
          <td class="num">${lo === hi ? baht(lo) : `${baht(lo)}–${baht(hi)}`}</td>
          <td class="num">${p.type === 'drop' ? '<span class="muted">ไม่สต๊อกเอง</span>' : stock}</td>
          <td colspan="2"><span class="muted">${p.type === 'drop' ? 'ร้านยืนยันของก่อนลูกค้าจ่าย' : (() => { const out = p.v.filter(v => v[3] === 0 || v[4] === 'off').length; return out ? `${p.v.length - out} พร้อมขาย · ${out} หมด/ซ่อน` : `พร้อมขายทุกรุ่น`; })()}</span></td>
          <td><span class="chan ${p.shopee ? '' : 'off'}"><i></i>${p.shopee ? 'เชื่อมแล้ว' : 'ยังไม่จับคู่'}</span></td>
          <td class="act"><span class="row-act"><a href="product-edit.html" aria-label="แก้ไข ${esc(p.name)}">${ico('edit')}</a><button type="button" data-dup="${pi}" aria-label="ทำสำเนา ${esc(p.name)}">${ico('copy')}</button><button class="del" type="button" data-pdel="${pi}" aria-label="ลบ ${esc(p.name)}">${ico('trash')}</button></span></td>
        </tr>` + p.v.map((v, vi) => {
          const k = key(pi, vi), d = dirty.get(k) || {}, price = d.price ?? v[2], st = d.stock ?? v[3], status = d.status ?? v[4];
          const pb = pub([0, 0, 0, st, status], p);
          return `<tr class="var-row${sel.has(k) ? ' is-sel' : ''}" ${isOpen ? '' : 'hidden'}>
            <td class="cb"><input type="checkbox" data-vsel="${k}" ${sel.has(k) ? 'checked' : ''} aria-label="เลือก ${esc(p.name)} ${esc(v[0])}"></td>
            <td><div class="vname"><span><b style="font-weight:500">${esc(v[0])}</b><br><span class="sku">${v[1]}</span></span></div></td>
            <td></td>
            <td class="num"><input class="ied${d.price !== undefined ? ' is-dirty' : ''}" data-f="price" data-k="${k}" value="${baht(price)}" inputmode="numeric" aria-label="ราคา ${esc(v[1])}"></td>
            <td class="num">${p.type === 'drop' ? '<span class="muted">—</span>' : `<input class="ied${d.stock !== undefined ? ' is-dirty' : ''}" style="width:80px" data-f="stock" data-k="${k}" value="${st}" inputmode="numeric" aria-label="สต๊อก ${esc(v[1])}">`}</td>
            <td><span class="pill ${pb[0]}">${pb[1]}</span></td>
            <td><label class="vh" for="s-${k}">สถานะ ${esc(v[1])}</label><select class="ied-s${d.status !== undefined ? ' is-dirty' : ''}" id="s-${k}" data-f="status" data-k="${k}"><option value="on" ${status === 'on' ? 'selected' : ''}>พร้อมขาย</option><option value="off" ${status === 'off' ? 'selected' : ''}>ไม่พร้อมขาย</option></select></td>
            <td colspan="2"></td></tr>`;
        }).join('');
      }).join('') || `<tr><td colspan="9"><div class="empty"><b>ไม่พบสินค้า</b>ลองค้นหาด้วย Parent SKU หรือ ModelSKU</div></td></tr>`;
      $('[data-pcount]').textContent = `${list.length} สินค้า · ${list.reduce((s, p) => s + p.v.length, 0)} รุ่น`;
      $('[data-pbulk]').classList.toggle('is-on', sel.size > 0); $('[data-pbulk-n]').textContent = `เลือก ${sel.size} รุ่น`;
      $('[data-savebar]').classList.toggle('is-on', dirty.size > 0); $('[data-dirty-n]').textContent = `แก้ไข ${dirty.size} รุ่น ยังไม่บันทึก`;
      $('[data-psum]').textContent = `แสดง ${list.length} จาก ${P.length} สินค้า`;
    };
    const setDirty = (k, f, val) => {
      const [pi, vi] = k.split(':').map(Number), v = P.find(p => p.id === pi).v[vi], orig = { price: v[2], stock: v[3], status: v[4] }[f];
      const d = dirty.get(k) || {}; if (val === orig) delete d[f]; else d[f] = val;
      Object.keys(d).length ? dirty.set(k, d) : dirty.delete(k);
    };
    body.addEventListener('click', e => {
      const ex = e.target.closest('[data-exp]'); if (ex) { const id = +ex.dataset.exp; open.has(id) ? open.delete(id) : open.add(id); render(); $(`[data-exp="${id}"]`).focus(); return; }
      const dup = e.target.closest('[data-dup]'); if (dup) { const p = P.find(x => x.id === +dup.dataset.dup); const c = JSON.parse(JSON.stringify(p)); c.id = Date.now(); c.name += ' (สำเนา)'; c.sku += '-COPY'; c.v.forEach(v => { v[1] += '-COPY'; v[4] = 'off'; }); P.splice(P.indexOf(p) + 1, 0, c); toast('ทำสำเนาแล้ว รุ่นย่อยถูกตั้งเป็นไม่พร้อมขาย'); render(); return; }
      const del = e.target.closest('[data-pdel]'); if (del) { pendingDel = +del.dataset.pdel; $('[data-del-title]').textContent = `ลบ ${P.find(x => x.id === pendingDel).name}?`; openLayer($('[data-delmodal]')); }
    });
    let pendingDel = null;
    $('[data-del-confirm]').addEventListener('click', () => { const i = P.findIndex(p => p.id === pendingDel); const n = P[i].name; P.splice(i, 1); closeAll(); toast(`ลบ ${n} แล้ว`); render(); });
    body.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.psel) { const pi = +t.dataset.psel; P.find(p => p.id === pi).v.forEach((_, vi) => t.checked ? sel.add(key(pi, vi)) : sel.delete(key(pi, vi))); if (t.checked) open.add(pi); render(); return; }
      if (t.dataset.vsel) { t.checked ? sel.add(t.dataset.vsel) : sel.delete(t.dataset.vsel); render(); return; }
      if (t.dataset.f) {
        let val = t.value; if (t.dataset.f !== 'status') { val = parseInt(val.replace(/[^\d]/g, ''), 10); if (isNaN(val) || val < 0) { t.value = ''; t.focus(); toast('กรุณากรอกตัวเลข 0 ขึ้นไป'); return; } }
        setDirty(t.dataset.k, t.dataset.f, val); light(t);
      }
    });
    body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.ied')) e.target.blur(); });
    // update one row in place so Tab keeps moving through the table
    const light = t => {
      const k = t.dataset.k, d = dirty.get(k) || {}, f = t.dataset.f, [pi, vi] = k.split(':').map(Number), p = P.find(x => x.id === pi), v = p.v[vi];
      if (f !== 'status') t.value = f === 'price' ? baht(d.price ?? v[2]) : (d.stock ?? v[3]);
      t.classList.toggle('is-dirty', d[f] !== undefined);
      const pb = pub([0, 0, 0, d.stock ?? v[3], d.status ?? v[4]], p), pill = $('.pill', t.closest('tr'));
      pill.className = 'pill ' + pb[0]; pill.textContent = pb[1];
      $('[data-savebar]').classList.toggle('is-on', dirty.size > 0); $('[data-dirty-n]').textContent = `แก้ไข ${dirty.size} รุ่น ยังไม่บันทึก`;
    };
    $('[data-pall]').addEventListener('change', e => { visible().forEach(p => { p.v.forEach((_, vi) => e.target.checked ? sel.add(key(p.id, vi)) : sel.delete(key(p.id, vi))); if (e.target.checked) open.add(p.id); }); render(); });
    $('[data-pbulk-clear]').addEventListener('click', () => { sel.clear(); $('[data-pall]').checked = false; render(); });
    const eachSel = fn => sel.forEach(k => { const [pi, vi] = k.split(':').map(Number); fn(k, P.find(p => p.id === pi).v[vi]); });
    $('[data-bulk-status]').addEventListener('change', e => { if (!e.target.value) return; eachSel(k => setDirty(k, 'status', e.target.value)); e.target.value = ''; render(); });
    $('[data-bulk-price]').addEventListener('change', e => { const pct = +e.target.value; if (!pct) return; eachSel((k, v) => setDirty(k, 'price', Math.round((dirty.get(k)?.price ?? v[2]) * (1 + pct / 100) / 10) * 10)); e.target.value = ''; render(); });
    $('[data-bulk-zero]').addEventListener('click', () => { eachSel(k => setDirty(k, 'stock', 0)); render(); });
    $('[data-discard]').addEventListener('click', () => { dirty.clear(); render(); toast('ยกเลิกการแก้ไขแล้ว'); });
    $('[data-save-all]').addEventListener('click', () => {
      const n = dirty.size;
      dirty.forEach((d, k) => { const [pi, vi] = k.split(':').map(Number), v = P.find(p => p.id === pi).v[vi]; if (d.price !== undefined) v[2] = d.price; if (d.stock !== undefined) v[3] = d.stock; if (d.status !== undefined) v[4] = d.status; });
      dirty.clear(); sel.clear(); render(); toast(`บันทึก ${n} รุ่นแล้ว · ซิงก์สต๊อกไป Shopee และบันทึกในประวัติ`);
    });
    window.addEventListener('beforeunload', e => { if (dirty.size) { e.preventDefault(); e.returnValue = ''; } });
    [q, fc].forEach(x => x.addEventListener('input', render));
    $$('[data-ptab]').forEach(b => b.addEventListener('click', () => { $$('[data-ptab]').forEach(x => x.setAttribute('aria-selected', x === b)); tab = b.dataset.ptab; render(); }));
    $('[data-expand-all]').addEventListener('click', e => { const all = visible().every(p => open.has(p.id)); visible().forEach(p => all ? open.delete(p.id) : open.add(p.id)); e.currentTarget.lastChild.textContent = all ? 'กางรุ่นย่อยทั้งหมด' : 'ยุบรุ่นย่อยทั้งหมด'; render(); });
    $('[data-export]').addEventListener('click', () => {
      const rows = [['Parent SKU', 'ModelSKU', 'ชื่อสินค้า', 'รุ่น', 'ประเภท', 'ราคา', 'สต๊อก', 'สถานะ']];
      P.forEach(p => p.v.forEach(v => rows.push([p.sku, v[1], p.name, v[0], TYPE[p.type][1], v[2], v[3] ?? '', v[4] === 'on' ? 'พร้อมขาย' : 'ไม่พร้อมขาย'])));
      download('tinzshop-products.csv', rows); toast('ส่งออกสินค้าแล้ว เปิดด้วย Excel แก้แล้วนำเข้ากลับได้');
    });

    // import with dry run
    const im = $('[data-impmodal]'), next = $('[data-inext]'), fileIn = $('[data-ifile]'), dz = $('[data-dropzone]');
    let step = 1;
    const go = s => {
      step = s; $$('[data-istep]', im).forEach(x => x.hidden = +x.dataset.istep !== s);
      $$('[data-is]', im).forEach(x => { const n = +x.dataset.is; x.className = n < s ? 'ok' : n === s ? 'on' : ''; });
      next.textContent = s === 1 ? 'ทดลองนำเข้า' : s === 2 ? 'นำเข้า 44 รายการที่ถูกต้อง' : 'เสร็จสิ้น';
      next.disabled = s === 1 && !fileIn.files.length;
      $('[data-icancel]').hidden = s === 3;
    };
    $('[data-open-import]').addEventListener('click', () => { fileIn.value = ''; dz.querySelector('b').textContent = 'ลากไฟล์ .xlsx หรือ .csv มาวาง หรือคลิกเพื่อเลือก'; go(1); openLayer(im); });
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) { dz.querySelector('b').textContent = `เลือกไฟล์ ${fileIn.files[0].name} แล้ว`; $('[data-ifname]').textContent = fileIn.files[0].name; next.disabled = false; } });
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('is-over'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) { fileIn.files = e.dataTransfer.files; fileIn.dispatchEvent(new Event('change')); } });
    next.addEventListener('click', () => { if (step === 1) { next.disabled = true; next.textContent = 'กำลังตรวจไฟล์…'; setTimeout(() => go(2), 700); } else if (step === 2) go(3); else closeAll(); });
    $('[data-template]').addEventListener('click', () => { download('tinzshop-import-template.csv', [['Parent SKU', 'ModelSKU', 'ชื่อสินค้า (TH)', 'ชื่อสินค้า (EN)', 'ตัวเลือก 1', 'ค่า 1', 'ตัวเลือก 2', 'ค่า 2', 'ราคา', 'สต๊อก', 'สถานะ'], ['PS5-SLIM-1TB', 'PS5-SLIM-1TB-DISC-WH', 'PlayStation 5 Slim 1TB', 'PlayStation 5 Slim 1TB', 'รุ่น', 'มีช่องใส่แผ่น', 'สี', 'ขาว', 17990, 12, 'พร้อมขาย']]); });
    render();
  }

  /* ================= POSTS LIST ================= */
  if ($('[data-post]')) {
    let st = '';
    const q = $('[data-sq]'), c = $('[data-scat]');
    const f = () => { let n = 0; $$('[data-post]').forEach(r => { const ok = (!st || r.dataset.status === st) && (!c.value || r.dataset.cat === c.value) && (!q.value || r.textContent.toLowerCase().includes(q.value.toLowerCase())); r.hidden = !ok; if (ok) n++; }); $('[data-scount]').textContent = `แสดง ${n} รายการ`; };
    $$('[data-stab]').forEach(b => b.addEventListener('click', () => { $$('[data-stab]').forEach(x => x.setAttribute('aria-selected', x === b)); st = b.dataset.stab; f(); }));
    [q, c].forEach(x => x.addEventListener('input', f));
    document.addEventListener('click', e => { const d = e.target.closest('[data-del-post]'); if (d) { d.closest('tr').remove(); toast('ย้ายไปถังขยะแล้ว กู้คืนได้ภายใน 30 วัน'); f(); } });
  }

  /* ================= STAFF LOGIN ================= */
  const s1 = $('[data-slog="1"]'), s2 = $('[data-slog="2"]');
  if (s1) {
    s1.addEventListener('submit', e => {
      e.preventDefault(); let bad;
      $$('input', s1).forEach(i => { const m = !i.value.trim() ? 'กรุณากรอกข้อมูลช่องนี้' : i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value) ? 'รูปแบบอีเมลไม่ถูกต้อง' : ''; const er = $('.err', i.closest('.field')); er.hidden = !m; er.textContent = m; i.closest('.field').classList.toggle('is-bad', !!m); if (m && !bad) bad = i; });
      if (bad) return bad.focus();
      $('[data-sl-mail]').textContent = $('#se').value; s1.hidden = true; s2.hidden = false; $('.otp6 input').focus();
    });
    const boxes = $$('.otp6 input');
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); });
      b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
      b.addEventListener('paste', e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (t.length) { e.preventDefault(); t.split('').forEach((d, j) => boxes[j] && (boxes[j].value = d)); boxes[Math.min(t.length, 5)].focus(); } });
    });
    s2.addEventListener('submit', e => { e.preventDefault(); const ok = boxes.every(b => b.value); $('[data-otp-err]').hidden = ok; if (ok) location.href = 'index.html'; else boxes.find(b => !b.value).focus(); });
    $('[data-resend]').addEventListener('click', e => { const b = e.currentTarget; let t = 60; b.disabled = true; const iv = setInterval(() => { b.textContent = `ส่งใหม่ได้ใน ${t--} วิ`; if (t < 0) { clearInterval(iv); b.disabled = false; b.textContent = 'ส่งรหัสใหม่'; } }, 1000); });
  }
})();
