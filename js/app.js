/* ═══════════════════════════════════════════════
   app.js — Nail Kloset Staff PWA
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

const SERVICE_LIST = ['ทำเล็บ', 'ต่อขนตา', 'สปามือ/เท้า', 'แว็กขน'];

const PAYMENT_LIST = [
  { id: 'Cash',     label: '💵 สด' },
  { id: 'Transfer', label: '📲 โอน' },
  { id: 'Credit',   label: '💳 รูด' },
];

const state = {
  userId: null, staffName: null, picture: '',
  page: 'home', todayRecs: [], config: {},
  member: null, selectedPayment: 'Cash',
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
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
    <div class="login-logo">💅 Nail Kloset</div>
    <div class="login-sub">Staff Portal</div>
    <div class="login-card">
      <div class="login-desc">
        ใส่ข้อมูลพนักงานครั้งแรกครั้งเดียว<br>
        <small>ระบบจะจำการเข้าสู่ระบบไว้อัตโนมัติ</small>
      </div>

      <label class="form-label">ชื่อพนักงาน</label>
      <input class="login-input" id="li-name" type="text"
        placeholder="เช่น Alex" autocomplete="off">

      <label class="form-label" style="margin-top:4px;">LINE UserID</label>
      <input class="login-input" id="li-userid" type="text"
        placeholder="U…" autocomplete="off"
        style="font-family: monospace; font-size:14px;">

      <div class="login-hint">
        💡 ดู LINE UserID ได้จาก Sheet "พนักงาน" คอลัมน์ A
      </div>

      <button class="btn-primary" style="margin-top:8px" onclick="doLogin()">
        เข้าสู่ระบบ →
      </button>
    </div>
  `;

  // กด Enter ที่ช่องไหนก็ login ได้
  setTimeout(() => {
    $('li-name')  ?.addEventListener('keydown', e => { if (e.key === 'Enter') $('li-userid').focus(); });
    $('li-userid')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }, 50);
}

async function doLogin() {
  const name   = $('li-name').value.trim();
  const userId = $('li-userid').value.trim();
  if (!name)   { showToast('กรุณากรอกชื่อพนักงานค่ะ', 'error'); $('li-name').focus();   return; }
  if (!userId) { showToast('กรุณากรอก LINE UserID ค่ะ', 'error'); $('li-userid').focus(); return; }
  if (!userId.startsWith('U')) {
    showToast('LINE UserID ต้องขึ้นต้นด้วย U ค่ะ', 'error');
    $('li-userid').focus(); return;
  }

  localStorage.setItem('nk_staff_name',   name);
  localStorage.setItem('nk_staff_userId', userId);
  state.staffName = name;
  state.userId    = userId;
  afterLogin();
}

async function afterLogin() {
  $('login-screen').classList.remove('show');
  renderAppShell();
  await loadConfig();
  await loadTodayRecords();
  hideLoading();
  goPage('home');
}

function doLogout() {
  if (!confirm('ออกจากระบบ?')) return;
  localStorage.removeItem('nk_staff_name');
  localStorage.removeItem('nk_staff_userId');
  localStorage.removeItem('nk_staff_picture');
  location.reload();
}

/* ══════════════════════════════════════════════
   APP SHELL
══════════════════════════════════════════════ */
function renderAppShell() {
  const avatarHTML = state.picture
    ? `<img src="${state.picture}" alt="${state.staffName}" class="staff-chip-avatar-img">`
    : `<div class="staff-chip-avatar">${state.staffName.slice(0,2)}</div>`;

  document.body.innerHTML = `
    <div id="offline-banner">⚡ ออฟไลน์อยู่ค่ะ ข้อมูลอาจล่าช้า</div>
    <div id="app">
      <div class="top-bar">
        <div class="top-logo">💅 Nail Kloset<small>Staff Portal</small></div>
        <div class="top-right">
          <div class="staff-chip">
            ${avatarHTML}
            <div class="staff-chip-name">${state.staffName}</div>
          </div>
        </div>
      </div>
      <div id="page-home"    class="page"></div>
      <div id="page-record"  class="page"></div>
      <div id="page-member"  class="page"></div>
      <div id="page-summary" class="page"></div>
      <nav class="bottom-nav">
        <button class="nav-item active" id="nav-home"    onclick="goPage('home')">   <span class="icon">🏠</span>หน้าหลัก</button>
        <button class="nav-item"        id="nav-record"  onclick="goPage('record')"> <span class="icon">✏️</span>บันทึกงาน</button>
        <button class="nav-item"        id="nav-member"  onclick="goPage('member')"> <span class="icon">💳</span>สมาชิก</button>
        <button class="nav-item"        id="nav-summary" onclick="goPage('summary')"><span class="icon">📊</span>สรุปยอด</button>
      </nav>
    </div>
    <div id="install-prompt">
      <span class="install-icon">📲</span>
      <div class="install-text">
        <strong>เพิ่มลงหน้าจอหลัก</strong>
        <small>เปิดแอปได้เร็วขึ้น</small>
      </div>
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
  if (ls) ls.classList.add('out');
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
  pageEl.scrollTop = 0;
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
  const recs = state.todayRecs.filter(r => !['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service));
  const total     = recs.reduce((s, r) => s + r.price, 0);
  const commTotal = Math.round(recs.reduce((s, r) => s + r.price * (COMMISSION_RATE[r.service] || 0.1), 0));
  const count     = recs.length;

  el.innerHTML = `
    <div class="page-title">สวัสดี <span>${state.staffName}</span> 👋</div>
    <div class="page-sub" id="home-date-lbl">—</div>
    <div class="stat-row">
      <div class="stat-box">
        <div class="s-val">฿${total.toLocaleString()}</div>
        <div class="s-lbl">รายรับวันนี้</div>
      </div>
      <div class="stat-box">
        <div class="s-val" style="color:var(--green)">฿${commTotal.toLocaleString()}</div>
        <div class="s-lbl">ค่าคอมรวม</div>
      </div>
      <div class="stat-box">
        <div class="s-val" style="color:var(--purple)">${count}</div>
        <div class="s-lbl">รายการ</div>
      </div>
    </div>
    <button class="btn-primary" onclick="goPage('record')" style="margin-bottom:16px">
      ✏️ บันทึกงานใหม่
    </button>
    <div class="card">
      <div class="card-title">📋 รายการวันนี้</div>
      <div id="home-tx-list">
        ${state.todayRecs.length === 0
          ? `<div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีรายการค่ะ</div>`
          : renderTxItems(state.todayRecs)}
      </div>
    </div>
    <button class="btn-secondary" onclick="doLogout()" style="margin-top:8px">
      🚪 ออกจากระบบ
    </button>
  `;

  const now    = new Date();
  const DAYS   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  $('home-date-lbl').textContent =
    `วัน${DAYS[now.getDay()]}ที่ ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()+543}`;
}

function renderTxItems(recs) {
  return recs.map(r => {
    const isMemSvc   = ['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service);
    const comm       = isMemSvc ? '' : ` · คอม ฿${Math.round(r.price*(COMMISSION_RATE[r.service]||0.1)).toLocaleString()}`;
    const badgeClass = r.payment === 'Member'   ? 'badge-member' :
                       r.payment === 'Transfer' ? 'badge-credit' :
                       r.payment === 'Credit'   ? 'badge-credit' : 'badge-cash';
    const badgeLabel = r.payment === 'Member'   ? 'เมม' :
                       r.payment === 'Transfer' ? 'โอน' :
                       r.payment === 'Credit'   ? 'รูด' : 'สด';
    const col = SVC_COLORS[r.service] || '#999';
    return `
      <div class="tx-item">
        <div class="tx-dot" style="background:${col}"></div>
        <div class="tx-info">
          <div class="tx-svc">${r.service}</div>
          <div class="tx-meta">${r.time || ''}${comm}</div>
        </div>
        <div class="tx-right">
          <span class="tx-badge ${badgeClass}">${badgeLabel}</span>
          <div class="tx-price">฿${r.price.toLocaleString()}</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   RECORD PAGE
══════════════════════════════════════════════ */
function renderRecord() {
  const el = $('page-record');
  el.innerHTML = `
    <div class="page-title">✏️ บันทึก<span>งาน</span></div>
    <div class="page-sub">เพิ่มรายการบริการวันนี้</div>
    <div class="card">
      <div class="form-group">
        <label class="form-label">💅 บริการ</label>
        <select class="form-select" id="rec-service">
          <option value="">-- เลือกบริการ --</option>
          ${SERVICE_LIST.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">💰 ราคา (บาท)</label>
        <input class="form-input" id="rec-price" type="number"
          inputmode="numeric" placeholder="0" min="0" step="1">
      </div>
      <div class="form-group">
        <label class="form-label">💳 การชำระเงิน</label>
        <div class="pay-chips" id="pay-chips">
          ${PAYMENT_LIST.map(p => `
            <button class="pay-chip ${p.id === state.selectedPayment ? 'active' : ''}"
              onclick="selectPayment('${p.id}')" data-pay="${p.id}">
              ${p.label}
            </button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">📝 หมายเหตุ (ถ้ามี)</label>
        <input class="form-input" id="rec-note" type="text" placeholder="เช่น สีที่ต้องการ">
      </div>
      <div id="rec-preview" style="display:none; margin-bottom:16px;">
        <div class="card" style="background:var(--rose-pale); border-color:var(--rose-light); margin-bottom:0;">
          <div style="font-size:13px; font-weight:700; color:var(--rose2); margin-bottom:4px;">ตัวอย่างค่าคอม</div>
          <div id="rec-comm-preview" style="font-size:22px; font-weight:700; font-family:var(--ff-mono); color:var(--rose);">—</div>
        </div>
      </div>
      <button class="btn-primary" id="rec-submit-btn" onclick="submitRecord()">
        💾 บันทึกรายการ
      </button>
    </div>
    <div class="card">
      <div class="card-title">⚡ บันทึกด่วน</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        ${SERVICE_LIST.map(s => `
          <button onclick="quickRecord('${s}')" style="
            padding:12px; border-radius:var(--radius-sm);
            border:1.5px solid var(--border); background:#fff;
            font-family:var(--ff); font-size:14px; font-weight:600;
            color:var(--ink2); cursor:pointer; min-height:48px;">${s}
          </button>`).join('')}
      </div>
    </div>
  `;
  $('rec-price').addEventListener('input', updateCommPreview);
  $('rec-service').addEventListener('change', updateCommPreview);
}

function selectPayment(payId) {
  state.selectedPayment = payId;
  document.querySelectorAll('.pay-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-pay') === payId);
  });
}

function updateCommPreview() {
  const svc   = $('rec-service').value;
  const price = parseFloat($('rec-price').value) || 0;
  const rate  = COMMISSION_RATE[svc] || 0.10;
  const comm  = Math.round(price * rate);
  const preview = $('rec-preview');
  if (svc && price > 0) {
    preview.style.display = 'block';
    $('rec-comm-preview').textContent = `฿${comm.toLocaleString()} (${(rate*100).toFixed(0)}%)`;
  } else {
    preview.style.display = 'none';
  }
}

function quickRecord(svc) {
  $('rec-service').value = svc;
  $('rec-price').focus();
  updateCommPreview();
}

async function submitRecord() {
  const svc   = $('rec-service').value;
  const price = parseFloat($('rec-price').value) || 0;
  const note  = $('rec-note').value.trim();
  if (!svc)       { showToast('เลือกบริการก่อนนะคะ', 'error'); return; }
  if (price <= 0) { showToast('กรุณากรอกราคาค่ะ',    'error'); return; }

  const btn = $('rec-submit-btn');
  btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...';
  try {
    const result = await api_saveRecord({
      userId: state.userId, staffName: state.staffName,
      service: svc, price, payment: state.selectedPayment, note,
    });
    if (result.ok === false) throw new Error(result.error);
    showToast(`✅ บันทึก ${svc} ฿${price.toLocaleString()} แล้วค่ะ`, 'success');
    $('rec-service').value = ''; $('rec-price').value = ''; $('rec-note').value = '';
    $('rec-preview').style.display = 'none';
    await loadTodayRecords();
    goPage('home');
  } catch (err) {
    showToast('❌ ' + (err.message || 'เกิดข้อผิดพลาด'), 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 บันทึกรายการ';
  }
}

/* ══════════════════════════════════════════════
   MEMBER PAGE
══════════════════════════════════════════════ */
function renderMember() {
  const el = $('page-member');
  el.innerHTML = `
    <div class="page-title">💳 สมาชิก</div>
    <div class="page-sub">ค้นหา เติมเงิน และตัดยอด</div>
    <div class="card">
      <div class="card-title">🔍 ค้นหาด้วยรหัส 4 หลัก</div>
      <div style="display:flex; gap:8px;">
        <input class="form-input" id="mem-code" type="number"
          inputmode="numeric" placeholder="รหัส 4 หลัก" maxlength="4"
          style="flex:1; margin-bottom:0;">
        <button class="btn-icon" onclick="searchMember()">🔍</button>
      </div>
    </div>
    <div id="mem-result"></div>
    <div class="card">
      <div class="card-title">🆕 สมัครสมาชิกใหม่</div>
      <div class="form-group">
        <label class="form-label">เบอร์โทร</label>
        <input class="form-input" id="reg-phone" type="tel" inputmode="tel" placeholder="0812345678" maxlength="10">
      </div>
      <div class="form-group">
        <label class="form-label">ชื่อสมาชิก</label>
        <input class="form-input" id="reg-name" type="text" placeholder="ชื่อ">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">รหัส 4 หลัก</label>
          <input class="form-input" id="reg-code" type="number" inputmode="numeric" placeholder="เช่น 1234" maxlength="4">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">ยอดเปิด (฿)</label>
          <input class="form-input" id="reg-amount" type="number" inputmode="numeric" placeholder="0">
        </div>
      </div>
      <button class="btn-primary btn-green" onclick="registerMember()">🆕 สมัครสมาชิก</button>
    </div>
  `;
  $('mem-code').addEventListener('keydown', e => { if (e.key === 'Enter') searchMember(); });
}

async function searchMember() {
  const code = $('mem-code').value.trim();
  if (!code || code.length !== 4) { showToast('กรุณากรอกรหัส 4 หลักค่ะ', 'error'); return; }
  const resultEl = $('mem-result');
  resultEl.innerHTML = `<div class="shimmer" style="height:140px; margin-bottom:14px;"></div>`;
  try {
    const result = await api_getMemberByCode(code);
    if (!result || !result.found) {
      resultEl.innerHTML = `
        <div class="card" style="text-align:center; color:var(--ink3);">
          <span style="font-size:36px;">🔍</span>
          <div style="margin-top:8px;">ไม่พบสมาชิกรหัส ${code} ค่ะ</div>
        </div>`;
      return;
    }
    state.member = result;
    const m = result; const lowBal = m.balance < 500;
    resultEl.innerHTML = `
      <div class="member-card">
        <div class="member-card-name">${m.name}</div>
        <div class="member-card-code">รหัส ${m.memberCode} · ${m.phone}</div>
        <div class="member-card-bal-lbl">ยอดเงินคงเหลือ</div>
        <div class="member-card-bal" style="color:${lowBal ? '#FF6B9D' : '#fff'}">
          ฿${m.balance.toLocaleString()}
        </div>
        ${m.expiry ? `<div class="member-card-exp">หมดอายุ: ${m.expiry}</div>` : ''}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
        <button class="btn-primary" onclick="showTopupModal()">💰 เติมเงิน</button>
        <button class="btn-secondary" style="color:var(--purple); border-color:var(--purple-pale);"
          onclick="showDeductInfo()">✂️ ข้อมูลตัด</button>
      </div>`;
  } catch (err) {
    resultEl.innerHTML = `<div class="card" style="color:#EF4444; text-align:center;">⚠️ ${err.message || 'เชื่อมต่อไม่ได้'}</div>`;
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
        <div class="modal-title">💰 เติมเงิน — ${m.name}</div>
        <div style="font-size:14px; color:var(--ink3); margin-bottom:16px;">
          ยอดปัจจุบัน ฿${m.balance.toLocaleString()}
        </div>
        <div class="form-group">
          <label class="form-label">ยอดเงินที่จ่าย (฿)</label>
          <input class="form-input" id="topup-amount" type="number"
            inputmode="numeric" placeholder="0" min="0" step="100">
        </div>
        <div class="form-group">
          <label class="form-label">ช่องทาง</label>
          <div class="pay-chips">
            ${PAYMENT_LIST.map(p => `
              <button class="pay-chip ${p.id === 'Cash' ? 'active' : ''}"
                onclick="selectTopupPay('${p.id}')" data-tpay="${p.id}">
                ${p.label}
              </button>`).join('')}
          </div>
        </div>
        <div id="topup-credit-preview" style="margin-bottom:16px;"></div>
        <button class="btn-primary" onclick="doTopup()">✅ ยืนยันเติมเงิน</button>
        <div style="height:10px;"></div>
        <button class="btn-secondary" onclick="closeModal('topup-modal')">ยกเลิก</button>
      </div>
    </div>
  `);
  $('topup-amount').addEventListener('input', updateTopupPreview);
}

function selectTopupPay(payId) {
  document.querySelectorAll('[data-tpay]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tpay') === payId);
  });
}

function updateTopupPreview() {
  const amount = parseFloat($('topup-amount').value) || 0;
  const cfg    = state.config;
  const tier   = amount >= 20000 ? (cfg.TIER_20K || 27000) :
                 amount >= 10000 ? (cfg.TIER_10K || 13000) :
                 amount >= 5000  ? (cfg.TIER_5K  || 6000)  : amount;
  const bonus  = tier - amount;
  const el     = $('topup-credit-preview');
  if (amount > 0) {
    el.innerHTML = `
      <div class="card" style="background:var(--green-pale); border-color:#A8E6CD; margin-bottom:0;">
        <div style="font-size:12px; font-weight:700; color:#0A7040; margin-bottom:4px;">จะได้รับเครดิต</div>
        <div style="font-size:24px; font-weight:700; font-family:var(--ff-mono); color:var(--green);">
          ฿${tier.toLocaleString()}
        </div>
        ${bonus > 0 ? `<div style="font-size:12px; color:#0A7040;">โบนัส +฿${bonus.toLocaleString()}</div>` : ''}
      </div>`;
  } else { el.innerHTML = ''; }
}

async function doTopup() {
  const amount  = parseFloat($('topup-amount').value) || 0;
  const payment = document.querySelector('[data-tpay].active')?.getAttribute('data-tpay') || 'Cash';
  if (amount <= 0) { showToast('กรอกยอดเงินด้วยค่ะ', 'error'); return; }
  try {
    const result = await api_topupMember({
      userId: state.userId, staffName: state.staffName,
      memberCode: state.member.memberCode, payAmount: amount, payment,
    });
    if (result.ok === false) throw new Error(result.error);
    showToast('✅ เติมเงินสำเร็จค่ะ', 'success');
    closeModal('topup-modal');
    await searchMember(); await loadTodayRecords();
  } catch (err) { showToast('❌ ' + (err.message || 'เกิดข้อผิดพลาด'), 'error'); }
}

function showDeductInfo() {
  if (!state.member) return;
  const m = state.member;
  showToast(`รหัส ${m.memberCode} · ยอด ฿${m.balance.toLocaleString()}`);
}

async function registerMember() {
  const phone  = $('reg-phone').value.trim();
  const name   = $('reg-name').value.trim();
  const code   = $('reg-code').value.trim();
  const amount = parseFloat($('reg-amount').value) || 0;
  if (!phone || !name || !code || amount <= 0) {
    showToast('กรุณากรอกข้อมูลให้ครบค่ะ', 'error'); return;
  }
  try {
    const result = await api_registerMember({
      userId: state.userId, staffName: state.staffName,
      phone, name, memberCode: code, amount,
    });
    if (result.ok === false) throw new Error(result.error);
    showToast(`✅ สมัครสมาชิก ${name} รหัส ${code} สำเร็จค่ะ`, 'success');
    $('reg-phone').value = ''; $('reg-name').value = '';
    $('reg-code').value  = ''; $('reg-amount').value = '';
  } catch (err) { showToast('❌ ' + (err.message || 'เกิดข้อผิดพลาด'), 'error'); }
}

/* ══════════════════════════════════════════════
   SUMMARY PAGE
══════════════════════════════════════════════ */
function renderSummary() {
  const el = $('page-summary');
  el.innerHTML = `
    <div class="page-title">📊 สรุป<span>ยอด</span></div>
    <div class="page-sub">ผลการทำงานของ ${state.staffName}</div>
    <div style="display:flex; gap:8px; margin-bottom:16px;">
      <button class="pay-chip active" onclick="loadSummaryPeriod('day', this)">วันนี้</button>
      <button class="pay-chip" onclick="loadSummaryPeriod('week', this)">อาทิตย์</button>
      <button class="pay-chip" onclick="loadSummaryPeriod('month', this)">เดือน</button>
    </div>
    <div id="summary-content">
      <div class="shimmer" style="height:100px; margin-bottom:14px;"></div>
      <div class="shimmer" style="height:160px; animation-delay:0.1s;"></div>
    </div>
  `;
  loadSummaryPeriod('day');
}

async function loadSummaryPeriod(period, btn) {
  if (btn) {
    document.querySelectorAll('#page-summary .pay-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const el = $('summary-content');
  el.innerHTML = `<div class="shimmer" style="height:200px;"></div>`;
  try {
    const result = await api_getSummary(state.userId, period);
    renderSummaryResult(result, period);
  } catch (err) { fallbackSummary(el); }
}

function fallbackSummary(el) {
  const recs  = state.todayRecs.filter(r =>
    !['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service));
  const total = recs.reduce((s, r) => s + r.price, 0);
  const comm  = Math.round(recs.reduce((s, r) => s + r.price*(COMMISSION_RATE[r.service]||0.1), 0));
  const byService = {};
  recs.forEach(r => { byService[r.service] = (byService[r.service] || 0) + r.price; });
  el.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="s-val">฿${total.toLocaleString()}</div><div class="s-lbl">รายรับ</div></div>
      <div class="stat-box"><div class="s-val" style="color:var(--green)">฿${comm.toLocaleString()}</div><div class="s-lbl">ค่าคอม</div></div>
    </div>
    <div class="card">
      <div class="card-title">💅 แยกตามบริการ</div>
      ${Object.entries(byService).map(([svc, val]) => `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
          <span style="font-size:14px; color:var(--ink2);">${svc}</span>
          <span style="font-size:14px; font-weight:700;">฿${val.toLocaleString()}</span>
        </div>`).join('')}
    </div>
    <div class="card" style="background:var(--rose-pale); border-color:var(--rose-light);">
      <div style="font-size:13px; color:var(--ink3); margin-bottom:2px;">ค่าคอมรวม</div>
      <div style="font-size:32px; font-weight:700; font-family:var(--ff-mono); color:var(--rose);">
        ฿${comm.toLocaleString()}
      </div>
    </div>`;
}

function renderSummaryResult(data) {
  const el = $('summary-content');
  const total = data.total || 0, comm = data.comm || 0;
  el.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="s-val">฿${total.toLocaleString()}</div><div class="s-lbl">รายรับ</div></div>
      <div class="stat-box"><div class="s-val" style="color:var(--green)">฿${comm.toLocaleString()}</div><div class="s-lbl">ค่าคอม</div></div>
    </div>
    <div class="card" style="background:var(--rose-pale); border-color:var(--rose-light);">
      <div style="font-size:13px; color:var(--ink3); margin-bottom:2px;">ค่าคอมรวม</div>
      <div style="font-size:32px; font-weight:700; font-family:var(--ff-mono); color:var(--rose);">
        ฿${comm.toLocaleString()}
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════════ */
async function loadTodayRecords() {
  try {
    const result = await api_getTodayRecords(state.userId);
    if (result.records) state.todayRecs = result.records;
  } catch (err) { console.warn('loadTodayRecords:', err.message); }
}

async function loadConfig() {
  try {
    const cfg = await api_getConfig();
    if (cfg) state.config = cfg;
  } catch (err) { console.warn('loadConfig:', err.message); }
}

/* ══════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════ */
function closeModal(id) { const el = document.getElementById(id); if (el) el.remove(); }

let _toastTimer;
function showToast(msg, type = '') {
  const t = $('toast') || document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function setupOfflineDetect() {
  const banner = $('offline-banner');
  if (!banner) return;
  const update = () => banner.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    checkInstallPrompt();
  });
}

function checkInstallPrompt() {
  const prompt = $('install-prompt'); if (!prompt) return;
  if (state.deferredInstallPrompt && !localStorage.getItem('nk_install_dismissed')) {
    prompt.classList.add('show');
  }
}

function triggerInstall() {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  state.deferredInstallPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') dismissInstall();
    state.deferredInstallPrompt = null;
  });
}

function dismissInstall() {
  localStorage.setItem('nk_install_dismissed', '1');
  const prompt = $('install-prompt'); if (prompt) prompt.classList.remove('show');
}