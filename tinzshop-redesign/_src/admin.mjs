// Builds the Tinzshop back-office pages into site/admin/.  node admin.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { SYM } from './icons.mjs';
const OUT = new URL('../admin/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(SYM).map(([k,v])=>`<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
const I = (n, c='') => `<svg class="ico ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const art = (cls, a) => `<div class="media ${cls}"><svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:1"><use href="#i-a-${a}"/></svg></div>`;
const baht = n => '฿' + n.toLocaleString('en-US');

const head = (title) => `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Tinzshop หลังร้าน</title>
<meta name="description" content="ระบบหลังร้าน Tinzshop สำหรับพนักงาน">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0C1524">
<link rel="preload" href="../assets/fonts/anuphan-thai-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/ibm-plex-sans-thai-thai-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/admin.css">
</head>`;

const NAV = [
  ['ภาพรวม', [['index.html','grid','แดชบอร์ด'],['#orders','receipt','คำสั่งซื้อ',{n:7}],['#slips','bank','ตรวจสลิป',{n:3}]]],
  ['ร้านค้า', [['products.html','package','สินค้าและสต๊อก'],['#import','sheet','นำเข้า / ส่งออก Excel'],['#shopee','shop','เชื่อม Shopee']]],
  ['เนื้อหา', [['posts.html','a-news','ข่าวและบทความ',{n:2,mute:true}],['#pages','receipt','หน้าเนื้อหาร้าน']]],
  ['ระบบ', [['users.html','users','ผู้ใช้และสิทธิ์'],['#audit','history','ประวัติการแก้ไข'],['#settings','gear','ตั้งค่าร้าน']]],
];
const shell = (cur, body, {me=['คต','คุณตัวอย่าง','Admin สูงสุด']}={}) => `<body class="adm">
${sprite()}
<a class="skip" href="#main">ข้ามไปเนื้อหาหลัก</a>
<div class="mock">ตัวอย่างงานออกแบบระบบหลังร้าน (Design mockup) — ชื่อ ยอดขาย และข้อมูลทั้งหมดเป็นข้อมูลสมมติ</div>
<div class="shell">
  <nav class="side-nav" id="sidenav" aria-label="เมนูหลังร้าน">
    <a class="brand" href="index.html" aria-label="Tinzshop หลังร้าน"><span class="brand__mark" aria-hidden="true">T</span><span><span class="brand__word">Tinz<b>shop</b></span><span class="side-nav__tag">หลังร้าน</span></span></a>
    ${NAV.map(([g,items])=>`<div class="nav-group"><p>${g}</p>${items.map(([h,ic,l,o={}])=>`<a class="nav-item" href="${h}"${cur===h?' aria-current="page"':''} title="${l}">${I(ic)}<span>${l}</span>${o.n?`<b class="count${o.mute?' mute':''}">${o.n}</b>`:''}</a>`).join('')}</div>`).join('')}
    <div class="side-nav__foot">
      <a class="nav-item" href="../index.html" title="ดูหน้าร้าน">${I('ext')}<span>ดูหน้าร้าน</span></a>
      <div class="me"><span class="av" aria-hidden="true">${me[0]}</span><div><b>${me[1]}</b><small>${me[2]}</small></div></div>
      <a class="nav-item" href="login.html" title="ออกจากระบบ">${I('logout')}<span>ออกจากระบบ</span></a>
    </div>
  </nav>
  <div>
    <header class="topnav">
      <button class="menu-btn" type="button" aria-controls="sidenav" aria-expanded="false" aria-label="เปิดเมนู">${I('menu')}</button>
      <form class="search" role="search" onsubmit="return false">${I('search')}<label class="vh" for="gq">ค้นหาในหลังร้าน</label><input id="gq" type="search" placeholder="ค้นหาคำสั่งซื้อ สินค้า SKU หรือลูกค้า"></form>
      <div class="topnav__right">
        <div class="lang" role="group" aria-label="ภาษาของหลังร้าน"><button type="button" aria-pressed="true">TH</button><button type="button" aria-pressed="false">EN</button></div>
        <button class="icon-b" type="button" aria-label="การแจ้งเตือน 3 รายการใหม่">${I('bell')}<span class="dot-n"></span></button>
        <a class="icon-b" href="../index.html" aria-label="ดูหน้าร้าน">${I('ext')}</a>
      </div>
    </header>
    <main class="content" id="main">${body}</main>
  </div>
</div>
<div class="scrim" data-scrim></div>
<div class="toast" role="status" aria-live="polite" data-toast>${I('check')}<span data-toast-msg></span></div>
<script src="../js/admin.js" defer></script>`;
const page = (file, title, cur, body, opts={}) => writeFileSync(new URL(file, OUT), `${head(title)}\n${shell(cur, body, opts)}${opts.extra||''}\n</body></html>`);

/* ============== USERS ============== */
const USERS = [
  {id:1,name:'คุณตัวอย่าง เจ้าของร้าน',email:'owner@tinzshop.example',phone:'08X-XXX-XX01',role:'top',status:'active',last:'วันนี้ 21:40',created:'2 ม.ค. 2569'},
  {id:2,name:'พนักงาน ก. (ตัวอย่าง)',email:'staff.a@tinzshop.example',phone:'08X-XXX-XX02',role:'admin',status:'active',last:'วันนี้ 18:05',created:'5 ม.ค. 2569'},
  {id:3,name:'พนักงาน ข. (ตัวอย่าง)',email:'sales.b@tinzshop.example',phone:'08X-XXX-XX03',role:'sales',status:'active',last:'วันนี้ 17:32',created:'12 ก.พ. 2569'},
  {id:4,name:'พนักงาน ค. (ตัวอย่าง)',email:'sales.c@tinzshop.example',phone:'08X-XXX-XX04',role:'sales',status:'active',last:'เมื่อวาน 19:10',created:'1 มี.ค. 2569'},
  {id:5,name:'นักเขียน ง. (ตัวอย่าง)',email:'writer.d@tinzshop.example',phone:'08X-XXX-XX05',role:'blog',status:'active',last:'วันนี้ 20:14',created:'3 เม.ย. 2569'},
  {id:6,name:'นักเขียน จ. (ตัวอย่าง)',email:'writer.e@tinzshop.example',phone:'08X-XXX-XX06',role:'blog',status:'suspended',last:'12 ต.ค. 2569',created:'9 พ.ค. 2569'},
  {id:7,name:'พนักงาน ฉ. (ตัวอย่าง)',email:'staff.f@tinzshop.example',phone:'08X-XXX-XX07',role:'sales',status:'invited',last:'—',created:'13 พ.ย. 2569'},
];
const CUSTS = Array.from({length:23},(_,i)=>{const n=['สมชาย','วรรณา','ธนพล','กมลชนก','ภูมิ','ณัฐริกา','อนุชา','ปวีณา','กิตติ','ศิริพร','ธีรเดช','มณีรัตน์'][i%12];return {id:100+i,name:`${n} ตัวอย่าง`,email:`customer${String(i+1).padStart(2,'0')}@mail.example`,phone:`08X-XXX-X${String(10+i).slice(-2)}`,role:'cust',status:i===4?'suspended':'active',last:['วันนี้ 20:58','วันนี้ 13:20','เมื่อวาน','3 วันก่อน','2 สัปดาห์ก่อน'][i%5],created:`${(i%27)+1} ${['ส.ค.','ก.ย.','ต.ค.','พ.ย.'][i%4]} 2569`,orders:(i*7)%13+1,spend:[23460,2290,16900,4780,59890,1590,18990,3480,7490,2390][i%10]*((i%3)+1)}});
const PERMS = [
  ['ภาพรวม',[['ดูแดชบอร์ดและยอดขาย','ยอดขายรายวัน สัปดาห์ เดือน',[0,1,1,1]]]],
  ['ร้านค้า',[['จัดการสินค้า ราคา และสต๊อก','เพิ่ม แก้ไข ลบสินค้าและรุ่นย่อย',[0,1,1,1]],['นำเข้า / ส่งออก Excel','รวมถึงโหมดทดลองนำเข้า',[0,1,1,1]],['เชื่อมสต๊อก Shopee','จับคู่สินค้ากับ Shopee',[0,1,1,1]],['คำสั่งซื้อและสถานะจัดส่ง','เปลี่ยนสถานะ พิมพ์ใบปะหน้า',[0,1,1,1]],['ตรวจสลิปและคืนเงิน','ยืนยันการชำระเงิน คืนเงินบางส่วน',[0,1,1,1]],['ส่งออกยอดขายให้ฝ่ายบัญชี','ไฟล์รายเดือนและราย SKU',[0,1,1,1]]]],
  ['เนื้อหา',[['เขียนและแก้ไขข่าวของตัวเอง','บันทึกร่าง ส่งตรวจ',[1,0,1,1]],['เผยแพร่และแก้ข่าวของทุกคน','รวมถึงตั้งเวลาเผยแพร่',[1,0,1,1]],['แก้ไขหน้าเนื้อหาร้าน','เกี่ยวกับเรา นโยบาย FAQ',[0,0,1,1]]]],
  ['ระบบ',[['ดูข้อมูลลูกค้า','ตามสิทธิ์ PDPA',[0,1,1,1]],['ดูประวัติการแก้ไข (Audit log)','ใครแก้อะไร เมื่อไหร่',[0,1,1,1]],['เพิ่ม / ลบพนักงาน','และกำหนดตำแหน่ง',[0,0,0,1]],['ตั้งค่าระบบและสิทธิ์','ช่องทางชำระเงิน ค่าส่ง',[0,0,0,1]]]],
];
const users = `
<div class="ph-head"><div><h1>ผู้ใช้และสิทธิ์</h1><p>พนักงานทุกตำแหน่งต้องยืนยันตัวตน 2 ขั้นด้วยรหัส OTP ทางอีเมล</p></div>
  <div class="ph-actions"><button class="btn btn-line" type="button" data-export-users>${I('download','ico-sm')}ส่งออกรายชื่อ</button><button class="btn btn-dark" type="button" data-new-user>${I('plus','ico-sm')}เพิ่มผู้ใช้</button></div></div>
<div class="ptabs" role="tablist" aria-label="ประเภทผู้ใช้">
  <button role="tab" aria-selected="true" data-utab="staff">${I('users','ico-sm')}พนักงาน <span class="n" data-n="staff">${USERS.length}</span></button>
  <button role="tab" aria-selected="false" data-utab="cust">${I('user','ico-sm')}ลูกค้า <span class="n" data-n="cust">${CUSTS.length}</span></button>
  <button role="tab" aria-selected="false" data-utab="perm">${I('lock','ico-sm')}ตำแหน่งและสิทธิ์</button>
</div>
<section data-upanel="list">
  <div class="fbar">
    <div class="search">${I('search')}<label class="vh" for="uq">ค้นหาผู้ใช้</label><input id="uq" type="search" placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร" data-uq></div>
    <label class="vh" for="urole">ตำแหน่ง</label><select class="select" id="urole" data-urole><option value="">ทุกตำแหน่ง</option><option value="top">Admin สูงสุด</option><option value="admin">Admin</option><option value="sales">Sale-manager</option><option value="blog">Blogger</option></select>
    <label class="vh" for="ustatus">สถานะ</label><select class="select" id="ustatus" data-ustatus><option value="">ทุกสถานะ</option><option value="active">ใช้งานอยู่</option><option value="invited">รอยืนยันอีเมล</option><option value="suspended">ระงับการใช้งาน</option></select>
    <p class="fbar__right" data-ucount></p>
  </div>
  <div class="bulk" data-ubulk><b data-ubulk-n>เลือก 0 คน</b>
    <label class="vh" for="bulkrole">เปลี่ยนตำแหน่ง</label><select class="select" id="bulkrole" data-bulk-role><option value="">เปลี่ยนตำแหน่ง…</option><option value="admin">Admin</option><option value="sales">Sale-manager</option><option value="blog">Blogger</option></select>
    <button class="btn btn-line btn-sm" type="button" data-bulk-suspend>ระงับการใช้งาน</button>
    <button class="btn btn-line btn-sm" type="button" data-bulk-activate>เปิดใช้งาน</button>
    <button class="btn btn-danger btn-sm" type="button" data-bulk-del>${I('trash','ico-sm')}ลบ</button>
    <button class="btn btn-text btn-sm" type="button" data-bulk-clear style="color:#fff;margin-left:auto">ยกเลิกการเลือก</button>
  </div>
  <div class="tbl-wrap"><table class="tbl" data-utable>
    <thead><tr><th class="cb"><label class="vh" for="uall">เลือกทั้งหมด</label><input type="checkbox" id="uall" data-uall></th><th>ชื่อ</th><th>เบอร์โทร</th><th data-col-role>ตำแหน่ง</th><th data-col-orders hidden class="num">คำสั่งซื้อ</th><th data-col-orders hidden class="num">ยอดซื้อรวม</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th class="act"><span class="vh">จัดการ</span></th></tr></thead>
    <tbody data-ubody></tbody>
  </table>
  <div class="tfoot"><span data-urange></span><nav class="pager" aria-label="เลขหน้า" data-upager></nav></div></div>
</section>
<section data-upanel="perm" hidden>
  <div class="hint-box" style="margin-bottom:14px">${I('info')}<span>เจ้าของร้านปรับสิทธิ์ของตำแหน่งที่มีอยู่ได้เอง ตำแหน่ง <b>Admin สูงสุด</b> มีสิทธิ์ทุกอย่างเสมอและแก้ไขไม่ได้ ลูกค้าและผู้ที่ไม่ได้เข้าสู่ระบบไม่มีสิทธิ์เข้าหลังร้าน</span></div>
  <div class="tbl-wrap"><table class="tbl perm">
    <thead><tr><th>สิทธิ์</th><th><span class="role r-blog">Blogger</span></th><th><span class="role r-sales">Sale-manager</span></th><th><span class="role r-admin">Admin</span></th><th><span class="role r-top">Admin สูงสุด</span></th></tr></thead>
    <tbody>${PERMS.map(([g,rows])=>`<tr class="grp"><td colspan="5">${g}</td></tr>`+rows.map(([t,d,v],ri)=>`<tr><td><b>${t}</b><small>${d}</small></td>${v.map((on,ci)=>`<td><label class="switch"><input type="checkbox"${on?' checked':''}${ci===3?' disabled':''} data-perm aria-label="${t} — ${['Blogger','Sale-manager','Admin','Admin สูงสุด'][ci]}"><i></i></label></td>`).join('')}</tr>`).join('')).join('')}</tbody>
  </table></div>
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px"><button class="btn btn-line" type="button" data-perm-reset>คืนค่าเดิม</button><button class="btn btn-dark" type="button" data-perm-save disabled>บันทึกสิทธิ์</button></div>
</section>`;
const userSheet = `
<aside class="sheet" role="dialog" aria-modal="true" aria-labelledby="ush" data-usheet>
  <div class="sheet__h"><h2 id="ush" data-usheet-title>เพิ่มผู้ใช้</h2><button class="icon-b" type="button" data-close-sheet aria-label="ปิด">${I('x')}</button></div>
  <form class="sheet__b" data-uform novalidate>
    <input type="hidden" name="id">
    <div class="field"><label for="f-name">ชื่อ-นามสกุล <span class="req">*</span></label><input class="input" id="f-name" name="name" required autocomplete="off"><p class="err" hidden></p></div>
    <div class="field"><label for="f-email">อีเมล <span class="req">*</span></label><input class="input" id="f-email" name="email" type="email" required autocomplete="off"><p class="hint" data-otp-hint>ใช้เข้าสู่ระบบและรับรหัส OTP ยืนยันตัวตน</p><p class="err" hidden></p></div>
    <div class="field"><label for="f-phone">เบอร์โทรศัพท์</label><input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="off"><p class="err" hidden></p></div>
    <div class="field"><label for="f-role">ตำแหน่ง <span class="req">*</span></label><select class="select" id="f-role" name="role" style="width:100%">
      <option value="blog">Blogger — เขียนข่าวอย่างเดียว</option><option value="sales">Sale-manager — สินค้า สต๊อก คำสั่งซื้อ การเงิน</option><option value="admin">Admin — ดูแลทั้งหมด</option><option value="top">Admin สูงสุด — เพิ่ม/ลบพนักงาน ตั้งค่าระบบ</option><option value="cust">ลูกค้า</option></select></div>
    <div class="field"><label class="switch" for="f-active"><input type="checkbox" id="f-active" name="active" checked><i></i>เปิดใช้งานบัญชี</label></div>
    <div class="hint-box" data-invite-note>${I('mail')}<span>เราจะส่งอีเมลเชิญให้ตั้งรหัสผ่าน และทุกครั้งที่เข้าสู่ระบบจะต้องกรอกรหัส OTP ที่ส่งไปทางอีเมล</span></div>
    <div class="field" data-reset-row hidden><button class="btn btn-line" type="button" data-reset-pw>${I('lock','ico-sm')}ส่งลิงก์ตั้งรหัสผ่านใหม่</button></div>
  </form>
  <div class="sheet__f"><button class="btn btn-line" type="button" data-close-sheet>ยกเลิก</button><button class="btn btn-dark" type="button" data-usave>บันทึก</button></div>
</aside>
<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="delt" aria-describedby="deld" data-delmodal>
  <div class="modal__ico">${I('trash')}</div>
  <h2 id="delt" data-del-title>ลบผู้ใช้?</h2>
  <p id="deld" data-del-desc>บัญชีจะถูกลบถาวร ประวัติคำสั่งซื้อและบันทึกการแก้ไขยังเก็บไว้ตามนโยบาย</p>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal>ยกเลิก</button><button class="btn btn-danger" type="button" data-del-confirm>ลบถาวร</button></div>
</div>
<script type="application/json" id="udata">${JSON.stringify({staff:USERS,cust:CUSTS})}</script>`;
page('users.html','ผู้ใช้และสิทธิ์','users.html',users,{extra:userSheet});

/* ============== PRODUCTS ============== */
const PRODS = [
  {id:1,name:'PlayStation 5 Slim 1TB',sku:'PS5-SLIM-1TB',cat:'PlayStation 5 · เครื่องเกม',m:'m-ps',a:'console',type:'norm',shopee:true,v:[['มีช่องใส่แผ่น · ขาว','PS5-SLIM-1TB-DISC-WH',17990,12,'on'],['มีช่องใส่แผ่น · ดำ','PS5-SLIM-1TB-DISC-BK',17990,0,'on'],['Digital · ขาว','PS5-SLIM-1TB-DIG-WH',15990,3,'on'],['Digital · ดำ','PS5-SLIM-1TB-DIG-BK',16290,7,'on']]},
  {id:2,name:'Nintendo Switch 2 เครื่องเกม',sku:'NS2-CONSOLE',cat:'Nintendo Switch 2 · เครื่องเกม',m:'m-ns',a:'handheld',type:'norm',shopee:true,v:[['รุ่นปกติ','NS2-CONSOLE-STD',16900,25,'on'],['ชุด + Mario Kart World','NS2-CONSOLE-MKW',17990,9,'on']]},
  {id:3,name:'จอย DualSense Wireless Controller',sku:'PS5-DS',cat:'PlayStation 5 · จอย',m:'m-ps',a:'pad',type:'norm',shopee:true,v:[['White','PS5-DS-WH',2290,40,'on'],['Midnight Black','PS5-DS-BK',2290,18,'on'],['Cosmic Red','PS5-DS-RD',2490,0,'off']]},
  {id:4,name:'เกม Astro Bot (PS5) โซน 3',sku:'PS5-GM-ASTRO',cat:'PlayStation 5 · แผ่นเกม',m:'m-ps',a:'disc',type:'norm',shopee:true,v:[['Standard Edition','PS5-GM-ASTRO-STD',1590,30,'on']]},
  {id:5,name:'เกม Mario Kart World (Switch 2)',sku:'NS2-GM-MKW',cat:'Nintendo Switch 2 · แผ่นเกม',m:'m-ns',a:'disc',type:'norm',shopee:false,v:[['โซนเอเชีย','NS2-GM-MKW-AS',2390,22,'on']]},
  {id:6,name:'จอย DualSense Limited Edition',sku:'PRE-PS5-DS-LTD',cat:'พรีออเดอร์ · จอย',m:'m-ps',a:'pad',type:'pre',shopee:false,pre:'วางขาย 27 พ.ย. 2569 · จองแล้ว 31/50',v:[['Limited Edition','PRE-PS5-DS-LTD-01',2590,19,'on']]},
  {id:7,name:'จอย GuliKit KingKong 3 Max',sku:'DS-GULI-KK3',cat:'Nintendo Switch · จอย',m:'m-ns',a:'pad',type:'drop',shopee:false,v:[['สีดำ','DS-GULI-KK3-BK',2190,null,'on'],['สีขาว','DS-GULI-KK3-WH',2190,null,'on']]},
  {id:8,name:'SSD M.2 NVMe 2TB สำหรับ PS5',sku:'IT-SSD-2TB',cat:'IT Gadgets · ที่เก็บข้อมูล',m:'m-it',a:'ssd',type:'norm',shopee:true,v:[['2TB พร้อมฮีตซิงก์','IT-SSD-2TB-HS',5490,9,'on']]},
  {id:9,name:'หูฟังเกมมิ่งไร้สาย 7.1 Surround',sku:'IT-HS-71',cat:'IT Gadgets · หูฟัง',m:'m-it',a:'head',type:'norm',shopee:true,v:[['สีดำ','IT-HS-71-BK',3490,4,'on'],['สีขาว','IT-HS-71-WH',3490,6,'on']]},
  {id:10,name:'Nintendo Switch 2 Pro Controller',sku:'NS2-PRO',cat:'Nintendo Switch 2 · จอย',m:'m-ns',a:'pad',type:'norm',shopee:true,v:[['รุ่นปกติ','NS2-PRO-STD',2790,0,'on']]},
];
const products = `
<div class="ph-head"><div><h1>สินค้าและสต๊อก</h1><p>แก้ราคา สต๊อก และสถานะได้ในตารางเลย ระบบบันทึกทุกการแก้ไขไว้ในประวัติ</p></div>
  <div class="ph-actions"><button class="btn btn-line" type="button" data-open-import>${I('upload','ico-sm')}นำเข้า Excel</button><button class="btn btn-line" type="button" data-export>${I('download','ico-sm')}ส่งออก Excel</button><a class="btn btn-dark" href="product-edit.html">${I('plus','ico-sm')}เพิ่มสินค้า</a></div></div>
<div class="ptabs" role="tablist" aria-label="กรองตามประเภทการขาย">
  <button role="tab" aria-selected="true" data-ptab="">ทั้งหมด <span class="n">${PRODS.length}</span></button>
  <button role="tab" aria-selected="false" data-ptab="norm">ขายปกติ <span class="n">${PRODS.filter(p=>p.type==='norm').length}</span></button>
  <button role="tab" aria-selected="false" data-ptab="pre">พรีออเดอร์ <span class="n">1</span></button>
  <button role="tab" aria-selected="false" data-ptab="drop">DropShip <span class="n">1</span></button>
  <button role="tab" aria-selected="false" data-ptab="out">สินค้าหมด <span class="n">3</span></button>
</div>
<div class="fbar">
  <div class="search">${I('search')}<label class="vh" for="pq">ค้นหาสินค้า</label><input id="pq" type="search" placeholder="ค้นหาชื่อสินค้า Parent SKU หรือ ModelSKU" data-pq></div>
  <label class="vh" for="pcat">หมวดหมู่</label><select class="select" id="pcat" data-pcat><option value="">ทุกหมวดหมู่</option><option>PlayStation 5</option><option>Nintendo Switch</option><option>IT Gadgets</option><option>พรีออเดอร์</option></select>
  <button class="btn btn-text" type="button" data-expand-all>${I('chev-d','ico-sm')}กางรุ่นย่อยทั้งหมด</button>
  <p class="fbar__right" data-pcount></p>
</div>
<div class="bulk" data-pbulk><b data-pbulk-n>เลือก 0 รุ่น</b>
  <label class="vh" for="bstat">ตั้งสถานะ</label><select class="select" id="bstat" data-bulk-status><option value="">ตั้งสถานะ…</option><option value="on">พร้อมขาย</option><option value="off">ไม่พร้อมขาย</option></select>
  <label class="vh" for="bprice">ปรับราคา</label><select class="select" id="bprice" data-bulk-price><option value="">ปรับราคา…</option><option value="-5">ลด 5%</option><option value="-10">ลด 10%</option><option value="5">เพิ่ม 5%</option></select>
  <button class="btn btn-line btn-sm" type="button" data-bulk-zero>ตั้งสต๊อกเป็น 0</button>
  <button class="btn btn-text btn-sm" type="button" data-pbulk-clear style="color:#fff;margin-left:auto">ยกเลิกการเลือก</button>
</div>
<div class="tbl-wrap"><table class="tbl" data-ptable>
  <thead><tr><th class="cb"><label class="vh" for="pall">เลือกทั้งหมด</label><input type="checkbox" id="pall" data-pall></th><th>สินค้า / รุ่น</th><th>ประเภท</th><th class="num">ราคา (บาท)</th><th class="num">สต๊อกจริง</th><th>หน้าร้านเห็น</th><th>สถานะ</th><th>Shopee</th><th class="act"><span class="vh">จัดการ</span></th></tr></thead>
  <tbody data-pbody></tbody>
</table>
<div class="tfoot"><span>สต๊อกที่ลูกค้าเห็นแสดงเป็นสถานะเท่านั้น ไม่แสดงจำนวนจริง</span><span data-psum></span></div></div>
<div class="savebar" data-savebar role="region" aria-label="การเปลี่ยนแปลงที่ยังไม่บันทึก"><span data-dirty-n>แก้ไข 0 รายการ</span><button class="btn btn-line btn-sm" type="button" data-discard>ยกเลิก</button><button class="btn btn-buy btn-sm" type="button" data-save-all>บันทึกการเปลี่ยนแปลง</button></div>
<script type="application/json" id="pdata">${JSON.stringify(PRODS)}</script>`;
const importModal = `
<div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="impt" data-impmodal>
  <div class="panel__h" style="margin:0"><h2 id="impt">นำเข้าสินค้าจาก Excel</h2><button class="icon-b" type="button" data-close-modal aria-label="ปิด">${I('x')}</button></div>
  <ol class="isteps"><li class="on" data-is="1"><b>1</b>เลือกไฟล์</li><li data-is="2"><b>2</b>ทดลองนำเข้า</li><li data-is="3"><b>3</b>ยืนยัน</li></ol>
  <div data-istep="1">
    <label class="drop" data-dropzone>${I('sheet')}<b>ลากไฟล์ .xlsx หรือ .csv มาวาง หรือคลิกเพื่อเลือก</b><small>หนึ่งแถวต่อหนึ่งรุ่น (ModelSKU) · สินค้าหลักใช้ Parent SKU เดียวกัน</small><input type="file" accept=".xlsx,.xls,.csv" class="vh" data-ifile></label>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="link" type="button" data-template style="border:0;background:none;min-height:40px">${I('download','ico-sm')}ดาวน์โหลดไฟล์ตัวอย่าง</button><label class="check"><input type="checkbox" checked>อัปเดตสินค้าที่มี ModelSKU ซ้ำ แทนการเพิ่มใหม่</label></div>
  </div>
  <div data-istep="2" hidden>
    <p style="margin:0 0 12px;color:var(--ink-2)">ไฟล์ <b data-ifname>products.xlsx</b> · ระบบตรวจแล้ว <b>ยังไม่ได้บันทึกจริง</b></p>
    <div class="dry"><div class="good"><b>38</b><small>รุ่นอัปเดตราคา / สต๊อก</small></div><div class="good"><b>6</b><small>สินค้าใหม่ (14 รุ่น)</small></div><div class="bad"><b>2</b><small>แถวมีข้อผิดพลาด</small></div></div>
    <div class="tbl-wrap"><table class="tbl" style="min-width:560px"><thead><tr><th>แถว</th><th>ModelSKU</th><th>ปัญหา</th></tr></thead><tbody>
      <tr><td>14</td><td class="sku">PS5-DS-GR</td><td><span class="pill p-bad">ไม่มี Parent SKU</span> คอลัมน์ C ว่าง</td></tr>
      <tr><td>27</td><td class="sku">NS2-GM-ZELDA-AS</td><td><span class="pill p-bad">ราคาไม่ถูกต้อง</span> “2,39O” ใช้ตัวอักษร O แทนเลขศูนย์</td></tr>
    </tbody></table></div>
    <p class="hint" style="margin-top:10px">แก้ไขในไฟล์แล้วอัปโหลดใหม่ หรือนำเข้าเฉพาะแถวที่ถูกต้อง แถวที่ผิดจะถูกข้ามไป</p>
  </div>
  <div data-istep="3" hidden><div class="hint-box" style="background:var(--ok-soft);color:#0A5A33">${I('check')}<span>นำเข้าเรียบร้อย อัปเดต 38 รุ่น เพิ่มสินค้าใหม่ 6 รายการ ข้าม 2 แถว · บันทึกในประวัติการแก้ไขแล้ว</span></div></div>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal data-icancel>ยกเลิก</button><button class="btn btn-dark" type="button" data-inext disabled>ทดลองนำเข้า</button></div>
</div>
<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="pdelt" data-delmodal>
  <div class="modal__ico">${I('trash')}</div><h2 id="pdelt" data-del-title>ลบสินค้า?</h2><p data-del-desc>สินค้าและรุ่นย่อยทั้งหมดจะถูกลบออกจากหน้าร้าน</p>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal>ยกเลิก</button><button class="btn btn-danger" type="button" data-del-confirm>ลบสินค้า</button></div>
</div>`;
page('products.html','สินค้าและสต๊อก','products.html',products,{extra:importModal});

/* ============== PRODUCT EDIT ============== */
const ped = `
<nav class="crumbs" aria-label="เส้นทาง" style="padding-top:0"><a href="products.html">สินค้าและสต๊อก</a>${I('chev-r')}<span aria-current="page">PlayStation 5 Slim 1TB</span></nav>
<div class="ph-head"><div><h1>PlayStation 5 Slim 1TB</h1><p>Parent SKU <span class="sku">PS5-SLIM-1TB</span> · แก้ไขล่าสุดโดย พนักงาน ข. วันนี้ 17:32</p></div>
  <div class="ph-actions"><a class="btn btn-line" href="../product.html">${I('eye','ico-sm')}ดูหน้าสินค้า</a><button class="btn btn-dark" type="button" data-save-product>บันทึก</button></div></div>
<div class="edit-grid">
  <div class="stack">
    <section class="panel" aria-labelledby="pe1">
      <div class="panel__h"><h2 id="pe1">ข้อมูลสินค้า</h2><div class="ltabs" role="tablist" aria-label="ภาษา"><button role="tab" aria-selected="true" data-lt="th">ไทย</button><button role="tab" aria-selected="false" data-lt="en"><span class="miss" aria-hidden="true"></span>English</button></div></div>
      <div class="stack" data-lp="th">
        <div class="field"><label for="pn">ชื่อสินค้า <span class="req">*</span></label><input class="input" id="pn" value="PlayStation 5 Slim เครื่องเกมคอนโซล 1TB"></div>
        <div class="field"><label for="pd">รายละเอียดสินค้า</label><textarea class="input" id="pd" rows="6">PlayStation 5 Slim มาพร้อม SSD 1TB โหลดเกมเร็ว เล่นได้ถึง 4K และใช้กับจอย DualSense ที่สั่นตอบสนองแบบ Haptic Feedback

• รุ่นมีช่องใส่แผ่น เล่นแผ่นเกม PS5 และ Ultra HD Blu-ray ได้
• Digital Edition ซื้อเกมจาก PlayStation Store อย่างเดียว</textarea></div>
      </div>
      <div class="stack" data-lp="en" hidden>
        <div class="hint-box" style="background:var(--warn-soft);color:var(--warn)">${I('alert')}<span>ยังไม่มีคำแปลภาษาอังกฤษ หน้าร้านภาษาอังกฤษจะแสดงข้อความภาษาไทยไปก่อน</span></div>
        <div class="field"><label for="pne">Product name</label><input class="input" id="pne" placeholder="PlayStation 5 Slim Console 1TB"></div>
        <div class="field"><label for="pde">Description</label><textarea class="input" id="pde" rows="6"></textarea></div>
        <button class="btn btn-line" type="button" style="justify-self:start">${I('copy','ico-sm')}คัดลอกจากภาษาไทยมาแก้</button>
      </div>
    </section>
    <section class="panel" aria-labelledby="pe2">
      <div class="panel__h"><h2 id="pe2">รูปสินค้า</h2><span class="muted" style="color:var(--muted);font-size:14px">ลากเพื่อเรียงลำดับ · รูปแรกเป็นรูปหน้าปก</span></div>
      <div class="gal">${[['m-ps','console'],['m-ps','pad'],['m-dark','console'],['m-ot','box']].map(([m,a],i)=>`<div class="media ${m}">${i===0?'<span class="cover-tag">หน้าปก</span>':''}<svg class="art" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:1"><use href="#i-a-${a}"/></svg></div>`).join('')}<label class="add-img">${I('upload')}<span>เพิ่มรูป</span><input type="file" accept="image/*" multiple class="vh"></label></div>
    </section>
    <section class="panel" aria-labelledby="pe3">
      <div class="panel__h"><h2 id="pe3">ตัวเลือกและรุ่นย่อย</h2><button class="btn btn-line btn-sm" type="button" data-add-opt>${I('plus','ico-sm')}เพิ่มตัวเลือก</button></div>
      <div class="opt-rows" data-opts>
        <div class="opt-row"><input class="input" value="รุ่น" aria-label="ชื่อตัวเลือก"><div class="tagin" data-tagin><span class="tok">มีช่องใส่แผ่น<button type="button" aria-label="ลบ มีช่องใส่แผ่น">${I('x')}</button></span><span class="tok">Digital<button type="button" aria-label="ลบ Digital">${I('x')}</button></span><input aria-label="เพิ่มค่าของตัวเลือก รุ่น" placeholder="พิมพ์แล้วกด Enter"></div><button class="row-act icon-b" type="button" aria-label="ลบตัวเลือก รุ่น">${I('trash','ico-sm')}</button></div>
        <div class="opt-row"><input class="input" value="สี" aria-label="ชื่อตัวเลือก"><div class="tagin" data-tagin><span class="tok">ขาว<button type="button" aria-label="ลบ ขาว">${I('x')}</button></span><span class="tok">ดำ<button type="button" aria-label="ลบ ดำ">${I('x')}</button></span><input aria-label="เพิ่มค่าของตัวเลือก สี" placeholder="พิมพ์แล้วกด Enter"></div><button class="row-act icon-b" type="button" aria-label="ลบตัวเลือก สี">${I('trash','ico-sm')}</button></div>
      </div>
      <div class="tbl-wrap" style="margin-top:16px"><table class="tbl" style="min-width:720px"><thead><tr><th>รุ่นย่อย</th><th>ModelSKU</th><th class="num">ราคา (บาท)</th><th class="num">สต๊อก</th><th>สถานะ</th></tr></thead><tbody>
        ${PRODS[0].v.map(([n,s,p,q,st])=>`<tr><td><b>${n}</b></td><td><input class="ied" style="width:220px;text-align:left" value="${s}" aria-label="ModelSKU ${n}"></td><td class="num"><input class="ied" value="${p.toLocaleString('en-US')}" inputmode="numeric" aria-label="ราคา ${n}"></td><td class="num"><input class="ied" style="width:80px" value="${q}" inputmode="numeric" aria-label="สต๊อก ${n}"></td><td><span class="pill ${q>0?'p-ok':'p-off'}">${q>0?'มีสินค้า':'สินค้าหมด'}</span></td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="panel" aria-labelledby="pe4">
      <div class="panel__h"><h2 id="pe4">รูปแบบการขาย</h2></div>
      <div class="radio-cards">
        <label class="rc"><input type="radio" name="stype" value="norm" checked data-stype><b>ขายปกติ</b><small>ตัดสต๊อกจริง ขายเกินจำนวนที่มีไม่ได้</small></label>
        <label class="rc"><input type="radio" name="stype" value="pre" data-stype><b>พรีออเดอร์</b><small>กำหนดวันวางขาย จำนวนรับจอง และมัดจำ</small></label>
        <label class="rc"><input type="radio" name="stype" value="drop" data-stype><b>DropShip</b><small>สั่งจากตัวแทน ร้านยืนยันของก่อนลูกค้าจ่ายเงิน</small></label>
      </div>
      <div class="fgrid" data-stype-pre hidden style="margin-top:16px">
        <div class="field"><label for="prd">วันวางจำหน่าย</label><input class="input" id="prd" type="date" value="2026-11-27"></div>
        <div class="field"><label for="prq">จำนวนรับจองสูงสุด</label><input class="input" id="prq" inputmode="numeric" value="50"></div>
        <div class="field"><label for="prp">การเก็บเงิน</label><select class="select" id="prp" style="width:100%"><option>เก็บมัดจำก่อน</option><option>เก็บเต็มจำนวน</option></select></div>
        <div class="field"><label for="prdep">ค่ามัดจำ (บาท)</label><input class="input" id="prdep" inputmode="numeric" value="500"></div>
      </div>
      <div class="fgrid" data-stype-drop hidden style="margin-top:16px">
        <div class="field"><label for="dsup">ซัพพลายเออร์</label><input class="input" id="dsup" placeholder="ชื่อตัวแทนจำหน่าย"></div>
        <div class="field"><label for="dwait">ระยะเวลารอของที่แจ้งลูกค้า</label><input class="input" id="dwait" value="7–14 วัน"></div>
      </div>
    </section>
  </div>
  <aside class="edit-side">
    <section class="panel" aria-labelledby="ps1"><div class="panel__h"><h2 id="ps1">สถานะ</h2></div>
      <div class="stack" style="gap:10px"><label class="switch" for="pub"><input type="checkbox" id="pub" checked><i></i>แสดงบนหน้าร้าน</label>
      <div class="field"><label for="pcat2">หมวดหมู่</label><select class="select" id="pcat2" style="width:100%"><option>PlayStation 5 · เครื่องเกม</option><option>PlayStation 5 · จอย</option><option>Nintendo Switch 2 · เครื่องเกม</option><option>IT Gadgets</option></select></div>
      <div class="field"><label for="pwg">น้ำหนักสำหรับคิดค่าส่ง (กก.)</label><input class="input" id="pwg" value="4.5" inputmode="decimal"></div></div></section>
    <section class="panel" aria-labelledby="ps2"><div class="panel__h"><h2 id="ps2">เชื่อม Shopee</h2><span class="chan"><i></i>เชื่อมแล้ว</span></div>
      <p style="font-size:14px;color:var(--ink-2)">สต๊อกของทุกรุ่นซิงก์กับ Shopee อัตโนมัติ ขายทางไหนก็ตัดอีกทาง</p>
      <div class="field" style="margin-top:12px"><label for="shid">รหัสสินค้าใน Shopee</label><input class="input" id="shid" value="SHP-0000000 (ตัวอย่าง)"></div>
      <button class="btn btn-line btn-block" type="button" style="margin-top:12px">${I('refresh','ico-sm')}จับคู่รุ่นย่อยใหม่</button></section>
    <section class="panel" aria-labelledby="ps3"><div class="panel__h"><h2 id="ps3">ข่าวที่เกี่ยวข้อง</h2></div>
      <p style="font-size:14px;color:var(--ink-2);margin-bottom:10px">แสดงท้ายหน้าสินค้านี้</p>
      <div class="tagin"><span class="tok">PS5 Slim กับ Digital ต่างกันตรงไหน<button type="button" aria-label="นำออก">${I('x')}</button></span><input aria-label="ค้นหาข่าว" placeholder="ค้นหาข่าว…"></div></section>
    <section class="panel" aria-labelledby="ps4"><div class="panel__h"><h2 id="ps4">ประวัติการแก้ไข</h2><a class="link" href="#audit">ดูทั้งหมด</a></div>
      <ul class="audit">
        <li><span class="av" aria-hidden="true">ข</span><span><b>พนักงาน ข.</b> แก้สต๊อก <span class="sku">DIG-WH</span> <span class="chg">5 → 3</span><time>วันนี้ 17:32</time></span></li>
        <li><span class="av" aria-hidden="true">ก</span><span><b>พนักงาน ก.</b> แก้ราคา <span class="sku">DIG-BK</span> <span class="chg">15,990 → 16,290</span><time>เมื่อวาน 11:05</time></span></li>
        <li><span class="av" aria-hidden="true">S</span><span><b>ซิงก์ Shopee</b> ตัดสต๊อก <span class="sku">DISC-BK</span> <span class="chg">1 → 0</span><time>12 พ.ย. 20:41</time></span></li>
      </ul></section>
  </aside>
</div>`;
page('product-edit.html','แก้ไขสินค้า','products.html',ped);

/* ============== POSTS LIST ============== */
const POSTS = [
  ['สรุปเกมใหม่ที่ประกาศในงานเดือนนี้ พร้อมวันวางจำหน่าย','PlayStation','pub','22 ก.ย. 2569','นักเขียน ง.',true,1840],
  ['รีวิว Switch 2 หลังใช้งาน 3 เดือน คุ้มไหมสำหรับมือใหม่','รีวิวสินค้า','pub','19 ก.ย. 2569','นักเขียน ง.',true,3210],
  ['เปิดรับพรีออเดอร์เกมใหม่ประจำเดือนพฤศจิกายน','ประชาสัมพันธ์','pub','15 ก.ย. 2569','พนักงาน ก.',true,962],
  ['วันหยุดร้านและรอบจัดส่งช่วงปีใหม่','ประชาสัมพันธ์','sched','28 ธ.ค. 2569 09:00','พนักงาน ก.',false,0],
  ['PS5 Slim กับ Digital Edition เลือกแบบไหนดี','รีวิวสินค้า','pending','—','นักเขียน จ.',false,0],
  ['เลือกคีย์บอร์ด Mechanical ตัวแรก ดูอะไรบ้าง','รีวิวสินค้า','draft','—','นักเขียน ง.',false,0],
  ['รายชื่อเกม Switch 2 ที่จะวางจำหน่ายไตรมาสนี้','Nintendo','pub','20 ก.ย. 2569','นักเขียน ง.',true,1205],
  ['PlayStation ประกาศอัปเดตเฟิร์มแวร์ใหม่','PlayStation','pub','21 ก.ย. 2569','นักเขียน ง.',false,740],
];
const PST = {pub:['p-ok','เผยแพร่แล้ว'],sched:['p-info','ตั้งเวลาไว้'],pending:['p-warn','รอตรวจ'],draft:['p-off','ฉบับร่าง']};
const posts = `
<div class="ph-head"><div><h1>ข่าวและบทความ</h1><p>Blogger เขียนและส่งตรวจ Admin เผยแพร่หรือตั้งเวลาเผยแพร่</p></div>
  <div class="ph-actions"><a class="btn btn-dark" href="post-edit.html">${I('plus','ico-sm')}เขียนข่าวใหม่</a></div></div>
<div class="ptabs" role="tablist" aria-label="สถานะข่าว">
  <button role="tab" aria-selected="true" data-stab="">ทั้งหมด <span class="n">${POSTS.length}</span></button>
  <button role="tab" aria-selected="false" data-stab="pub">เผยแพร่แล้ว <span class="n">5</span></button>
  <button role="tab" aria-selected="false" data-stab="sched">ตั้งเวลา <span class="n">1</span></button>
  <button role="tab" aria-selected="false" data-stab="pending">รอตรวจ <span class="n">1</span></button>
  <button role="tab" aria-selected="false" data-stab="draft">ฉบับร่าง <span class="n">1</span></button>
</div>
<div class="fbar">
  <div class="search">${I('search')}<label class="vh" for="sq">ค้นหาข่าว</label><input id="sq" type="search" placeholder="ค้นหาหัวข้อข่าว" data-sq></div>
  <label class="vh" for="scat">หมวดหมู่</label><select class="select" id="scat" data-scat><option value="">ทุกหมวดหมู่</option><option>ประชาสัมพันธ์</option><option>รีวิวสินค้า</option><option>Nintendo</option><option>PlayStation</option></select>
</div>
<div class="tbl-wrap"><table class="tbl">
  <thead><tr><th>หัวข้อ</th><th>หมวดหมู่</th><th>ผู้เขียน</th><th>ภาษา</th><th>สถานะ</th><th>วันที่</th><th class="num">ผู้อ่าน</th><th class="act"><span class="vh">จัดการ</span></th></tr></thead>
  <tbody>${POSTS.map(([t,c,s,d,a,en,v],i)=>`<tr data-post data-status="${s}" data-cat="${c}">
    <td style="min-width:300px"><a href="post-edit.html" style="font-weight:600">${t}</a> <span class="muted">(ตัวอย่าง)</span></td>
    <td><span class="tag ${c==='PlayStation'?'tag-ps':c==='Nintendo'?'tag-ns':'tag-ot'}">${c}</span></td>
    <td>${a}</td><td><span class="pill p-ok" style="margin-right:4px">TH</span>${en?'<span class="pill p-ok">EN</span>':'<span class="pill p-off">EN</span>'}</td>
    <td><span class="pill ${PST[s][0]}">${PST[s][1]}</span></td><td class="muted">${d}</td><td class="num">${v?v.toLocaleString('en-US'):'—'}</td>
    <td class="act"><span class="row-act"><a href="post-edit.html" aria-label="แก้ไข ${t}">${I('edit','ico-sm')}</a><a href="../news.html" aria-label="ดู ${t}">${I('eye','ico-sm')}</a><button class="del" type="button" data-del-post aria-label="ย้าย ${t} ไปถังขยะ">${I('trash','ico-sm')}</button></span></td></tr>`).join('')}</tbody>
</table><div class="tfoot"><span data-scount>แสดง ${POSTS.length} รายการ</span><span>ถังขยะ (0)</span></div></div>`;
page('posts.html','ข่าวและบทความ','posts.html',posts);

/* ============== DASHBOARD ============== */
const days = [['31',18],['1',22],['2',15],['3',28],['4',24],['5',31],['6',38],['7',26],['8',19],['9',33],['10',41],['11',36],['12',44],['13',49]];
const dash = `
<div class="ph-head"><div><h1>สวัสดี คุณตัวอย่าง</h1><p>ภาพรวมร้านวันศุกร์ที่ 13 พฤศจิกายน 2569</p></div>
  <div class="ph-actions"><div class="ltabs" role="tablist" aria-label="ช่วงเวลา"><button role="tab" aria-selected="true">วันนี้</button><button role="tab" aria-selected="false">สัปดาห์นี้</button><button role="tab" aria-selected="false">เดือนนี้</button></div><button class="btn btn-line" type="button">${I('download','ico-sm')}ส่งออกยอดขายให้บัญชี</button></div></div>
<div class="kpi">
  <div class="panel"><small>${I('chart','ico-sm')}ยอดขายวันนี้</small><b>฿48,920</b><span class="delta up">+12% จากเมื่อวาน</span></div>
  <div class="panel"><small>${I('receipt','ico-sm')}คำสั่งซื้อวันนี้</small><b>19</b><span class="delta up">+4 จากเมื่อวาน</span></div>
  <div class="panel"><small>${I('bank','ico-sm')}สลิปรอตรวจ</small><b>3</b><span class="delta down">เก่าสุด 2 ชม. ที่แล้ว</span></div>
  <div class="panel"><small>${I('package','ico-sm')}รุ่นที่สินค้าหมด</small><b>3</b><span class="delta" style="color:var(--muted)">ดูในสินค้าและสต๊อก</span></div>
</div>
<div class="dgrid">
  <div class="stack">
    <section class="panel" aria-labelledby="d1"><div class="panel__h"><h2 id="d1">ยอดขาย 14 วันล่าสุด (พันบาท)</h2><span style="color:var(--muted);font-size:14px">รวม ฿4.6 แสน</span></div>
      <div class="bars" role="img" aria-label="กราฟยอดขาย 14 วัน สูงสุดวันที่ 13 พฤศจิกายน 49,000 บาท">${days.map(([d,v],i)=>`<div class="bar${i===13?' is-today':''}" style="--h:${v*3.4}px"><em>฿${v},${(v*37%1000).toString().padStart(3,'0')}</em><i style="height:${v*3.4}px"></i><span>${d}</span></div>`).join('')}</div></section>
    <section class="panel" aria-labelledby="d2"><div class="panel__h"><h2 id="d2">คำสั่งซื้อตามสถานะ</h2><a class="link" href="#orders">ดูคำสั่งซื้อทั้งหมด</a></div>
      <div class="ostat">${[['4','รอชำระเงิน'],['3','รอตรวจสลิป'],['6','รอแพ็กสินค้า'],['2','รอสินค้าจากซัพพลายเออร์'],['18','จัดส่งแล้ว'],['1','ขอยกเลิก / คืนเงิน']].map(([n,l])=>`<a href="#orders"><b>${n}</b><small>${l}</small></a>`).join('')}</div></section>
    <section class="panel" aria-labelledby="d4"><div class="panel__h"><h2 id="d4">ขายดีวันนี้ (ตาม ModelSKU)</h2></div>
      <div class="tbl-wrap" style="border:0"><table class="tbl" style="min-width:520px"><thead><tr><th>ModelSKU</th><th>สินค้า</th><th class="num">ชิ้น</th><th class="num">ยอดขาย</th></tr></thead><tbody>
      ${[['PS5-DS-WH','จอย DualSense White',6,13740],['PS5-SLIM-1TB-DISC-WH','PS5 Slim มีช่องใส่แผ่น ขาว',1,17990],['NS2-GM-MKW-AS','Mario Kart World',3,7170],['PS5-GM-ASTRO-STD','Astro Bot',3,4770]].map(([s,n,q,v])=>`<tr><td class="sku">${s}</td><td>${n}</td><td class="num">${q}</td><td class="num">${baht(v)}</td></tr>`).join('')}</tbody></table></div></section>
  </div>
  <div class="stack">
    <section class="panel" aria-labelledby="d3"><div class="panel__h"><h2 id="d3">สลิปรอตรวจ</h2><a class="link" href="#slips">ตรวจทั้งหมด</a></div>
      <ul class="qlist">${[['#TZ-2569-10511','฿2,790 · 12 นาทีที่แล้ว'],['#TZ-2569-10507','฿19,490 · 1 ชม. ที่แล้ว'],['#TZ-2569-10499','฿4,780 · 2 ชม. ที่แล้ว']].map(([o,d])=>`<li><span><b>${o}</b><small>${d}</small></span><button class="btn btn-line btn-sm" type="button">ตรวจสลิป</button></li>`).join('')}</ul></section>
    <section class="panel" aria-labelledby="d5"><div class="panel__h"><h2 id="d5">คิว DropShip</h2></div>
      <ul class="qlist"><li><span><b>GuliKit KK3 Max · ดำ</b><small>#TZ-2569-10488 · สั่งตัวแทนแล้ว 3 วัน</small></span><span class="pill p-warn">รอของ</span></li><li><span><b>GuliKit KK3 Max · ขาว</b><small>#TZ-2569-10512 · รอยืนยันของก่อนลูกค้าจ่าย</small></span><span class="pill p-info">ต้องยืนยัน</span></li></ul></section>
    <section class="panel" aria-labelledby="d6"><div class="panel__h"><h2 id="d6">แก้ไขล่าสุด</h2><a class="link" href="#audit">ประวัติทั้งหมด</a></div>
      <ul class="audit">
        <li><span class="av" aria-hidden="true">ข</span><span><b>พนักงาน ข.</b> แก้สต๊อก <span class="sku">PS5-SLIM-1TB-DIG-WH</span> <span class="chg">5 → 3</span><time>17:32</time></span></li>
        <li><span class="av" aria-hidden="true">ง</span><span><b>นักเขียน ง.</b> เผยแพร่ข่าว “สรุปเกมใหม่…”<time>16:10</time></span></li>
        <li><span class="av" aria-hidden="true">ก</span><span><b>พนักงาน ก.</b> คำสั่งซื้อ #10482 <span class="chg">แพ็กสินค้า → ส่งแล้ว</span><time>14:55</time></span></li>
      </ul></section>
  </div>
</div>`;
page('index.html','แดชบอร์ด','index.html',dash);

/* ============== STAFF LOGIN (email OTP) ============== */
writeFileSync(new URL('login.html', OUT), `${head('เข้าสู่ระบบพนักงาน')}
<body>${sprite()}
<div class="mock">ตัวอย่างงานออกแบบระบบหลังร้าน (Design mockup)</div>
<main class="slog" id="main">
  <div class="slog__art"><span class="brand"><span class="brand__mark" style="background:var(--accent);color:var(--ink)" aria-hidden="true">T</span><span class="brand__word" style="color:#fff">Tinz<b>shop</b></span></span>
    <div><h1>ระบบหลังร้านสำหรับพนักงาน Tinzshop</h1><p>สินค้า สต๊อก คำสั่งซื้อ และข่าวของร้าน ในที่เดียว ใช้ได้ทั้งภาษาไทยและอังกฤษ</p></div>
    <p style="font-size:14px">ลูกค้า? <a href="../login.html" style="color:#fff;text-decoration:underline">เข้าสู่ระบบหน้าร้าน</a></p></div>
  <div class="slog__form">
    <form data-slog="1" novalidate>
      <h2>เข้าสู่ระบบพนักงาน</h2><p style="color:var(--muted);margin-top:-8px">ขั้นที่ 1 จาก 2 · อีเมลและรหัสผ่าน</p>
      <div class="field"><label for="se">อีเมลพนักงาน</label><input class="input" id="se" type="email" autocomplete="username" required><p class="err" hidden></p></div>
      <div class="field"><label for="sp">รหัสผ่าน</label><input class="input" id="sp" type="password" autocomplete="current-password" required><p class="err" hidden></p></div>
      <button class="btn btn-dark btn-lg btn-block" type="submit">ถัดไป</button>
    </form>
    <form data-slog="2" novalidate hidden>
      <h2>ยืนยันตัวตน</h2><p style="color:var(--muted);margin-top:-8px">ขั้นที่ 2 จาก 2 · กรอกรหัส 6 หลักที่ส่งไปที่ <b data-sl-mail>อีเมลของคุณ</b></p>
      <fieldset style="border:0;padding:0;margin:0"><legend class="vh">รหัส OTP 6 หลัก</legend><div class="otp6">${[1,2,3,4,5,6].map(i=>`<input inputmode="numeric" maxlength="1" aria-label="หลักที่ ${i}"${i===1?' autocomplete="one-time-code"':''}>`).join('')}</div></fieldset>
      <p class="err" data-otp-err hidden>กรุณากรอกรหัสให้ครบ 6 หลัก</p>
      <button class="btn btn-dark btn-lg btn-block" type="submit">ยืนยันและเข้าสู่ระบบ</button>
      <p style="font-size:14px;color:var(--muted);text-align:center">ไม่ได้รับอีเมล? <button class="link" type="button" data-resend style="border:0;background:none;min-height:40px">ส่งรหัสใหม่</button></p>
    </form>
  </div>
</main>
<script src="../js/admin.js" defer></script></body></html>`);


/* ============== POST EDITOR (WordPress-like) ============== */
const tb = (cmd, ic, label, extra='') => `<button type="button" class="tb" data-cmd="${cmd}" aria-label="${label}" title="${label}"${extra}>${I(ic)}</button>`;
const postEdit = `
<form class="ed" data-editor novalidate onsubmit="return false">
  <div class="ed-top">
    <a class="btn btn-text" href="posts.html">${I('chev-l','ico-sm')}ข่าวทั้งหมด</a>
    <span class="ed-save" data-savestate aria-live="polite">${I('check','ico-sm')}บันทึกร่างแล้ว 22:14</span>
    <div class="ed-top__r">
      <button class="btn btn-text" type="button" data-cmd="undo" aria-label="ย้อนกลับ" title="ย้อนกลับ (Ctrl+Z)">${I('undo','ico-sm')}</button>
      <button class="btn btn-text" type="button" data-cmd="redo" aria-label="ทำซ้ำ" title="ทำซ้ำ (Ctrl+Y)">${I('redo','ico-sm')}</button>
      <button class="btn btn-line" type="button" data-preview>${I('eye','ico-sm')}ดูตัวอย่าง</button>
      <button class="btn btn-line" type="button" data-save-draft>บันทึกร่าง</button>
      <button class="btn btn-buy" type="button" data-publish>เผยแพร่</button>
    </div>
  </div>
  <div class="ed-grid">
    <div class="ed-main">
      <div class="ed-lang"><div class="ltabs" role="tablist" aria-label="ภาษาของบทความ"><button role="tab" type="button" aria-selected="true" data-elang="th">ไทย</button><button role="tab" type="button" aria-selected="false" data-elang="en"><span class="miss" aria-hidden="true"></span>English</button></div><span class="ed-hint">เปลี่ยนภาษาเพื่อเขียนฉบับภาษาอังกฤษ ถ้ายังไม่มี หน้าเว็บภาษาอังกฤษจะแสดงฉบับภาษาไทย</span></div>
      <label class="vh" for="etitle">หัวข้อข่าว</label>
      <textarea class="ed-title" id="etitle" rows="1" placeholder="เพิ่มหัวข้อข่าว" data-etitle>รีวิว Switch 2 หลังใช้งาน 3 เดือน คุ้มไหมสำหรับมือใหม่</textarea>
      <p class="ed-link">${I('link','ico-sm')}ลิงก์: <span>tinzshop.example/news/</span><input aria-label="ส่วนท้ายของลิงก์ (slug)" value="switch-2-review-3-months" data-slug></p>
      <div class="ed-paper">
        <div class="ed-tools" role="toolbar" aria-label="จัดรูปแบบข้อความ">
          <label class="vh" for="eblock">รูปแบบย่อหน้า</label>
          <select class="ed-block" id="eblock" data-block><option value="p">ย่อหน้า</option><option value="h2">หัวข้อ 2</option><option value="h3">หัวข้อ 3</option><option value="blockquote">ข้อความอ้างอิง</option></select>
          <span class="tsep"></span>
          ${tb('bold','bold','ตัวหนา (Ctrl+B)')}${tb('italic','italic','ตัวเอียง (Ctrl+I)')}${tb('underline','underline','ขีดเส้นใต้ (Ctrl+U)')}${tb('strikeThrough','strike','ขีดฆ่า')}${tb('createLink','link','แทรกลิงก์ (Ctrl+K)')}
          <span class="tsep"></span>
          ${tb('insertUnorderedList','ul','รายการแบบจุด')}${tb('insertOrderedList','ol','รายการแบบตัวเลข')}${tb('formatBlock:blockquote','quote','ข้อความอ้างอิง')}
          <span class="tsep"></span>
          ${tb('justifyLeft','al-l','ชิดซ้าย')}${tb('justifyCenter','al-c','กึ่งกลาง')}${tb('justifyRight','al-r','ชิดขวา')}
          <span class="tsep"></span>
          <label class="tb tb-wide" title="แทรกรูปภาพ">${I('image')}<span>รูปภาพ</span><input type="file" accept="image/*" multiple class="vh" data-img-input aria-label="แทรกรูปภาพ"></label>
          ${tb('video','video','แทรกวิดีโอ YouTube')}${tb('product','cart','แทรกการ์ดสินค้า')}${tb('insertHorizontalRule','hr','เส้นคั่น')}
          <span class="tsep"></span>
          ${tb('removeFormat','clear','ล้างรูปแบบ')}
        </div>
        <div class="ed-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="เนื้อหาข่าว" data-body spellcheck="true">
          <p>หลังจากใช้ Nintendo Switch 2 มาสามเดือนเต็ม ทั้งเล่นบนทีวีและพกไปเล่นนอกบ้าน ทีมร้านสรุปสิ่งที่ชอบ สิ่งที่ควรรู้ก่อนซื้อ และเกมที่แนะนำสำหรับคนเพิ่งเริ่ม (ข้อความตัวอย่าง)</p>
          <h2>จอใหญ่ขึ้น พกยังสบาย</h2>
          <p>จอใหญ่ขึ้นจากรุ่นเดิมชัดเจน ตัวหนังสือในเกมอ่านง่ายขึ้นมากเวลาเล่นแบบพกพา น้ำหนักเพิ่มขึ้นเล็กน้อยแต่ถือเล่นนานได้สบาย</p>
          <figure class="ed-fig" contenteditable="false" data-fig data-align="wide"><div class="ed-fig__img m-ns"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-a-handheld"/></svg></div><figcaption contenteditable="true" data-placeholder="เพิ่มคำอธิบายภาพ (ไม่บังคับ)">Switch 2 ขณะเล่นแบบพกพา</figcaption></figure>
          <h2>เกมแรกที่แนะนำ</h2>
          <ul><li><b>Mario Kart World</b> — เล่นกับเพื่อนได้ทันที เหมาะกับทุกวัย</li><li>เกมแนวผจญภัยสำหรับเล่นคนเดียวยาว ๆ</li></ul>
          <blockquote>ถ้าเล่นบนทีวีเป็นหลัก แนะนำซื้อ Pro Controller เพิ่มหนึ่งตัว</blockquote>
          <p><br></p>
        </div>
        <div class="ed-status"><span data-wc>0 คำ</span><span data-rt>อ่านประมาณ 1 นาที</span><span class="ed-tip">${I('image','ico-sm')}วางรูปจากคลิปบอร์ด (Ctrl+V) หรือลากไฟล์มาวางในเนื้อหาได้เลย</span></div>
      </div>
      <section class="panel ed-seo" aria-labelledby="seo-h"><div class="panel__h"><h2 id="seo-h">การแสดงผลบน Google</h2></div>
        <div class="gprev" aria-hidden="true"><small>tinzshop.example › news › <span data-gp-slug>switch-2-review-3-months</span></small><b data-gp-title>รีวิว Switch 2 หลังใช้งาน 3 เดือน คุ้มไหมสำหรับมือใหม่ | Tinzshop</b><p data-gp-desc></p></div>
        <div class="field"><label for="emeta">คำอธิบายสั้น (Meta description)</label><textarea class="input" id="emeta" rows="2" maxlength="160" data-meta>สรุปการใช้ Switch 2 สามเดือน ทั้งจุดเด่น สิ่งที่ควรรู้ก่อนซื้อ และเกมแรกที่แนะนำสำหรับมือใหม่ จากทีม Tinzshop</textarea><p class="hint"><span data-meta-n>0</span>/160 ตัวอักษร</p></div>
      </section>
    </div>
    <aside class="ed-side">
      <details class="panel" open><summary><h2>การเผยแพร่</h2>${I('chev-d','ico-sm')}</summary>
        <dl class="pubrows">
          <div><dt>สถานะ</dt><dd><span class="pill p-off" data-pub-state>ฉบับร่าง</span></dd></div>
          <div><dt><label for="evis">การมองเห็น</label></dt><dd><select class="ied-s" id="evis"><option>สาธารณะ</option><option>เฉพาะสมาชิก</option></select></dd></div>
          <div><dt><label for="ewhen">เผยแพร่</label></dt><dd><select class="ied-s" id="ewhen" data-when><option value="now">ทันที</option><option value="later">ตั้งเวลา…</option></select></dd></div>
          <div data-when-at hidden><dt><label for="eat">วันและเวลา</label></dt><dd><input class="input" id="eat" type="datetime-local" value="2026-11-20T09:00" style="min-height:38px;font-size:14px"></dd></div>
          <div><dt>ผู้เขียน</dt><dd>นักเขียน ง.</dd></div>
        </dl>
        <div class="hint-box" style="margin-top:10px">${I('info')}<span>บัญชี Blogger กด <b>ส่งตรวจ</b> ได้ Admin เป็นผู้กดเผยแพร่</span></div>
        <div class="pub-actions"><button class="btn btn-text btn-sm del-link" type="button" data-trash>${I('trash','ico-sm')}ย้ายไปถังขยะ</button><button class="btn btn-line btn-sm" type="button" data-submit-review>ส่งตรวจ</button></div>
      </details>
      <details class="panel" open><summary><h2>ภาพหน้าปก</h2>${I('chev-d','ico-sm')}</summary>
        <label class="cover" data-cover><input type="file" accept="image/*" class="vh" data-cover-input aria-label="เลือกภาพหน้าปก"><span class="cover__empty">${I('image')}<b>เลือกหรือลากภาพหน้าปกมาวาง</b><small>แนะนำ 1200 × 675 px</small></span></label>
      </details>
      <details class="panel" open><summary><h2>หมวดหมู่</h2>${I('chev-d','ico-sm')}</summary>
        <div class="catlist">${['ประชาสัมพันธ์','รีวิวสินค้า','Nintendo','PlayStation'].map((c,i)=>`<label class="check"><input type="checkbox"${i===1||i===2?' checked':''}>${c}</label>`).join('')}</div>
      </details>
      <details class="panel" open><summary><h2>แท็ก</h2>${I('chev-d','ico-sm')}</summary>
        <div class="tagin" data-tagin>${['Switch 2','มือใหม่','Mario Kart'].map(t=>`<span class="tok">${t}<button type="button" aria-label="ลบแท็ก ${t}">${I('x')}</button></span>`).join('')}<input aria-label="เพิ่มแท็ก" placeholder="เพิ่มแท็ก แล้วกด Enter"></div>
      </details>
      <details class="panel" open><summary><h2>สินค้าที่เกี่ยวข้อง</h2>${I('chev-d','ico-sm')}</summary>
        <p style="font-size:13.5px;color:var(--muted);margin-bottom:10px">ข่าวนี้จะขึ้นในหน้าสินค้าที่เลือก</p>
        <ul class="relp" data-relp>${[['m-ns','handheld','Nintendo Switch 2 เครื่องเกม','NS2-CONSOLE'],['m-ns','disc','เกม Mario Kart World','NS2-GM-MKW']].map(([m,a,n,s])=>`<li>${art(m,a)}<span><b>${n}</b><small class="sku">${s}</small></span><button type="button" class="row-act icon-b" aria-label="นำ ${n} ออก">${I('x','ico-sm')}</button></li>`).join('')}</ul>
        <div class="search" style="height:42px;margin-top:10px;background:#fff;border-color:var(--line-2)">${I('search')}<label class="vh" for="relq">ค้นหาสินค้า</label><input id="relq" placeholder="ค้นหาสินค้าหรือ SKU"></div>
      </details>
      <details class="panel"><summary><h2>ประวัติการแก้ไข</h2>${I('chev-d','ico-sm')}</summary>
        <ul class="audit"><li><span class="av" aria-hidden="true">ง</span><span><b>นักเขียน ง.</b> บันทึกร่าง<time>วันนี้ 22:14</time></span></li><li><span class="av" aria-hidden="true">ง</span><span><b>นักเขียน ง.</b> สร้างข่าว<time>วันนี้ 20:02</time></span></li></ul>
      </details>
    </aside>
  </div>
</form>
<div class="imgpop" data-imgpop role="toolbar" aria-label="จัดการรูปภาพ" hidden>
  <button type="button" data-ialign="left" aria-label="ชิดซ้าย ข้อความล้อมรอบ" title="ชิดซ้าย">${I('al-l')}</button>
  <button type="button" data-ialign="center" aria-label="กึ่งกลาง" title="กึ่งกลาง">${I('al-c')}</button>
  <button type="button" data-ialign="wide" aria-label="เต็มความกว้าง" title="เต็มความกว้าง">${I('hr')}</button>
  <span class="tsep"></span>
  <button type="button" data-ialt aria-label="แก้ข้อความแทนภาพ (alt)" title="ข้อความแทนภาพ" style="width:auto;padding:0 10px;font-size:13px;font-weight:600">ALT</button>
  <label title="เปลี่ยนรูป" aria-label="เปลี่ยนรูป">${I('refresh')}<input type="file" accept="image/*" class="vh" data-ireplace></label>
  <button type="button" data-iremove aria-label="ลบรูป" title="ลบรูป" class="del">${I('trash')}</button>
</div>
<div class="ed-drop" data-edrop aria-hidden="true"><span>${I('upload')}วางรูปเพื่อแทรกลงในเนื้อหา</span></div>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="lnkt" data-linkmodal>
  <h2 id="lnkt">แทรกลิงก์</h2>
  <div class="field" style="margin-top:14px"><label for="lurl">URL</label><input class="input" id="lurl" type="url" placeholder="https://"><p class="err" hidden></p></div>
  <label class="check"><input type="checkbox" id="lnew">เปิดในแท็บใหม่</label>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal>ยกเลิก</button><button class="btn btn-dark" type="button" data-link-ok>แทรกลิงก์</button></div>
</div>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="vidt" data-vidmodal>
  <h2 id="vidt">แทรกวิดีโอ YouTube</h2>
  <div class="field" style="margin-top:14px"><label for="vurl">ลิงก์วิดีโอ</label><input class="input" id="vurl" type="url" placeholder="https://www.youtube.com/watch?v=…"><p class="err" hidden></p></div>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal>ยกเลิก</button><button class="btn btn-dark" type="button" data-vid-ok>แทรกวิดีโอ</button></div>
</div>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="prdt" data-prodmodal>
  <h2 id="prdt">แทรกการ์ดสินค้า</h2><p>การ์ดแสดงราคาและสถานะสต๊อกล่าสุดอัตโนมัติ</p>
  <div class="catlist" style="margin-top:12px">${[['Nintendo Switch 2 เครื่องเกม','฿16,900','m-ns','handheld'],['เกม Mario Kart World','฿2,390','m-ns','disc'],['Nintendo Switch 2 Pro Controller','฿2,790','m-ns','pad'],['PlayStation 5 Slim 1TB','฿17,990','m-ps','console']].map(([n,p,m,a],i)=>`<label class="check"><input type="radio" name="pcard" value="${i}" data-pc='${JSON.stringify({n,p,m,a})}'${i===0?' checked':''}>${n} <span class="cnt">${p}</span></label>`).join('')}</div>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal>ยกเลิก</button><button class="btn btn-dark" type="button" data-prod-ok>แทรกการ์ด</button></div>
</div>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="altt" data-altmodal>
  <h2 id="altt">ข้อความแทนภาพ (alt)</h2><p>อธิบายสิ่งที่อยู่ในภาพ ช่วยผู้ใช้โปรแกรมอ่านหน้าจอและการค้นหาบน Google</p>
  <div class="field" style="margin-top:14px"><label for="alti">ข้อความแทนภาพ</label><input class="input" id="alti"></div>
  <div class="modal__f"><button class="btn btn-line" type="button" data-close-modal>ยกเลิก</button><button class="btn btn-dark" type="button" data-alt-ok>บันทึก</button></div>
</div>
<script src="../js/editor.js" defer></script>`;
page('post-edit.html','เขียนข่าว','posts.html',postEdit,{me:['ง','นักเขียน ง.','Blogger']});

console.log('admin built');
