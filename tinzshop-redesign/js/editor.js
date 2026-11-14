// Tinzshop post editor (WordPress-style). Mockup: images stay in the browser; a real build uploads them to storage.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ed = $('[data-body]'); if (!ed) return;
  const toast = m => window.admToast?.(m);
  const ico = n => `<svg class="ico ico-sm" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.execCommand('defaultParagraphSeparator', false, 'p');

  /* ---------- keep the caret so toolbar / modals insert in the right place ---------- */
  let saved = null;
  const inEd = n => n && (n === ed || ed.contains(n));
  const save = () => { const s = getSelection(); if (s.rangeCount && inEd(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
  const restore = () => { ed.focus({ preventScroll: true }); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } };
  document.addEventListener('selectionchange', () => { save(); syncTools(); });

  /* ---------- toolbar ---------- */
  const STATEFUL = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'];
  const blockSel = $('[data-block]');
  function syncTools() {
    if (!inEd(getSelection().anchorNode)) return;
    STATEFUL.forEach(c => { const b = $(`.ed-tools [data-cmd="${c}"]`); if (b) b.setAttribute('aria-pressed', document.queryCommandState(c)); });
    let n = getSelection().anchorNode; while (n && n !== ed && !/^(P|H2|H3|BLOCKQUOTE|LI)$/.test(n.nodeName)) n = n.parentNode;
    const tag = n && n !== ed ? n.nodeName.toLowerCase() : 'p'; blockSel.value = ['h2', 'h3', 'blockquote'].includes(tag) ? tag : 'p';
  }
  blockSel.addEventListener('change', () => { restore(); document.execCommand('formatBlock', false, blockSel.value); changed(); });
  $$('[data-cmd]').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault()); // keep selection in the editor
    b.addEventListener('click', () => {
      const c = b.dataset.cmd;
      if (c === 'createLink') return openLink();
      if (c === 'video') return openM('[data-vidmodal]');
      if (c === 'product') return openM('[data-prodmodal]');
      restore();
      if (c.startsWith('formatBlock:')) { const t = c.split(':')[1]; document.execCommand('formatBlock', false, blockSel.value === t ? 'p' : t); }
      else document.execCommand(c, false, null);
      changed(); syncTools();
    });
  });
  ed.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openLink(); }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft(true); }
    if ((e.key === 'Backspace' || e.key === 'Delete') && selFig) { e.preventDefault(); removeFig(selFig); }
  });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft(true); } });

  /* ---------- modals ---------- */
  const openM = sel => { save(); window.admOpen($(sel)); };
  const closeM = () => window.admClose();
  const openLink = () => { save(); const a = getSelection().anchorNode?.parentElement?.closest('a'); $('#lurl').value = a ? a.getAttribute('href') : ''; $('#lnew').checked = a?.target === '_blank'; window.admOpen($('[data-linkmodal]')); };
  $('[data-link-ok]').addEventListener('click', () => {
    const u = $('#lurl'), v = u.value.trim(), er = $('.err', u.closest('.field'));
    if (v && !/^(https?:\/\/|mailto:|\/)/.test(v)) { er.hidden = false; er.textContent = 'ลิงก์ต้องขึ้นต้นด้วย https://'; u.focus(); return; }
    er.hidden = true; closeM(); restore();
    if (!v) document.execCommand('unlink');
    else {
      if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(v)}">${esc(v)}</a>`);
      else document.execCommand('createLink', false, v);
      const a = getSelection().anchorNode?.parentElement?.closest('a'); if (a) { if ($('#lnew').checked) { a.target = '_blank'; a.rel = 'noopener'; } else a.removeAttribute('target'); }
    }
    changed();
  });
  $('[data-vid-ok]').addEventListener('click', () => {
    const u = $('#vurl'), m = u.value.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/), er = $('.err', u.closest('.field'));
    if (!m) { er.hidden = false; er.textContent = 'ไม่พบรหัสวิดีโอในลิงก์นี้'; u.focus(); return; }
    er.hidden = true; closeM(); insertBlock(`<div class="ed-embed" contenteditable="false" data-youtube="${m[1]}"><span>${'<svg class="ico" aria-hidden="true"><use href="#i-video"/></svg>'}<br>วิดีโอ YouTube · ${m[1]}<br><small style="opacity:.7">แสดงเป็นเครื่องเล่นวิดีโอบนหน้าเว็บ</small></span></div>`); u.value = '';
  });
  $('[data-prod-ok]').addEventListener('click', () => {
    const d = JSON.parse($('input[name=pcard]:checked').dataset.pc); closeM();
    insertBlock(`<div class="ed-pcard" contenteditable="false" data-product><div class="media ${d.m}"><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:1"><use href="#i-a-${d.a}"/></svg></div><span><b>${esc(d.n)}</b>${d.p} · มีสินค้า</span><span class="btn btn-buy">ดูสินค้า</span></div>`);
  });

  /* ---------- inserting blocks & images ---------- */
  function topBlock(node) { while (node && node.parentNode !== ed) node = node.parentNode; return node; }
  function insertBlock(html, at) {
    const tpl = document.createElement('template'); tpl.innerHTML = html.trim(); const el = tpl.content.firstChild;
    let ref = at || (saved && inEd(saved.startContainer) ? topBlock(saved.startContainer) : null);
    if (ref && ref !== ed) {
      const empty = ref.nodeName === 'P' && !ref.textContent.trim() && !ref.querySelector('img');
      if (empty) ref.replaceWith(el); else ref.after(el);
    } else ed.append(el);
    if (!el.nextElementSibling) el.after(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
    const p = el.nextElementSibling; const r = document.createRange(); r.setStart(p, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    changed(); return el;
  }
  const figHTML = (src, alt = '') => `<figure class="ed-fig" contenteditable="false" data-fig data-align="wide"><img src="${src}" alt="${esc(alt)}"><figcaption contenteditable="true" data-placeholder="เพิ่มคำอธิบายภาพ (ไม่บังคับ)"></figcaption></figure>`;
  function insertImages(files, at) {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return false;
    imgs.forEach(f => {
      if (f.size > 10 * 1024 * 1024) { toast(`${f.name} ใหญ่เกิน 10 MB`); return; }
      const fig = insertBlock(figHTML(URL.createObjectURL(f), f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')), at);
      fig.classList.add('is-uploading'); setTimeout(() => fig.classList.remove('is-uploading'), 900); at = fig;
    });
    toast(imgs.length > 1 ? `แทรกรูป ${imgs.length} รูปแล้ว` : 'แทรกรูปแล้ว');
    return true;
  }
  $('[data-img-input]').addEventListener('change', e => { restore(); insertImages(e.target.files); e.target.value = ''; });

  /* paste: images from clipboard go in as figures; pasted web/Word HTML is cleaned like WordPress does */
  const ALLOWED = { P: [], H2: [], H3: [], H4: [], UL: [], OL: [], LI: [], B: [], STRONG: [], I: [], EM: [], U: [], S: [], A: ['href'], BLOCKQUOTE: [], BR: [], HR: [] };
  function clean(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html'), out = document.createElement('div');
    const walk = (src, dst) => src.childNodes.forEach(n => {
      if (n.nodeType === 3) { dst.append(n.textContent); return; }
      if (n.nodeType !== 1) return;
      const t = n.nodeName === 'H1' ? 'H2' : n.nodeName === 'DIV' ? 'P' : n.nodeName;
      if (t === 'IMG') { const s = n.getAttribute('src'); if (s && /^(https?:|data:image)/.test(s)) { out.insertAdjacentHTML('beforeend', figHTML(esc(s), n.alt || '')); } return; }
      if (/^(SCRIPT|STYLE|META|LINK|IFRAME|OBJECT|svg)$/i.test(t)) return;
      if (ALLOWED[t]) { const el = document.createElement(t); ALLOWED[t].forEach(a => { const v = n.getAttribute(a); if (v && !/^javascript:/i.test(v)) el.setAttribute(a, v); }); dst.append(el); walk(n, el); }
      else walk(n, dst); // unwrap spans, fonts, tables
    });
    walk(doc.body, out);
    return out.innerHTML;
  }
  ed.addEventListener('paste', e => {
    const cd = e.clipboardData; if (!cd) return;
    if (e.target.closest('figcaption')) { e.preventDefault(); document.execCommand('insertText', false, cd.getData('text/plain')); return; }
    const files = [...cd.files]; if (files.some(f => f.type.startsWith('image/'))) { e.preventDefault(); save(); insertImages(files); return; }
    const html = cd.getData('text/html');
    if (html) { e.preventDefault(); const c = clean(html); document.execCommand('insertHTML', false, c); $$('[data-fig]', ed).forEach(f => f.contentEditable = 'false'); changed(); if (/<figure/.test(c)) toast('วางข้อความพร้อมรูปแล้ว รูปจะถูกอัปโหลดเข้าระบบของร้าน'); }
  });

  /* drag & drop files anywhere onto the page */
  const dropUI = $('[data-edrop]'); let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; dropUI.classList.add('is-on'); });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dropUI.classList.remove('is-on'); } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return; e.preventDefault(); depth = 0; dropUI.classList.remove('is-on');
    if (e.target.closest?.('[data-cover]')) return;
    let at = null;
    const r = document.caretRangeFromPoint?.(e.clientX, e.clientY) || (document.caretPositionFromPoint && (p => { const x = document.createRange(); x.setStart(p.offsetNode, p.offset); return x; })(document.caretPositionFromPoint(e.clientX, e.clientY)));
    if (r && inEd(r.startContainer)) at = topBlock(r.startContainer);
    insertImages(e.dataTransfer.files, at);
  });

  /* ---------- image toolbar ---------- */
  const pop = $('[data-imgpop]'); let selFig = null;
  const place = () => { if (!selFig) return; const r = selFig.getBoundingClientRect(); pop.style.top = `${r.top + scrollY - 52}px`; pop.style.left = `${Math.max(12, r.left + scrollX + r.width / 2 - pop.offsetWidth / 2)}px`; };
  const selectFig = f => {
    $$('.ed-fig.is-sel', ed).forEach(x => x.classList.remove('is-sel')); selFig = f;
    if (!f) { pop.hidden = true; return; }
    f.classList.add('is-sel'); pop.hidden = false;
    $$('[data-ialign]', pop).forEach(b => b.setAttribute('aria-pressed', b.dataset.ialign === f.dataset.align)); place();
  };
  ed.addEventListener('click', e => { const f = e.target.closest('[data-fig]'); if (f && !e.target.closest('figcaption')) selectFig(f); else if (!e.target.closest('figcaption')) selectFig(null); });
  document.addEventListener('mousedown', e => { if (!e.target.closest('[data-fig],[data-imgpop],.modal')) selectFig(null); });
  addEventListener('resize', place); addEventListener('scroll', place, { passive: true });
  pop.addEventListener('click', e => {
    const a = e.target.closest('[data-ialign]'); if (a && selFig) { selFig.dataset.align = a.dataset.ialign; selectFig(selFig); changed(); }
    if (e.target.closest('[data-iremove]') && selFig) removeFig(selFig);
    if (e.target.closest('[data-ialt]') && selFig) { const img = $('img', selFig); $('#alti').value = img ? img.alt : ''; window.admOpen($('[data-altmodal]')); }
  });
  $('[data-alt-ok]').addEventListener('click', () => { const img = selFig && $('img', selFig); if (img) img.alt = $('#alti').value.trim(); window.admClose(); toast('บันทึกข้อความแทนภาพแล้ว'); changed(); });
  $('[data-ireplace]').addEventListener('change', e => { const f = e.target.files[0]; if (f && selFig) { let img = $('img', selFig); if (!img) { $('.ed-fig__img', selFig)?.replaceWith(img = document.createElement('img')); } img.src = URL.createObjectURL(f); toast('เปลี่ยนรูปแล้ว'); changed(); place(); } e.target.value = ''; });
  function removeFig(f) { const next = f.nextElementSibling; f.remove(); selectFig(null); if (next) { const r = document.createRange(); r.setStart(next, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); } toast('ลบรูปแล้ว'); changed(); }

  /* ---------- word count, autosave ---------- */
  const seg = 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const count = t => seg ? [...seg.segment(t)].filter(s => s.isWordLike).length : t.split(/\s+/).filter(Boolean).length;
  const stateEl = $('[data-savestate]'); let timer;
  const hhmm = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  function stats() { const w = count(ed.innerText); $('[data-wc]').textContent = `${w.toLocaleString('en-US')} คำ`; $('[data-rt]').textContent = `อ่านประมาณ ${Math.max(1, Math.round(w / 220))} นาที`; }
  function saveDraft(manual) { clearTimeout(timer); stateEl.classList.remove('is-saving'); stateEl.innerHTML = `${ico('check')}บันทึกร่างแล้ว ${hhmm()}`; if (manual) toast('บันทึกร่างแล้ว'); }
  function changed() { stats(); stateEl.classList.add('is-saving'); stateEl.textContent = 'กำลังบันทึก…'; clearTimeout(timer); timer = setTimeout(() => saveDraft(false), 1200); }
  ed.addEventListener('input', changed);
  $('[data-save-draft]').addEventListener('click', () => saveDraft(true));
  stats();

  /* ---------- title, slug, Google preview ---------- */
  const title = $('[data-etitle]'), slug = $('[data-slug]'), meta = $('[data-meta]');
  const grow = () => { title.style.height = 'auto'; title.style.height = title.scrollHeight + 'px'; };
  const gp = () => { $('[data-gp-title]').textContent = `${title.value || 'หัวข้อข่าว'} | Tinzshop`; $('[data-gp-slug]').textContent = slug.value; $('[data-gp-desc]').textContent = meta.value; $('[data-meta-n]').textContent = meta.value.length; };
  title.addEventListener('input', () => { grow(); gp(); changed(); });
  title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ed.focus(); } });
  slug.addEventListener('input', () => { slug.value = slug.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9ก-๙-]/g, ''); gp(); });
  meta.addEventListener('input', gp);
  grow(); gp(); addEventListener('load', grow);

  /* ---------- TH / EN versions ---------- */
  const store = { th: { t: title.value, b: ed.innerHTML }, en: { t: '', b: '' } }; let lang = 'th';
  $$('[data-elang]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.elang === lang) return;
    store[lang] = { t: title.value, b: ed.innerHTML }; lang = b.dataset.elang;
    title.value = store[lang].t; ed.innerHTML = store[lang].b; title.placeholder = lang === 'en' ? 'Add title' : 'เพิ่มหัวข้อข่าว';
    grow(); gp(); stats(); selectFig(null);
    if (lang === 'en' && !store.en.b) toast('ยังไม่มีฉบับภาษาอังกฤษ เริ่มเขียนได้เลย');
  }));

  /* ---------- side panels ---------- */
  const when = $('[data-when]'), pubBtn = $('[data-publish]'), pill = $('[data-pub-state]');
  when.addEventListener('change', () => { $('[data-when-at]').hidden = when.value !== 'later'; pubBtn.textContent = when.value === 'later' ? 'ตั้งเวลาเผยแพร่' : 'เผยแพร่'; });
  pubBtn.addEventListener('click', () => {
    if (!title.value.trim()) { title.focus(); toast('กรุณาใส่หัวข้อข่าวก่อนเผยแพร่'); return; }
    if (!$$('.catlist input:checked').length) { toast('กรุณาเลือกหมวดหมู่อย่างน้อย 1 หมวด'); return; }
    saveDraft(false);
    if (when.value === 'later') { pill.className = 'pill p-info'; pill.textContent = 'ตั้งเวลาไว้'; toast(`ตั้งเวลาเผยแพร่ ${$('#eat').value.replace('T', ' ')} แล้ว`); }
    else { pill.className = 'pill p-ok'; pill.textContent = 'เผยแพร่แล้ว'; pubBtn.textContent = 'อัปเดต'; toast('เผยแพร่ข่าวแล้ว'); }
  });
  $('[data-submit-review]').addEventListener('click', () => { pill.className = 'pill p-warn'; pill.textContent = 'รอตรวจ'; toast('ส่งให้ Admin ตรวจแล้ว'); });
  $('[data-trash]').addEventListener('click', () => { toast('ย้ายไปถังขยะแล้ว'); setTimeout(() => location.href = 'posts.html', 900); });

  const cover = $('[data-cover]'), cin = $('[data-cover-input]');
  const setCover = f => { if (!f || !f.type.startsWith('image/')) return; cover.classList.add('has-img'); cover.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="ภาพหน้าปก"><input type="file" accept="image/*" class="vh" data-cover-input aria-label="เปลี่ยนภาพหน้าปก">`; $('[data-cover-input]', cover).addEventListener('change', e => setCover(e.target.files[0])); toast('ตั้งภาพหน้าปกแล้ว'); };
  cin.addEventListener('change', e => setCover(e.target.files[0]));
  ['dragover', 'dragenter'].forEach(ev => cover.addEventListener(ev, e => { e.preventDefault(); cover.classList.add('is-over'); }));
  cover.addEventListener('dragleave', () => cover.classList.remove('is-over'));
  cover.addEventListener('drop', e => { e.preventDefault(); cover.classList.remove('is-over'); setCover(e.dataTransfer.files[0]); });
  $('[data-relp]').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { b.closest('li').remove(); toast('นำสินค้าออกแล้ว'); } });

  /* ---------- preview ---------- */
  $('[data-preview]').addEventListener('click', () => {
    const w = open('', '_blank'); if (!w) return toast('เบราว์เซอร์บล็อกหน้าต่างใหม่');
    const body = ed.innerHTML.replace(/contenteditable="(true|false)"/g, '').replace(/data-placeholder="[^"]*"/g, '');
    w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ตัวอย่าง: ${esc(title.value)}</title><link rel="stylesheet" href="${new URL('../css/style.css', location)}"><link rel="stylesheet" href="${new URL('../css/admin.css', location)}"><style>body{background:#fff}.pv{max-width:820px;margin:0 auto;padding:40px 20px}.pv h1{font-size:38px;margin-bottom:24px}.ed-body{padding:0}.ed-fig{cursor:default}.ed-fig figcaption:empty{display:none}</style></head><body>${document.querySelector('svg[aria-hidden]').outerHTML}<div class="mock">ตัวอย่างก่อนเผยแพร่</div><article class="pv"><h1>${esc(title.value)}</h1><div class="ed-body">${body}</div></article></body></html>`);
    w.document.close();
  });
})();
