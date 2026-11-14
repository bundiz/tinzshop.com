// Builds the Tinzshop redesign pages from shared partials.  node build.mjs
import { writeFileSync } from 'node:fs';
const OUT = new URL('../', import.meta.url);

/* ---------------- icons ---------------- */
import { SYM } from './icons.mjs';
const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(SYM).map(([k,v])=>`<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
const I = (n, c='') => `<svg class="ico ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const art = (cls, a, label='') => `<div class="media ${cls}"><!-- client photo slot --><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:.9"><use href="#i-a-${a}"/></svg>${label?`<span class="art-label">${label}</span>`:''}</div>`;
const baht = n => '฿' + n.toLocaleString('en-US');

/* ---------------- data ---------------- */
const P = {
  ps5:{t:'PlayStation 5 Slim รุ่นมีช่องใส่แผ่น 1TB',pl:'PlayStation 5 · เครื่องเกม',m:'m-ps',a:'console',p:17990,s:'in',r:'4.8 (312)'},
  ps5d:{t:'PlayStation 5 Slim Digital Edition 1TB',pl:'PlayStation 5 · เครื่องเกม',m:'m-ps',a:'console',p:15990,s:'low',r:'4.6 (154)'},
  ns2:{t:'Nintendo Switch 2 เครื่องเกม (ประกันร้าน 1 ปี)',pl:'Nintendo Switch 2 · เครื่องเกม',m:'m-ns',a:'handheld',p:16900,s:'in',r:'4.9 (540)'},
  set12:{t:'ชุดพร้อมเล่น PS5 Slim + จอย DualSense ตัวที่ 2',pl:'ชุดโปรโมชั่น · PS5',m:'m-ps',a:'box',p:19490,o:20280,s:'in',r:'4.7 (88)',tag:'set'},
  set21:{t:'ชุดพร้อมเล่น Switch 2 + Mario Kart World',pl:'ชุดโปรโมชั่น · Switch 2',m:'m-ns',a:'box',p:17990,o:19290,s:'in',r:'4.9 (201)',tag:'set'},
  set13:{t:'ชุด Switch 2 + เคสกันกระแทก + ฟิล์มกระจก',pl:'ชุดโปรโมชั่น · Switch 2',m:'m-ns',a:'box',p:17690,s:'low',r:'4.8 (126)',tag:'set'},
  ds:{t:'จอย DualSense Wireless Controller',pl:'PlayStation 5 · จอย',m:'m-ps',a:'pad',p:2290,s:'in',r:'4.7 (268)'},
  pro2:{t:'Nintendo Switch 2 Pro Controller',pl:'Nintendo Switch 2 · จอย',m:'m-ns',a:'pad',p:2790,s:'out',r:'4.6 (143)'},
  astro:{t:'เกม Astro Bot (PS5) โซน 3 ซับไทย',pl:'PlayStation 5 · แผ่นเกม',m:'m-ps',a:'disc',p:1590,s:'in',r:'4.9 (188)'},
  mkw:{t:'เกม Mario Kart World (Switch 2) โซนเอเชีย',pl:'Nintendo Switch 2 · แผ่นเกม',m:'m-ns',a:'disc',p:2390,s:'in',r:'4.8 (230)'},
  gt7:{t:'เกม Gran Turismo 7 (PS5) โซน 3',pl:'PlayStation 5 · แผ่นเกม',m:'m-ps',a:'disc',p:1290,s:'in',r:'4.7 (120)'},
  ssd:{t:'SSD M.2 NVMe 2TB พร้อมฮีตซิงก์ สำหรับ PS5',pl:'IT Gadgets · ที่เก็บข้อมูล',m:'m-it',a:'ssd',p:5490,s:'in',r:'4.7 (59)'},
  head:{t:'หูฟังเกมมิ่งไร้สาย 7.1 Surround',pl:'IT Gadgets · หูฟัง',m:'m-it',a:'head',p:3490,s:'low',r:'4.4 (97)'},
  kb:{t:'คีย์บอร์ด Mechanical RGB ขนาด TKL',pl:'IT Gadgets · คีย์บอร์ด',m:'m-it',a:'key',p:2890,s:'in',r:'4.5 (76)'},
  mouse:{t:'เมาส์เกมมิ่งไร้สาย น้ำหนักเบา 60 กรัม',pl:'IT Gadgets · เมาส์',m:'m-it',a:'mouse',p:1990,s:'in',r:'4.6 (64)'},
  guli:{t:'จอย GuliKit KingKong 3 Max สำหรับ Switch / PC',pl:'Nintendo Switch · จอย',m:'m-ns',a:'pad',p:2190,s:'drop',r:'4.6 (41)'},
  pulse:{t:'หูฟังไร้สาย Pulse Elite สำหรับ PS5',pl:'PlayStation 5 · อุปกรณ์เสริม',m:'m-ps',a:'head',p:4590,o:5290,s:'in',r:'4.4 (39)',tag:'sale'},
  dock:{t:'แท่นชาร์จจอย DualSense แบบคู่',pl:'PlayStation 5 · อุปกรณ์เสริม',m:'m-ps',a:'pad',p:1190,s:'in',r:'4.5 (73)'},
  portal:{t:'PlayStation Portal Remote Player',pl:'PlayStation 5 · อุปกรณ์เสริม',m:'m-ps',a:'handheld',p:7990,s:'out',r:'4.3 (45)'},
  edge:{t:'จอย DualSense Edge Wireless Controller',pl:'PlayStation 5 · จอย',m:'m-ps',a:'pad',p:7490,s:'in',r:'4.5 (61)'},
};
const STOCK = {in:['stock-in','มีสินค้า'],low:['stock-low','เหลือน้อย'],out:['stock-out','สินค้าหมด'],drop:['stock-low','สั่งจากตัวแทน · รอ 7–14 วัน']};
const TAG = {set:'<span class="tag tag-set">ชุดโปรโมชั่น</span>',sale:'<span class="tag tag-sale">ลดราคา</span>',pre:'<span class="tag tag-pre">พรีออเดอร์</span>'};

const card = (k) => { const p=P[k]; const [sc,sl]=STOCK[p.s]; const out=p.s==='out';
  return `<article class="card${out?' is-out':''}">
  ${p.tag?`<div class="card__tags">${TAG[p.tag]}</div>`:''}
  <button class="wish" type="button" aria-pressed="false" aria-label="เพิ่ม ${p.t} ในรายการที่ชอบ">${I('heart')}</button>
  ${art(p.m,p.a)}
  <div class="card__body">
    <p class="card__plat">${p.pl}</p>
    <h3 class="card__title"><a href="product.html">${p.t}</a></h3>
    <div class="card__price"><span class="price num${p.o?' price-sale':''}">${baht(p.p)}</span>${p.o?`<span class="price-old num">${baht(p.o)}</span>`:''}</div>
    ${p.p>=10000?`<p class="inst">ผ่อนบัตรเครดิตผ่าน K-Payment ได้</p>`:''}
    <div class="card__foot"><span class="stock ${sc}">${sl}</span>
      <button class="add" type="button" ${out?'disabled aria-label="สินค้าหมด"':`data-add="${p.t}" aria-label="ใส่ ${p.t} ลงตะกร้า"`}>${I('cart')}</button></div>
  </div></article>`; };

/* ---------------- partials ---------------- */
const head = (title, desc) => `<!doctype html>
<html lang="th" data-type="product">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="page-type" content="product"><meta name="site-kind" content="tech">
<meta name="theme-color" content="#0C1524">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="website">
<link rel="preload" href="assets/fonts/anuphan-thai-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/ibm-plex-sans-thai-thai-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/style.css">
</head>`;

const NAV = [
  ['index.html','หน้าแรก',''],
  ['category.html','PlayStation 5','ps'],
  ['category.html#ns','Nintendo Switch 2','ns'],
  ['category.html#it','IT Gadgets','it'],
  ['category.html#pre','พรีออเดอร์',''],
  ['category.html#set','ชุดโปรโมชั่น',''],
  ['category.html#other','เครื่องเกมอื่น ๆ · ของเล่น','ot'],
  ['category.html#sale','สินค้าลดราคา','sale'],
  ['news.html','ข่าวเกม & รีวิว',''],
];
const header = (cur, {user=false, cartN=3}={}) => `
<a class="skip" href="#main">ข้ามไปเนื้อหาหลัก</a>
<div class="mock">ตัวอย่างงานออกแบบ (Design mockup) — ราคา สต๊อก รีวิว และข้อมูลลูกค้าเป็นข้อมูลสมมติ</div>
<div class="topbar"><div class="wrap">
  <p class="topbar__msg"><span class="dot" aria-hidden="true"></span><span><b>ส่งด่วนภายในวัน</b> กรุงเทพฯ และปริมณฑล · ส่งฟรีเมื่อซื้อครบ <span data-assumed>฿3,000</span></span></p>
  <div class="topbar__links">
    <a href="track.html">${I('truck','ico-sm')}ติดตามพัสดุ</a>
    <a href="warranty.html">${I('wrench','ico-sm')}ลงทะเบียน / แจ้งเคลม</a>
    <a href="#line">${I('chat','ico-sm')}LINE @tinzshop</a>
    <a href="#" data-lang aria-label="Switch language to English">${I('globe','ico-sm')}TH · EN</a>
  </div>
</div></div>
<header class="header">
  <div class="wrap header__row">
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="drawer" aria-label="เปิดเมนู">${I('menu')}</button>
    <a class="brand" href="index.html" aria-label="Tinzshop หน้าแรก"><span class="brand__mark" aria-hidden="true">T</span><span class="brand__word">Tinz<b>shop</b></span></a>
    <form class="search" role="search" action="category.html">
      ${I('search')}
      <label class="vh" for="q">ค้นหาสินค้า</label>
      <input id="q" name="q" type="search" placeholder="ค้นหาเกม เครื่อง อุปกรณ์" autocomplete="off">
      <button type="submit">ค้นหา</button>
    </form>
    <nav class="hactions" aria-label="บัญชีและตะกร้า">
      <a class="hact" href="${user?'account.html':'login.html'}">${I('user')}<span class="hact__lbl">${user?'<small>สวัสดี คุณตัวอย่าง</small><strong>บัญชีของฉัน</strong>':'<small>เข้าสู่ระบบ</small><strong>บัญชีของฉัน</strong>'}</span></a>
      <a class="hact" href="account.html#wish" aria-label="รายการที่ชอบ">${I('heart')}<span class="hact__lbl"><small>รายการ</small><strong>ที่ชอบ</strong></span></a>
      <a class="hact" href="cart.html" aria-label="ตะกร้าสินค้า ${cartN} รายการ"${cur==='cart'?' aria-current="page"':''}>${I('cart')}<span class="badge-count" data-cart-count>${cartN}</span><span class="hact__lbl"><small>ตะกร้า</small><strong class="num">฿23,460</strong></span></a>
    </nav>
  </div>
  <nav class="catnav" aria-label="หมวดหมู่หลัก"><div class="wrap"><ul>
    ${NAV.map(([h,l,d])=>`<li><a href="${h}"${cur===l?' aria-current="page"':''}${d==='sale'?' class="nav-sale"':''}>${d&&d!=='sale'?`<span class="pdot ${d}" aria-hidden="true"></span>`:''}${l}</a></li>`).join('')}
  </ul></div></nav>
</header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="เมนู">
  <div class="drawer__head"><span class="brand"><span class="brand__mark" aria-hidden="true">T</span><span class="brand__word">Tinz<b>shop</b></span></span><button class="menu-btn" style="display:inline-flex" type="button" data-close aria-label="ปิดเมนู">${I('x')}</button></div>
  ${NAV.map(([h,l])=>`<a href="${h}">${l}</a>`).join('')}
  <a href="track.html">${I('truck')}ติดตามพัสดุ</a>
  <a href="warranty.html">${I('wrench')}ลงทะเบียนรับประกัน / แจ้งเคลม</a>
  <a href="login.html">${I('user')}เข้าสู่ระบบ / สมัครสมาชิก</a>
  <a href="#" data-lang>${I('globe')}English</a>
  <a class="btn btn-lineapp btn-block" href="#line">${I('chat')}แชทกับร้านทาง LINE</a>
</div>`;

const footer = () => `
<footer class="footer" id="line">
  <div class="wrap footer__top">
    <div class="footer__about">
      <a class="brand" href="index.html" aria-label="Tinzshop หน้าแรก"><span class="brand__mark" aria-hidden="true">T</span><span class="brand__word">Tinz<b>shop</b></span></a>
      <p>ร้านเกม คอนโซล และอุปกรณ์ไอที จากหน้าร้านย่านสะพานเหล็ก มาเป็นร้านออนไลน์ที่ส่งทั่วประเทศไทย</p>
      <div class="social"><a href="#" aria-label="Facebook">${I('fb')}</a><a href="#" aria-label="YouTube">${I('yt')}</a><a href="#" aria-label="TikTok">${I('tt')}</a><a href="#" aria-label="LINE @tinzshop">${I('chat')}</a></div>
    </div>
    <div><h4>ช่วยเหลือ</h4><ul>
      <li><a href="track.html">ติดตามพัสดุ</a></li><li><a href="#">วิธีสั่งซื้อและชำระเงิน</a></li><li><a href="#">คำถามที่พบบ่อย</a></li><li><a href="warranty.html">ลงทะเบียนรับประกัน / แจ้งเคลม</a></li><li><a href="#">การยกเลิกคำสั่งซื้อ</a></li></ul></div>
    <div><h4>เกี่ยวกับเรา</h4><ul>
      <li><a href="#">เรื่องราวของ Tinzshop</a></li><li><a href="news.html">ข่าวเกม & รีวิว</a></li><li><a href="#">นโยบายการรับประกันและคืนสินค้า</a></li><li><a href="#">นโยบายความเป็นส่วนตัว (PDPA)</a></li><li><a href="#">เงื่อนไขการใช้บริการ</a></li></ul></div>
    <div><h4>ติดต่อร้าน</h4><ul>
      <li><a href="#">${'LINE @tinzshop'}</a></li><li><a href="#">โทร (เบอร์ร้าน)</a></li><li><a href="#">อีเมลร้าน</a></li></ul>
      <p style="margin-top:10px">จันทร์–เสาร์ 10:00–18:00<br>ซอยจินดาถวิล ถนนพระราม 4 เขตบางรัก</p></div>
  </div>
  <div class="footer__bot"><div class="wrap">
    <div class="paylist"><span class="pay">โอนผ่านธนาคาร</span><span class="pay">บัตรเครดิต / เดบิต</span><span class="pay">ผ่อนชำระ</span><span class="pay">PromptPay QR</span><span class="pay">ผ่าน K-Payment</span><span class="pay">DBD Registered</span></div>
    <p>© 2569 Tinzshop · ตัวอย่างงานออกแบบ</p>
  </div></div>
</footer>
<div class="toast" role="status" aria-live="polite" data-toast>${I('check')}<span data-toast-msg>ใส่ตะกร้าแล้ว</span><a href="cart.html">ดูตะกร้า</a></div>
<script src="js/app.js" defer></script>
</body></html>`;

const page = (file, title, desc, cur, body, opts={}) => {
  writeFileSync(new URL(file, OUT), `${head(title,desc)}\n<body${opts.bodyClass?` class="${opts.bodyClass}"`:''}>\n${sprite()}\n${opts.noHeader?opts.customHeader:header(cur,opts)}\n<main id="main">${body}</main>\n${opts.noFooter?`<script src="js/app.js" defer></script></body></html>`:footer()}`);
};
const crumbs = (...xs) => `<nav class="crumbs" aria-label="เส้นทาง"><a href="index.html">หน้าแรก</a>${xs.map(([h,l])=>`${I('chev-r')}${h?`<a href="${h}">${l}</a>`:`<span aria-current="page">${l}</span>`}`).join('')}</nav>`;

/* ================= INDEX ================= */
const PLATS = [
  ['PlayStation 5','เครื่อง · เกม · จอย','ps','#E7F0FC','#0B4FAE','console'],
  ['Switch 2','เครื่อง · เกม · จอย','ns','#FDE8EC','#B5001F','handheld'],
  ['IT Gadgets','คีย์บอร์ด · เมาส์','it','#E2F5F2','#0A6E62','key'],
  ['พรีออเดอร์','จองก่อนวางขาย','pre','#E9ECF2','#10141C','calendar'],
  ['ชุดโปรโมชั่น','เครื่อง + เกม คุ้มกว่า','set','#FFF0E8','#C24410','box'],
  ['ลดราคา','สินค้าราคาพิเศษ','sale','#FCE9E7','#B42318','tag'],
];
const index = `
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap hero__grid" data-enter>
    <div>
      <p class="eyebrow" style="color:#A9B4C8">ร้านเกมย่านสะพานเหล็ก · ออนไลน์ทั่วไทย</p>
      <h1 id="hero-title" style="margin-top:14px">เครื่องเกม แผ่นเกม และอุปกรณ์ <em>PS5 · Switch 2</em> ครบในร้านเดียว</h1>
      <p class="hero__lead">สั่งได้เลยโดยไม่ต้องสมัครสมาชิก ไม่แน่ใจรุ่นไหน ทักถามพนักงานที่เล่นเกมจริงทาง LINE ก่อนซื้อได้</p>
      <ul class="hero__facts">
        <li>${I('bolt')}ส่งด่วนภายในวัน กรุงเทพฯ และปริมณฑล</li>
        <li>${I('card')}ผ่อนบัตรเครดิตผ่าน K-Payment</li>
        <li>${I('receipt')}ใบกำกับภาษีออกอัตโนมัติ</li>
      </ul>
      <div class="hero__cta">
        <a class="btn btn-buy btn-lg" href="category.html">เลือกซื้อสินค้า ${I('chev-r')}</a>
        <a class="btn btn-ghost btn-lg" href="track.html">${I('truck')}ติดตามพัสดุ</a>
      </div>
    </div>
    <div class="feature">
      <span class="feature__tag tag tag-set">ชุดโปรโมชั่นขายดี</span>
      ${art('m-dark','box')}
      <div class="feature__body">
        <div><h2><a href="product.html">ชุดพร้อมเล่น PS5 Slim + จอยตัวที่ 2</a></h2><p>คุ้มกว่าซื้อแยก ฿790 · มีสินค้า ส่งได้วันนี้</p></div>
        <span class="price num">฿19,490</span>
      </div>
      <div class="feature__mini">
        <a class="mini" href="product.html">${art('m-ns','handheld')}<span><b>Switch 2</b>฿16,900</span></a>
        <a class="mini" href="product.html">${art('m-ps','disc')}<span><b>Astro Bot</b>฿1,590</span></a>
        <a class="mini" href="product.html">${art('m-it','head')}<span><b>หูฟัง 7.1</b>฿3,490</span></a>
      </div>
    </div>
  </div>
</section>
<nav class="plats" aria-label="เลือกตามแพลตฟอร์ม"><div class="wrap"><ul>
  ${PLATS.map(([t,s,h,bg,c,a])=>`<li><a class="plat" href="category.html#${h}"><span class="plat__ico" style="background:${bg};color:${c}">${I({console:'a-console',handheld:'a-handheld',key:'a-key',calendar:'calendar',box:'a-box',tag:'tag'}[a])}</span><span><b>${t}</b><small>${s}</small></span></a></li>`).join('')}
</ul></div></nav>

<section class="sec" aria-labelledby="sets-title"><div class="wrap">
  <div class="sec__head"><div><h2 id="sets-title">ชุดโปรโมชั่นพร้อมเล่น</h2><p>เครื่อง เกม และอุปกรณ์เสริม จัดเป็นชุด ราคาถูกกว่าซื้อแยก</p></div><a class="link" href="category.html#set">ดูชุดทั้งหมด ${I('chev-r','ico-sm')}</a></div>
  <div class="grid g-5">${['set12','set21','set13','ps5','ns2'].map(card).join('')}</div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="plat-title"><div class="wrap">
  <h2 id="plat-title" class="vh">เลือกซื้อตามเครื่อง</h2>
  <div class="split2">
    <div class="pbanner pbanner--ps"><div><p class="eyebrow" style="color:#CFE0FA">PlayStation 5</p><h3 style="margin-top:8px"><a class="cover" href="category.html">ทุกอย่างสำหรับ PS5</a></h3><p>เครื่อง Slim ทั้งรุ่นมีช่องแผ่นและ Digital แผ่นเกมโซน 3 ซับไทย จอย และ SSD เพิ่มความจุ</p>
      <ul><li><a href="category.html">เครื่องเกม</a></li><li><a href="category.html">แผ่นเกม</a></li><li><a href="category.html">จอย</a></li><li><a href="category.html">อุปกรณ์เสริม</a></li></ul></div>${art('','console')}</div>
    <div class="pbanner pbanner--ns"><div><p class="eyebrow" style="color:#FFD3DB">Nintendo Switch 2</p><h3 style="margin-top:8px"><a class="cover" href="category.html#ns">ทุกอย่างสำหรับ Switch 2</a></h3><p>เครื่องประกันร้าน เกมใหม่โซนเอเชีย Pro Controller เคส และฟิล์มกันรอย</p>
      <ul><li><a href="category.html#ns">เครื่องเกม</a></li><li><a href="category.html#ns">แผ่นเกม</a></li><li><a href="category.html#ns">จอย</a></li><li><a href="category.html#ns">เคส & ฟิล์ม</a></li></ul></div>${art('','handheld')}</div>
  </div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="best-title"><div class="wrap">
  <div class="sec__head"><div><h2 id="best-title">สินค้าขายดีสัปดาห์นี้</h2></div>
    <div class="chips" role="group" aria-label="กรองสินค้าขายดี"><button class="chip" type="button" aria-pressed="true">ทั้งหมด</button><button class="chip" type="button" aria-pressed="false">PS5</button><button class="chip" type="button" aria-pressed="false">Switch 2</button><button class="chip" type="button" aria-pressed="false">IT Gadgets</button></div></div>
  <div class="grid g-5">${['ds','mkw','astro','head','pro2','kb','ssd','mouse','pulse','guli'].map(card).join('')}</div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="pre-title"><div class="wrap">
  <div class="sec__head"><div><h2 id="pre-title">พรีออเดอร์ เปิดจองแล้ว</h2><p>จำนวนรับจองจำกัด เลือกจ่ายเต็มหรือวางมัดจำก่อน แล้วชำระส่วนที่เหลือก่อนส่งของ</p></div><a class="link" href="category.html#pre">ดูพรีออเดอร์ทั้งหมด ${I('chev-r','ico-sm')}</a></div>
  <div class="pre">
    ${[['20','พ.ย.','เกมใหม่ Switch 2 (ตัวอย่างชื่อเกม) Standard Edition','m-ns','disc',2190,500,'เหลือที่จองน้อย'],['27','พ.ย.','จอย DualSense สีใหม่ Limited Edition','m-ps','pad',2590,500,''],['4','ธ.ค.','เกมใหม่ PS5 (ตัวอย่างชื่อเกม) Deluxe Edition','m-ps','disc',2690,500,''],['11','ธ.ค.','amiibo ตัวใหม่ (ตัวอย่าง) ชุดสะสม','m-ns','fig',890,0,'']].map(([d,m,t,c,a,p,dep,lo])=>`
    <article class="pre__item"><div class="pre__date"><b>${d}</b><span>${m} 69</span></div>${art(c,a)}
      <div><h3><a href="product.html">${t}</a></h3><div class="pre__meta">${TAG.pre}${dep?`<span class="card__note">มัดจำ ${baht(dep)}</span>`:'<span class="card__note">ชำระเต็มจำนวน</span>'}${lo?`<span class="stock stock-low">${lo}</span>`:''}</div></div>
      <span class="price num">${baht(p)}</span></article>`).join('')}
  </div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="why-title"><div class="wrap">
  <div class="sec__head"><div><h2 id="why-title">ทำไมเกมเมอร์ซื้อกับ Tinzshop</h2></div></div>
  <div class="reasons">
    <div class="reason"><div class="reason__ico">${I('bolt')}</div><h3>ส่งด่วนภายในวัน</h3><p>สั่งก่อนบ่ายในกรุงเทพฯ และปริมณฑล ได้ของวันเดียวกัน ต่างจังหวัดส่งพร้อมเลขพัสดุให้ติดตามเอง</p></div>
    <div class="reason"><div class="reason__ico">${I('chat')}</div><h3>ถามคนที่เล่นจริง</h3><p>พนักงานเล่นเกมเอง แนะนำรุ่นและเกมตามที่คุณใช้ ไม่ขายเกินความจำเป็น</p></div>
    <div class="reason"><div class="reason__ico">${I('wrench')}</div><h3>เคลมง่ายผ่านเว็บ</h3><p>ลงทะเบียนรับประกันและแจ้งเคลมได้เอง แนบรูปอาการ แล้วติดตามสถานะในบัญชีของคุณ</p></div>
    <div class="reason"><div class="reason__ico">${I('receipt')}</div><h3>เอกสารครบ</h3><p>ราคารวม VAT ใบกำกับภาษีอย่างย่อออกให้ทุกคำสั่งซื้อ ดาวน์โหลด PDF จากประวัติการสั่งซื้อ</p></div>
  </div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="consult-title"><div class="wrap">
  <div class="consult">
    <div>
      <p class="eyebrow" style="color:#A9B4C8">ไม่แน่ใจว่าจะเลือกรุ่นไหน</p>
      <h2 id="consult-title" style="margin-top:12px">ทักถามร้านก่อนซื้อ ตอบในเวลาทำการ</h2>
      <p>ถามได้ทั้งเรื่องรุ่น โซนแผ่น การผ่อน หรือของที่ต้องสั่งจากตัวแทน จันทร์–เสาร์ 10:00–18:00</p>
      <div class="consult__cta"><a class="btn btn-lineapp btn-lg" href="#">${I('chat')}แชทกับร้านทาง LINE</a><a class="btn btn-ghost btn-lg" href="#">อ่านคำถามที่พบบ่อย</a></div>
    </div>
    <div>
      <p class="consult__handle"><span>@</span>tinzshop</p>
      <div class="consult__q" aria-hidden="true"><span class="bubble me">PS5 Slim รุ่นมีช่องแผ่นกับ Digital ต่างกันยังไงครับ</span><span class="bubble">รุ่นมีช่องแผ่นเล่นแผ่นเกมและ Blu-ray ได้ครับ ถ้าซื้อเกมดิจิทัลอย่างเดียว Digital ประหยัดกว่า ฿2,000</span></div>
    </div>
  </div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="news-title"><div class="wrap">
  <div class="sec__head"><div><h2 id="news-title">ข่าวเกมและรีวิวจากร้าน</h2></div><a class="link" href="news.html">อ่านทั้งหมด ${I('chev-r','ico-sm')}</a></div>
  <div class="grid g-3">
    ${[['m-dark','news','PlayStation','สรุปเกมใหม่ที่ประกาศในงานเดือนนี้ (ตัวอย่างหัวข้อข่าว)','22 ก.ย. 2569','tag-ps'],['m-ns','handheld','รีวิวสินค้า','รีวิว Switch 2 หลังใช้งาน 3 เดือน คุ้มไหมสำหรับมือใหม่ (ตัวอย่าง)','19 ก.ย. 2569','tag-ot'],['m-ot','calendar','ประชาสัมพันธ์','เปิดรับพรีออเดอร์เกมใหม่ประจำเดือนพฤศจิกายน','15 ก.ย. 2569','tag-ot']].map(([m,a,tg,h,d,tc])=>`
    <article class="ncard">${a==='calendar'?`<div class="media ${m}"><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:.9"><use href="#i-calendar"/></svg></div>`:art(m,a)}<div class="ncard__body"><span class="tag ${tc}" style="align-self:flex-start">${tg}</span><h3><a href="news.html">${h}</a></h3><time>${d}</time></div></article>`).join('')}
  </div>
</div></section>

<section class="sec" style="padding-top:0" aria-labelledby="visit-title"><div class="wrap">
  <div class="visit">
    <div class="vcard">
      <p class="eyebrow">หน้าร้าน</p>
      <h2 id="visit-title" style="margin-top:10px">แวะมาดูของจริงที่ร้าน ย่านสะพานเหล็ก</h2>
      <div class="vrows">
        <div class="vrow">${I('pin')}<div><b>ซอยจินดาถวิล ถนนพระราม 4</b><span>เขตบางรัก กรุงเทพมหานคร</span></div></div>
        <div class="vrow">${I('clock')}<div><b>จันทร์–เสาร์ 10:00–18:00</b><span>ปิดวันอาทิตย์และวันหยุดนักขัตฤกษ์</span></div></div>
        <div class="vrow">${I('chat')}<div><b>LINE @tinzshop</b><span>ถามสต๊อกก่อนเดินทางมาได้</span></div></div>
      </div>
      <div class="hero__cta" style="margin-top:24px"><a class="btn btn-dark" href="#">${I('pin')}ดูเส้นทาง</a><a class="btn btn-line" href="#">${I('chat')}ถามสต๊อกทาง LINE</a></div>
    </div>
    <div class="vmap" aria-hidden="true">
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"><rect width="600" height="400" fill="#E8ECE4"/>
        <g fill="#D9DFD4"><rect x="30" y="30" width="150" height="110" rx="6"/><rect x="210" y="30" width="120" height="110" rx="6"/><rect x="360" y="30" width="210" height="110" rx="6"/><rect x="30" y="250" width="200" height="120" rx="6"/><rect x="260" y="250" width="140" height="120" rx="6"/><rect x="430" y="250" width="140" height="120" rx="6"/></g>
        <path d="M0 195h600" stroke="#fff" stroke-width="34"/><path d="M0 195h600" stroke="#F7D9A8" stroke-width="22"/>
        <path d="M312 0v400" stroke="#fff" stroke-width="16"/><path d="M195 0v400M415 0v400" stroke="#fff" stroke-width="10"/>
        <rect x="0" y="210" width="600" height="20" fill="#BFD7EA" opacity=".0"/>
        <text x="40" y="186" font-family="Plex Thai, sans-serif" font-size="15" fill="#6A6F78">ถนนพระราม 4</text>
        <text x="320" y="100" font-family="Plex Thai, sans-serif" font-size="13" fill="#6A6F78" transform="rotate(90 320 100)">ซอยจินดาถวิล</text>
      </svg>
      <span class="vmap__pin">Tinzshop</span>
    </div>
  </div>
</div></section>`;
page('index.html','Tinzshop — เครื่องเกม แผ่นเกม และอุปกรณ์ PS5 · Nintendo Switch 2','ร้านเกมย่านสะพานเหล็ก ขาย PS5, Nintendo Switch 2, แผ่นเกม จอย และ IT Gadgets ส่งด่วนภายในวันในกรุงเทพฯ ผ่อนบัตรเครดิตผ่าน K-Payment','หน้าแรก',index);

/* ================= CATEGORY ================= */
const SUBS = [['ทั้งหมด','248','m-ps','console',true],['เครื่องเกม','18','m-ps','console'],['แผ่นเกม','142','m-ps','disc'],['จอย','27','m-ps','pad'],['อุปกรณ์เสริม','49','m-ps','head'],['ชุดโปรโมชั่น','12','m-ps','box']];
const fcheck = (l,c,on=false) => `<label class="check"><input type="checkbox"${on?' checked':''}>${l}<span class="cnt">${c}</span></label>`;
const category = `<div class="wrap">
  ${crumbs([null,'PlayStation 5'])}
  <div class="lhead"><div><h1>PlayStation 5</h1><p>เครื่องเกม แผ่นเกม จอย และอุปกรณ์เสริมสำหรับ PS5 · 248 รายการ</p></div></div>
  <nav class="subcats" aria-label="หมวดย่อย">${SUBS.map(([l,c,m,a,on])=>`<a class="subcat" href="category.html"${on?' aria-current="page"':''}>${art(m,a)}<span>${l}</span><small>${c} รายการ</small></a>`).join('')}</nav>
  <div class="listing">
    <aside class="filters" id="filters" aria-label="ตัวกรองสินค้า">
      <div class="filters__head"><b style="font-size:20px">ตัวกรอง</b><button class="menu-btn" style="display:inline-flex" type="button" data-filter-close aria-label="ปิดตัวกรอง">${I('x')}</button></div>
      <details class="fgroup" open><summary>สถานะสินค้า ${I('chev-d','ico-sm')}</summary><div class="fbody">${fcheck('มีสินค้า พร้อมส่ง','221',true)}${fcheck('พรีออเดอร์','9')}${fcheck('สั่งจากตัวแทน (รอของ)','18')}</div></details>
      <details class="fgroup" open><summary>ประเภทสินค้า ${I('chev-d','ico-sm')}</summary><div class="fbody">${fcheck('เครื่องเกม','18')}${fcheck('แผ่นเกม','142')}${fcheck('จอย','27')}${fcheck('อุปกรณ์เสริม','49')}${fcheck('ชุดโปรโมชั่น','12')}</div></details>
      <details class="fgroup" open><summary>ช่วงราคา (บาท) ${I('chev-d','ico-sm')}</summary><div class="fbody"><div class="prange"><label class="vh" for="pmin">ราคาต่ำสุด</label><input class="input" id="pmin" inputmode="numeric" placeholder="ต่ำสุด"><span aria-hidden="true">–</span><label class="vh" for="pmax">ราคาสูงสุด</label><input class="input" id="pmax" inputmode="numeric" placeholder="สูงสุด"></div>
        <div class="chips" style="margin-top:10px"><button class="chip" type="button" aria-pressed="false">ต่ำกว่า ฿2,000</button><button class="chip" type="button" aria-pressed="false">฿2,000–10,000</button><button class="chip" type="button" aria-pressed="false">มากกว่า ฿10,000</button></div></div></details>
      <details class="fgroup"><summary>โซนแผ่นเกม ${I('chev-d','ico-sm')}</summary><div class="fbody">${fcheck('โซน 3 (เอเชีย)','96')}${fcheck('โซน 2 (ยุโรป)','31')}${fcheck('มีซับไทย','58')}</div></details>
      <details class="fgroup"><summary>การชำระเงิน ${I('chev-d','ico-sm')}</summary><div class="fbody">${fcheck('ผ่อนชำระได้','34')}</div></details>
      <div class="filters__apply"><button class="btn btn-dark btn-block" type="button" data-filter-close>แสดง 221 รายการ</button></div>
    </aside>
    <div>
      <div class="toolbar">
        <p class="toolbar__count">แสดง <b>1–20</b> จาก <b>221</b> รายการ</p>
        <div class="toolbar__ctrl">
          <button class="btn btn-line ftoggle" type="button" aria-controls="filters" aria-expanded="false" style="min-height:44px">${I('filter','ico-sm')}ตัวกรอง</button>
          <label class="vh" for="sort">เรียงตาม</label>
          <select class="select" id="sort"><option>เรียงตาม: แนะนำ</option><option>ขายดี</option><option>มาใหม่</option><option>ราคา: ต่ำ → สูง</option><option>ราคา: สูง → ต่ำ</option></select>
        </div>
      </div>
      <div class="active-f"><span>ตัวกรองที่ใช้:</span><button class="chip is-on" type="button">มีสินค้า พร้อมส่ง ${I('x','ico-sm')}</button><button class="link" type="button" style="border:0;background:none;min-height:36px">ล้างทั้งหมด</button></div>
      <div class="grid g-4">${['ps5','ps5d','set12','ds','edge','astro','gt7','pulse','dock','ssd','portal','head'].map(card).join('')}</div>
      <nav class="pager" aria-label="เลขหน้า"><a href="#" aria-label="หน้าก่อนหน้า">${I('chev-l','ico-sm')}</a><span aria-current="page">1</span><a href="#">2</a><a href="#">3</a><span class="gap" aria-hidden="true">…</span><a href="#">12</a><a href="#" aria-label="หน้าถัดไป">${I('chev-r','ico-sm')}</a></nav>
    </div>
  </div>
</div>`;
page('category.html','PlayStation 5 — Tinzshop','เครื่อง PS5 Slim แผ่นเกมโซน 3 จอย DualSense และอุปกรณ์เสริม ส่งด่วนภายในวันในกรุงเทพฯ','PlayStation 5',category);

/* ================= PRODUCT ================= */
const variants = JSON.stringify({
  'disc|white':{price:17990,stock:'in',sku:'PS5-SLIM-1TB-DISC-WH'},
  'disc|black':{price:17990,stock:'out',sku:'PS5-SLIM-1TB-DISC-BK'},
  'digital|white':{price:15990,stock:'low',sku:'PS5-SLIM-1TB-DIG-WH'},
  'digital|black':{price:16290,stock:'in',sku:'PS5-SLIM-1TB-DIG-BK'},
});
const product = `<div class="wrap">
  ${crumbs(['category.html','PlayStation 5'],['category.html','เครื่องเกม'],[null,'PlayStation 5 Slim'])}
  <div class="pdp">
    <section class="gallery" aria-label="รูปสินค้า">
      <div class="gallery__stage" data-stage>${art('m-ps','console','1 / 5')}</div>
      <div class="thumbs">${[['m-ps','console'],['m-ps','pad'],['m-dark','console'],['m-ot','box'],['m-ps','disc']].map(([m,a],i)=>`<button class="thumb" type="button" data-thumb="${m}|${a}|${i+1}" aria-current="${i===0}" aria-label="รูปที่ ${i+1}">${art(m,a)}</button>`).join('')}</div>
    </section>
    <section class="buy" aria-labelledby="ptitle">
      <span class="tag tag-ps">PlayStation 5 · เครื่องเกม</span>
      <h1 id="ptitle">PlayStation 5 Slim เครื่องเกมคอนโซล 1TB</h1>
      <div class="buy__meta"><span><span class="stars" style="--p:96%" aria-hidden="true"></span> <b>4.8</b></span><a class="link" href="#tabs" data-open-tab="t3">312 รีวิว</a><span>รหัสรุ่น <b class="num" data-sku>PS5-SLIM-1TB-DISC-WH</b></span></div>
      <div class="pricebox">
        <div class="pricebox__row"><span class="price num" data-price>฿17,990</span><span class="stock stock-in" data-stock>มีสินค้า · ส่งได้วันนี้</span></div>
        <p class="pricebox__inst">${I('card')}<span>ผ่อนบัตรเครดิตผ่าน K-Payment เลือกจำนวนงวดตอนชำระเงิน · ราคารวม VAT แล้ว</span></p>
      </div>
      <script type="application/json" id="variants">${variants}</script>
      <fieldset class="opt"><legend>รุ่น: <span data-lbl="ed">มีช่องใส่แผ่น</span></legend><div class="opt__vals">
        <input type="radio" name="ed" id="ed1" value="disc" data-name="มีช่องใส่แผ่น" checked><label for="ed1">มีช่องใส่แผ่น</label>
        <input type="radio" name="ed" id="ed2" value="digital" data-name="Digital Edition"><label for="ed2">Digital Edition</label></div></fieldset>
      <fieldset class="opt"><legend>สี: <span data-lbl="co">ขาว</span></legend><div class="opt__vals">
        <input type="radio" name="co" id="co1" value="white" data-name="ขาว" checked><label for="co1"><span class="sw" style="background:#F4F4F2"></span>ขาว</label>
        <input type="radio" name="co" id="co2" value="black" data-name="ดำ"><label for="co2"><span class="sw" style="background:#1D1F24"></span>ดำ <small data-co-note></small></label></div></fieldset>
      <div class="buyrow">
        <div class="qty" data-qty><button type="button" aria-label="ลดจำนวน">−</button><label class="vh" for="qty">จำนวน</label><input id="qty" inputmode="numeric" value="1"><button type="button" aria-label="เพิ่มจำนวน">+</button></div>
        <button class="btn btn-dark btn-lg" type="button" data-add="PlayStation 5 Slim" data-buy-btn>${I('cart')}ใส่ตะกร้า</button>
        <a class="btn btn-buy btn-lg" href="checkout.html" data-buy-now>ซื้อเลย</a>
      </div>
      <div class="assure">
        <div>${I('truck')}<p><b>ส่งด่วนภายในวัน</b><span>กทม. และปริมณฑล สั่งก่อน 14:00</span></p></div>
        <div>${I('shield')}<p><b>ประกันศูนย์ไทย 1 ปี</b><span>ลงทะเบียนและแจ้งเคลมผ่านเว็บได้</span></p></div>
        <div>${I('receipt')}<p><b>ใบกำกับภาษีอัตโนมัติ</b><span>ดาวน์โหลด PDF จากประวัติการสั่งซื้อ</span></p></div>
        <div>${I('user')}<p><b>ไม่ต้องสมัครสมาชิก</b><span>สั่งด้วยอีเมลและเบอร์โทรได้เลย</span></p></div>
      </div>
      <div class="ask"><p><b>มีคำถามก่อนซื้อ?</b>ถามพนักงานที่เล่น PS5 จริงทาง LINE</p><a class="btn btn-lineapp" href="#">${I('chat')}ถามทาง LINE</a></div>
    </section>
  </div>

  <section class="tabs" id="tabs" aria-label="ข้อมูลสินค้า">
    <div class="tabs__list" role="tablist">
      <button role="tab" id="t1" aria-controls="p1" aria-selected="true">รายละเอียดสินค้า</button>
      <button role="tab" id="t2" aria-controls="p2" aria-selected="false" tabindex="-1">ข้อมูลจำเพาะ</button>
      <button role="tab" id="t3" aria-controls="p3" aria-selected="false" tabindex="-1">รีวิว (312)</button>
      <button role="tab" id="t4" aria-controls="p4" aria-selected="false" tabindex="-1">การจัดส่งและรับประกัน</button>
    </div>
    <div class="tabs__panel" role="tabpanel" id="p1" aria-labelledby="t1"><div class="prose">
      <h3>เครื่องบางลง ความจุ 1TB เท่าเดิม</h3>
      <p>PlayStation 5 Slim มาพร้อม SSD 1TB โหลดเกมเร็ว เล่นได้ถึง 4K และใช้กับจอย DualSense ที่สั่นตอบสนองแบบ Haptic Feedback (ข้อความตัวอย่าง)</p>
      <h3>เลือกรุ่นไหนดี</h3>
      <ul><li><b>รุ่นมีช่องใส่แผ่น</b> — เล่นแผ่นเกม PS5 และดู Ultra HD Blu-ray ได้ ซื้อแผ่นมือสองหรือขายต่อได้</li><li><b>Digital Edition</b> — ซื้อเกมจาก PlayStation Store อย่างเดียว ราคาถูกกว่า ต่อไดรฟ์แผ่นเพิ่มภายหลังได้</li><li>เล่นเกม PS4 ได้เกือบทั้งหมด · ในกล่องมีจอย DualSense 1 ตัว</li></ul>
    </div></div>
    <div class="tabs__panel" role="tabpanel" id="p2" aria-labelledby="t2" hidden><table class="spec"><tbody>
      <tr><th scope="row">แบรนด์</th><td>Sony</td></tr><tr><th scope="row">รุ่น</th><td>PlayStation 5 Slim</td></tr><tr><th scope="row">ความจุ</th><td>SSD 1TB</td></tr><tr><th scope="row">ไดรฟ์แผ่น</th><td>Ultra HD Blu-ray (เฉพาะรุ่นมีช่องใส่แผ่น)</td></tr><tr><th scope="row">ความละเอียดสูงสุด</th><td>4K</td></tr><tr><th scope="row">ในกล่อง</th><td>เครื่อง PS5 Slim, จอย DualSense 1 ตัว, สาย HDMI, สายไฟ, สาย USB</td></tr><tr><th scope="row">น้ำหนักสำหรับค่าส่ง</th><td>ประมาณ 4.5 กก.</td></tr>
    </tbody></table></div>
    <div class="tabs__panel" role="tabpanel" id="p3" aria-labelledby="t3" hidden>
      <div class="rsum"><div class="rsum__score"><b>4.8</b><span class="stars" style="--p:96%" aria-hidden="true"></span><p style="color:var(--muted);font-size:14px;margin-top:6px">จาก 312 รีวิว</p></div>
        <div style="display:grid;gap:8px">${[['5 ดาว',84,262],['4 ดาว',11,34],['3 ดาว',3,10],['2 ดาว',1,4],['1 ดาว',1,2]].map(([l,w,n])=>`<div class="rbar"><span>${l}</span><i style="--w:${w}%"></i><span class="num">${n}</span></div>`).join('')}</div></div>
      ${[['ก','ลูกค้า ก. (ตัวอย่าง)',100,'12 ก.ย. 2569','มีช่องใส่แผ่น · ขาว','ของมาไว แพ็กดีมาก เครื่องใช้งานได้ปกติ (ข้อความรีวิวตัวอย่าง)'],['ข','ลูกค้า ข. (ตัวอย่าง)',80,'3 ก.ย. 2569','Digital Edition · ขาว','ผ่อนผ่าน K-Payment สะดวกดี ได้ของตามที่สั่ง (ข้อความรีวิวตัวอย่าง)']].map(([a,n,s,d,v,t])=>`<article class="review"><div class="review__head"><span class="review__av" aria-hidden="true">${a}</span><b>${n}</b><span class="stars" style="--p:${s}%" aria-hidden="true"></span><span class="review__date">${d}</span></div><p class="review__var">${v} · ซื้อจริงจากร้าน</p><p>${t}</p></article>`).join('')}
      <a class="btn btn-line" href="#" style="margin-top:20px">เขียนรีวิว</a>
    </div>
    <div class="tabs__panel" role="tabpanel" id="p4" aria-labelledby="t4" hidden><div class="prose">
      <h3>ค่าจัดส่ง</h3><p>คิดตามน้ำหนักและปลายทางจริง แสดงยอดก่อนชำระเงิน ส่งฟรีเมื่อซื้อครบ <span data-assumed>฿3,000</span> ได้เลขพัสดุทันทีที่ร้านส่งของ</p>
      <h3>การรับประกัน</h3><p>ประกันศูนย์ไทย 1 ปี ลงทะเบียนรับประกันและแจ้งเคลมได้ที่หน้า <a class="link" href="warranty.html">ลงทะเบียน / แจ้งเคลม</a></p>
      <h3>การยกเลิก</h3><p>ยกเลิกเองได้จากบัญชีของคุณ ตราบใดที่ร้านยังไม่ส่งของ</p>
    </div></div>
  </section>

  <section class="sec" aria-labelledby="rel-title" style="padding-bottom:0"><div class="sec__head"><h2 id="rel-title">ซื้อคู่กันบ่อย</h2><a class="link" href="category.html">ดูทั้งหมด ${I('chev-r','ico-sm')}</a></div>
    <div class="grid g-5">${['ds','astro','ssd','dock','pulse'].map(card).join('')}</div></section>
  <section class="sec" aria-labelledby="pnews-title" style="padding-bottom:0"><div class="sec__head"><h2 id="pnews-title">ข่าวและรีวิวเกี่ยวกับ PS5</h2><a class="link" href="news.html">อ่านทั้งหมด ${I('chev-r','ico-sm')}</a></div>
    <div class="grid g-3">${[['m-dark','console','รีวิวสินค้า','PS5 Slim กับ Digital Edition ต่างกันตรงไหน เลือกแบบไหนดี (ตัวอย่าง)','8 ก.ย. 2569'],['m-ps','ssd','รีวิวสินค้า','วิธีติดตั้ง SSD เพิ่มใน PS5 ทีละขั้น (ตัวอย่าง)','1 ก.ย. 2569'],['m-ps','news','PlayStation','PlayStation ประกาศอัปเดตเฟิร์มแวร์ใหม่ (ตัวอย่าง)','21 ก.ย. 2569']].map(([m,a,tg,h,d])=>`<article class="ncard">${art(m,a)}<div class="ncard__body"><span class="tag tag-ps" style="align-self:flex-start">${tg}</span><h3><a href="news.html">${h}</a></h3><time>${d}</time></div></article>`).join('')}</div></section>
</div>
<div class="mobile-pay"><div><small>PS5 Slim · มีช่องใส่แผ่น</small><b class="num" data-price-m>฿17,990</b></div><a class="btn btn-buy" href="checkout.html">ซื้อเลย</a></div>`;
page('product.html','PlayStation 5 Slim 1TB — Tinzshop','PS5 Slim 1TB รุ่นมีช่องใส่แผ่นและ Digital Edition ประกันศูนย์ไทย ผ่อนผ่าน K-Payment ส่งด่วนภายในวัน','PlayStation 5',product,{bodyClass:'has-mobile-pay'});

/* ================= CART ================= */
const citem = (k, qty, opts) => { const p=P[k]; return `
<article class="citem" data-line data-unit="${p.p}">
  ${art(p.m,p.a)}
  <div>
    <h3><a href="product.html">${p.t}</a></h3>
    <p class="citem__var">${opts}</p>
    <div class="citem__meta"><span class="stock ${STOCK[p.s][0]}">${STOCK[p.s][1]}</span><span>${I('shield','ico-sm')}ประกันร้าน / ศูนย์</span></div>
    <div class="citem__ctrl">
      <div class="qty qty--sm" data-qty><button type="button" aria-label="ลดจำนวน">−</button><label class="vh" for="q-${k}">จำนวน ${p.t}</label><input id="q-${k}" inputmode="numeric" value="${qty}"><button type="button" aria-label="เพิ่มจำนวน">+</button></div>
      <button class="icon-btn" type="button" data-remove>${I('trash','ico-sm')}ลบ</button>
      <button class="icon-btn" type="button">${I('heart','ico-sm')}ย้ายไปที่ชอบ</button>
    </div>
  </div>
  <div class="citem__right"><span class="citem__unit num">${baht(p.p)} / ชิ้น</span><b class="price num" data-line-total>${baht(p.p*qty)}</b></div>
</article>`; };
const cart = `<div class="wrap">
  ${crumbs([null,'ตะกร้าสินค้า'])}
  <ol class="steps" aria-label="ขั้นตอนการสั่งซื้อ"><li class="now" aria-current="step"><span class="steps__n">1</span>ตะกร้าสินค้า</li><li><span class="steps__n">2</span>ที่อยู่และการชำระเงิน</li><li><span class="steps__n">3</span>ชำระเงิน</li></ol>
  <div class="layout2">
    <div>
      <section class="panel" aria-labelledby="cart-title">
        <h1 class="panel__title" id="cart-title">ตะกร้าสินค้า <span style="font:500 16px var(--f-body);color:var(--muted)" data-count-lbl>3 รายการ · 4 ชิ้น</span></h1>
        <div class="ship-goal" data-ship-goal>
          <p>${I('truck','ico-sm')} <b>ได้ส่งฟรีแล้ว</b> ยอดซื้อเกิน <span data-assumed>฿3,000</span> · ส่งด่วนภายในวันได้ถ้าที่อยู่อยู่ในกรุงเทพฯ และปริมณฑล</p>
        </div>
        ${citem('ps5',1,'รุ่น: มีช่องใส่แผ่น · สี: ขาว · รหัสรุ่น PS5-SLIM-1TB-DISC-WH')}
        ${citem('astro',2,'Standard Edition · โซน 3')}
        ${citem('ds',1,'สี: Midnight Black')}
        <div class="cfoot"><a class="link" href="category.html">${I('chev-l','ico-sm')}เลือกซื้อสินค้าต่อ</a><button class="icon-btn" type="button">ล้างตะกร้า</button></div>
      </section>
      <div class="note" style="margin-top:16px">${I('info')}<p>สินค้าที่ <b>สั่งจากตัวแทน</b> ร้านจะยืนยันว่ามีของก่อน แล้วจึงให้ชำระเงิน ส่วนสินค้า <b>พรีออเดอร์</b> เลือกจ่ายเต็มหรือมัดจำได้ในขั้นตอนถัดไป</p></div>
    </div>
    <aside class="summary" aria-labelledby="sum-title">
      <h2 id="sum-title">สรุปคำสั่งซื้อ</h2>
      <div class="srow"><span data-sub-lbl>ราคาสินค้า (4 ชิ้น)</span><b class="num" data-subtotal>฿23,460</b></div>
      <div class="srow"><span>ค่าจัดส่ง</span><b class="free">ฟรี</b></div>
      <div class="coupon"><label class="vh" for="coupon">โค้ดส่วนลด</label><input class="input" id="coupon" placeholder="โค้ดส่วนลด"><button class="btn btn-line" type="button">ใช้โค้ด</button></div>
      <div class="stotal"><span>ยอดรวม</span><b class="num" data-total>฿23,460</b></div>
      <p class="snote">ราคารวม VAT 7% แล้ว</p>
      <a class="btn btn-buy btn-block btn-lg" href="checkout.html">ดำเนินการสั่งซื้อ</a>
      <p class="sfine">ไม่ต้องสมัครสมาชิก · มีบัญชีแล้ว? <a href="login.html">เข้าสู่ระบบ</a></p>
      <div class="paylogos"><span>โอนผ่านธนาคาร</span><span>บัตรเครดิต</span><span>ผ่อนชำระ</span><span>PromptPay</span></div>
    </aside>
  </div>
  <section class="sec" aria-labelledby="add-title" style="padding-bottom:0"><div class="sec__head"><h2 id="add-title">ซื้อเพิ่มคู่กับ PS5</h2></div><div class="grid g-5">${['ssd','dock','gt7','pulse','edge'].map(card).join('')}</div></section>
</div>
<div class="mobile-pay"><div><small>ยอดรวม (ส่งฟรี)</small><b class="num" data-total-m>฿23,460</b></div><a class="btn btn-buy" href="checkout.html">สั่งซื้อ</a></div>`;
page('cart.html','ตะกร้าสินค้า — Tinzshop','ตะกร้าสินค้า Tinzshop','cart',cart,{bodyClass:'has-mobile-pay'});

/* ================= CHECKOUT ================= */
const coHeader = `<a class="skip" href="#main">ข้ามไปเนื้อหาหลัก</a>
<div class="mock">ตัวอย่างงานออกแบบ (Design mockup) — ราคา ยอดชำระ และข้อมูลลูกค้าเป็นข้อมูลสมมติ</div>
<header class="co-header"><div class="wrap"><a class="brand" href="index.html" aria-label="Tinzshop หน้าแรก"><span class="brand__mark" aria-hidden="true">T</span><span class="brand__word">Tinz<b>shop</b></span></a><span class="secure">${I('shield')}ชำระเงินปลอดภัย</span></div></header>`;
const field = (id,l,{type='text',ac='',ph='',hint='',full=false,im=''}={}) => `<div class="field"${full?' style="grid-column:1/-1"':''}><label for="${id}">${l}</label><input class="input" id="${id}" name="${id}" type="${type}"${ac?` autocomplete="${ac}"`:''}${ph?` placeholder="${ph}"`:''}${im?` inputmode="${im}"`:''} required>${hint?`<p class="hint">${hint}</p>`:''}<p class="err" hidden></p></div>`;
const choice = (name,id,ico,title,desc,aside='',checked=false) => `<label class="choice"><input type="radio" name="${name}" value="${id}"${checked?' checked':''}><span><b>${title}</b><span>${desc}</span></span>${aside?`<span class="aside">${aside}</span>`:ico?`<span class="choice__ico">${I(ico)}</span>`:''}</label>`;
const checkout = `<div class="wrap">
  <ol class="steps" aria-label="ขั้นตอนการสั่งซื้อ" style="margin-top:24px"><li class="done"><span class="steps__n">${I('check','ico-sm')}</span>ตะกร้าสินค้า</li><li class="now" aria-current="step"><span class="steps__n">2</span>ที่อยู่และการชำระเงิน</li><li><span class="steps__n">3</span>ชำระเงิน</li></ol>
  <form class="layout2" data-checkout novalidate>
    <div>
      <section class="panel" aria-labelledby="c1">
        <h1 class="panel__title" id="c1"><span class="panel__num">1</span>ข้อมูลติดต่อ</h1>
        <p class="note">${I('user')}<span>สั่งซื้อได้โดยไม่ต้องสมัครสมาชิก เราจะส่งเลขคำสั่งซื้อและสถานะไปที่อีเมลนี้ · มีบัญชีแล้ว? <a class="link" href="login.html">เข้าสู่ระบบ</a></span></p>
        <div class="fgrid">${field('email','อีเมล',{type:'email',ac:'email',ph:'name@example.com'})}${field('tel','เบอร์โทรศัพท์',{type:'tel',ac:'tel',im:'tel',hint:'ใช้ติดต่อเรื่องการจัดส่ง'})}</div>
        <label class="check" style="margin-top:8px"><input type="checkbox" name="account">สร้างบัญชีด้วยข้อมูลนี้ เพื่อดูประวัติการสั่งซื้อและดาวน์โหลดใบกำกับภาษีภายหลัง</label>
      </section>
      <section class="panel" aria-labelledby="c2">
        <h2 class="panel__title" id="c2"><span class="panel__num">2</span>ที่อยู่จัดส่ง</h2>
        <div class="fgrid">${field('fullname','ชื่อ-นามสกุลผู้รับ',{ac:'name',full:true})}${field('addr','บ้านเลขที่ ถนน ซอย',{ac:'address-line1',full:true})}${field('district','แขวง / ตำบล',{})}${field('amphoe','เขต / อำเภอ',{})}${field('province','จังหวัด',{ac:'address-level1'})}${field('zip','รหัสไปรษณีย์',{ac:'postal-code',im:'numeric'})}</div>
        <h3 style="font-size:17px;margin:22px 0 10px">วิธีจัดส่ง</h3>
        <div class="choices">
          ${choice('ship','std','', 'จัดส่งมาตรฐาน · 1–3 วันทำการ','ร้านแจ้งเลขพัสดุทางอีเมลทันทีที่ส่งของ ติดตามสถานะได้เอง','ฟรี',true)}
          ${choice('ship','same','', 'ส่งด่วนภายในวัน','เฉพาะกรุงเทพฯ และปริมณฑล สั่งก่อน 14:00 · ค่าส่งคำนวณจากระยะทาง','<span data-assumed>+฿150</span>')}
          ${choice('ship','pick','', 'รับเองที่หน้าร้าน','ซอยจินดาถวิล ถนนพระราม 4 เขตบางรัก · จันทร์–เสาร์ 10:00–18:00','ฟรี')}
        </div>
      </section>
      <section class="panel" aria-labelledby="c3">
        <h2 class="panel__title" id="c3"><span class="panel__num">3</span>ช่องทางชำระเงิน</h2>
        <div class="choices" data-pay>
          ${choice('pay','bank','bank','โอนผ่านธนาคาร · ไม่มีค่าธรรมเนียม','โอนแล้วอัปโหลดสลิป ร้านตรวจสอบและยืนยันในเวลาทำการ','',true)}
          ${choice('pay','card','card','บัตรเครดิต / เดบิต ผ่าน K-Payment','ตัดเงินทันที ระบบยืนยันการชำระเงินให้อัตโนมัติ · มีค่าธรรมเนียม')}
          ${choice('pay','inst','calendar','ผ่อนชำระบัตรเครดิต ผ่าน K-Payment','เลือกธนาคารและจำนวนงวดในหน้า K-Payment · มีค่าธรรมเนียม')}
          ${choice('pay','qr','qr','PromptPay QR ผ่าน K-Payment','สแกนจ่ายด้วยแอปธนาคาร ระบบยืนยันให้อัตโนมัติ')}
        </div>
        <div class="note" style="margin:14px 0 0" data-pay-note>${I('info')}<span>หลังกดยืนยัน คุณจะเห็นเลขบัญชีของร้านและปุ่มอัปโหลดสลิป เก็บลิงก์ไว้อัปโหลดภายหลังได้ใน <b>ติดตามคำสั่งซื้อ</b></span></div>
      </section>
      <section class="panel" aria-labelledby="c4">
        <h2 class="panel__title" id="c4"><span class="panel__num">4</span>ใบกำกับภาษี</h2>
        <p class="note">${I('receipt')}<span>ใบกำกับภาษีอย่างย่อออกให้อัตโนมัติทุกคำสั่งซื้อ ดาวน์โหลด PDF จากอีเมลยืนยันหรือประวัติการสั่งซื้อ</span></p>
        <label class="check"><input type="checkbox" data-toggle="#taxform">ต้องการใบกำกับภาษีเต็มรูป (ระบุชื่อและเลขผู้เสียภาษี)</label>
        <div class="toggle-sec" id="taxform" hidden style="margin-top:14px">
          <div class="seg" role="radiogroup" aria-label="ประเภทผู้เสียภาษี"><input type="radio" name="tp" id="tp1" checked><label for="tp1">บุคคลธรรมดา</label><input type="radio" name="tp" id="tp2"><label for="tp2">นิติบุคคล</label></div>
          <div class="fgrid"><div class="field"><label for="taxname">ชื่อ-นามสกุล / ชื่อบริษัท</label><input class="input" id="taxname"></div><div class="field"><label for="taxid">เลขประจำตัวผู้เสียภาษี 13 หลัก</label><input class="input" id="taxid" inputmode="numeric" maxlength="13"><p class="hint">บุคคลธรรมดาใช้เลขบัตรประชาชน</p></div></div>
          <label class="check"><input type="checkbox" checked>ใช้ที่อยู่เดียวกับที่อยู่จัดส่ง</label>
        </div>
      </section>
    </div>
    <aside class="summary" aria-labelledby="sum2">
      <h2 id="sum2">สรุปคำสั่งซื้อ</h2>
      <div class="sitems">${[['ps5','มีช่องใส่แผ่น · ขาว',1],['astro','Standard Edition',2],['ds','Midnight Black',1]].map(([k,v,q])=>`<div class="sitem"><div class="media ${P[k].m}"><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:.9"><use href="#i-a-${P[k].a}"/></svg><span class="sitem__q">${q}</span></div><div>${P[k].t}<small>${v}</small></div><b class="num">${baht(P[k].p*q)}</b></div>`).join('')}</div>
      <div class="srow"><span>ราคาสินค้า (4 ชิ้น)</span><b class="num">฿23,460</b></div>
      <div class="srow"><span>ค่าจัดส่ง · มาตรฐาน</span><b class="free" data-ship>ฟรี</b></div>
      <div class="srow"><span>ค่าธรรมเนียมชำระเงิน</span><b data-fee>ไม่มี</b></div>
      <div class="stotal"><span>ยอดชำระ</span><b class="num" data-grand>฿23,460</b></div>
      <p class="snote">ราคารวม VAT 7% แล้ว</p>
      <button class="btn btn-buy btn-block btn-lg" type="submit" data-submit>ยืนยันคำสั่งซื้อ</button>
      <p class="sfine">เมื่อกดยืนยัน ถือว่าคุณยอมรับ <a href="#">เงื่อนไขการใช้บริการ</a> และ <a href="#">นโยบายความเป็นส่วนตัว</a></p>
      <p class="sfine" style="margin-top:6px"><a href="cart.html">กลับไปแก้ไขตะกร้า</a></p>
    </aside>
  </form>
</div>
<div class="mobile-pay"><div><small>ยอดชำระ</small><b class="num">฿23,460</b></div><button class="btn btn-buy" type="button" data-submit-proxy>ยืนยันคำสั่งซื้อ</button></div>`;
page('checkout.html','ชำระเงิน — Tinzshop','ชำระเงิน Tinzshop','',checkout,{noHeader:true,customHeader:coHeader,bodyClass:'has-mobile-pay'});

/* ================= ACCOUNT ================= */
const status = (steps, at) => `<ol class="tl">${steps.map((s,i)=>`<li class="${i<at?'done':i===at?'now':''}"><span></span>${s}</li>`).join('')}</ol>`;
const account = `<div class="wrap">
  ${crumbs([null,'บัญชีของฉัน'])}
  <div class="lhead"><div><h1>สวัสดี คุณตัวอย่าง</h1><p>ติดตามคำสั่งซื้อ พรีออเดอร์ และเอกสารของคุณได้ที่นี่</p></div><a class="btn btn-line" href="warranty.html">${I('wrench','ico-sm')}แจ้งเคลมสินค้า</a></div>
  <div class="acc">
    <nav class="acc__nav panel" aria-label="เมนูบัญชี">
      <a href="#" aria-current="page">${I('package','ico-sm')}คำสั่งซื้อ</a><a href="#pre">${I('calendar','ico-sm')}พรีออเดอร์</a><a href="#wish">${I('heart','ico-sm')}รายการที่ชอบ</a><a href="#">${I('pin','ico-sm')}ที่อยู่</a><a href="#">${I('mail','ico-sm')}การแจ้งเตือนอีเมล</a><a href="#">${I('shield','ico-sm')}ข้อมูลส่วนตัว (PDPA)</a>
    </nav>
    <div>
      <div class="kpis"><div class="panel"><small>รอชำระ / รอตรวจสลิป</small><b class="stat">1</b></div><div class="panel"><small>กำลังจัดส่ง</small><b class="stat">1</b></div><div class="panel"><small>พรีออเดอร์ที่รอ</small><b class="stat">1</b></div></div>
      <section class="panel order" aria-labelledby="o1">
        <div class="order__head"><div><h2 id="o1">คำสั่งซื้อ #TZ-2569-10482</h2><p>สั่งเมื่อ 10 พ.ย. 2569 · 3 รายการ · <b class="num">฿23,460</b></p></div><span class="tag tag-ps">${I('truck','ico-sm')}กำลังจัดส่ง</span></div>
        ${status(['รับคำสั่งซื้อ','ชำระเงินแล้ว','แพ็กสินค้า','ส่งแล้ว','ได้รับสินค้า'],3)}
        <div class="order__foot"><p>Flash Express · เลขพัสดุ <b class="num">TH0000000000X</b> (ตัวอย่าง)</p><div class="order__act"><a class="btn btn-dark" href="track.html">${I('truck','ico-sm')}ติดตามพัสดุ</a><a class="btn btn-line" href="#">${I('download','ico-sm')}ใบกำกับภาษี PDF</a></div></div>
      </section>
      <section class="panel order" aria-labelledby="o2">
        <div class="order__head"><div><h2 id="o2">คำสั่งซื้อ #TZ-2569-10511</h2><p>สั่งเมื่อ 12 พ.ย. 2569 · 1 รายการ · <b class="num">฿2,790</b> · โอนผ่านธนาคาร</p></div><span class="tag" style="background:var(--warn-soft);color:var(--warn)">${I('clock','ico-sm')}รอชำระเงิน</span></div>
        ${status(['รับคำสั่งซื้อ','ชำระเงินแล้ว','แพ็กสินค้า','ส่งแล้ว','ได้รับสินค้า'],1)}
        <div class="order__foot"><p>โอนแล้ว อัปโหลดสลิปเพื่อให้ร้านตรวจสอบ</p><div class="order__act"><label class="btn btn-buy" style="cursor:pointer">${I('upload','ico-sm')}อัปโหลดสลิป<input type="file" accept="image/*" class="vh"></label><button class="btn btn-line" type="button">ยกเลิกคำสั่งซื้อ</button></div></div>
      </section>
      <section class="panel order" id="pre" aria-labelledby="o3">
        <div class="order__head"><div><h2 id="o3">พรีออเดอร์ · จอย DualSense Limited Edition</h2><p>วางจำหน่าย 27 พ.ย. 2569 · มัดจำแล้ว <b class="num">฿500</b> · คงเหลือ <b class="num">฿2,090</b></p></div>${TAG.pre}</div>
        ${status(['วางมัดจำ','รอวันวางจำหน่าย','ชำระส่วนที่เหลือ','ส่งแล้ว'],1)}
        <div class="order__foot"><p>เราจะแจ้งทางอีเมลให้ชำระส่วนที่เหลือก่อนวันส่งของ</p><div class="order__act"><button class="btn btn-line" type="button">ยกเลิกการจอง</button></div></div>
      </section>
      <section id="wish" class="sec--tight" aria-labelledby="w-title"><div class="sec__head"><h2 id="w-title" style="font-size:22px">รายการที่ชอบ</h2></div><div class="grid g-4">${['edge','ssd','pro2','kb'].map(card).join('')}</div></section>
    </div>
  </div>
</div>`;
page('account.html','บัญชีของฉัน — Tinzshop','บัญชีของฉัน ประวัติการสั่งซื้อ และพรีออเดอร์','',account,{user:true});

/* ================= TRACK ================= */
const track = `<div class="wrap narrow">
  ${crumbs([null,'ติดตามพัสดุ'])}
  <div class="lhead"><div><h1>ติดตามคำสั่งซื้อและพัสดุ</h1><p>ไม่ต้องเข้าสู่ระบบ ใช้เลขคำสั่งซื้อกับอีเมลหรือเบอร์โทรที่ใช้ตอนสั่ง</p></div></div>
  <form class="panel" data-track novalidate>
    <div class="fgrid">${field('order','เลขคำสั่งซื้อ',{ph:'TZ-2569-xxxxx',hint:'อยู่ในอีเมลยืนยันคำสั่งซื้อ'})}${field('contact','อีเมล หรือ เบอร์โทรศัพท์',{ac:'email'})}</div>
    <button class="btn btn-dark btn-lg" type="submit" style="margin-top:16px">${I('search','ico-sm')}ตรวจสอบสถานะ</button>
  </form>
  <section class="panel order" aria-labelledby="tr" data-track-result hidden style="margin-top:16px">
    <div class="order__head"><div><h2 id="tr">คำสั่งซื้อ #TZ-2569-10482</h2><p>Flash Express · เลขพัสดุ <b class="num">TH0000000000X</b> (ตัวอย่าง)</p></div><span class="tag tag-ps">กำลังจัดส่ง</span></div>
    ${status(['รับคำสั่งซื้อ','ชำระเงินแล้ว','แพ็กสินค้า','ส่งแล้ว','ได้รับสินค้า'],3)}
    <ul class="events">${[['11 พ.ย. 09:12','พัสดุออกจากศูนย์คัดแยก กำลังนำส่ง'],['10 พ.ย. 17:40','ร้านส่งพัสดุให้ Flash Express แล้ว'],['10 พ.ย. 13:05','ยืนยันการชำระเงินแล้ว'],['10 พ.ย. 12:58','รับคำสั่งซื้อแล้ว']].map(([t,e])=>`<li><time>${t}</time><span>${e}</span></li>`).join('')}</ul>
    <div class="order__foot"><p>ปัญหาเรื่องพัสดุ? ทักร้านทาง LINE @tinzshop</p><a class="btn btn-line" href="#">${I('download','ico-sm')}ใบกำกับภาษี PDF</a></div>
  </section>
</div>`;
page('track.html','ติดตามพัสดุ — Tinzshop','ติดตามสถานะคำสั่งซื้อและพัสดุ Tinzshop ด้วยเลขคำสั่งซื้อ','',track);

/* ================= WARRANTY ================= */
const warranty = `<div class="wrap narrow">
  ${crumbs([null,'ลงทะเบียน / แจ้งเคลม'])}
  <div class="lhead"><div><h1>ลงทะเบียนรับประกันและแจ้งเคลม</h1><p>กรอกครั้งเดียว ร้านตอบกลับทางอีเมลและ LINE ภายในวันทำการถัดไป</p></div></div>
  <form class="panel" data-warranty novalidate>
    <div class="seg" role="radiogroup" aria-label="ประเภทคำขอ"><input type="radio" name="wt" id="wt1" checked><label for="wt1">ลงทะเบียนรับประกัน</label><input type="radio" name="wt" id="wt2"><label for="wt2">แจ้งเคลม / ซ่อม</label></div>
    <div class="fgrid">
      ${field('worder','เลขคำสั่งซื้อ',{ph:'TZ-2569-xxxxx'})}
      ${field('wserial','Serial Number ของสินค้า',{hint:'ดูได้ที่สติกเกอร์ใต้เครื่องหรือบนกล่อง'})}
      ${field('wname','ชื่อ-นามสกุล',{ac:'name'})}
      ${field('wtel','เบอร์โทรศัพท์',{type:'tel',ac:'tel',im:'tel'})}
      <div class="field" style="grid-column:1/-1"><label for="wissue">อาการที่พบ (สำหรับแจ้งเคลม)</label><textarea class="input" id="wissue" rows="4" style="padding:12px 14px;min-height:120px"></textarea></div>
      <div class="field" style="grid-column:1/-1"><label for="wfile">แนบรูปหรือวิดีโออาการ</label><input class="input" id="wfile" type="file" accept="image/*,video/*" multiple style="padding:10px"></div>
    </div>
    <button class="btn btn-buy btn-lg" type="submit" style="margin-top:18px">ส่งคำขอ</button>
    <p class="note" data-w-ok hidden style="margin-top:14px">${I('check')}<span>ส่งคำขอแล้ว เลขอ้างอิงจะส่งไปที่อีเมลของคุณ</span></p>
  </form>
</div>`;
page('warranty.html','ลงทะเบียนรับประกัน / แจ้งเคลม — Tinzshop','ลงทะเบียนรับประกันและแจ้งเคลมสินค้า Tinzshop ผ่านเว็บไซต์','',warranty);

/* ================= NEWS ================= */
const news = `<div class="wrap">
  ${crumbs([null,'ข่าวเกม & รีวิว'])}
  <div class="lhead"><div><h1>ข่าวเกม & รีวิว</h1><p>ข่าวเกมใหม่ รีวิวสินค้าจากพนักงาน และประกาศจากร้าน</p></div>
    <div class="chips" role="group" aria-label="หมวดข่าว"><button class="chip" type="button" aria-pressed="true">ทั้งหมด</button><button class="chip" type="button" aria-pressed="false">ประชาสัมพันธ์</button><button class="chip" type="button" aria-pressed="false">รีวิวสินค้า</button><button class="chip" type="button" aria-pressed="false">Nintendo</button><button class="chip" type="button" aria-pressed="false">PlayStation</button></div></div>
  <section class="nfeat" aria-label="ข่าวเด่น">
    <article class="nbig">${art('m-dark','news')}<span class="tag tag-ps" style="align-self:flex-start">PlayStation</span><h2><a href="#">สรุปเกมใหม่ที่ประกาศในงานเดือนนี้ พร้อมวันวางจำหน่าย (ตัวอย่างหัวข้อข่าว)</a></h2><p>รวมทุกเกมที่ประกาศ และเกมที่เปิดให้พรีออเดอร์แล้วที่ร้าน (ข้อความตัวอย่าง)</p><time>โดยทีม Tinzshop · 22 ก.ย. 2569</time></article>
    <div class="nside">
      <article class="nbig" style="background:#A6001E">${art('m-ns','handheld')}<span class="tag tag-ns" style="align-self:flex-start">รีวิวสินค้า</span><h2><a href="#">รีวิว Switch 2 หลังใช้งาน 3 เดือน (ตัวอย่าง)</a></h2><time>19 ก.ย. 2569</time></article>
      <article class="nbig" style="background:var(--navy-2)">${art('m-dark','box')}<span class="tag tag-ot" style="align-self:flex-start">ประชาสัมพันธ์</span><h2><a href="#">เปิดรับพรีออเดอร์เกมใหม่ประจำเดือนพฤศจิกายน</a></h2><time>15 ก.ย. 2569</time></article>
    </div>
  </section>
  <div class="nlayout sec" style="padding-top:28px">
    <section aria-labelledby="latest"><div class="sec__head"><h2 id="latest">ข่าวล่าสุด</h2></div>
      <div class="grid g-3" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[['m-ps','news','PlayStation','tag-ps','PlayStation ประกาศอัปเดตเฟิร์มแวร์ใหม่ (ตัวอย่าง)','สรุปฟีเจอร์ใหม่และสิ่งที่เปลี่ยนไปหลังอัปเดต','21 ก.ย. 2569'],['m-ns','disc','Nintendo','tag-ns','รายชื่อเกม Switch 2 ที่จะวางจำหน่ายไตรมาสนี้ (ตัวอย่าง)','เช็กวันวางจำหน่ายและเกมที่เปิดให้จองแล้ว','20 ก.ย. 2569'],['m-ot','store','ประชาสัมพันธ์','tag-ot','วันหยุดร้านและรอบจัดส่งช่วงเทศกาล (ตัวอย่าง)','แจ้งวันหยุดหน้าร้านและรอบจัดส่งสินค้า','18 ก.ย. 2569'],['m-it','key','รีวิวสินค้า','tag-it','เลือกคีย์บอร์ด Mechanical ตัวแรก ดูอะไรบ้าง (ตัวอย่าง)','สวิตช์ ขนาด และการเชื่อมต่อ อธิบายแบบเข้าใจง่าย','16 ก.ย. 2569']].map(([m,a,tg,tc,h,p,d])=>`<article class="ncard">${a==='store'?`<div class="media ${m}"><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:.9"><use href="#i-store"/></svg></div>`:art(m,a)}<div class="ncard__body"><span class="tag ${tc}" style="align-self:flex-start">${tg}</span><h3><a href="#">${h}</a></h3><p>${p} (ข้อความตัวอย่าง)</p><time>${d}</time></div></article>`).join('')}</div>
      <nav class="pager" aria-label="เลขหน้า"><a href="#" aria-label="หน้าก่อนหน้า">${I('chev-l','ico-sm')}</a><span aria-current="page">1</span><a href="#">2</a><a href="#">3</a><span class="gap" aria-hidden="true">…</span><a href="#">12</a><a href="#" aria-label="หน้าถัดไป">${I('chev-r','ico-sm')}</a></nav>
    </section>
    <aside class="side" aria-label="แถบข้าง">
      <section class="panel"><h2>อ่านมากที่สุด</h2><ol class="rank"><li><a href="#">สรุปเกมใหม่ที่ประกาศในงานเดือนนี้ (ตัวอย่าง)</a></li><li><a href="#">เปิดรับพรีออเดอร์เกมใหม่ประจำเดือนพฤศจิกายน</a></li><li><a href="#">รีวิว Switch 2 หลังใช้งาน 3 เดือน (ตัวอย่าง)</a></li><li><a href="#">PS5 Slim กับ Digital Edition เลือกแบบไหนดี (ตัวอย่าง)</a></li></ol></section>
      <section class="panel" style="background:var(--navy);color:var(--on-navy);border:0"><h2 style="color:#fff">พรีออเดอร์เปิดจองแล้ว</h2><p style="color:var(--on-navy-2);margin-bottom:14px">จำนวนจำกัด วางมัดจำก่อนได้</p><a class="btn btn-buy btn-block" href="category.html#pre">ดูสินค้าพรีออเดอร์</a></section>
    </aside>
  </div>
</div>`;
page('news.html','ข่าวเกม & รีวิว — Tinzshop','ข่าวเกม PlayStation และ Nintendo รีวิวสินค้า และประกาศจากร้าน Tinzshop','ข่าวเกม & รีวิว',news);


/* ================= LOGIN + REGISTER ================= */
const perks = (title) => `<aside class="auth__perks" aria-labelledby="perks-t">
  <p class="eyebrow" style="color:#A9B4C8">สมาชิก Tinzshop</p>
  <h2 id="perks-t">${title}</h2>
  <ul>
    <li>${I('package')}<span><b>ติดตามคำสั่งซื้อในที่เดียว</b>สถานะการชำระเงิน เลขพัสดุ และประวัติการสั่งซื้อทั้งหมด</span></li>
    <li>${I('receipt')}<span><b>ดาวน์โหลดใบกำกับภาษี</b>ไฟล์ PDF ของทุกคำสั่งซื้อ เก็บย้อนหลังได้</span></li>
    <li>${I('calendar')}<span><b>ดูพรีออเดอร์และยอดคงเหลือ</b>แจ้งเตือนก่อนวันวางจำหน่ายและวันชำระส่วนที่เหลือ</span></li>
    <li>${I('heart')}<span><b>บันทึกสินค้าที่ชอบ</b>กลับมาดูราคาและสต๊อกได้ทุกเมื่อ</span></li>
    <li>${I('wrench')}<span><b>แจ้งเคลมเร็วขึ้น</b>เลือกสินค้าจากประวัติการสั่งซื้อ ไม่ต้องกรอกเลขคำสั่งซื้อเอง</span></li>
  </ul>
  <p class="auth__guest">${I('cart','ico-sm')}ยังไม่อยากสมัคร? <a href="cart.html">สั่งซื้อแบบไม่เป็นสมาชิกได้</a></p>
</aside>`;
const pw = (id,l,ac,hint='') => `<div class="field"><label for="${id}">${l}</label><div class="pw"><input class="input" id="${id}" name="${id}" type="password" autocomplete="${ac}" required${id==='rpass'?' minlength="8"':''}><button type="button" class="pw__btn" data-pw="${id}" aria-label="แสดงรหัสผ่าน" aria-pressed="false">แสดง</button></div>${hint}<p class="err" hidden></p></div>`;
const login = `<div class="wrap">
  ${crumbs([null,'เข้าสู่ระบบ'])}
  <div class="auth">
    <section class="auth__card" aria-labelledby="lg-t">
      <h1 id="lg-t">เข้าสู่ระบบ</h1>
      <p class="auth__sub">ยังไม่มีบัญชี? <a class="link" href="register.html">สมัครสมาชิก</a></p>
      <div class="seg seg--full" role="radiogroup" aria-label="วิธีเข้าสู่ระบบ">
        <input type="radio" name="lm" id="lm1" value="pw" checked data-show="#m-pw"><label for="lm1">${I('mail','ico-sm')}อีเมลและรหัสผ่าน</label>
        <input type="radio" name="lm" id="lm2" value="otp" data-show="#m-otp"><label for="lm2">${I('phone','ico-sm')}รหัส OTP ทางมือถือ</label>
      </div>
      <form id="m-pw" class="auth__form" data-auth="login" novalidate>
        ${field('lemail','อีเมล',{type:'email',ac:'email',ph:'name@example.com'})}
        ${pw('lpass','รหัสผ่าน','current-password')}
        <div class="auth__row"><label class="check"><input type="checkbox" checked>จดจำการเข้าสู่ระบบในเครื่องนี้</label><a class="link" href="#">ลืมรหัสผ่าน?</a></div>
        <button class="btn btn-dark btn-block btn-lg" type="submit">เข้าสู่ระบบ</button>
      </form>
      <form id="m-otp" class="auth__form" data-auth="otp" novalidate hidden>
        <div class="field"><label for="ltel">เบอร์โทรศัพท์มือถือ</label><div class="otp-row"><input class="input" id="ltel" type="tel" autocomplete="tel" inputmode="tel" placeholder="0XX-XXX-XXXX" required><button class="btn btn-line" type="button" data-send-otp>ขอรหัส OTP</button></div><p class="hint" data-otp-hint>เราจะส่งรหัส 6 หลักทาง SMS</p><p class="err" hidden></p></div>
        <div class="field"><label for="lotp">รหัส OTP 6 หลัก</label><input class="input otp" id="lotp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required><p class="err" hidden></p></div>
        <button class="btn btn-dark btn-block btn-lg" type="submit">ยืนยันและเข้าสู่ระบบ</button>
      </form>
      <p class="note auth__ok" data-auth-ok hidden>${I('check')}<span>เข้าสู่ระบบสำเร็จ กำลังพาไปที่ <a class="link" href="account.html">บัญชีของฉัน</a></span></p>
      <div class="auth__or"><span>หรือ</span></div>
      <a class="btn btn-line btn-block" href="track.html">${I('truck','ico-sm')}ติดตามคำสั่งซื้อโดยไม่ต้องเข้าสู่ระบบ</a>
    </section>
    ${perks('เข้าสู่ระบบเพื่อดูคำสั่งซื้อ พรีออเดอร์ และใบกำกับภาษีของคุณ')}
  </div>
</div>`;
page('login.html','เข้าสู่ระบบ — Tinzshop','เข้าสู่ระบบบัญชี Tinzshop ด้วยอีเมลหรือรหัส OTP ทางมือถือ','',login);

const register = `<div class="wrap">
  ${crumbs([null,'สมัครสมาชิก'])}
  <div class="auth">
    <section class="auth__card" aria-labelledby="rg-t">
      <h1 id="rg-t">สมัครสมาชิก</h1>
      <p class="auth__sub">มีบัญชีอยู่แล้ว? <a class="link" href="login.html">เข้าสู่ระบบ</a></p>
      <form class="auth__form" data-auth="register" novalidate>
        <div class="fgrid">${field('rfirst','ชื่อ',{ac:'given-name'})}${field('rlast','นามสกุล',{ac:'family-name'})}</div>
        ${field('remail','อีเมล',{type:'email',ac:'email',ph:'name@example.com',hint:'ใช้รับอีเมลยืนยันคำสั่งซื้อและใบกำกับภาษี'})}
        ${field('rtel','เบอร์โทรศัพท์มือถือ',{type:'tel',ac:'tel',im:'tel',ph:'0XX-XXX-XXXX',hint:'ใช้เข้าสู่ระบบด้วย OTP และติดต่อเรื่องการจัดส่ง'})}
        ${pw('rpass','ตั้งรหัสผ่าน','new-password','<div class="meter" aria-hidden="true"><i data-meter></i></div><p class="hint" data-meter-lbl>อย่างน้อย 8 ตัวอักษร มีตัวเลขอย่างน้อย 1 ตัว</p>')}
        ${pw('rpass2','ยืนยันรหัสผ่าน','new-password')}
        <fieldset class="consent">
          <legend>ความยินยอมและการแจ้งเตือน</legend>
          <label class="check check--top"><input type="checkbox" name="pdpa" required data-consent><span>ฉันยอมรับ <a class="link" href="#">เงื่อนไขการใช้บริการ</a> และ <a class="link" href="#">นโยบายความเป็นส่วนตัว</a> ของ Tinzshop ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) <b style="color:var(--sale)">*</b></span></label>
          <p class="err" data-consent-err hidden>กรุณายอมรับเงื่อนไขก่อนสมัครสมาชิก</p>
          <label class="check check--top"><input type="checkbox" checked><span>ส่งอีเมลแจ้งสถานะคำสั่งซื้อ (รับคำสั่งซื้อ ชำระเงิน จัดส่ง ยกเลิก คืนเงิน) <small>ปิดได้ภายหลังในบัญชีของคุณ</small></span></label>
          <label class="check check--top"><input type="checkbox"><span>รับข่าวพรีออเดอร์ เกมใหม่ และโปรโมชั่นทางอีเมล <small>ไม่บังคับ</small></span></label>
        </fieldset>
        <button class="btn btn-buy btn-block btn-lg" type="submit">สมัครสมาชิก</button>
        <p class="sfine">ขอดู แก้ไข หรือลบข้อมูลส่วนตัวของคุณได้ทุกเมื่อในหน้า <b>ข้อมูลส่วนตัว (PDPA)</b></p>
      </form>
      <p class="note auth__ok" data-auth-ok hidden>${I('check')}<span>สมัครสมาชิกสำเร็จ เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว · <a class="link" href="account.html">ไปที่บัญชีของฉัน</a></span></p>
    </section>
    ${perks('สมัครครั้งเดียว ติดตามทุกคำสั่งซื้อได้เอง')}
  </div>
</div>`;
page('register.html','สมัครสมาชิก — Tinzshop','สมัครสมาชิก Tinzshop เพื่อติดตามคำสั่งซื้อ ดาวน์โหลดใบกำกับภาษี และดูพรีออเดอร์','',register);

console.log('built');
