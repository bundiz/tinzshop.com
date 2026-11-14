// Tinzshop mockup interactions — no framework.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const baht = n => '฿' + Math.round(n).toLocaleString('en-US');

  /* mobile drawer */
  const drawer = $('#drawer'), mbtn = $('.header .menu-btn');
  const setDrawer = open => { if (!drawer) return; drawer.classList.toggle('is-open', open); mbtn?.setAttribute('aria-expanded', open); mbtn?.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู'); document.body.style.overflow = open ? 'hidden' : ''; if (open) drawer.querySelector('a')?.focus(); };
  mbtn?.addEventListener('click', () => setDrawer(true));
  $$('[data-close]', drawer || document).forEach(b => b.addEventListener('click', () => { setDrawer(false); mbtn?.focus(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setDrawer(false); setFilters(false); } });

  /* filters drawer */
  const filters = $('#filters'), ft = $('.ftoggle');
  const setFilters = open => { if (!filters) return; filters.classList.toggle('is-open', open); ft?.setAttribute('aria-expanded', open); };
  ft?.addEventListener('click', () => setFilters(true));
  $$('[data-filter-close]').forEach(b => b.addEventListener('click', () => setFilters(false)));

  /* chips as toggles (single-select inside a role=group) */
  $$('.chips[role=group]').forEach(g => g.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $$('.chip', g).forEach(x => x.setAttribute('aria-pressed', x === c)); }));
  $$('.filters .chips .chip').forEach(c => c.addEventListener('click', () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true')));

  /* wishlist */
  $$('.wish').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true')));

  /* toast + add to cart */
  const toast = $('[data-toast]'); let tt;
  const count = $('[data-cart-count]');
  $$('[data-add]').forEach(b => b.addEventListener('click', () => {
    if (!toast) return;
    $('[data-toast-msg]').textContent = `ใส่ “${b.dataset.add}” ลงตะกร้าแล้ว`;
    toast.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('is-on'), 3200);
    if (count) count.textContent = +count.textContent + 1;
  }));

  /* qty steppers */
  $$('[data-qty]').forEach(q => {
    const inp = $('input', q), [minus, plus] = $$('button', q);
    const set = v => { inp.value = Math.max(1, Math.min(9, v || 1)); inp.dispatchEvent(new Event('change', { bubbles: true })); };
    minus.addEventListener('click', () => set(+inp.value - 1));
    plus.addEventListener('click', () => set(+inp.value + 1));
    inp.addEventListener('blur', () => set(parseInt(inp.value, 10)));
  });

  /* cart totals */
  const cartRoot = $('[data-line]')?.parentElement;
  const recalc = () => {
    const lines = $$('[data-line]'); let sub = 0, pcs = 0;
    lines.forEach(l => { const q = +$('input', l).value, u = +l.dataset.unit; sub += q * u; pcs += q; $('[data-line-total]', l).textContent = baht(q * u); });
    $$('[data-subtotal],[data-total],[data-total-m]').forEach(x => x.textContent = baht(sub));
    const sl = $('[data-sub-lbl]'); if (sl) sl.textContent = `ราคาสินค้า (${pcs} ชิ้น)`;
    const cl = $('[data-count-lbl]'); if (cl) cl.textContent = `${lines.length} รายการ · ${pcs} ชิ้น`;
    if (count) count.textContent = lines.length;
  };
  if (cartRoot) {
    cartRoot.addEventListener('change', recalc);
    $$('[data-remove]').forEach(b => b.addEventListener('click', () => { b.closest('[data-line]').remove(); recalc(); }));
  }

  /* product variants: price + stock change instantly */
  const vEl = $('#variants');
  if (vEl) {
    const V = JSON.parse(vEl.textContent);
    const ST = { in: ['stock-in', 'มีสินค้า'], low: ['stock-in', 'มีสินค้า'], out: ['stock-out', 'สินค้าหมด'] };
    const update = () => {
      const ed = $('input[name=ed]:checked'), co = $('input[name=co]:checked');
      let v = V[`${ed.value}|${co.value}`];
      $('[data-lbl=ed]').textContent = ed.dataset.name; $('[data-lbl=co]').textContent = co.dataset.name;
      $('[data-price]').textContent = baht(v.price); const pm = $('[data-price-m]'); if (pm) pm.textContent = baht(v.price);
      $('[data-sku]').textContent = v.sku;
      const s = $('[data-stock]'); s.className = 'stock ' + ST[v.stock][0]; s.textContent = ST[v.stock][1];
      const out = v.stock === 'out', buy = $('[data-buy-btn]'), now = $('[data-buy-now]');
      if (out) { buy.disabled = false; buy.removeAttribute('data-add'); buy.textContent = 'แจ้งเตือนเมื่อมีของ'; now.setAttribute('aria-disabled', 'true'); now.style.opacity = .45; now.style.pointerEvents = 'none'; }
      else { buy.dataset.add = 'PlayStation 5 Slim'; buy.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-cart"/></svg>ใส่ตะกร้า'; now.removeAttribute('aria-disabled'); now.style.opacity = ''; now.style.pointerEvents = ''; }
      const note = $('[data-co-note]'); const bk = V[`${ed.value}|black`]; note.textContent = bk.stock === 'out' ? '(หมด)' : '';
    };
    $$('input[name=ed],input[name=co]').forEach(i => i.addEventListener('change', update));
    update();

    /* gallery */
    const stage = $('[data-stage]');
    $$('[data-thumb]').forEach(t => t.addEventListener('click', () => {
      $$('[data-thumb]').forEach(x => x.setAttribute('aria-current', x === t));
      stage.innerHTML = t.innerHTML; const n = t.dataset.thumb.split('|')[2];
      $('.media', stage).insertAdjacentHTML('beforeend', `<span class="art-label">${n} / 5</span>`);
    }));
  }

  /* tabs (arrow keys supported) */
  const tabs = $$('[role=tab]');
  const openTab = t => { tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }); };
  tabs.forEach((t, i) => { t.addEventListener('click', () => openTab(t)); t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; openTab(n); n.focus(); } }); });
  $$('[data-open-tab]').forEach(a => a.addEventListener('click', () => openTab($('#' + a.dataset.openTab))));

  /* toggles */
  $$('[data-toggle]').forEach(c => c.addEventListener('change', () => { $(c.dataset.toggle).hidden = !c.checked; }));

  /* checkout: shipping + payment */
  const co = $('[data-checkout]');
  if (co) {
    const SUB = 23460;
    const NOTES = {
      bank: 'หลังกดยืนยัน คุณจะเห็นเลขบัญชีของร้านและปุ่มอัปโหลดสลิป เก็บลิงก์ไว้อัปโหลดภายหลังได้ใน <b>ติดตามคำสั่งซื้อ</b>',
      card: 'ระบบจะพาไปหน้าชำระเงินของ K-Payment (ธนาคารกสิกรไทย) แล้วกลับมาที่ร้านพร้อมยืนยันการชำระเงินอัตโนมัติ',
      inst: 'เลือกธนาคารผู้ออกบัตรและจำนวนงวดในหน้า K-Payment ค่าธรรมเนียมจะแสดงก่อนยืนยันการผ่อน',
      qr: 'ระบบจะแสดง QR PromptPay ในหน้า K-Payment สแกนจ่ายภายใน 15 นาที แล้วสถานะจะอัปเดตเอง',
    };
    const upd = () => {
      const pay = $('input[name=pay]:checked').value;
      $('[data-pay-note] span').innerHTML = NOTES[pay];
      $('[data-submit]').textContent = 'ไปชำระเงินที่ K-Payment';
    };
    co.addEventListener('change', upd); upd();
    $('[data-submit-proxy]')?.addEventListener('click', () => co.requestSubmit());
  }

  const RULES = [/^.{8,}$/, /[0-9]/, /[a-z]/, /[A-Z]/, /[\^$*.[\]{}()?\-"!@#%&/\\,><':;|_~`+=]|\S \S/].map(re => ({ test: v => re.test(v) }));

  /* simple required-field validation for mockup forms */
  const setErr = (i, msg) => { const f = i.closest('.field'); if (!f) return; const err = $('.err', f); f.classList.toggle('is-bad', !!msg); err.hidden = !msg; err.textContent = msg || ''; i.setAttribute('aria-invalid', !!msg); };
  const validate = form => {
    let ok = true, first;
    $$('input[required]', form).forEach(i => {
      if (i.type === 'checkbox') { const bad = !i.checked; const e = $('[data-consent-err]', form); if (e) e.hidden = !bad; i.setAttribute('aria-invalid', bad); if (bad) { ok = false; first ||= i; } return; }
      let msg = '';
      if (!i.value.trim()) msg = 'กรุณากรอกข้อมูลช่องนี้';
      else if (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value)) msg = 'รูปแบบอีเมลไม่ถูกต้อง';
      else if (i.type === 'tel' && i.value.replace(/\D/g, '').length < 9) msg = 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ';
      else if (i.id === 'lotp' && !/^\d{6}$/.test(i.value)) msg = 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก';
      else if (i.id === 'rpass' && RULES.some(r => !r.test(i.value))) msg = 'รหัสผ่านยังไม่ครบตามเงื่อนไข';
      else if (i.id === 'rpass2' && i.value !== $('#rpass').value) msg = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
      setErr(i, msg); if (msg) { ok = false; first ||= i; }
    });
    first?.focus(); return ok;
  };
  $$('form[novalidate]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault(); if (!validate(f)) return;
    if (f.matches('[data-track]')) $('[data-track-result]').hidden = false;
    if (f.matches('[data-warranty]')) $('[data-w-ok]').hidden = false;
    if (f.matches('[data-auth]')) { const ok = $('[data-auth-ok]'); ok.hidden = false; if (f.matches('[data-auth=register]')) f.hidden = true; ok.focus?.(); }
  }));

  /* login method switch */
  $$('input[data-show]').forEach(r => r.addEventListener('change', () => {
    $$('input[data-show]').forEach(x => { $(x.dataset.show).hidden = !x.checked; });
  }));

  /* show / hide password */
  $$('[data-pw]').forEach(b => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.pw), show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.textContent = show ? 'ซ่อน' : 'แสดง';
    b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
  }));

  /* OTP request with resend countdown */
  const sendOtp = $('[data-send-otp]');
  sendOtp?.addEventListener('click', () => {
    const tel = $('#ltel');
    if (tel.value.replace(/\D/g, '').length < 9) { setErr(tel, 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ'); tel.focus(); return; }
    setErr(tel, ''); let t = 60; sendOtp.disabled = true;
    $('[data-otp-hint]').textContent = `ส่งรหัสไปที่ ${tel.value} แล้ว (ตัวอย่าง) รหัสมีอายุ 5 นาที`;
    $('#lotp').focus();
    const tick = () => { sendOtp.textContent = `ขอใหม่ใน ${t} วิ`; if (t-- <= 0) { clearInterval(iv); sendOtp.disabled = false; sendOtp.textContent = 'ขอรหัสใหม่'; } };
    tick(); const iv = setInterval(tick, 1000);
  });

  /* password rules tick green as they are met; the confirm label ticks when both match */
  const rp = $('#rpass'), rp2 = $('#rpass2');
  const live = () => {
    $$('[data-rule]').forEach(li => li.classList.toggle('is-met', RULES[+li.dataset.rule].test(rp.value)));
    const lbl = $('label[for=rpass2]'), on = rp2.value !== '' && rp2.value === rp.value;
    lbl?.classList.toggle('is-match', on);
    if (on) setErr(rp2, '');
  };
  rp?.addEventListener('input', live); rp2?.addEventListener('input', live);
})();
