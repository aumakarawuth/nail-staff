/* ═══════════════════════════════════════
   api.js — GAS Bridge
   ทุก call ไป GAS รวมอยู่ที่นี่
═══════════════════════════════════════ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzrZt0orG7_m3Lp9IxQsydBmhSwji_ks456bjKvPbO747-S8mCGQHVrsyqEJHKYjcdd/exec';
const API_TIMEOUT_MS = 10000; // 10 วินาที

/* ── helper: GET ──────────────────────── */
async function gasGet(params) {
  const qs  = new URLSearchParams(params);
  const url = `${GAS_URL}?${qs}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      cache:  'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ── helper: POST ─────────────────────── */
async function gasPost(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ══ API FUNCTIONS ══════════════════════ */

/** ดึงข้อมูลค่าคอม + สรุปวันนี้ของพนักงาน */
async function api_getStaffComm(userId) {
  return gasGet({ action: 'getStaffComm', userId });
}

/** ดึงรายการทั้งหมดวันนี้ของพนักงาน */
async function api_getTodayRecords(userId) {
  return gasGet({ action: 'getStaffTodayRecords', userId });
}

/** บันทึกงานใหม่
 *  payload: { userId, staffName, service, price, payment, note }
 */
async function api_saveRecord(payload) {
  return gasPost({ action: 'staffSaveRecord', ...payload });
}

/** ค้นหาสมาชิกด้วยรหัส 4 หลัก */
async function api_getMemberByCode(code) {
  return gasGet({ action: 'getMemberByCode', code });
}

/** เติมเงินสมาชิก
 *  payload: { userId, staffName, memberCode, payAmount, payment }
 */
async function api_topupMember(payload) {
  return gasPost({ action: 'staffTopup', ...payload });
}

/** สมัครสมาชิกใหม่
 *  payload: { userId, staffName, phone, name, memberCode, amount }
 */
async function api_registerMember(payload) {
  return gasPost({ action: 'staffRegister', ...payload });
}

/** ตัดยอดสมาชิก
 *  payload: { userId, staffName, recordId, memberCode, price }
 */
async function api_deductMember(payload) {
  return gasPost({ action: 'staffDeduct', ...payload });
}

/** ดึง config (tier, bonus, commission rates) */
async function api_getConfig() {
  return gasGet({ action: 'getConfig' });
}

/** ดึงรายการสรุปย้อนหลัง (week/month)
 *  params: { userId, period: 'day'|'week'|'month' }
 */
async function api_getSummary(userId, period = 'day') {
  return gasGet({ action: 'getStaffSummary', userId, period });
}

/** ขอลบรายการ (ส่งให้ Admin อนุมัติ)
 *  payload: { userId, staffName, recordId }
 */
async function api_requestVoid(payload) {
  return gasPost({ action: 'staffRequestVoid', ...payload });
}
