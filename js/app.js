/* ═══════════════════════════════════════════════
   app.js — Nail Kloset Staff PWA  (UI v4 — fixed)
   แก้ไข:
   1. Bottom nav นิ่ง ไม่เลื่อนตาม
   2. บันทึกงาน ตัดยอดสมาชิกเมื่อชำระแบบ Member
   3. ค้นหาสมาชิก / สรุปยอด ทำงานถูกต้อง
   4. ไม่มีปุ่มออกจากระบบ
═══════════════════════════════════════════════ */

const SVC_COLORS = {
  'ทำเล็บ':        '#FF2D6F',
  'ต่อขนตา':       '#7B52AB',
  'สปามือ/เท้า':   '#0FBA75',
  'แว็กขน':        '#F5A623',
  'เติมเงินสมาชิก': '#2B7FFF',
  'เปิดเมมเบอร์ใหม่':'#2B7FFF',
};

const COMMISSION_RATE = {
  'ทำเล็บ':       0.10,
  'ต่อขนตา':      0.15,
  'สปามือ/เท้า':  0.10,
  'แว็กขน':       0.10,
};

const SERVICE_LIST = [
  { id: 'ทำเล็บ',       icon: '💅', color: '#FF2D6F', bg: '#FFF0F4' },
  { id: 'ต่อขนตา',      icon: '👁',  color: '#7B52AB', bg: '#EDE8F7' },
  { id: 'สปามือ/เท้า',  icon: '🧴', color: '#0FBA75', bg: '#D7F7EC' },
  { id: 'แว็กขน',       icon: '✨', color: '#F5A623', bg: '#FEF3DC' },
];

const PAYMENT_LIST = [
  { id: 'Cash',     label: '💵 สด' },
  { id: 'Transfer', label: '📲 โอน' },
  { id: 'Credit',   label: '💳 รูด' },
  { id: 'Member',   label: '🏷️ เมมเบอร์' },
];

const state = {
  userId: null, staffName: null, picture: '',
  page: 'record',
  todayRecs: [], config: {},
  member: null, selectedPayment: 'Cash',
  selectedService: '',
  recordMember: null,
  deferredInstallPrompt: null,
};

const $ = id => document.getElementById(id);

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  registerSW();
  setupOfflineDetect();
  setupInstallPrompt();
  checkLogin();
});

function registerSW() {
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ══════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════ */
function checkLogin() {
  const savedUser = localStorage.getItem('nk_staff_userId');
  const savedName = localStorage.getItem('nk_staff_name');
  if (savedUser && savedName) {
    state.userId    = savedUser;
    state.staffName = savedName;
    state.picture   = localStorage.getItem('nk_staff_picture') || '';
    afterLogin();
  } else {
    showLoginScreen();
  }
}

function showLoginScreen() {
  $('loading-screen').classList.add('out');
  $('login-screen').classList.add('show');
  renderLoginForm();
}

function renderLoginForm() {
  $('login-screen').innerHTML = `
    <div class="login-wrap">
      <div class="login-logo">💅</div>
      <div class="login-title">Nail Kloset</div>
      <div class="login-subtitle">Staff Portal</div>
      <div class="login-card">
        <div class="login-field">
          <div class="login-field-label">ชื่อพนักงาน</div>
          <input class="login-field-input" id="li-name" type="text"
            placeholder="เช่น Alex" autocomplete="off">
        </div>
        <div class="login-field">
          <div class="login-field-label">LINE UserID</div>
          <input class="login-field-input login-mono" id="li-userid" type="text"
            placeholder="U…" autocomplete="off">
          <div class="login-field-hint">ดูได้จาก Sheet "พนักงาน" คอลัมน์ A</div>
        </div>
        <button class="login-btn" onclick="doLogin()">เข้าสู่ระบบ →</button>
      </div>
    </div>
  `;
  setTimeout(() => {
    $('li-name')  ?.addEventListener('keydown', e => { if (e.key==='Enter') $('li-userid').focus(); });
    $('li-userid')?.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
    $('li-name')?.focus();
  }, 50);
}

async function doLogin() {
  const name   = $('li-name').value.trim();
  const userId = $('li-userid').value.trim();
  if (!name)   { showToast('กรุณากรอกชื่อพนักงานค่ะ','error'); $('li-name').focus();   return; }
  if (!userId) { showToast('กรุณากรอก LINE UserID ค่ะ','error'); $('li-userid').focus(); return; }
  if (!userId.startsWith('U')) {
    showToast('LINE UserID ต้องขึ้นต้นด้วย U ค่ะ','error');
    $('li-userid').focus(); return;
  }
  localStorage.setItem('nk_staff_name',   name);
  localStorage.setItem('nk_staff_userId', userId);
  state.staffName = name;
  state.userId    = userId;
  afterLogin();
}

async function afterLogin() {
  $('login-screen')?.classList.remove('show');
  renderAppShell();
  loadConfig().catch(() => {});
  hideLoading();
  goPage('record');
  loadTodayRecords().then(() => {
    if (state.page === 'home') renderHome();
  });
}

/* ══════════════════════════════════════════════
   APP SHELL — ไม่มีปุ่มออกจากระบบ
══════════════════════════════════════════════ */
function renderAppShell() {
  const av = state.picture
    ? `<img src="${state.picture}" class="staff-chip-avatar-img" alt="">`
    : `<div class="staff-chip-avatar">${state.staffName.slice(0,2)}</div>`;

  document.body.innerHTML = `
    <div id="loading-screen" style="display:none"></div>
    <div id="offline-banner">⚡ ออฟไลน์อยู่ค่ะ</div>
    <div id="app">
      <div class="top-bar">
        <div class="top-logo">💅 Nail Kloset<small>Staff Portal</small></div>
        <div class="staff-chip">${av}<div class="staff-chip-name">${state.staffName}</div></div>
      </div>
      <div class="pages-wrap">
        <div id="page-home"    class="page"></div>
        <div id="page-record"  class="page"></div>
        <div id="page-member"  class="page"></div>
        <div id="page-summary" class="page"></div>
      </div>
      <nav class="bottom-nav">
        <button class="nav-item" id="nav-home"    onclick="goPage('home')">   <span class="icon">🏠</span>หน้าหลัก</button>
        <button class="nav-item" id="nav-record"  onclick="goPage('record')"><span class="icon">✏️</span>บันทึกงาน</button>
        <button class="nav-item" id="nav-member"  onclick="goPage('member')"> <span class="icon">💳</span>สมาชิก</button>
        <button class="nav-item" id="nav-summary" onclick="goPage('summary')"><span class="icon">📊</span>สรุปยอด</button>
      </nav>
    </div>
    <div id="install-prompt">
      <span class="install-icon">📲</span>
      <div class="install-text"><strong>เพิ่มลงหน้าจอหลัก</strong><small>เปิดแอปได้เร็วขึ้น</small></div>
      <button class="install-btn" onclick="triggerInstall()">ติดตั้ง</button>
      <button class="install-dismiss" onclick="dismissInstall()">✕</button>
    </div>
    <div class="toast" id="toast"></div>
  `;
  setupOfflineDetect();
  checkInstallPrompt();
}

function hideLoading() {
  const ls = document.getElementById('loading-screen');
  if (ls) { ls.classList.add('out'); ls.style.display='none'; }
}

/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */
function goPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pageEl = $(`page-${page}`);
  const navEl  = $(`nav-${page}`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');
  state.page = page;
  if (pageEl) pageEl.scrollTop = 0;
  if (page === 'home')    renderHome();
  if (page === 'record')  renderRecord();
  if (page === 'member')  renderMember();
  if (page === 'summary') renderSummary();
}

/* ══════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════ */
function renderHome() {
  const el   = $('page-home');
  if (!el) return;
  const recs = state.todayRecs.filter(r =>
    !['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service));
  const comm  = Math.round(recs.reduce((s,r) => s + r.price*(COMMISSION_RATE[r.service]||0.1), 0));
  const count = recs.length;

  const now    = new Date();
  const DAYS   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const dateStr = `วัน${DAYS[now.getDay()]}ที่ ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()+543}`;

  el.innerHTML = `
    <div class="page-title">สวัสดี <span>${state.staffName}</span> 👋</div>
    <div class="page-sub">${dateStr}</div>
    <div class="comm-hero">
      <div class="comm-hero-label">ค่าคอมวันนี้</div>
      <div class="comm-hero-val">฿${comm.toLocaleString()}</div>
      <div class="comm-hero-sub">${count} รายการ</div>
    </div>
    <div class="card">
      <div class="card-title">📋 รายการวันนี้</div>
      ${state.todayRecs.length === 0
        ? `<div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีรายการค่ะ</div>`
        : renderTxItems(state.todayRecs)}
    </div>
  `;
}

function renderTxItems(recs) {
  return recs.map(r => {
    const isMemSvc   = ['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service);
    const commAmt    = isMemSvc ? 0 : Math.round(r.price*(COMMISSION_RATE[r.service]||0.1));
    const commStr    = isMemSvc ? '' : `คอม ฿${commAmt.toLocaleString()}`;
    const badgeClass = r.payment==='Member' ? 'badge-member' :
                       r.payment==='Transfer'||r.payment==='Credit' ? 'badge-credit' : 'badge-cash';
    const badgeLabel = r.payment==='Member' ? 'เมม' :
                       r.payment==='Transfer' ? 'โอน' :
                       r.payment==='Credit'   ? 'รูด' : 'สด';
    const col = SVC_COLORS[r.service] || '#999';
    return `
      <div class="tx-item">
        <div class="tx-dot" style="background:${col}"></div>
        <div class="tx-info">
          <div class="tx-svc">${r.service}</div>
          <div class="tx-meta">${r.time||''}${commStr ? ' · '+commStr : ''}</div>
        </div>
        <div class="tx-right">
          <span class="tx-badge ${badgeClass}">${badgeLabel}</span>
          <div class="tx-price">฿${Number(r.price).toLocaleString()}</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   RECORD PAGE — บันทึกงาน + ตัดยอดสมาชิก
══════════════════════════════════════════════ */
function renderRecord() {
  const el = $('page-record');
  if (!el) return;
  el.innerHTML = `
    <div class="page-title">✏️ บันทึก<span>งาน</span></div>
    <div class="page-sub">เลือกบริการแล้วกรอกราคา</div>

    <div class="card">
      <div class="form-label" style="margin-bottom:12px">💅 บริการ</div>
      <div class="svc-grid">
        ${SERVICE_LIST.map(s => `
          <button class="svc-btn ${state.selectedService===s.id?'active':''}"
            onclick="selectService('${s.id}')"
            style="--svc-color:${s.color}; --svc-bg:${s.bg};">
            <span class="svc-icon">${s.icon}</span>
            <span class="svc-label">${s.id}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="card" id="rec-price-card" style="${state.selectedService?'':'opacity:.45; pointer-events:none'}">
      <div class="form-group">
        <label class="form-label">💰 ราคา (บาท)</label>
        <input class="form-input form-input-lg" id="rec-price" type="number"
          inputmode="numeric" placeholder="0" min="0" step="1">
      </div>

      <div class="form-group">
        <label class="form-label">💳 การชำระเงิน</label>
        <div class="pay-chips">
          ${PAYMENT_LIST.map(p => `
            <button class="pay-chip ${p.id===state.selectedPayment?'active':''}"
              onclick="selectPayment('${p.id}')" data-pay="${p.id}">
              ${p.label}
            </button>`).join('')}
        </div>
      </div>

      <!-- Member lookup — แสดงเมื่อเลือก Member -->
      <div id="rec-member-section" style="display:${state.selectedPayment==='Member'?'block':'none'}">
        <div class="card member-lookup-card">
          <div class="form-label" style="margin-bottom:8px">🔍 ค้นหาสมาชิก (รหัส 4 หลัก)</div>
          <div class="search-row">
            <input class="form-input" id="rec-mem-code" type="number"
              inputmode="numeric" placeholder="0000" maxlength="4">
            <button class="btn-search" onclick="lookupRecordMember()">ค้นหา</button>
          </div>
          <div id="rec-mem-result"></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">📝 หมายเหตุ</label>
        <input class="form-input" id="rec-note" type="text" placeholder="เช่น สีที่ต้องการ">
      </div>

      <div id="rec-preview"></div>

      <button class="btn-primary" id="rec-submit-btn" onclick="submitRecord()">
        💾 บันทึกรายการ
      </button>
    </div>
  `;

  $('rec-price')?.addEventListener('input', updateCommPreview);
  $('rec-mem-code')?.addEventListener('keydown', e => { if(e.key==='Enter') lookupRecordMember(); });
}

function selectService(svcId) {
  state.selectedService = svcId;
  document.querySelectorAll('.svc-btn').forEach(btn => {
    const lbl = btn.querySelector('.svc-label')?.textContent;
    btn.classList.toggle('active', lbl === svcId);
  });
  const card = $('rec-price-card');
  if (card) { card.style.opacity='1'; card.style.pointerEvents='auto'; }
  $('rec-price')?.focus();
  updateCommPreview();
}

function selectPayment(payId) {
  state.selectedPayment = payId;
  document.querySelectorAll('.pay-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-pay') === payId);
  });
  const sec = $('rec-member-section');
  if (sec) sec.style.display = payId === 'Member' ? 'block' : 'none';
  if (payId !== 'Member') {
    state.recordMember = null;
    const res = $('rec-mem-result');
    if (res) res.innerHTML = '';
  }
  updateCommPreview();
}

async function lookupRecordMember() {
  const code = $('rec-mem-code')?.value.trim();
  if (!code || code.length !== 4) { showToast('กรอกรหัส 4 หลักด้วยค่ะ','error'); return; }
  const el = $('rec-mem-result');
  if (!el) return;
  el.innerHTML = `<div class="shimmer" style="height:60px;margin-top:10px;"></div>`;
  try {
    const result = await api_getMemberByCode(code);
    if (!result?.found) {
      el.innerHTML = `<div class="mem-not-found">ไม่พบสมาชิกรหัส <strong>${code}</strong></div>`;
      state.recordMember = null;
      return;
    }
    state.recordMember = result;
    const low = result.balance < 500;
    el.innerHTML = `
      <div class="rec-member-info ${low?'low-balance':''}">
        <div class="rec-member-name">✅ ${result.name}</div>
        <div class="rec-member-bal">ยอดคงเหลือ: <strong style="color:${low?'#EF4444':'#0FBA75'}">฿${Number(result.balance).toLocaleString()}</strong></div>
        ${low ? `<div class="rec-member-warn">⚠️ ยอดใกล้หมดค่ะ</div>` : ''}
      </div>`;
    updateCommPreview();
  } catch(err) {
    el.innerHTML = `<div class="mem-not-found">⚠️ ${err.message||'เชื่อมต่อไม่ได้'}</div>`;
    state.recordMember = null;
  }
}

function updateCommPreview() {
  const svc   = state.selectedService;
  const price = parseFloat($('rec-price')?.value) || 0;
  const rate  = COMMISSION_RATE[svc] || 0.10;
  const comm  = Math.round(price * rate);
  const el    = $('rec-preview');
  if (!el) return;

  let memberWarn = '';
  if (state.selectedPayment === 'Member' && state.recordMember && price > 0) {
    const after    = state.recordMember.balance - price;
    const overdrawn = after < 0;
    memberWarn = `
      <div class="member-deduct-preview ${overdrawn?'overdrawn':''}">
        <span>${overdrawn ? '⚠️ ยอดไม่พอ' : '🏷️ หักจากเมมเบอร์'}</span>
        <span>฿${Number(state.recordMember.balance).toLocaleString()} → <strong>฿${after.toLocaleString()}</strong></span>
      </div>`;
  }

  if (svc && price > 0) {
    el.innerHTML = `
      <div class="comm-preview">
        <span class="comm-preview-label">ค่าคอม</span>
        <span class="comm-preview-val">฿${comm.toLocaleString()}</span>
        <span class="comm-preview-rate">${(rate*100).toFixed(0)}%</span>
      </div>
      ${memberWarn}`;
  } else {
    el.innerHTML = memberWarn;
  }
}

async function submitRecord() {
  const svc   = state.selectedService;
  const price = parseFloat($('rec-price')?.value) || 0;
  const note  = $('rec-note')?.value.trim() || '';
  if (!svc)       { showToast('เลือกบริการก่อนนะคะ','error'); return; }
  if (price <= 0) { showToast('กรุณากรอกราคาค่ะ','error');    return; }

  if (state.selectedPayment === 'Member') {
    if (!state.recordMember) {
      showToast('กรุณาค้นหาสมาชิกก่อนค่ะ','error'); return;
    }
    if (state.recordMember.balance < price) {
      showToast('ยอดเมมเบอร์ไม่พอค่ะ','error'); return;
    }
  }

  const btn = $('rec-submit-btn');
  btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...';
  try {
    const payload = {
      userId: state.userId, staffName: state.staffName,
      service: svc, price, payment: state.selectedPayment, note,
    };
    if (state.selectedPayment === 'Member' && state.recordMember) {
      payload.memberCode = state.recordMember.memberCode;
      // ส่ง flag ให้ GAS ตัดยอดสมาชิกด้วย
      payload.deductMember = true;
    }

    const result = await api_saveRecord(payload);
    if (result.ok === false) throw new Error(result.error || 'บันทึกไม่สำเร็จ');

    showToast(`✅ บันทึก ${svc} ฿${price.toLocaleString()} แล้วค่ะ`, 'success');

    // update local member balance ถ้าชำระแบบ Member
    if (state.selectedPayment === 'Member' && state.recordMember) {
      state.recordMember.balance -= price;
    }

    // reset form
    state.selectedService = '';
    state.recordMember    = null;
    const priceEl = $('rec-price'); if (priceEl) priceEl.value = '';
    const noteEl  = $('rec-note');  if (noteEl)  noteEl.value  = '';
    const prev    = $('rec-preview'); if (prev) prev.innerHTML = '';
    document.querySelectorAll('.svc-btn').forEach(b => b.classList.remove('active'));
    const card = $('rec-price-card');
    if (card) { card.style.opacity='.45'; card.style.pointerEvents='none'; }

    await loadTodayRecords();
    goPage('home');
  } catch(err) {
    showToast('❌ '+(err.message||'เกิดข้อผิดพลาด'), 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 บันทึกรายการ';
  }
}

/* ══════════════════════════════════════════════
   MEMBER PAGE
══════════════════════════════════════════════ */
function renderMember() {
  const el = $('page-member');
  if (!el) return;
  el.innerHTML = `
    <div class="page-title">💳 สมาชิก</div>
    <div class="page-sub">ค้นหา · เติมเงิน · สมัครใหม่</div>

    <div class="card">
      <div class="card-title">🔍 ค้นหาด้วยรหัส 4 หลัก</div>
      <div class="search-row">
        <input class="form-input" id="mem-code" type="number"
          inputmode="numeric" placeholder="0000" maxlength="4">
        <button class="btn-search" onclick="searchMember()">ค้นหา</button>
      </div>
    </div>

    <div id="mem-result"></div>

    <div class="card">
      <div class="card-title">🆕 สมัครสมาชิกใหม่</div>
      <div class="form-group">
        <label class="form-label">เบอร์โทร</label>
        <input class="form-input" id="reg-phone" type="tel" inputmode="tel"
          placeholder="0812345678" maxlength="10">
      </div>
      <div class="form-group">
        <label class="form-label">ชื่อสมาชิก</label>
        <input class="form-input" id="reg-name" type="text" placeholder="ชื่อ-นามสกุล">
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">รหัส 4 หลัก</label>
          <input class="form-input" id="reg-code" type="number"
            inputmode="numeric" placeholder="1234" maxlength="4">
        </div>
        <div class="form-group">
          <label class="form-label">ยอดเปิด (฿)</label>
          <input class="form-input" id="reg-amount" type="number"
            inputmode="numeric" placeholder="0">
        </div>
      </div>
      <button class="btn-primary btn-green" onclick="registerMember()">
        🆕 สมัครสมาชิก
      </button>
    </div>
  `;
  $('mem-code')?.addEventListener('keydown', e => { if (e.key==='Enter') searchMember(); });
}

async function searchMember() {
  const code = $('mem-code')?.value.trim();
  if (!code || code.length !== 4) { showToast('กรุณากรอกรหัส 4 หลักค่ะ','error'); return; }
  const el = $('mem-result');
  if (!el) return;
  el.innerHTML = `<div class="shimmer" style="height:160px;margin-bottom:14px;"></div>`;
  try {
    const result = await api_getMemberByCode(code);
    if (!result?.found) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:32px 20px;color:var(--ink3)">
          <div style="font-size:40px;margin-bottom:8px;">🔍</div>
          ไม่พบสมาชิกรหัส <strong>${code}</strong>
        </div>`;
      state.member = null;
      return;
    }
    state.member = result;
    const m   = result;
    const low = m.balance < 500;
    el.innerHTML = `
      <div class="member-card">
        <div class="member-card-top">
          <div>
            <div class="member-card-name">${m.name}</div>
            <div class="member-card-code">รหัส ${m.memberCode} · ${m.phone||''}</div>
          </div>
          ${m.expiry ? `<div class="member-card-exp">หมดอายุ<br>${m.expiry}</div>` : ''}
        </div>
        <div class="member-card-bal-label">ยอดเงินคงเหลือ</div>
        <div class="member-card-bal" style="color:${low?'#FF9EC0':'#fff'}">
          ฿${Number(m.balance).toLocaleString()}
        </div>
        ${low ? `<div class="member-card-warn">⚠️ ยอดใกล้หมดแล้วค่ะ</div>` : ''}
      </div>
      <div class="action-row">
        <button class="btn-primary" onclick="showTopupModal()">💰 เติมเงิน</button>
      </div>`;
  } catch(err) {
    el.innerHTML = `<div class="card" style="color:#EF4444;text-align:center;padding:24px">⚠️ ${err.message||'เชื่อมต่อไม่ได้'}<br><small style="color:var(--ink3);font-size:12px;margin-top:8px;display:block">ตรวจสอบ GAS URL และการเชื่อมต่อค่ะ</small></div>`;
  }
}

function showTopupModal() {
  if (!state.member) return;
  const m = state.member;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg show" id="topup-modal"
      onclick="if(event.target===this)closeModal('topup-modal')">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">💰 เติมเงิน</div>
        <div class="modal-sub">${m.name} · ยอดปัจจุบัน ฿${Number(m.balance).toLocaleString()}</div>
        <div class="form-group">
          <label class="form-label">ยอดเงินที่จ่าย (฿)</label>
          <input class="form-input form-input-lg" id="topup-amount" type="number"
            inputmode="numeric" placeholder="0" min="0" step="100">
        </div>
        <div class="form-group">
          <label class="form-label">ช่องทางชำระ</label>
          <div class="pay-chips">
            ${PAYMENT_LIST.filter(p=>p.id!=='Member').map(p=>`
              <button class="pay-chip ${p.id==='Cash'?'active':''}"
                onclick="selectTopupPay('${p.id}')" data-tpay="${p.id}">
                ${p.label}
              </button>`).join('')}
          </div>
        </div>
        <div id="topup-preview"></div>
        <button class="btn-primary" onclick="doTopup()">✅ ยืนยันเติมเงิน</button>
        <div style="height:8px"></div>
        <button class="btn-secondary" onclick="closeModal('topup-modal')">ยกเลิก</button>
      </div>
    </div>
  `);
  $('topup-amount')?.addEventListener('input', updateTopupPreview);
  $('topup-amount')?.focus();
}

function selectTopupPay(payId) {
  document.querySelectorAll('[data-tpay]').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-tpay')===payId));
}

function updateTopupPreview() {
  const amount = parseFloat($('topup-amount')?.value) || 0;
  const cfg    = state.config;
  const tier   = amount>=20000?(cfg.TIER_20K||27000):amount>=10000?(cfg.TIER_10K||13000):amount>=5000?(cfg.TIER_5K||6000):amount;
  const bonus  = tier - amount;
  const el     = $('topup-preview');
  if (!el) return;
  if (amount > 0) {
    el.innerHTML = `
      <div class="topup-preview-box">
        <div class="topup-preview-label">จะได้รับเครดิต</div>
        <div class="topup-preview-val">฿${tier.toLocaleString()}</div>
        ${bonus>0?`<div class="topup-preview-bonus">โบนัส +฿${bonus.toLocaleString()}</div>`:''}
      </div>`;
  } else { el.innerHTML = ''; }
}

async function doTopup() {
  const amount  = parseFloat($('topup-amount')?.value) || 0;
  const payment = document.querySelector('[data-tpay].active')?.getAttribute('data-tpay') || 'Cash';
  if (amount <= 0) { showToast('กรอกยอดเงินด้วยค่ะ','error'); return; }
  try {
    const result = await api_topupMember({
      userId: state.userId, staffName: state.staffName,
      memberCode: state.member.memberCode, payAmount: amount, payment,
    });
    if (result.ok === false) throw new Error(result.error);
    showToast('✅ เติมเงินสำเร็จค่ะ','success');
    closeModal('topup-modal');
    // refresh member card
    await searchMember();
    await loadTodayRecords();
  } catch(err) { showToast('❌ '+(err.message||'เกิดข้อผิดพลาด'),'error'); }
}

async function registerMember() {
  const phone  = $('reg-phone')?.value.trim();
  const name   = $('reg-name')?.value.trim();
  const code   = $('reg-code')?.value.trim();
  const amount = parseFloat($('reg-amount')?.value) || 0;
  if (!phone||!name||!code||amount<=0) {
    showToast('กรุณากรอกข้อมูลให้ครบค่ะ','error'); return;
  }
  try {
    const result = await api_registerMember({
      userId: state.userId, staffName: state.staffName,
      phone, name, memberCode: code, amount,
    });
    if (result.ok === false) throw new Error(result.error);
    showToast(`✅ สมัครสมาชิก ${name} รหัส ${code} สำเร็จค่ะ`,'success');
    ['reg-phone','reg-name','reg-code','reg-amount'].forEach(id => {
      const el = $(id); if (el) el.value='';
    });
  } catch(err) { showToast('❌ '+(err.message||'เกิดข้อผิดพลาด'),'error'); }
}

/* ══════════════════════════════════════════════
   SUMMARY PAGE — แสดงข้อมูลจาก API + fallback local
══════════════════════════════════════════════ */
function renderSummary() {
  const el = $('page-summary');
  if (!el) return;
  el.innerHTML = `
    <div class="page-title">📊 สรุป<span>ยอด</span></div>
    <div class="page-sub">ค่าคอมของ ${state.staffName}</div>
    <div class="period-tabs">
      <button class="period-tab active" id="tab-day"   onclick="loadSummaryPeriod('day',this)">วันนี้</button>
      <button class="period-tab"        id="tab-week"  onclick="loadSummaryPeriod('week',this)">อาทิตย์นี้</button>
      <button class="period-tab"        id="tab-month" onclick="loadSummaryPeriod('month',this)">เดือนนี้</button>
    </div>
    <div id="summary-content">
      <div class="shimmer" style="height:140px;margin-bottom:14px;border-radius:18px;"></div>
      <div class="shimmer" style="height:180px;border-radius:18px;"></div>
    </div>
  `;
  loadSummaryPeriod('day', $('tab-day'));
}

async function loadSummaryPeriod(period, btn) {
  if (btn) {
    document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const el = $('summary-content');
  if (!el) return;
  el.innerHTML = `<div class="shimmer" style="height:200px;border-radius:18px;"></div>`;

  // ถ้า period=day ใช้ local records ก่อน (เร็วกว่า + ทำงานแม้ไม่มี GAS endpoint)
  if (period === 'day') {
    buildSummaryFromLocal(el);
    // ลองดึงจาก API เพิ่มเติม
    try {
      const result = await api_getSummary(state.userId, period);
      if (result && result.comm !== undefined) {
        renderSummaryResult(result, el);
      }
    } catch(e) { /* ใช้ local ที่แสดงไปแล้ว */ }
    return;
  }

  // week / month — ต้องดึงจาก API
  try {
    const result = await api_getSummary(state.userId, period);
    if (result && (result.comm !== undefined || result.byService)) {
      renderSummaryResult(result, el);
    } else {
      el.innerHTML = `<div class="card"><div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีข้อมูลค่ะ</div></div>`;
    }
  } catch(e) {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:32px 20px;color:var(--ink3)">
        <div style="font-size:40px;margin-bottom:8px;">🔌</div>
        <div style="font-size:14px;color:#EF4444;margin-bottom:6px;">เชื่อมต่อ API ไม่ได้ค่ะ</div>
        <div style="font-size:12px;">${e.message||'ตรวจสอบ GAS URL'}</div>
      </div>`;
  }
}

function buildSummaryFromLocal(el) {
  const recs = state.todayRecs.filter(r =>
    !['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service));
  const comm = Math.round(recs.reduce((s,r)=>s+r.price*(COMMISSION_RATE[r.service]||0.1),0));
  const byService = {};
  recs.forEach(r => {
    byService[r.service] = (byService[r.service] || { price:0, count:0 });
    byService[r.service].price += r.price;
    byService[r.service].count += 1;
  });
  renderSummaryResult({ comm, byServiceDetail: byService, count: recs.length, isFallback: true }, el);
}

function renderSummaryResult(data, el) {
  if (!el) el = $('summary-content');
  if (!el) return;

  const comm = data.comm || 0;
  // รองรับทั้ง byService (object ธรรมดา) และ byServiceDetail (มี count)
  const by   = data.byServiceDetail || data.byService || {};

  const rows = Object.entries(by).map(([svc, val]) => {
    const price = typeof val === 'object' ? val.price : val;
    const count = typeof val === 'object' ? val.count : '';
    const rate  = COMMISSION_RATE[svc] || 0.1;
    const c     = Math.round(price * rate);
    const col   = SVC_COLORS[svc] || '#999';
    return `
      <div class="summary-row">
        <div class="summary-dot" style="background:${col}"></div>
        <div class="summary-svc">${svc}${count?` <small style="color:var(--ink3)">(${count})</small>`:''}</div>
        <div>
          <div class="summary-comm">฿${c.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--ink3);text-align:right">฿${Number(price).toLocaleString()}</div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    ${data.isFallback ? `<div class="fallback-notice">📱 ข้อมูลจาก cache วันนี้</div>` : ''}
    <div class="comm-hero">
      <div class="comm-hero-label">ค่าคอมรวม</div>
      <div class="comm-hero-val">฿${comm.toLocaleString()}</div>
      ${data.count !== undefined ? `<div class="comm-hero-sub">${data.count} รายการ</div>` : ''}
    </div>
    ${rows ? `
    <div class="card">
      <div class="card-title">แยกตามบริการ</div>
      ${rows}
    </div>` : `<div class="card"><div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีรายการค่ะ</div></div>`}
  `;
}

/* ══════════════════════════════════════════════
   DATA LOADERS
══════════════════════════════════════════════ */
async function loadTodayRecords() {
  try {
    const r = await api_getTodayRecords(state.userId);
    if (r && Array.isArray(r.records)) state.todayRecs = r.records;
  } catch(e) { console.warn('loadTodayRecords:', e.message); }
}

async function loadConfig() {
  try {
    const c = await api_getConfig();
    if (c) state.config = c;
  } catch(e) {}
}

/* ══════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════ */
function closeModal(id) { document.getElementById(id)?.remove(); }

let _tt;
function showToast(msg, type='') {
  const t = $('toast') || document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), 3000);
}

function setupOfflineDetect() {
  const b = $('offline-banner'); if (!b) return;
  const u = () => b.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', u); window.addEventListener('offline', u); u();
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); state.deferredInstallPrompt = e; checkInstallPrompt();
  });
}

function checkInstallPrompt() {
  const p = $('install-prompt'); if (!p) return;
  if (state.deferredInstallPrompt && !localStorage.getItem('nk_install_dismissed'))
    p.classList.add('show');
}

function triggerInstall() {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  state.deferredInstallPrompt.userChoice.then(c => {
    if (c.outcome==='accepted') dismissInstall();
    state.deferredInstallPrompt = null;
  });
}

function dismissInstall() {
  localStorage.setItem('nk_install_dismissed','1');
  $('install-prompt')?.classList.remove('show');
}