/* ═══════════════════════════════════════════════
   app.js — Nail Kloset Staff PWA
   แก้ไข:
   1. ค้นหาสมาชิกบันทึกงาน: timeout สั้นลง + skeleton ชัดขึ้น
   2. สมัครสมาชิก: แก้ field validation + error message ชัดขึ้น
   3. หน้าสมาชิก: ยอดเงินเห็นชัด + รีเฟรชยอดล่าสุดหลังเติมเงิน
   4. บันทึกงานตัดเมมเบอร์: บันทึก memberCode + memberName เหมือนตอนเติมเงิน
   5. [FIX] ทุกช่อง input รหัสสมาชิก: type="text" + maxlength=4 + oninput กันพิมพ์เกิน
═══════════════════════════════════════════════ */

const SVC_COLORS = {
  'ทำเล็บ':        '#FF2D78',
  'ต่อขนตา':       '#7C3AED',
  'สปามือ/เท้า':   '#0EA5AA',
  'แว็กขน':        '#F59E0B',
  'เติมเงินสมาชิก': '#3B82F6',
  'เปิดเมมเบอร์ใหม่':'#3B82F6',
};

const COMMISSION_RATE = {
  'ทำเล็บ':       0.10,
  'ต่อขนตา':      0.15,
  'สปามือ/เท้า':  0.10,
  'แว็กขน':       0.10,
};

const SERVICE_LIST = [
  { id: 'ทำเล็บ',       icon: '💅', color: '#FF2D78', bg: '#FFF0F4' },
  { id: 'ต่อขนตา',      icon: '👁',  color: '#7C3AED', bg: '#EDE8F7' },
  { id: 'สปามือ/เท้า',  icon: '🧴', color: '#0EA5AA', bg: '#D7F7EC' },
  { id: 'แว็กขน',       icon: '✨', color: '#F59E0B', bg: '#FEF3DC' },
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
   HELPER: code input oninput handler (ใช้ร่วมกันทุกช่อง)
   - รับเฉพาะตัวเลข 0-9
   - ตัดเหลือแค่ 4 ตัวพอดี
   - แสดง visual feedback
══════════════════════════════════════════════ */
function onCodeInput(el) {
  // กรองเฉพาะตัวเลข แล้วตัดเหลือ 4 ตัว
  const cleaned = el.value.replace(/[^0-9]/g, '').slice(0, 4);
  el.value = cleaned;

  // visual feedback: สีขอบเปลี่ยนตามจำนวนหลัก
  el.classList.remove('code-input--partial', 'code-input--full', 'code-input--empty');
  if (cleaned.length === 0) {
    el.classList.add('code-input--empty');
  } else if (cleaned.length === 4) {
    el.classList.add('code-input--full');
  } else {
    el.classList.add('code-input--partial');
  }
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  registerSW();
  setupOfflineDetect();
  setupInstallPrompt();
  setupKeyboardDetect();
  checkLogin();
});

function registerSW() {
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

function setupKeyboardDetect() {
  if (!window.visualViewport) return;
  const THRESHOLD = 150;
  function onViewportChange() {
    const diff = window.innerHeight - window.visualViewport.height;
    document.body.classList.toggle('keyboard-open', diff > THRESHOLD);
  }
  window.visualViewport.addEventListener('resize', onViewportChange);
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
   APP SHELL
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
  setupKeyboardDetect();
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
  if (page === 'member') {
    renderMember();
    switchMemberTab(_memTab || 'search');
  }
  if (page === 'summary') renderSummary();
}

/* ══════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════ */
function renderHome() {
  const el = $('page-home');
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
      <div class="comm-hero-val" id="home-comm-val">฿${comm.toLocaleString()}</div>
      <div class="comm-hero-sub" id="home-comm-count">${count} รายการ</div>
    </div>
    <div class="card">
      <div class="card-title">📋 รายการวันนี้</div>
      <div id="home-tx-list">
        ${state.todayRecs.length === 0
          ? `<div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีรายการค่ะ</div>`
          : renderTxItems(state.todayRecs)}
      </div>
    </div>
  `;
}

function refreshHomeStats() {
  const recs  = state.todayRecs.filter(r =>
    !['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service));
  const comm  = Math.round(recs.reduce((s,r) => s + r.price*(COMMISSION_RATE[r.service]||0.1), 0));
  const count = recs.length;

  const commEl  = $('home-comm-val');
  const countEl = $('home-comm-count');
  const listEl  = $('home-tx-list');

  if (commEl)  commEl.textContent  = `฿${comm.toLocaleString()}`;
  if (countEl) countEl.textContent = `${count} รายการ`;
  if (listEl)  listEl.innerHTML    = state.todayRecs.length === 0
    ? `<div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีรายการค่ะ</div>`
    : renderTxItems(state.todayRecs);
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

    const memberInfo = (r.payment === 'Member' && (r.memberName || r.memberCode))
      ? ` · ${r.memberName || ''}${r.memberCode ? ` (${r.memberCode})` : ''}`
      : '';

    return `
      <div class="tx-item">
        <div class="tx-dot" style="background:${col}"></div>
        <div class="tx-info">
          <div class="tx-svc">${r.service}</div>
          <div class="tx-meta">${r.time||''}${commStr ? ' · '+commStr : ''}${memberInfo}</div>
        </div>
        <div class="tx-right">
          <span class="tx-badge ${badgeClass}">${badgeLabel}</span>
          <div class="tx-price">฿${Number(r.price).toLocaleString()}</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   RECORD PAGE
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
           inputmode="numeric" placeholder="0" min="0" step="1"
           readonly onfocus="this.removeAttribute('readonly')">
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
            <!-- ✅ FIX: type="text" + maxlength + oninput กันพิมพ์เกิน 4 -->
            <input class="form-input code-input" id="rec-mem-code"
              type="text"
              inputmode="numeric"
              placeholder="_ _ _ _"
              maxlength="4"
              pattern="[0-9]{4}"
              autocomplete="off"
              oninput="onCodeInput(this)">
            <button class="btn-search" id="rec-mem-search-btn" onclick="lookupRecordMember()">ค้นหา</button>
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

/* ══════════════════════════════════════════════
   ค้นหาสมาชิกหน้าบันทึกงาน
══════════════════════════════════════════════ */
async function lookupRecordMember() {
  const raw  = $('rec-mem-code')?.value.replace(/[^0-9]/g, '');
  const code = raw?.padStart(4, '0');

  if (!raw || raw.length !== 4) {
    showToast('กรอกรหัส 4 หลักให้ครบด้วยค่ะ','error');
    $('rec-mem-code')?.focus();
    return;
  }

  const el    = $('rec-mem-result');
  const btn   = $('rec-mem-search-btn');
  if (!el) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding:12px;
      background:var(--surface2);border-radius:var(--radius-xs);">
      <div class="shimmer" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div class="shimmer" style="height:14px;border-radius:6px;margin-bottom:6px;width:60%;"></div>
        <div class="shimmer" style="height:12px;border-radius:6px;width:40%;"></div>
      </div>
    </div>`;

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
        <div class="rec-member-bal">ยอดคงเหลือ: <strong style="color:${low?'#EF4444':'#10B981'}">฿${Number(result.balance).toLocaleString()}</strong></div>
        ${low ? `<div class="rec-member-warn">⚠️ ยอดใกล้หมดค่ะ</div>` : ''}
      </div>`;
    updateCommPreview();
  } catch(err) {
    el.innerHTML = `<div class="mem-not-found">⚠️ ${err.message||'เชื่อมต่อไม่ได้'}</div>`;
    state.recordMember = null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ค้นหา'; }
  }
}

function updateCommPreview() {
  const svc   = state.selectedService;
  const price = parseFloat($('rec-price')?.value) || 0;
  const rate  = COMMISSION_RATE[svc] || 0.10;
  const comm  = Math.round(price * rate);
  const el    = $('rec-preview');
  if (!el) return;

  // ── คำนวณค่าธรรมเนียมรูดบัตร ──
  let creditFeeHtml = '';
   if (state.selectedPayment === 'Credit' && price > 0 && price < 2000) {
    const fee      = Math.round(price * 0.03);
    const totalGet = price + fee;  // ← บวกแทน
    creditFeeHtml = `
      <div class="credit-fee-preview">
        <div class="credit-fee-row">
          <span>💳 บวกเพิ่ม 3% (รูดต่ำกว่า ฿2,000)</span>
          <span class="credit-fee-amt">+฿${fee.toLocaleString()}</span>
        </div>
        <div class="credit-fee-row credit-fee-net">
          <span>ยอดที่เรียกเก็บจริง</span>
          <span>฿${totalGet.toLocaleString()}</span>
        </div>
      </div>`;
  }

  let memberWarn = '';
  if (state.selectedPayment === 'Member' && state.recordMember && price > 0) {
    const after     = state.recordMember.balance - price;
    const overdrawn = after < 0;
    memberWarn = `
      <div class="member-deduct-preview ${overdrawn ? 'overdrawn' : ''}">
        <span>${overdrawn ? '⚠️ ยอดไม่พอ' : '🏷️ หักจากเมมเบอร์'}</span>
        <span>฿${Number(state.recordMember.balance).toLocaleString()} → <strong>฿${after.toLocaleString()}</strong></span>
      </div>`;
  }

  if (svc && price > 0) {
    el.innerHTML = `
      ${creditFeeHtml}
      <div class="comm-preview">
        <span class="comm-preview-label">ค่าคอม</span>
        <span class="comm-preview-val">฿${comm.toLocaleString()}</span>
        <span class="comm-preview-rate">${(rate * 100).toFixed(0)}%</span>
      </div>
      ${memberWarn}`;
  } else {
    el.innerHTML = creditFeeHtml + memberWarn;
  }
}

/* ══════════════════════════════════════════════
   submitRecord — บันทึก memberCode + memberName
══════════════════════════════════════════════ */
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

  const now     = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const newRec  = {
    service:    svc,
    price,
    payment:    state.selectedPayment,
    note,
    time:       timeStr,
    memberCode: state.recordMember?.memberCode || '',
    memberName: state.recordMember?.name       || '',
    _optimistic: true,
  };
  state.todayRecs.unshift(newRec);
  if (state.page === 'home') refreshHomeStats();

  try {
    const payload = {
      userId:    state.userId,
      staffName: state.staffName,
      service:   svc,
      price,
      payment:   state.selectedPayment,
      note,
    };

    if (state.selectedPayment === 'Member' && state.recordMember) {
      payload.memberCode   = state.recordMember.memberCode;
      payload.memberName   = state.recordMember.name;
      payload.deductMember = true;
    }

    const result = await api_saveRecord(payload);
    if (result.ok === false) throw new Error(result.error || 'บันทึกไม่สำเร็จ');

    const idx = state.todayRecs.findIndex(r => r._optimistic);
    if (idx !== -1) {
      state.todayRecs[idx]._optimistic = false;
      if (result.rowId) state.todayRecs[idx].rowId = result.rowId;
    }

    const memberMsg = state.selectedPayment === 'Member' && state.recordMember
      ? ` (ตัด ${state.recordMember.name})`
      : '';
    showToast(`✅ บันทึก ${svc} ฿${price.toLocaleString()}${memberMsg} แล้วค่ะ`, 'success');

    if (state.selectedPayment === 'Member' && state.recordMember) {
      state.recordMember.balance -= price;
    }

    state.selectedService = '';
    state.recordMember    = null;

    goPage('home');
    loadTodayRecords().then(() => refreshHomeStats());

  } catch(err) {
    state.todayRecs = state.todayRecs.filter(r => !r._optimistic);
    if (state.page === 'home') refreshHomeStats();
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
    <div class="page-title">💳 <span>สมาชิก</span></div>
    <div class="page-sub">ค้นหา · เติมเงิน · สมัครใหม่</div>

    <div style="display:flex;gap:0;background:var(--surface2);border-radius:14px;padding:4px;margin-bottom:16px;">
      <button id="mem-tab-btn-search"
        style="flex:1;padding:11px 6px;border:none;background:linear-gradient(135deg,var(--pink),var(--pink2));color:#fff;border-radius:12px;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;"
        onclick="switchMemberTab('search')">🔍 ค้นหา</button>
      <button id="mem-tab-btn-topup"
        style="flex:1;padding:11px 6px;border:none;background:transparent;color:var(--text3);border-radius:12px;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;"
        onclick="switchMemberTab('topup')">💰 เติมเงิน</button>
      <button id="mem-tab-btn-register"
        style="flex:1;padding:11px 6px;border:none;background:transparent;color:var(--text3);border-radius:12px;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;"
        onclick="switchMemberTab('register')">🆕 สมัคร</button>
    </div>

    <!-- ค้นหา -->
    <div id="mem-pane-search">
      <div class="card">
        <div class="card-title">🔍 ค้นหาด้วยรหัส 4 หลัก</div>
        <div class="search-row">
          <!-- ✅ FIX: type="text" + maxlength + oninput -->
          <input class="form-input code-input" id="mem-code"
            type="text"
            inputmode="numeric"
            placeholder="_ _ _ _"
            maxlength="4"
            pattern="[0-9]{4}"
            autocomplete="off"
            oninput="onCodeInput(this)">
          <button class="btn-search" id="mem-search-btn" onclick="searchMember()">ค้นหา</button>
        </div>
      </div>
      <div id="mem-result"></div>
    </div>

    <!-- เติมเงิน -->
    <div id="mem-pane-topup" style="display:none;">
      <div class="card">
        <div class="card-title">💰 เติมเงินสมาชิก</div>
        <div class="form-group">
          <label class="form-label">รหัสสมาชิก 4 หลัก</label>
          <div class="search-row">
            <!-- ✅ FIX: type="text" + maxlength + oninput -->
            <input class="form-input code-input" id="topup-code-tab"
              type="text"
              inputmode="numeric"
              placeholder="_ _ _ _"
              maxlength="4"
              pattern="[0-9]{4}"
              autocomplete="off"
              oninput="onCodeInput(this)">
            <button class="btn-search" id="topup-lookup-btn" onclick="lookupTopupTab()">ค้นหา</button>
          </div>
        </div>
        <div id="topup-tab-member-info"></div>
        <div id="topup-tab-form" style="display:none;">
          <div class="form-group">
            <label class="form-label">ยอดที่จ่าย (บาท)</label>
            <input class="form-input form-input-lg" id="topup-tab-amount" type="number"
              inputmode="numeric" placeholder="0" oninput="updateTopupTabPreview()">
          </div>
          <div class="form-group">
            <label class="form-label">ช่องทางชำระ</label>
            <div class="pay-chips" id="topup-tab-pay-chips">
              <button class="pay-chip active" data-pay="Cash"     onclick="selectTopupTabPay(this)">💵 สด</button>
              <button class="pay-chip"        data-pay="Transfer" onclick="selectTopupTabPay(this)">📲 โอน</button>
              <button class="pay-chip"        data-pay="Credit"   onclick="selectTopupTabPay(this)">💳 รูด</button>
            </div>
          </div>
          <div id="topup-tab-preview"></div>
          <button class="btn-primary btn-green" onclick="doTopupTab()">✅ ยืนยันเติมเงิน</button>
          <div style="height:8px"></div>
          <button class="btn-secondary" onclick="resetTopupTab()">ยกเลิก</button>
        </div>
      </div>
    </div>

    <!-- สมัครสมาชิก -->
    <div id="mem-pane-register" style="display:none;">
      <div class="card">
        <div class="card-title">🆕 สมัครสมาชิกใหม่</div>
        <div class="register-hint">
          💡 กรอกข้อมูลให้ครบทุกช่อง · รหัส 4 หลักต้องไม่ซ้ำกับสมาชิกอื่น
        </div>
        <div class="form-group">
          <label class="form-label">ชื่อสมาชิก</label>
          <input class="form-input" id="reg-name-tab" type="text"
            placeholder="ชื่อ-นามสกุล" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">เบอร์โทร</label>
          <input class="form-input" id="reg-phone-tab"
            type="tel"
            inputmode="tel"
            placeholder="0812345678"
            maxlength="10"
            oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)">
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">รหัส 4 หลัก</label>
            <!-- ✅ FIX: ใช้ onCodeInput เหมือนกันทุกช่อง + style พิเศษ -->
            <input class="form-input code-input code-input--register" id="reg-code-tab"
              type="text"
              inputmode="numeric"
              placeholder="_ _ _ _"
              maxlength="4"
              pattern="[0-9]{4}"
              autocomplete="off"
              oninput="onCodeInput(this)"
              style="letter-spacing:8px;font-size:22px;font-family:var(--ff-mono);text-align:center;">
          </div>
          <div class="form-group">
            <label class="form-label">ยอดเปิด (฿)</label>
            <input class="form-input" id="reg-amount-tab" type="number"
              inputmode="numeric" placeholder="0" oninput="updateRegTabPreview()">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">💳 ชำระด้วย</label>
          <div class="pay-chips" id="reg-pay-chips">
            <button class="pay-chip active" data-pay="Cash"     onclick="selectRegPay(this)">💵 สด</button>
            <button class="pay-chip"        data-pay="Transfer" onclick="selectRegPay(this)">📲 โอน</button>
            <button class="pay-chip"        data-pay="Credit"   onclick="selectRegPay(this)">💳 รูด</button>
          </div>
        </div>
        <div id="reg-tab-preview"></div>
        <button class="btn-primary btn-violet" id="reg-submit-btn" onclick="registerMemberTab()">🆕 สมัครสมาชิก</button>
      </div>
    </div>
  `;

  $('mem-code')?.addEventListener('keydown',        e => { if (e.key === 'Enter') searchMember(); });
  $('topup-code-tab')?.addEventListener('keydown',  e => { if (e.key === 'Enter') lookupTopupTab(); });
  $('reg-code-tab')?.addEventListener('keydown',    e => { if (e.key === 'Enter') $('reg-amount-tab')?.focus(); });
}

// ── Member Tabs ───────────────────────────────────────────────
let _memTab = 'search';

function switchMemberTab(tab) {
  _memTab = tab;
  const tabColors = {
    search:   'linear-gradient(135deg,var(--pink),var(--pink2))',
    topup:    'linear-gradient(135deg,#059669,#10B981)',
    register: 'linear-gradient(135deg,#6D28D9,#7C3AED)',
  };
  ['search','topup','register'].forEach(t => {
    const pane = $('mem-pane-' + t);
    const btn  = $('mem-tab-btn-' + t);
    if (!pane || !btn) return;
    if (t === tab) {
      pane.style.display = '';
      btn.style.background = tabColors[t];
      btn.style.color = '#fff';
    } else {
      pane.style.display = 'none';
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text3)';
    }
  });
}

// ── ค้นหาสมาชิก Tab ──────────────────────────────────────────
async function searchMember() {
  const raw  = $('mem-code')?.value.replace(/[^0-9]/g, '');
  const code = raw?.padStart(4, '0');

  if (!raw || raw.length !== 4) {
    showToast('กรุณากรอกรหัส 4 หลักให้ครบค่ะ','error');
    $('mem-code')?.focus();
    return;
  }

  const el  = $('mem-result');
  const btn = $('mem-search-btn');
  if (!el) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  el.innerHTML = `
    <div class="card">
      <div class="shimmer" style="height:20px;border-radius:6px;margin-bottom:10px;width:50%;"></div>
      <div class="shimmer" style="height:14px;border-radius:6px;margin-bottom:20px;width:70%;"></div>
      <div class="shimmer" style="height:80px;border-radius:12px;"></div>
    </div>`;

  try {
    const result = await api_getMemberByCode(code);
    if (!result?.found) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:32px 20px;">
          <div style="font-size:40px;margin-bottom:8px;">🔍</div>
          <div style="color:var(--text3);font-size:14px;">ไม่พบสมาชิกรหัส <strong>${code}</strong></div>
        </div>`;
      state.member = null;
      return;
    }
    state.member = result;
    renderMemberCard(result, el);
  } catch(err) {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:24px;">
        <div style="color:var(--red);font-size:14px;margin-bottom:6px;">⚠️ ${err.message||'เชื่อมต่อไม่ได้'}</div>
        <div style="font-size:12px;color:var(--text3);">ตรวจสอบ GAS URL และการเชื่อมต่อค่ะ</div>
      </div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ค้นหา'; }
  }
}

function renderMemberCard(m, el) {
  const low = m.balance < 500;
  const balColor = low ? '#EF4444' : '#1A0F2E';

  el.innerHTML = `
    <div class="member-card">
      <div class="member-card-top">
        <div>
          <div class="member-card-name">${m.name}</div>
          <div class="member-card-code">รหัส ${m.memberCode}${m.phone ? ' · ' + m.phone : ''}</div>
        </div>
        ${m.expiry ? `<div class="member-card-exp">หมดอายุ<br>${m.expiry}</div>` : ''}
      </div>
      <div class="member-card-bal-section">
        <div class="member-card-bal-label">ยอดเงินคงเหลือ</div>
        <div class="member-card-bal" style="color:${balColor}">
          ฿${Number(m.balance).toLocaleString()}
        </div>
        ${low ? `<div class="member-card-warn">⚠️ ยอดใกล้หมดแล้วค่ะ</div>` : ''}
      </div>
    </div>
    <div class="action-row">
      <button class="btn-primary" onclick="switchMemberTab('topup');autoFillTopupCode('${m.memberCode}')">
        💰 เติมเงิน
      </button>
    </div>`;
}

function autoFillTopupCode(code) {
  const inp = $('topup-code-tab');
  if (inp) {
    inp.value = code;
    onCodeInput(inp); // trigger visual feedback ด้วย
    lookupTopupTab();
  }
}

// ── เติมเงิน Tab ──────────────────────────────────────────────
let _topupTabMember = null;

async function lookupTopupTab() {
  const raw  = $('topup-code-tab')?.value.replace(/[^0-9]/g, '');
  const code = raw?.padStart(4, '0');

  if (!raw || raw.length !== 4) {
    showToast('กรอกรหัส 4 หลักให้ครบด้วยค่ะ', 'error');
    $('topup-code-tab')?.focus();
    return;
  }

  const infoEl = $('topup-tab-member-info');
  const formEl = $('topup-tab-form');
  const btn    = $('topup-lookup-btn');
  if (!infoEl || !formEl) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  infoEl.innerHTML = `<div class="shimmer" style="height:64px;margin-bottom:12px;border-radius:12px;"></div>`;

  try {
    const result = await api_getMemberByCode(code);
    if (!result?.found) {
      infoEl.innerHTML = `<div class="mem-not-found">❌ ไม่พบสมาชิกรหัส <strong>${code}</strong></div>`;
      formEl.style.display = 'none';
      _topupTabMember = null;
      return;
    }
    _topupTabMember = result;
    const low = result.balance < 500;
    infoEl.innerHTML = `
      <div class="rec-member-info ${low ? 'low-balance' : ''}" style="margin-bottom:12px;">
        <div class="rec-member-name">✅ ${result.name}</div>
        <div class="rec-member-bal">
          ยอดคงเหลือ: <strong style="color:${low ? '#EF4444' : '#10B981'}">
            ฿${Number(result.balance).toLocaleString()}
          </strong>
        </div>
        ${low ? `<div class="rec-member-warn">⚠️ ยอดใกล้หมดค่ะ</div>` : ''}
      </div>`;
    formEl.style.display = '';
    const amtEl = $('topup-tab-amount');
    if (amtEl) amtEl.value = '';
    const preEl = $('topup-tab-preview');
    if (preEl) preEl.innerHTML = '';
  } catch(err) {
    infoEl.innerHTML = `<div class="mem-not-found">⚠️ ${err.message || 'เชื่อมต่อไม่ได้'}</div>`;
    formEl.style.display = 'none';
    _topupTabMember = null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ค้นหา'; }
  }
}

function selectTopupTabPay(btn) {
  document.querySelectorAll('#topup-tab-pay-chips .pay-chip')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function updateTopupTabPreview() {
  const amount = parseFloat($('topup-tab-amount')?.value) || 0;
  const cfg    = state.config || {};
  const credit = calcCredit(amount, cfg);
  const bonus  = credit - amount;
  const el     = $('topup-tab-preview');
  if (!el) return;
  if (amount > 0) {
    el.innerHTML = `
      <div class="topup-preview-box">
        <div class="topup-preview-label">เครดิตที่ได้รับ</div>
        <div class="topup-preview-val">฿${credit.toLocaleString()}</div>
        ${bonus > 0 ? `<div class="topup-preview-bonus">โบนัส +฿${bonus.toLocaleString()}</div>` : ''}
      </div>`;
  } else {
    el.innerHTML = '';
  }
}

async function doTopupTab() {
  if (!_topupTabMember) { showToast('กรุณาค้นหาสมาชิกก่อนค่ะ', 'error'); return; }
  const amount  = parseFloat($('topup-tab-amount')?.value) || 0;
  const payment = document.querySelector('#topup-tab-pay-chips .pay-chip.active')
                    ?.getAttribute('data-pay') || 'Cash';
  if (amount <= 0) { showToast('กรุณาระบุยอดเงินค่ะ', 'error'); return; }

  const btn = document.querySelector('#mem-pane-topup .btn-green');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังเติมเงิน...'; }

  try {
    const result = await api_topupMember({
      userId:     state.userId,
      staffName:  state.staffName,
      memberCode: _topupTabMember.memberCode,
      memberName: _topupTabMember.name,
      payAmount:  amount,
      payment,
    });
    if (result.ok === false) throw new Error(result.error);
    showToast(`✅ เติมเงิน ${_topupTabMember.name} สำเร็จค่ะ`, 'success');
    resetTopupTab();
    await loadTodayRecords();
  } catch(err) {
    showToast('❌ ' + (err.message || 'เกิดข้อผิดพลาด'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยันเติมเงิน'; }
  }
}

function resetTopupTab() {
  _topupTabMember = null;
  const codeEl = $('topup-code-tab');
  if (codeEl) { codeEl.value = ''; onCodeInput(codeEl); }
  if ($('topup-tab-amount'))      $('topup-tab-amount').value = '';
  if ($('topup-tab-member-info')) $('topup-tab-member-info').innerHTML = '';
  if ($('topup-tab-form'))        $('topup-tab-form').style.display = 'none';
  if ($('topup-tab-preview'))     $('topup-tab-preview').innerHTML = '';
  document.querySelectorAll('#topup-tab-pay-chips .pay-chip')
    .forEach((b,i) => b.classList.toggle('active', i === 0));
}

// ── สมัครสมาชิก Tab ───────────────────────────────────────────

function updateRegTabPreview() {
  const amount = parseFloat($('reg-amount-tab')?.value) || 0;
  const credit = calcCredit(amount, state.config || {});
  const bonus  = credit - amount;
  const el     = $('reg-tab-preview');
  if (!el) return;
  if (amount > 0) {
    el.innerHTML = `
      <div class="topup-preview-box" style="margin-bottom:12px;">
        <div class="topup-preview-label">เครดิตที่ได้รับ</div>
        <div class="topup-preview-val">฿${credit.toLocaleString()}</div>
        ${bonus > 0 ? `<div class="topup-preview-bonus">โบนัส +฿${bonus.toLocaleString()}</div>` : ''}
      </div>`;
  } else {
    el.innerHTML = '';
  }
}

async function registerMemberTab() {
  const name   = $('reg-name-tab')?.value.trim();
  const phone  = $('reg-phone-tab')?.value.replace(/\D/g, '');
  const code   = $('reg-code-tab')?.value.replace(/[^0-9]/g, '');
  const amount = parseFloat($('reg-amount-tab')?.value) || 0;
  const payment = document.querySelector('#reg-pay-chips .pay-chip.active')
                    ?.getAttribute('data-pay') || 'Cash';

  // ── Validate ──
  if (!name)              { showToast('กรุณากรอกชื่อสมาชิกค่ะ', 'error');          $('reg-name-tab')?.focus();   return; }
  if (!phone)             { showToast('กรุณากรอกเบอร์โทรค่ะ', 'error');            $('reg-phone-tab')?.focus();  return; }
  if (phone.length < 9)   { showToast('เบอร์โทรต้องอย่างน้อย 9 หลักค่ะ', 'error'); $('reg-phone-tab')?.focus();  return; }
  if (phone.length > 10)  { showToast('เบอร์โทรต้องไม่เกิน 10 หลักค่ะ', 'error');  $('reg-phone-tab')?.focus();  return; }
  if (!code)              { showToast('กรุณากรอกรหัส 4 หลักค่ะ', 'error');          $('reg-code-tab')?.focus();   return; }
  if (code.length !== 4)  { showToast('รหัสต้องเป็น 4 หลักพอดีค่ะ', 'error');       $('reg-code-tab')?.focus();   return; }
  if (amount <= 0)        { showToast('กรุณากรอกยอดเปิดบัญชีค่ะ', 'error');        $('reg-amount-tab')?.focus(); return; }

  const phoneNorm = phone.length === 9 ? '0' + phone : phone;

  const btn = $('reg-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังสมัคร...'; }

  try {
    const payload = {
      userId:     state.userId,
      staffName:  state.staffName,
      name,
      phone:      phoneNorm,
      memberCode: code,
      amount,
      payment,
    };

    console.log('📤 registerMember payload:', JSON.stringify(payload));

    const result = await api_registerMember(payload);

    console.log('📥 registerMember result:', JSON.stringify(result));

    if (result.ok === false) {
      throw new Error(result.error || 'บันทึกไม่สำเร็จ');
    }

    showToast(`✅ สมัครสมาชิก ${name} รหัส ${code} สำเร็จค่ะ`, 'success');

    ['reg-name-tab', 'reg-phone-tab', 'reg-amount-tab'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });
    // reset code input พร้อม visual feedback
    const codeEl = $('reg-code-tab');
    if (codeEl) { codeEl.value = ''; onCodeInput(codeEl); }

    if ($('reg-tab-preview')) $('reg-tab-preview').innerHTML = '';
    document.querySelectorAll('#reg-pay-chips .pay-chip').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });

    await loadTodayRecords();

  } catch(err) {
    console.error('❌ registerMember error:', err);
    showToast('❌ ' + (err.message || 'เกิดข้อผิดพลาดค่ะ'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🆕 สมัครสมาชิก'; }
  }
}

function showTopupModal() {
  if (!state.member) return;
  switchMemberTab('topup');
  autoFillTopupCode(state.member.memberCode);
}

function selectTopupPay(payId) {
  document.querySelectorAll('[data-tpay]').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-tpay')===payId));
}

function updateTopupPreview() {
  const amount = parseFloat($('topup-amount')?.value) || 0;
  const credit = calcCredit(amount, state.config || {});
  const bonus  = credit - amount;
  const el     = $('topup-preview');
  if (!el) return;
  if (amount > 0) {
    el.innerHTML = `
      <div class="topup-preview-box">
        <div class="topup-preview-label">จะได้รับเครดิต</div>
        <div class="topup-preview-val">฿${credit.toLocaleString()}</div>
        ${bonus>0?`<div class="topup-preview-bonus">โบนัส +฿${bonus.toLocaleString()}</div>`:''}
      </div>`;
  } else { el.innerHTML = ''; }
}

/* ══════════════════════════════════════════════
   SUMMARY PAGE
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

  if (period === 'day') {
    buildSummaryFromLocal(el);
    try {
      const result = await api_getSummary(state.userId, period);
      if (result && result.comm !== undefined) {
        renderSummaryResult(result, el);
      }
    } catch(e) {}
    return;
  }

  try {
    const result = await api_getSummary(state.userId, period);
    if (result && (result.comm !== undefined || result.byService)) {
      renderSummaryResult(result, el);
    } else {
      el.innerHTML = `<div class="card"><div class="empty-state"><span class="empty-icon">📭</span>ยังไม่มีข้อมูลค่ะ</div></div>`;
    }
  } catch(e) {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:32px 20px;">
        <div style="font-size:40px;margin-bottom:8px;">🔌</div>
        <div style="font-size:14px;color:var(--red);margin-bottom:6px;">เชื่อมต่อ API ไม่ได้ค่ะ</div>
        <div style="font-size:12px;color:var(--text3);">${e.message||'ตรวจสอบ GAS URL'}</div>
      </div>`;
  }
}

function buildSummaryFromLocal(el) {
  const recs = state.todayRecs.filter(r =>
    !['เติมเงินสมาชิก','เปิดเมมเบอร์ใหม่'].includes(r.service));
  const comm = Math.round(recs.reduce((s,r)=>s+r.price*(COMMISSION_RATE[r.service]||0.1),0));
  const byService = {};
  recs.forEach(r => {
    if (!byService[r.service]) byService[r.service] = { price:0, count:0 };
    byService[r.service].price += r.price;
    byService[r.service].count += 1;
  });
  renderSummaryResult({ comm, byServiceDetail: byService, count: recs.length, isFallback: true }, el);
}

function renderSummaryResult(data, el) {
  if (!el) el = $('summary-content');
  if (!el) return;

  const comm = data.comm || 0;
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
        <div class="summary-svc">${svc}${count?` <small style="color:var(--text3)">(${count})</small>`:''}</div>
        <div>
          <div class="summary-comm">฿${c.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text3);text-align:right">฿${Number(price).toLocaleString()}</div>
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
   HELPERS
══════════════════════════════════════════════ */
function calcCredit(amount, cfg) {
  const t20 = cfg.TIER_20K || 27000;
  const t10 = cfg.TIER_10K || 13000;
  const t5  = cfg.TIER_5K  || 6000;
  if (amount >= 20000) return t20;
  if (amount >= 10000) return t10;
  if (amount >= 5000)  return t5;
  return amount;
}

function closeModal(id) { document.getElementById(id)?.remove(); }

let _tt;
function showToast(msg, type='') {
  const t = $('toast') || document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), 3500);
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

function selectRegPay(btn) {
  document.querySelectorAll('#reg-pay-chips .pay-chip')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
