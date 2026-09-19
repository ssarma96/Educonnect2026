const $ = id => document.getElementById(id);

const SUPABASE_URL = 'https://iheqzqoqukiqkypsuzlt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZXF6cW9xdWtpcWt5cHN1emx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzIxNDQsImV4cCI6MjEwNDA0ODE0NH0.h9BH1AGdVgqD8WUxSTnAcQacmxTWCCPO35-eJjnwLqI';
const MASTER_DOC_ID = 'educonnect_master_v5';
const LEGACY_DOC_IDS = ['educonnect_master_v3', 'educonnect_master_v4', 'educonnect_master_v2'];
const DEFAULT_BRAND_LOGO = 'logo.png';

let sb = null;
let saveInFlight = false;
let saveQueued = false;
let currentUser = null;
let db = createDefaultDB();

/* ACTIVE FILTERS FOR TEACHER DIRECTORY & ATTENDANCE */
let currentStudentCategoryFilter = 'all';
let currentStudentClassFilter = 'all';
let currentAttCategoryFilter = 'all';
let currentAttClassFilter = 'all';

/* ACTIVE FILTERS FOR OFFLINE MARKS & FAST BATCH ENTRY */
let fastAutoNumericCounter = 1;
let currentOmCategoryFilter = 'all';
let currentOmClassFilter = 'all';

// ATTACH SLIDING PANEL EVENT LISTENERS ON LOAD
document.addEventListener('DOMContentLoaded', () => {
  const container = $('authContainerMain');
  if ($('slideSignUpBtn')) {
    $('slideSignUpBtn').addEventListener('click', () => container.classList.add('right-panel-active'));
  }
  if ($('slideSignInBtn')) {
    $('slideSignInBtn').addEventListener('click', () => container.classList.remove('right-panel-active'));
  }
});

function createDefaultDB(){
  return {
    schemaVersion: 5,
    branding: { logo: DEFAULT_BRAND_LOGO },
    institute: {
      name: "EduConnect Learning Solutions Pvt. Ltd.",
      address: "Holding No. 42, G.S. Road, Christian Basti, Near Central Mall, Guwahati, Assam, India — 781005",
      supportEmail: "support@educonnect.com",
      officeHours: "10:00 AM to 7:00 PM (All 7 days)"
    },
    socials: {
      telegram: "https://t.me/+Y5fP8e554BhhMmNl",
      whatsapp: "https://whatsapp.com",
      youtube: "https://youtube.com"
    },
    legal: {
      policy: "1. Fair Assessment Conduct: Students attempting online mock tests agree to maintain academic honesty. Tab switching and external aids are monitored.\n2. Account Security: Single-user authorization keys are non-transferable.\n3. Institutional Discipline: Courteous communication is mandated across all doubt resolution forums.",
      terms: "1. Service Contract: Utilizing EduConnect services implies compliance with institutional assessment rules.\n2. Fee Records: Digitally signed receipts represent valid legal payment records between guardians and educators.\n3. Encrypted Continuity: Regular cloud synchronization safeguards academic historical records.",
      privacy: "1. Data Collection: Academic metrics, student contact details, and parent communication records are stored securely.\n2. Data Usage: Information is accessed strictly for educational tracking, dues alerts, and progress reports.\n3. Third Parties: Information is never commercialized or shared with third-party advertising brokers."
    },
    security: { adminPin: 'ADMIN2026', teacherRef: 'TEACH2026', studentRef: 'STUD2026' },
    teachers: [],
    students: [],
    materials: [],
    tests: [],
    testResults: [],
    pinRequests: [],
    userQueries: [],
    stories: [
      { id:'story-1', title:"The Honest Woodcutter", text:"A woodcutter refused gold and silver axes that weren't his. He was rewarded with all three for truthfulness.", moral:"Honesty is rewarded." },
      { id:'story-2', title:"The Thirsty Crow", text:"Dropping stones in a pitcher elevated the water level so the clever crow could quench its thirst.", moral:"Patience and wits conquer difficulty." }
    ]
  };
}

function normaliseDB(raw){
  const base = createDefaultDB();
  if (!raw || typeof raw !== 'object') return base;
  const merged = {...base, ...raw};
  merged.branding = {...base.branding, ...(raw.branding || {})};
  merged.institute = {...base.institute, ...(raw.institute || {})};
  merged.socials = {...base.socials, ...(raw.socials || {})};
  merged.legal = {...base.legal, ...(raw.legal || {})};
  merged.security = {...base.security, ...(raw.security || {})};
  ['teachers','students','materials','tests','testResults','pinRequests','userQueries','stories'].forEach(k=>{
    merged[k] = Array.isArray(raw[k]) ? raw[k] : base[k];
  });

  merged.teachers.forEach(t=>{
    t.students = Array.isArray(t.students) ? t.students : [];
    t.transactions = Array.isArray(t.transactions) ? t.transactions : [];
    t.diary = Array.isArray(t.diary) ? t.diary : [];
    t.offlineMarks = Array.isArray(t.offlineMarks) ? t.offlineMarks : [];
    t.copyCheckins = Array.isArray(t.copyCheckins) ? t.copyCheckins : [];
    t.projects = Array.isArray(t.projects) ? t.projects : [];
    t.profile = (t.profile && typeof t.profile === 'object') ? t.profile : {};
    t.id = String(t.id ?? '');
    t.pin = String(t.pin ?? '');
    t.students.forEach(s=>{
      s.id = String(s.id ?? makeId('st'));
      s.attendance = (s.attendance && typeof s.attendance === 'object') ? s.attendance : {};
      s.monthlyAttendance = (s.monthlyAttendance && typeof s.monthlyAttendance === 'object') ? s.monthlyAttendance : {};
      s.fee = Number(s.fee) || 0;
      s.billing = s.billing === 'prepaid' ? 'prepaid' : 'postpaid';
    });
  });

  merged.students.forEach(s=>{
    s.id = String(s.id ?? uniqueStudentPortalId());
    s.profile = (s.profile && typeof s.profile === 'object') ? s.profile : {};
  });

  merged.materials.forEach(m=>m.id = String(m.id ?? makeId('mat')));
  merged.tests.forEach(t=>t.id = String(t.id ?? makeId('test')));
  merged.testResults.forEach(r=>r.id = String(r.id ?? makeId('res')));
  merged.schemaVersion = 5;
  return merged;
}

function makeId(prefix='id'){
  if (crypto?.randomUUID) return prefix + '-' + crypto.randomUUID();
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
}

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}
function money(n){ return '₹' + Number(n || 0).toLocaleString('en-IN'); }

function localDate(d=new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function today(){ return localDate(); }
function monthNow(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function addMonths(ym, delta){
  const [y,m] = String(ym).split('-').map(Number);
  const d = new Date(y, (m||1)-1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function validPhone(v){
  const digits = String(v||'').replace(/\D/g,'');
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
}
function cleanPhone(v){
  let n = String(v||'').replace(/\D/g,'');
  if (n.length === 10) n = '91' + n;
  return n;
}
function setError(msg){
  const el = $('loginErrorMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}
function safeAlert(msg){ window.alert(String(msg)); }

/* 30-DAY AUTO-PURGE */
function purgeOldResolvedRecords() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  db.pinRequests = (db.pinRequests || []).filter(req => {
    const age = now - (new Date(req.createdAt).getTime() || 0);
    return !(req.status === 'resolved' && age > THIRTY_DAYS_MS);
  });
  db.userQueries = (db.userQueries || []).filter(q => {
    const age = now - (new Date(q.createdAt).getTime() || 0);
    return !(q.status === 'resolved' && age > THIRTY_DAYS_MS);
  });
}

function saveLocal(){
  try { localStorage.setItem(MASTER_DOC_ID, JSON.stringify(db)); }
  catch(e){ console.error(e); safeAlert('Local storage is full or blocked.'); }
}

function loadLocal(){
  let found = null;
  try {
    const current = localStorage.getItem(MASTER_DOC_ID);
    if (current) found = JSON.parse(current);
    if (!found) {
      for (const key of LEGACY_DOC_IDS) {
        const legacy = localStorage.getItem(key);
        if (legacy) { found = JSON.parse(legacy); break; }
      }
    }
  } catch(e){ console.warn('Local parse error:', e); }

  db = normaliseDB(found || db);

  try {
    const userSession = sessionStorage.getItem('edu_user');
    if (userSession) currentUser = JSON.parse(userSession);
  } catch(e){ currentUser = null; }
}

async function initCloud(){
  if (!window.supabase) return;
  try{
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession:false, autoRefreshToken:false }
    });
    await syncFromCloud(false);
  }catch(e){ console.warn('Cloud initialisation failed:', e); }
}

async function save(){
  saveLocal();
  refreshAllViews();
  if (!sb) return;
  if (saveInFlight){ saveQueued = true; return; }
  saveInFlight = true;
  try{
    const {data: row, error: readError} = await sb
      .from('app_data')
      .select('payload,updated_at')
      .eq('id', MASTER_DOC_ID)
      .maybeSingle();
    if (readError) throw readError;

    const serverTs = row?.updated_at ? Date.parse(row.updated_at) : 0;
    if (serverTs && serverTs > (db._lastSyncedAt || 0) && row?.payload) {
      const ok = confirm('A newer cloud copy exists. Replace it with your latest local changes?');
      if (!ok){
        db = normaliseDB(row.payload);
        db._lastSyncedAt = serverTs;
        saveLocal();
        refreshAllViews();
        return;
      }
    }

    const now = new Date().toISOString();
    const payload = {...db};
    delete payload._lastSyncedAt;
    const {error} = await sb.from('app_data').upsert({
      id: MASTER_DOC_ID,
      payload,
      updated_at: now
    });
    if (error) throw error;
    db._lastSyncedAt = Date.parse(now);
    saveLocal();
  }catch(e){
    console.error('Cloud save failed:', e);
  }finally{
    saveInFlight = false;
    if (saveQueued){ saveQueued = false; save(); }
  }
}

async function syncFromCloud(alertUser=false){
  if (!sb) return;
  try{
    const {data: row, error} = await sb
      .from('app_data')
      .select('payload,updated_at')
      .eq('id', MASTER_DOC_ID)
      .maybeSingle();
    if (error) throw error;
    if (row?.payload){
      db = normaliseDB(row.payload);
      db._lastSyncedAt = row.updated_at ? Date.parse(row.updated_at) : Date.now();
      saveLocal();
      refreshAllViews();
      if (alertUser) safeAlert('Cloud synced successfully.');
    }else if (alertUser){
      safeAlert('No cloud record exists yet.');
    }
  }catch(e){
    if (alertUser) safeAlert('Cloud sync failed: ' + e.message);
  }
}

function getActiveLogo() {
  return db.branding?.logo || DEFAULT_BRAND_LOGO;
}

function applyBrandLogo() {
  const logoUrl = getActiveLogo();
  const headerLogo = $('appBrandLogo');
  const heroLogo = $('homeHeroLogo');
  const previewImg = $('adminLogoPreviewImg');
  const footerLogo = $('footerAppLogo');

  if (headerLogo) headerLogo.src = logoUrl;
  if (heroLogo) heroLogo.src = logoUrl;
  if (previewImg) previewImg.src = logoUrl;
  if (footerLogo) footerLogo.src = logoUrl;
}

function handleLogoUpload(event) {
  if (currentUser?.role !== 'admin') return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return safeAlert('Please select a valid image file.');

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 140;
      let width = img.width, height = img.height;
      if (width > height) {
        if (width > maxDim) { height *= maxDim / width; width = maxDim; }
      } else {
        if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      db.branding = db.branding || {};
      db.branding.logo = canvas.toDataURL('image/png', 0.88);
      save();
      applyBrandLogo();
      safeAlert('Institute logo updated successfully.');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function resetBrandLogoToDefault() {
  if (currentUser?.role !== 'admin') return;
  if (!confirm('Reset institute branding logo to default EduConnect emblem?')) return;
  db.branding = db.branding || {};
  db.branding.logo = DEFAULT_BRAND_LOGO;
  save();
  applyBrandLogo();
  safeAlert('Logo reset to default.');
}

function exportBackup(){
  const payload = JSON.stringify(normaliseDB(db), null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EduConnect-Backup-${today()}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function importBackupFile(){
  const input = document.createElement('input');
  input.type='file';
  input.accept='.json,application/json';
  input.onchange = async ()=>{
    const file = input.files?.[0];
    if (!file) return;
    try{
      const imported = normaliseDB(JSON.parse(await file.text()));
      if (!confirm('Replace current EduConnect data with this backup?')) return;
      db = imported;
      save();
      safeAlert('Backup restored successfully.');
    }catch(e){ safeAlert('Invalid backup file.'); }
  };
  input.click();
}

function renderFooterDynamicData() {
  const inst = db.institute || {};
  if ($('footerCompanyName')) $('footerCompanyName').textContent = inst.name || 'EduConnect Learning Solutions Pvt. Ltd.';
  if ($('footerAddress')) $('footerAddress').textContent = inst.address || 'Guwahati, Assam, India';
  if ($('footerEmailLink')) {
    const email = inst.supportEmail || 'support@educonnect.com';
    $('footerEmailLink').textContent = email;
    $('footerEmailLink').href = 'mailto:' + email;
  }
  if ($('footerOfficeHours')) $('footerOfficeHours').textContent = inst.officeHours || '10:00 AM to 7:00 PM (All 7 days)';
}

function renderSocialLinks() {
  const soc = db.socials || {
    telegram: "https://t.me/+Y5fP8e554BhhMmNl",
    whatsapp: "https://whatsapp.com",
    youtube: "https://youtube.com"
  };

  const tg = soc.telegram || "https://t.me/+Y5fP8e554BhhMmNl";
  const wa = soc.whatsapp || "https://whatsapp.com";
  const yt = soc.youtube || "https://youtube.com";

  if ($('headerTgLink')) $('headerTgLink').href = tg;
  if ($('footerTgLink')) $('footerTgLink').href = tg;

  if ($('headerWaLink')) $('headerWaLink').href = wa;
  if ($('footerWaLink')) $('footerWaLink').href = wa;

  if ($('headerYtLink')) $('headerYtLink').href = yt;
  if ($('footerYtLink')) $('footerYtLink').href = yt;
}

function filterMaterialsBySubject(subj) {
  switchTab('landing');
  const container = $('publicMaterialGrid');
  if (!container) return;

  const filtered = (db.materials || []).filter(m => m.subject === subj);

  if (!filtered.length) {
    container.innerHTML = `<p class="muted" style="padding:10px">No study materials published yet for <b>${esc(subj)}</b>.</p>`;
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  container.innerHTML = filtered.map(m => {
    let contentHtml = '';
    if (m.access === 'public') {
      const isLink = String(m.content).trim().startsWith('http');
      if (isLink) {
        contentHtml = `<a href="${esc(m.content.trim())}" target="_blank" rel="noopener" class="btn light btn-sm" style="display:inline-flex;width:auto">📄 Open / Download ↗</a>`;
      } else {
        contentHtml = `<p style="font-size:13px;margin:8px 0;line-height:1.4">${esc(m.content)}</p>`;
      }
    } else {
      contentHtml = '<p style="font-size:12px;color:var(--muted);margin:8px 0"><i>🔒 Locked for enrolled students.</i></p>';
    }

    const extra = `Subject: ${m.subject} | By: ${m.teacherName}`;

    return `
      <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <b style="font-size:14px;line-height:1.3">${esc(m.title)}</b>
            <span class="pill ${m.access === 'public' ? 'green' : 'red'}" style="flex-shrink:0">${m.access === 'public' ? 'FREE' : '🔒 PAID'}</span>
          </div>
          <small class="muted" style="display:block;margin:4px 0 8px 0">Subject: ${esc(m.subject)} • By: ${esc(m.teacherName)}</small>
          ${contentHtml}
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;display:flex;justify-content:flex-end">
          <button class="btn light btn-sm" onclick="shareContent('material', '${esc(m.title)}', '${esc(extra)}')">
            📤 Share
          </button>
        </div>
      </div>`;
  }).join('');

  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function openLegalModal(type) {
  const titles = {
    policy: "📜 EduConnect User Policy",
    terms: "⚖️ Terms of Service",
    privacy: "🔒 Privacy & Data Protection"
  };
  const leg = db.legal || {};
  const content = leg[type] || 'Policy statement not specified.';

  $('legalModalTitle').textContent = titles[type] || 'Legal Information';
  $('legalModalBody').innerHTML = `<p style="white-space:pre-wrap;line-height:1.7">${esc(content)}</p>`;
  $('legalModal').classList.add('show');
}

function closeLegalModal() {
  $('legalModal').classList.remove('show');
}

function populateAdminInstituteForm() {
  const inst = db.institute || {};
  const leg = db.legal || {};
  const soc = db.socials || {};

  if ($('admInstName')) $('admInstName').value = inst.name || '';
  if ($('admInstEmail')) $('admInstEmail').value = inst.supportEmail || '';
  if ($('admInstAddress')) $('admInstAddress').value = inst.address || '';
  if ($('admInstHours')) $('admInstHours').value = inst.officeHours || '';

  if ($('admSocTg')) $('admSocTg').value = soc.telegram || 'https://t.me/+Y5fP8e554BhhMmNl';
  if ($('admSocWa')) $('admSocWa').value = soc.whatsapp || 'https://whatsapp.com';
  if ($('admSocYt')) $('admSocYt').value = soc.youtube || 'https://youtube.com';

  if ($('admLegalPolicy')) $('admLegalPolicy').value = leg.policy || '';
  if ($('admLegalTerms')) $('admLegalTerms').value = leg.terms || '';
  if ($('admLegalPrivacy')) $('admLegalPrivacy').value = leg.privacy || '';
}

function saveAdminInstituteSettings() {
  if (currentUser?.role !== 'admin') return;

  db.institute = {
    name: $('admInstName').value.trim() || 'EduConnect Learning Solutions Pvt. Ltd.',
    supportEmail: $('admInstEmail').value.trim() || 'support@educonnect.com',
    address: $('admInstAddress').value.trim() || 'Holding No. 42, G.S. Road, Guwahati, Assam',
    officeHours: $('admInstHours').value.trim() || '10:00 AM to 7:00 PM (All 7 days)'
  };

  db.socials = {
    telegram: $('admSocTg').value.trim() || 'https://t.me/+Y5fP8e554BhhMmNl',
    whatsapp: $('admSocWa').value.trim() || 'https://whatsapp.com',
    youtube: $('admSocYt').value.trim() || 'https://youtube.com'
  };

  db.legal = {
    policy: $('admLegalPolicy').value.trim(),
    terms: $('admLegalTerms').value.trim(),
    privacy: $('admLegalPrivacy').value.trim()
  };

  save();
  renderFooterDynamicData();
  renderSocialLinks();
  safeAlert('Institute details, legal policies & social community links updated successfully.');
}

function switchTab(tabId, pushHistory = true){
  if (tabId !== 'games') {
    stopSudokuTimer();
  }

  ['landing','tests','games','stories','tools','workspace'].forEach(t=>{
    const el=$('tab-'+t);
    if (el) el.style.display = (t===tabId) ? 'block':'none';
  });
  document.querySelectorAll('#topNav button').forEach(b=>{
    b.classList.toggle('active', (b.getAttribute('onclick')||'').includes(`'${tabId}'`));
  });
  if (tabId==='workspace'){
    if (!currentUser){ switchTab('landing'); return; }
    renderWorkspace();
  }

  if (pushHistory) {
    history.pushState({ tab: tabId }, '', '#' + tabId);
  }
}

window.addEventListener('popstate', (event) => {
  const openModals = document.querySelectorAll('.modal.show');
  if (openModals.length > 0) {
    openModals.forEach(m => m.classList.remove('show'));
    return;
  }

  if (activeExam) {
    if (!confirm('An exam is in progress. Exiting will abort your session. Leave?')) {
      history.pushState({ tab: 'tests' }, '', '#tests');
      return;
    }
  }

  const targetTab = (event.state && event.state.tab) || location.hash.replace('#', '') || 'landing';
  switchTab(targetTab, false);
});

function switchTeacherSub(subId){
  document.querySelectorAll('.t-subpage').forEach(x=>x.style.display='none');
  const target=$(subId);
  if (target) target.style.display='block';
  document.querySelectorAll('#teacherWorkspace .public-nav button').forEach(b=>{
    b.classList.toggle('active', (b.getAttribute('onclick')||'').includes(subId));
  });
  if (subId === 't-queries') renderTeacherQueriesList();
}

function switchStudentInner(viewId){
  ['view-st-dir','view-st-att','view-st-marks'].forEach(v=>{
    if ($(v)) $(v).style.display = (v===viewId)?'block':'none';
  });
  document.querySelectorAll('#t-students .sub-nav button').forEach(b=>{
    b.classList.toggle('active', (b.getAttribute('onclick')||'').includes(viewId));
  });
  if(viewId==='view-st-att') {
    populateAttendanceClassFilterDropdown(getActiveTeacher());
    renderAttendanceUI(getActiveTeacher());
  }
  if(viewId==='view-st-marks') {
    populateOfflineMarksClassFilterDropdown(getActiveTeacher());
    renderOfflineMarksUI(getActiveTeacher());
  }
}

function switchAcademicInner(viewId){
  ['view-ac-copy','view-ac-project'].forEach(v=>{
    if ($(v)) $(v).style.display = (v===viewId)?'block':'none';
  });
  document.querySelectorAll('#t-academic .sub-nav button').forEach(b=>{
    b.classList.toggle('active', (b.getAttribute('onclick')||'').includes(viewId));
  });
}

function switchFeeInner(viewId){
  ['view-fee-record','view-fee-pending','view-fee-history'].forEach(v=>{
    if ($(v)) $(v).style.display = (v===viewId)?'block':'none';
  });
  document.querySelectorAll('#t-fees .sub-nav button').forEach(b=>{
    b.classList.toggle('active', (b.getAttribute('onclick')||'').includes(viewId));
  });
}

function switchAdminSub(subId){
  ['ad-overview', 'ad-students', 'ad-teachers', 'ad-messages', 'ad-security'].forEach(id => {
    const el = $(id);
    if(el) el.style.display = (id === subId) ? 'block' : 'none';
  });
  document.querySelectorAll('#adminWorkspace .sub-nav button').forEach(b => {
    b.classList.toggle('active', (b.getAttribute('onclick') || '').includes(subId));
  });
  if (subId === 'ad-security') {
    populateAdminInstituteForm();
  }
}

function switchStudentPortalSub(viewId){
  ['view-sp-tests', 'view-sp-report', 'view-sp-profile', 'view-sp-queries'].forEach(id => {
    const el = $(id);
    if(el) el.style.display = (id === viewId) ? 'block' : 'none';
  });
  document.querySelectorAll('#studentTestUnlocked .sub-nav button').forEach(b => {
    b.classList.toggle('active', (b.getAttribute('onclick') || '').includes(viewId));
  });
  if(viewId === 'view-sp-report') renderStudentPerformanceReport();
  if(viewId === 'view-sp-profile') populateStudentSelfProfile();
  if(viewId === 'view-sp-queries') renderStudentQueriesList();
}

function openLoginModal(defaultRole) {
  if (defaultRole) $('loginRole').value = defaultRole;
  toggleLoginRoleUI();
  setError('');
  $('loginUserId').value = '';
  $('loginSecret').value = '';
  const container = $('authContainerMain');
  if (container) container.classList.remove('right-panel-active');
  $('authAnimatedModal').classList.add('show');
}

function openSignupModal() {
  $('regName').value = ''; 
  $('regContact').value = ''; 
  $('regPin').value = ''; 
  $('regReferral').value = '';
  toggleSignupRoleUI();
  const container = $('authContainerMain');
  if (container) container.classList.add('right-panel-active');
  $('authAnimatedModal').classList.add('show');
}

function closeAuthModal() {
  $('authAnimatedModal').classList.remove('show');
}

function closeLoginModal() { closeAuthModal(); }
function closeSignupModal() { closeAuthModal(); }

function toggleLoginRoleUI(){
  const r=$('loginRole').value;
  $('loginFieldIdWrapper').style.display=(r==='admin')?'none':'block';
  $('loginIdLabel').textContent=(r==='student')?'Unique Student ID or 10-digit Mobile':'Teacher Mobile / ID';
  $('loginSecretLabel').textContent=(r==='admin')?'Master Admin PIN':'Account Security PIN';
}
function toggleSignupRoleUI(){
  const r=$('regRole').value;
  $('regReferral').placeholder=(r==='teacher')?'Teacher Referral Key':'Student Referral Key';
}

function uniqueStudentPortalId(){
  const used = new Set(db.students.map(s=>String(s.id).toUpperCase()));
  let id='';
  do { id='EDU-' + Math.floor(100000 + Math.random()*900000); }
  while(used.has(id));
  return id;
}

function executeSignup(){
  const role=$('regRole').value;
  const name=$('regName').value.trim();
  const contact=$('regContact').value.trim();
  const pin=$('regPin').value.trim();
  const ref=$('regReferral').value.trim();

  if(!name || !contact || !pin || !ref) return safeAlert('Please fill all required details.');
  if(!validPhone(contact)) return safeAlert('Enter a valid 10-digit mobile number.');
  if(!/^\d{4,6}$/.test(pin)) return safeAlert('PIN must contain 4 to 6 digits.');

  if(role==='teacher'){
    if(ref!==db.security.teacherRef) return safeAlert('Invalid Teacher Referral Password.');
    const tid=cleanPhone(contact);
    if(db.teachers.some(t=>cleanPhone(t.id)===tid)) return safeAlert('Teacher mobile is already registered.');
    const newTeacher={
      id:tid,name,contact:tid,pin,
      profile:{name,contact:tid},
      students:[],transactions:[],diary:[],offlineMarks:[],copyCheckins:[],projects:[],createdAt:today()
    };
    db.teachers.push(newTeacher);
    currentUser={role:'teacher',id:tid,name};
  }else{
    if(ref!==db.security.studentRef) return safeAlert('Invalid Student Referral Password.');
    const sid=uniqueStudentPortalId();
    db.students.push({
      id:sid,name,contact:cleanPhone(contact),pin,registeredAt:today(),teacherIds:[],
      profile:{name,contact:cleanPhone(contact)}
    });
    currentUser={role:'student',id:sid,name};
    safeAlert(`Account created successfully.\n\nYour Student ID is: ${sid}\nYou can also log in using your registered mobile number.`);
  }
  sessionStorage.setItem('edu_user',JSON.stringify(currentUser));
  save();
  closeSignupModal();
  updateAuthUI();
  switchTab(currentUser.role==='student'?'tests':'workspace');
}

function executeLogin(){
  const role=$('loginRole').value;
  const secret=$('loginSecret').value.trim();
  const uid=$('loginUserId').value.trim();

  if(!secret) return setError('Enter your PIN / Password.');

  if(role==='admin'){
    if(secret===db.security.adminPin || secret==='SUPER_ADMIN_RECOVER_9988'){
      currentUser={role:'admin',id:'admin',name:'Master Administrator'};
    }else return setError('Incorrect Admin PIN.');
  }else if(role==='teacher'){
    const norm=cleanPhone(uid);
    const t=db.teachers.find(x=>cleanPhone(x.id)===norm && String(x.pin)===secret);
    if(!t) return setError('Invalid Teacher Mobile / ID or PIN.');
    currentUser={role:'teacher',id:String(t.id),name:t.name};
  }else{
    const normUid=uid.toUpperCase();
    const cleanMobile=cleanPhone(uid);
    const s=db.students.find(x=>(
      String(x.id).toUpperCase()===normUid || (cleanMobile && cleanPhone(x.contact)===cleanMobile)
    ) && String(x.pin)===secret);
    if(!s) return setError('Invalid Student ID / Mobile or PIN.');
    currentUser={role:'student',id:String(s.id),name:s.name};
  }

  sessionStorage.setItem('edu_user',JSON.stringify(currentUser));
  closeLoginModal();
  updateAuthUI();
  switchTab(currentUser.role==='student'?'tests':'workspace');
}

/* FORGOT PIN USER REQUEST */
function openForgotPinModal() {
  closeLoginModal();
  $('fpMobileInput').value = '';
  $('forgotPinModal').classList.add('show');
}
function closeForgotPinModal() { $('forgotPinModal').classList.remove('show'); }

function submitForgotPinRequest() {
  const raw = $('fpMobileInput').value.trim();
  const phone = cleanPhone(raw);
  if (!validPhone(raw)) return safeAlert('Please enter a valid 10-digit mobile number.');

  const teacher = db.teachers.find(t => cleanPhone(t.id) === phone || cleanPhone(t.contact) === phone);
  const student = db.students.find(s => cleanPhone(s.contact) === phone);

  if (!teacher && !student) {
    return safeAlert('No account found with this registered mobile number.');
  }

  const role = teacher ? 'Teacher' : 'Student';
  const name = teacher ? teacher.name : student.name;
  const accountId = teacher ? teacher.id : student.id;

  db.pinRequests = db.pinRequests || [];
  db.pinRequests.unshift({
    id: makeId('req'),
    role,
    name,
    accountId,
    phone,
    message: `My name is ${name}, registered mobile is ${raw}, and I forgot my login PIN. Please verify and reset my PIN.`,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  save();
  closeForgotPinModal();
  safeAlert('Your PIN reset request has been routed to the Administrator.');
}

/* USER QUERY TICKETING */
function submitUserQuery(userRole) {
  if (!currentUser) return;
  const isStudent = userRole === 'Student';
  const cat = isStudent ? $('sqCategory').value : $('tqCategory').value;
  const msgInput = isStudent ? $('sqMessage') : $('tqMessage');
  const msg = msgInput.value.trim();

  if (!msg) return safeAlert('Please enter your message or problem description.');

  let phone = '';
  if (isStudent) {
    const s = db.students.find(x => String(x.id) === String(currentUser.id));
    phone = s?.contact || '';
  } else {
    const t = getActiveTeacher();
    phone = t?.contact || t?.id || '';
  }

  db.userQueries = db.userQueries || [];
  db.userQueries.unshift({
    id: makeId('query'),
    userId: currentUser.id,
    userName: currentUser.name,
    userRole,
    phone,
    category: cat,
    message: msg,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  save();
  msgInput.value = '';
  safeAlert('Your query has been sent to the Administrator.');
  if (isStudent) renderStudentQueriesList();
  else renderTeacherQueriesList();
}

function renderStudentQueriesList() {
  const container = $('studentMyQueriesList');
  if (!container) return;
  const list = (db.userQueries || []).filter(q => String(q.userId) === String(currentUser?.id));
  container.innerHTML = list.length ? list.map(q => `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>${esc(q.category)}</b>
        <span class="pill ${q.status === 'resolved' ? 'green' : 'orange'}">${q.status.toUpperCase()}</span>
      </div>
      <p style="font-size:12px;margin:6px 0;color:#334155">${esc(q.message)}</p>
      <small class="muted">Submitted: ${new Date(q.createdAt).toLocaleDateString('en-IN')}</small>
    </div>
  `).join('') : '<p class="muted">No queries submitted yet.</p>';
}

function renderTeacherQueriesList() {
  const container = $('teacherMyQueriesList');
  if (!container) return;
  const list = (db.userQueries || []).filter(q => String(q.userId) === String(currentUser?.id));
  container.innerHTML = list.length ? list.map(q => `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>${esc(q.category)}</b>
        <span class="pill ${q.status === 'resolved' ? 'green' : 'orange'}">${q.status.toUpperCase()}</span>
      </div>
      <p style="font-size:12px;margin:6px 0;color:#334155">${esc(q.message)}</p>
      <small class="muted">Submitted: ${new Date(q.createdAt).toLocaleDateString('en-IN')}</small>
    </div>
  `).join('') : '<p class="muted">No queries submitted yet.</p>';
}

/* LOGOUT */
function logout(){
  if(activeExam){
    if(!confirm('An exam is currently in progress. Logging out will forfeit this attempt. Are you sure you want to exit?')) return;
  } else {
    if(!confirm('Are you sure you want to log out of your account?')) return;
  }

  stopExamTimer();
  activeExam = null;
  sessionStorage.removeItem('edu_user');
  currentUser = null;
  updateAuthUI();
  switchTab('landing');
}

function updateAuthUI(){
  const logged = !!currentUser;
  $('authHeaderButtons').style.display = logged ? 'none' : 'flex';
  $('userHeaderProfile').style.display = logged ? 'flex' : 'none';
  $('userNameBadge').textContent = logged ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : '';
  $('workspaceNavBtn').style.display = (logged && currentUser.role !== 'student') ? 'inline-block' : 'none';

  const lockedBanner = $('studentTestLocked');
  const unlockedArea = $('studentTestUnlocked');

  if (!logged) {
    lockedBanner.style.display = 'block';
    unlockedArea.style.display = 'none';
    lockedBanner.innerHTML = `
      <h3>🔒 Student Authentication Required</h3>
      <p class="muted">Log in using your Student ID or Registered Mobile Number to access tests, report cards, queries, and profile.</p>
      <button class="btn green" onclick="openLoginModal('student')">Login as Student</button>
    `;
  } else if (currentUser.role === 'student') {
    lockedBanner.style.display = 'none';
    unlockedArea.style.display = 'block';
  } else if (currentUser.role === 'admin') {
    lockedBanner.style.display = 'block';
    unlockedArea.style.display = 'none';
    lockedBanner.innerHTML = `
      <div style="max-width:540px;margin:0 auto;text-align:center">
        <span class="pill orange" style="font-size:13px;padding:4px 10px">👑 Administrator Mode</span>
        <h3 style="margin:10px 0 6px">Examination Oversight & Control</h3>
        <p class="muted" style="font-size:13px;margin:0 0 16px">You are logged in as Administrator. To inspect questions, approve papers, or remove outdated tests, access the Admin Command Center.</p>
        <button class="btn" onclick="switchTab('workspace');switchAdminSub('ad-overview')">Open Test Approvals & Inspections ➔</button>
      </div>
    `;
  } else if (currentUser.role === 'teacher') {
    lockedBanner.style.display = 'block';
    unlockedArea.style.display = 'none';
    lockedBanner.innerHTML = `
      <div style="max-width:540px;margin:0 auto;text-align:center">
        <span class="pill blue" style="font-size:13px;padding:4px 10px">👨‍🏫 Teacher Mode</span>
        <h3 style="margin:10px 0 6px">Teacher Examination Workspace</h3>
        <p class="muted" style="font-size:13px;margin:0 0 16px">Educators draft new tests and review batch results from their workspace rather than taking student exams.</p>
        <button class="btn green" onclick="switchTab('workspace');switchTeacherSub('t-tests')">Manage & Draft Tests ➔</button>
      </div>
    `;
  }

  applyBrandLogo();
  renderFooterDynamicData();
  renderSocialLinks();
  refreshAllViews();
}

function renderWorkspace(){
  if(!currentUser) return;
  $('adminWorkspace').style.display=currentUser.role==='admin'?'block':'none';
  $('teacherWorkspace').style.display=currentUser.role==='teacher'?'block':'none';
  if(currentUser.role==='admin') renderAdminPanel();
  if(currentUser.role==='teacher') renderTeacherPanel();
}

function shareContent(type, title, extraInfo = '') {
  const pageUrl = window.location.href.split('#')[0];
  let shareText = '';

  if (type === 'test') {
    shareText = `📝 *EduConnect Online Mock Test Alert!*\n\nTest: *${title}*\n${extraInfo ? `Details: ${extraInfo}\n` : ''}Test is live now. Attempt it to secure your rank on the leaderboard!\n\n👉 Open Link: ${pageUrl}`;
  } else {
    shareText = `📚 *EduConnect Study Material Alert!*\n\nTitle: *${title}*\n${extraInfo ? `Subject: ${extraInfo}\n` : ''}New notes / study material have been published. Check it out now!\n\n👉 Access Here: ${pageUrl}`;
  }

  if (navigator.share) {
    navigator.share({
      title: 'EduConnect Learning Update',
      text: shareText,
      url: pageUrl
    }).catch(err => console.log('Share dismissed:', err));
  } else {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener');
  }
}

function openTestPaperInspector(tid) {
  const t = db.tests.find(x => String(x.id) === String(tid));
  if (!t) return safeAlert('Test record not found.');

  const canDelete = currentUser && (currentUser.role === 'admin' || (currentUser.role === 'teacher' && String(t.teacherId) === String(currentUser.id)));
  const canApprove = currentUser && currentUser.role === 'admin' && t.status === 'pending';

  $('admPrevTestTitle').textContent = t.title;
  $('admPrevTestMeta').innerHTML = `
    Subject: <b>${esc(t.subject)}</b> | 
    Duration: <b>${t.duration} Mins</b> | 
    Status: <span class="pill ${t.status === 'approved' ? 'green' : t.status === 'pending' ? 'orange' : 'red'}">${esc(t.status.toUpperCase())}</span> | 
    Teacher ID: <b>${esc(t.teacherId)}</b>
  `;

  const qHtml = (t.questions || []).map((q, idx) => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:8px">
        Q${idx + 1}. ${esc(q.q)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${(q.options || []).map((opt, oIdx) => {
          const isCorrect = Number(q.correct) === oIdx;
          return `
            <div style="padding:6px 10px;border-radius:6px;font-size:13px;border:1px solid ${isCorrect ? 'var(--green)' : '#cbd5e1'};background:${isCorrect ? '#dcfce7' : '#fff'};color:${isCorrect ? '#166534' : '#334155'};font-weight:${isCorrect ? '700' : 'normal'}">
              <b>${String.fromCharCode(65 + oIdx)}.</b> ${esc(opt)} ${isCorrect ? '✓ (Key)' : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  $('admPrevQuestionsList').innerHTML = qHtml || '<p class="muted">No questions in this test.</p>';

  $('admPrevActionFooter').innerHTML = `
    <button class="btn light btn-sm" onclick="closeAdminTestPreview()">Close</button>
    ${canDelete ? `<button class="btn red btn-sm" onclick="deleteTestRecord('${esc(t.id)}')">🗑️ Delete Test</button>` : ''}
    ${canApprove ? `<button class="btn green btn-sm" onclick="approveTest('${esc(t.id)}');closeAdminTestPreview()">✅ Approve Test</button>` : ''}
  `;

  $('adminTestPreviewModal').classList.add('show');
}

function closeAdminTestPreview() {
  $('adminTestPreviewModal').classList.remove('show');
}

function deleteTestRecord(tid) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) return;
  const t = db.tests.find(x => String(x.id) === String(tid));
  if (!t) return;
  
  if (currentUser.role === 'teacher' && String(t.teacherId) !== String(currentUser.id)) {
    return safeAlert('Permission denied: You can only delete tests authored by you.');
  }

  if (!confirm(`Warning: Permanently delete test "${t.title}" and remove all related student attempt results?`)) return;

  db.tests = db.tests.filter(x => String(x.id) !== String(tid));
  db.testResults = (db.testResults || []).filter(r => String(r.testId) !== String(tid));
  
  save();
  closeAdminTestPreview();
  safeAlert('Test and linked attempt results deleted successfully.');
}

function onFastTypeConfigChange() {
  const type = $('fastStType').value;
  const rollModeSelect = $('fastRollMode');
  const feeCol = $('fastFeeCol');

  if (type === 'tuition') {
    feeCol.style.display = 'block';
    rollModeSelect.value = 'tuition_seq';
    $('fastRollManualCol').style.display = 'none';
  } else {
    feeCol.style.display = 'none';
    rollModeSelect.value = 'auto_numeric';
    $('fastRollManualCol').style.display = 'none';
  }
  updateNextRollDisplay();
}

function onFastRollModeChange() {
  const mode = $('fastRollMode').value;
  $('fastRollManualCol').style.display = (mode === 'manual') ? 'block' : 'none';
  updateNextRollDisplay();
}

function updateNextRollDisplay() {
  const t = getActiveTeacher();
  const type = $('fastStType').value;
  const mode = $('fastRollMode').value;
  const display = $('fastNextRollDisplay');
  if (!display) return;

  if (type === 'tuition') {
    display.textContent = t ? generateTuitionRoll(t) : 'EC-YYYY-####';
  } else if (mode === 'auto_numeric') {
    display.textContent = `Roll ${fastAutoNumericCounter}`;
  } else {
    display.textContent = $('fastStRollManual')?.value || 'Manual Entry';
  }
}

function saveFastBatchStudent() {
  const t = getActiveTeacher();
  if (!t) return;

  const type = $('fastStType').value;
  const lockedClass = $('fastStClass').value.trim();
  const mode = $('fastRollMode').value;

  const name = $('fastStName').value.trim();
  const father = $('fastStFather').value.trim();
  const contact = $('fastStContact').value.trim();
  const fee = (type === 'tuition') ? Math.max(0, Number($('fastStFee').value) || 0) : 0;

  if (!lockedClass) return safeAlert('Please enter and lock a Class (e.g. Class 9).');
  if (!name) return safeAlert('Please enter Student Name.');
  if (contact && !validPhone(contact)) return safeAlert('Enter a valid 10-digit WhatsApp number.');

  let finalRoll = '-';
  if (type === 'tuition') {
    finalRoll = generateTuitionRoll(t);
  } else if (mode === 'auto_numeric') {
    finalRoll = String(fastAutoNumericCounter);
    fastAutoNumericCounter++;
  } else {
    finalRoll = $('fastStRollManual').value.trim() || '-';
  }

  const sid = makeId('tst');
  const newSt = {
    id: sid,
    type,
    name,
    father,
    contact: cleanPhone(contact),
    className: lockedClass,
    roll: finalRoll,
    fee,
    billing: 'postpaid',
    weakness: '',
    attendance: {},
    monthlyAttendance: {},
    joinedMonth: monthNow(),
    portalId: '',
    portalLinked: false
  };

  t.students.push(newSt);

  const match = db.students.find(s => cleanPhone(s.contact) === newSt.contact && newSt.contact && s.name.trim().toLowerCase() === name.toLowerCase());
  if (match) {
    newSt.portalId = String(match.id);
    newSt.portalLinked = true;
    match.teacherIds = Array.isArray(match.teacherIds) ? match.teacherIds : [];
    if (!match.teacherIds.includes(String(t.id))) match.teacherIds.push(String(t.id));
  }

  save();

  $('fastStName').value = '';
  $('fastStFather').value = '';
  $('fastStContact').value = '';
  if ($('fastStRollManual')) $('fastStRollManual').value = '';
  $('fastStName').focus();

  updateNextRollDisplay();
  populateStudentClassFilterDropdown(t);
  populateAttendanceClassFilterDropdown(t);
  populateOfflineMarksClassFilterDropdown(t);
  renderTeacherStudentsUI(t);
  renderOfflineMarksUI(t);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && ['fastStName', 'fastStFather', 'fastStContact', 'fastStRollManual'].includes(e.target.id)) {
    e.preventDefault();
    saveFastBatchStudent();
  }
});

function setOfflineMarksCategoryFilter(cat) {
  currentOmCategoryFilter = cat;
  $('omFilterAllBtn').className = cat === 'all' ? 'btn btn-sm' : 'btn light btn-sm';
  $('omFilterTuitionBtn').className = cat === 'tuition' ? 'btn green btn-sm' : 'btn light btn-sm';
  $('omFilterSchoolBtn').className = cat === 'school' ? 'btn blue btn-sm' : 'btn light btn-sm';

  populateOfflineMarksClassFilterDropdown(getActiveTeacher());
  renderOfflineMarksUI(getActiveTeacher());
}

function onOfflineMarksClassFilterChange() {
  currentOmClassFilter = $('omFilterClassSelect')?.value || 'all';
  renderOfflineMarksUI(getActiveTeacher());
}

function populateOfflineMarksClassFilterDropdown(t) {
  if (!t) return;
  const select = $('omFilterClassSelect');
  if (!select) return;

  const currentVal = select.value;
  let students = t.students || [];
  if (currentOmCategoryFilter !== 'all') {
    students = students.filter(s => s.type === currentOmCategoryFilter);
  }

  const classes = [...new Set(students.map(s => String(s.className || '').trim()).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">All Classes</option>' + 
    classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  if (classes.includes(currentVal)) {
    select.value = currentVal;
    currentOmClassFilter = currentVal;
  } else {
    select.value = 'all';
    currentOmClassFilter = 'all';
  }
}

function renderOfflineMarksUI(t){
  if(!t) return;
  const tbl = $('offlineMarksEntryTable');
  if(!tbl) return;

  let students = t.students || [];
  if (currentOmCategoryFilter !== 'all') {
    students = students.filter(s => s.type === currentOmCategoryFilter);
  }
  if (currentOmClassFilter !== 'all') {
    students = students.filter(s => String(s.className || '').trim() === currentOmClassFilter);
  }

  tbl.innerHTML = students.length ? `
    <table><thead><tr><th>Student</th><th>Roll</th><th>Class</th><th>Category</th><th>Marks Obtained</th></tr></thead>
    <tbody>${students.map(s => `
      <tr>
        <td><b>${esc(s.name)}</b></td>
        <td>${esc(s.roll || '-')}</td>
        <td>${esc(s.className || '-')}</td>
        <td><span class="pill ${s.type === 'school' ? 'blue' : 'green'}">${s.type.toUpperCase()}</span></td>
        <td><input type="number" data-sid="${esc(s.id)}" class="offline-score-input" style="width:85px;padding:4px" placeholder="0"></td>
      </tr>`).join('')}
    </tbody></table>` : '<p class="muted" style="padding:10px">No students match this category and class filter.</p>';
}

function renderAdminPanel(){
  $('adTotalTeachers').textContent=db.teachers.length;
  $('adTotalStudents').textContent=db.students.length;
  const pending=db.tests.filter(t=>t.status==='pending');
  $('adPendingTests').textContent=pending.length;
  $('adTotalMaterials').textContent=db.materials.length;

  $('cfgAdminPin').value=db.security.adminPin;
  $('cfgTeacherRef').value=db.security.teacherRef;
  $('cfgStudentRef').value=db.security.studentRef;

  $('adminPendingTestsList').innerHTML=pending.length ? `
    <table><thead><tr><th>Title</th><th>Subject</th><th>Questions</th><th>Duration</th><th>Teacher</th><th>Action</th></tr></thead>
    <tbody>${pending.map(t=>`
      <tr>
        <td><b>${esc(t.title)}</b></td><td><span class="pill blue">${esc(t.subject)}</span></td><td>${t.questions.length}</td><td>${Number(t.duration)||0}m</td>
        <td>${esc(t.teacherId)}</td>
        <td style="white-space:nowrap">
          <button class="btn light btn-sm" onclick="openTestPaperInspector('${esc(t.id)}')">👁️ View</button>
          <button class="btn green btn-sm" onclick="approveTest('${esc(t.id)}')">Approve</button>
          <button class="btn red btn-sm" onclick="deleteTestRecord('${esc(t.id)}')">🗑️ Delete</button>
        </td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="muted">No tests awaiting review.</p>';

  $('adminTeacherDirectory').innerHTML = db.teachers.length ? `
    <table>
      <thead>
        <tr>
          <th>Teacher Name</th>
          <th>Mobile / Login ID</th>
          <th>Current PIN</th>
          <th>Working School</th>
          <th>Collections</th>
          <th>Pending</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${db.teachers.map(t => {
          const cash = (t.transactions || []).filter(x => String(x.date || '').startsWith(monthNow())).reduce((a, x) => a + Number(x.amount || 0), 0);
          const pendingCount = countPendingStudents(t);
          const schoolName = t.profile?.school || 'Not Specified';
          return `<tr>
            <td><a href="javascript:void(0)" style="font-weight:700;color:var(--brand);text-decoration:underline" onclick="viewTeacherProfileModal('${esc(t.id)}')">${esc(t.name)} ↗</a></td>
            <td><span class="pill blue">${esc(t.id)}</span></td>
            <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:700">${esc(t.pin)}</code></td>
            <td>${esc(schoolName)}</td>
            <td>${money(cash)}</td>
            <td>${pendingCount}</td>
            <td>
              <button class="btn light btn-sm" onclick="adminResetTeacherPin('${esc(t.id)}')">Reset PIN</button>
              <button class="btn red btn-sm" onclick="adminDeleteTeacherAccount('${esc(t.id)}')">Delete</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`
    : '<p class="muted">No teachers registered yet.</p>';

  renderAdminStudentAccounts();
  renderAdminMessagesAndQueries();
}

function viewTeacherProfileModal(tid) {
  const t = db.teachers.find(x => String(x.id) === String(tid));
  if (!t) return safeAlert('Teacher record not found.');
  const p = t.profile || {};
  showAdminProfilePopup({
    title: `Teacher: ${t.name}`,
    badge: 'TEACHER',
    fields: [
      { label: 'Full Name', val: t.name },
      { label: 'Date of Birth (DOB)', val: p.dob || 'Not Provided' },
      { label: "Father's Name", val: p.father || 'Not Provided' },
      { label: "Mother's Name", val: p.mother || 'Not Provided' },
      { label: 'WhatsApp Contact', val: t.contact || t.id },
      { label: 'Current Working School', val: p.school || 'Not Provided' },
      { label: 'Residential Address', val: p.address || 'Not Provided' }
    ]
  });
}

function viewStudentProfileModal(sid) {
  const s = db.students.find(x => String(x.id) === String(sid));
  if (!s) return safeAlert('Student record not found.');
  const p = s.profile || {};
  showAdminProfilePopup({
    title: `Student: ${s.name}`,
    badge: 'STUDENT',
    fields: [
      { label: 'Portal ID', val: s.id },
      { label: 'Full Name', val: s.name },
      { label: 'Date of Birth (DOB)', val: p.dob || 'Not Provided' },
      { label: "Father's Name", val: p.father || 'Not Provided' },
      { label: "Mother's Name", val: p.mother || 'Not Provided' },
      { label: 'WhatsApp Contact', val: s.contact || 'Not Provided' },
      { label: 'Residential Address', val: p.address || 'Not Provided' }
    ]
  });
}

function showAdminProfilePopup(info) {
  $('admProfileTitle').innerHTML = `${esc(info.title)} <span class="pill blue" style="font-size:11px">${esc(info.badge)}</span>`;
  $('admProfileBody').innerHTML = `
    <table style="min-width:auto;width:100%">
      ${info.fields.map(f => `
        <tr>
          <td style="font-weight:700;color:var(--muted);width:40%;padding:7px 0">${esc(f.label)}</td>
          <td style="padding:7px 0"><b>${esc(f.val)}</b></td>
        </tr>
      `).join('')}
    </table>
  `;
  $('adminProfileModal').classList.add('show');
}
function closeAdminProfileModal() { $('adminProfileModal').classList.remove('show'); }

function adminResetTeacherPin(tid) {
  const t = db.teachers.find(x => String(x.id) === String(tid));
  if (!t) return;
  const newPin = prompt(`Enter new 4-6 digit PIN for Teacher ${t.name} (${t.id}):`, t.pin);
  if (newPin === null) return;
  if (!/^\d{4,6}$/.test(newPin.trim())) return safeAlert('PIN must contain 4 to 6 numeric digits.');
  t.pin = newPin.trim();
  save();
  safeAlert(`Teacher PIN updated for ${t.name}.\nNew Login PIN: ${t.pin}`);
}

function adminDeleteTeacherAccount(tid) {
  const t = db.teachers.find(x => String(x.id) === String(tid));
  if (!t) return;
  if (!confirm(`Warning: Permanently delete Teacher "${t.name}" (${t.id}) along with all linked students and fee logs?`)) return;
  db.teachers = db.teachers.filter(x => String(x.id) !== String(tid));
  save();
  safeAlert('Teacher account deleted.');
}

function renderAdminStudentAccounts() {
  const container = $('adminStudentDirectory');
  if (!container) return;
  const q = ($('adminStudentSearch')?.value || '').trim().toLowerCase();
  
  const list = (db.students || []).filter(s => {
    if (!q) return true;
    return [s.name, s.id, s.contact].some(v => String(v || '').toLowerCase().includes(q));
  });

  container.innerHTML = list.length ? `
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Login ID</th>
          <th>Registered Mobile</th>
          <th>Current PIN</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(s => `
          <tr>
            <td><a href="javascript:void(0)" style="font-weight:700;color:var(--brand);text-decoration:underline" onclick="viewStudentProfileModal('${esc(s.id)}')">${esc(s.name)} ↗</a></td>
            <td><span class="pill blue">${esc(s.id)}</span></td>
            <td>${esc(s.contact || '-')}</td>
            <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:700">${esc(s.pin)}</code></td>
            <td>
              <button class="btn light btn-sm" onclick="adminResetStudentPin('${esc(s.id)}')">Reset PIN</button>
              <button class="btn red btn-sm" onclick="adminDeleteStudentAccount('${esc(s.id)}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<p class="muted">No student portal accounts found.</p>';
}

function adminResetStudentPin(sid) {
  const s = db.students.find(x => String(x.id) === String(sid));
  if (!s) return;
  const newPin = prompt(`Enter new 4-6 digit PIN for ${s.name} (${s.id}):`, s.pin);
  if (newPin === null) return;
  if (!/^\d{4,6}$/.test(newPin.trim())) return safeAlert('PIN must contain 4 to 6 numeric digits.');
  s.pin = newPin.trim();
  save();
  safeAlert(`PIN updated for ${s.name}.\nNew Login PIN: ${s.pin}`);
}

function adminDeleteStudentAccount(sid) {
  if (!confirm('Permanently delete this student login account?')) return;
  db.students = db.students.filter(x => String(x.id) !== String(sid));
  db.testResults = db.testResults.filter(r => String(r.studentId) !== String(sid));
  save();
}

function renderAdminMessagesAndQueries() {
  purgeOldResolvedRecords();
  const container = $('adminMessagesList');
  if (!container) return;

  const pinReqs = (db.pinRequests || []).map(r => ({ ...r, type: 'PIN Reset' }));
  const userQueries = (db.userQueries || []).map(q => ({ ...q, type: 'Query: ' + q.category, name: q.userName, role: q.userRole }));
  
  const combined = [...pinReqs, ...userQueries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const pendingCount = combined.filter(r => r.status === 'pending').length;
  
  const badge = $('adMsgBadge');
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  container.innerHTML = combined.length ? `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type / Role</th>
          <th>User & Message</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${combined.map(r => `
          <tr style="${r.status === 'resolved' ? 'opacity:0.6;background:#f8fafc' : 'background:#fff'}">
            <td><small>${new Date(r.createdAt).toLocaleDateString('en-IN')}</small></td>
            <td>
              <span class="pill ${r.role === 'Teacher' ? 'orange' : 'blue'}">${esc(r.role)}</span><br>
              <small class="muted"><b>${esc(r.type)}</b></small>
            </td>
            <td>
              <b>${esc(r.name)}</b> (☎ ${esc(r.phone || '-')})<br>
              <span style="font-size:12px;color:#475569">"${esc(r.message)}"</span>
            </td>
            <td>
              <span class="pill ${r.status === 'resolved' ? 'green' : 'red'}">
                ${r.status === 'resolved' ? 'Resolved' : 'Pending'}
              </span>
            </td>
            <td style="white-space:nowrap">
              ${r.type === 'PIN Reset' ? `
                <button class="btn green btn-sm" onclick="adminResetAndWhatsApp('${esc(r.id)}')">💬 Reset & WhatsApp</button>
              ` : `
                <button class="btn green btn-sm" onclick="adminReplyQueryWhatsApp('${esc(r.id)}')">💬 WhatsApp Reply</button>
              `}
              ${r.status === 'pending' ? `
                <button class="btn light btn-sm" onclick="markMatterResolved('${esc(r.id)}', '${r.type === 'PIN Reset' ? 'pin' : 'query'}')">✅ Mark Resolved</button>
              ` : ''}
              <button class="btn red btn-sm" onclick="deleteInboxItem('${esc(r.id)}', '${r.type === 'PIN Reset' ? 'pin' : 'query'}')">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '<p class="muted">Inbox is empty. No pending reset requests or user queries.</p>';
}

function markMatterResolved(id, kind) {
  if (kind === 'pin') {
    const req = (db.pinRequests || []).find(x => String(x.id) === String(id));
    if (req) req.status = 'resolved';
  } else {
    const q = (db.userQueries || []).find(x => String(x.id) === String(id));
    if (q) q.status = 'resolved';
  }
  save();
  renderAdminMessagesAndQueries();
}

function deleteInboxItem(id, kind) {
  if (!confirm('Delete this message entry permanently?')) return;
  if (kind === 'pin') {
    db.pinRequests = (db.pinRequests || []).filter(x => String(x.id) !== String(id));
  } else {
    db.userQueries = (db.userQueries || []).filter(x => String(x.id) !== String(id));
  }
  save();
  renderAdminMessagesAndQueries();
}

function adminResetAndWhatsApp(reqId) {
  const req = (db.pinRequests || []).find(x => String(x.id) === String(reqId));
  if (!req) return;

  const newPin = prompt(`Enter new 4-6 digit PIN for ${req.name}:`, Math.floor(1000 + Math.random() * 9000));
  if (!newPin) return;
  if (!/^\d{4,6}$/.test(newPin.trim())) return safeAlert('PIN must contain 4 to 6 numeric digits.');

  if (req.role === 'Teacher') {
    const t = db.teachers.find(x => cleanPhone(x.id) === req.phone || cleanPhone(x.contact) === req.phone);
    if (t) t.pin = newPin.trim();
  } else {
    const s = db.students.find(x => cleanPhone(x.contact) === req.phone);
    if (s) s.pin = newPin.trim();
  }

  req.status = 'resolved';
  save();
  renderAdminMessagesAndQueries();

  const msg = `Hello ${req.name}, your EduConnect login PIN has been successfully reset.\n\nLogin ID / Mobile: ${req.phone}\nNew PIN: ${newPin.trim()}\n\nYou can now log in to your account.`;
  window.open(`https://wa.me/${req.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

function adminReplyQueryWhatsApp(queryId) {
  const q = (db.userQueries || []).find(x => String(x.id) === String(queryId));
  if (!q) return;
  if (!q.phone) return safeAlert('User mobile number is not available for this ticket.');

  const reply = prompt(`Type response for ${q.userName} regarding "${q.category}":`, 'We have addressed your query.');
  if (reply === null) return;

  q.status = 'resolved';
  save();
  renderAdminMessagesAndQueries();

  const msg = `Hello ${q.userName}, regarding your query regarding "${q.category}":\n\n${reply}\n\nThank you,\nEduConnect Administrator`;
  window.open(`https://wa.me/${q.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

function approveTest(id){
  if(currentUser?.role!=='admin') return;
  const t=db.tests.find(x=>String(x.id)===String(id));
  if(t){ t.status='approved'; t.approvedAt=new Date().toISOString(); save(); safeAlert('Test approved.'); }
}
function rejectTest(id){
  if(currentUser?.role!=='admin') return;
  if(!confirm('Reject this test?')) return;
  const t=db.tests.find(x=>String(x.id)===String(id));
  if(t){ t.status='rejected'; t.rejectedAt=new Date().toISOString(); save(); }
}
function saveAdminSecuritySettings(){
  if(currentUser?.role!=='admin') return;
  const a=$('cfgAdminPin').value.trim(), t=$('cfgTeacherRef').value.trim(), s=$('cfgStudentRef').value.trim();
  if(!a || !t || !s) return safeAlert('Security values cannot be empty.');
  if(a.length<6) return safeAlert('Admin PIN must have at least 6 characters.');
  db.security={adminPin:a,teacherRef:t,studentRef:s};
  save();
  safeAlert('Security settings updated.');
}

function getActiveTeacher(){
  if(currentUser?.role!=='teacher') return null;
  return db.teachers.find(t=>String(t.id)===String(currentUser.id)) || null;
}

function countPendingStudents(t){
  const tm=monthNow();
  const list=(t.students||[]).filter(s=>s.type==='tuition' && Number(s.fee)>0);
  return list.filter(s=>calculateOutstandingForStudent(t,s,tm)>0).length;
}

function calculateOutstandingForStudent(t,s,uptoMonth=monthNow()){
  const current = uptoMonth;
  const first = s.billing==='prepaid' ? current : addMonths(current,-1);
  const joined = s.joinedMonth || first;
  const start = joined > first ? joined : first;
  let totalDue=0;
  let cursor=start;
  const nowIndex = monthIndex(current);
  let guard=0;
  while(monthIndex(cursor)<=nowIndex && guard<120){
    totalDue += Number(s.fee)||0;
    cursor=addMonths(cursor,1);
    guard++;
  }
  const paid=(t.transactions||[]).filter(x=>String(x.studentId)===String(s.id))
    .reduce((a,x)=>a+Number(x.amount||0),0);
  return Math.max(0,totalDue-paid);
}
function monthIndex(ym){
  const [y,m]=String(ym).split('-').map(Number);
  return (Number(y)||0)*12+(Number(m)||1);
}

function renderTeacherPanel(){
  const t=getActiveTeacher();
  if(!t) return;
  t.students=t.students||[]; t.transactions=t.transactions||[]; t.diary=t.diary||[];
  t.offlineMarks=t.offlineMarks||[]; t.copyCheckins=t.copyCheckins||[]; t.projects=t.projects||[];
  t.profile=t.profile||{};

  const isApril = new Date().getMonth() === 3;
  if ($('aprilRolloverBanner')) $('aprilRolloverBanner').style.display = isApril ? 'flex' : 'none';

  $('teacherGreeting').textContent=`${t.name}'s Workspace`;
  $('teacherSubId').textContent=`Teacher ID: ${t.id}`;
  const tuition=t.students.filter(s=>s.type==='tuition');
  const school=t.students.filter(s=>s.type==='school');
  $('tStatSchool').textContent=school.length;
  $('tStatTuition').textContent=tuition.length;
  const cash=(t.transactions||[]).filter(x=>String(x.date||'').startsWith(monthNow())).reduce((a,x)=>a+Number(x.amount||0),0);
  $('tStatCash').textContent=money(cash);
  $('tStatPending').textContent=countPendingStudents(t);
  
  populateTeacherSelfProfile(t);
  populateStudentClassFilterDropdown(t);
  renderTeacherStudentsUI(t);
  renderTeacherFeesUI(t);
  renderTeacherMaterialsUI(t);
  populateAttendanceClassFilterDropdown(t);
  renderAttendanceUI(t);
  renderMonthlyAttendanceReport(t);
  populateOfflineMarksClassFilterDropdown(t);
  renderOfflineMarksUI(t);
  renderCopyCheckinUI(t);
  renderProjectTrackerUI(t);
  renderTeacherCreatedTests(t);
  renderDiaryUI(t);
  updateNextRollDisplay();
}

function setStudentCategoryFilter(cat) {
  currentStudentCategoryFilter = cat;
  $('filterStAllBtn').className = cat === 'all' ? 'btn btn-sm' : 'btn light btn-sm';
  $('filterStTuitionBtn').className = cat === 'tuition' ? 'btn green btn-sm' : 'btn light btn-sm';
  $('filterStSchoolBtn').className = cat === 'school' ? 'btn blue btn-sm' : 'btn light btn-sm';
  
  populateStudentClassFilterDropdown(getActiveTeacher());
  renderTeacherStudentsUI(getActiveTeacher());
}

function onStudentClassFilterChange() {
  currentStudentClassFilter = $('filterStClassSelect')?.value || 'all';
  renderTeacherStudentsUI(getActiveTeacher());
}

function populateStudentClassFilterDropdown(t) {
  if (!t) return;
  const select = $('filterStClassSelect');
  if (!select) return;

  const currentVal = select.value;
  let students = t.students || [];
  if (currentStudentCategoryFilter !== 'all') {
    students = students.filter(s => s.type === currentStudentCategoryFilter);
  }

  const classes = [...new Set(students.map(s => String(s.className || '').trim()).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">All Classes</option>' + 
    classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  if (classes.includes(currentVal)) {
    select.value = currentVal;
    currentStudentClassFilter = currentVal;
  } else {
    select.value = 'all';
    currentStudentClassFilter = 'all';
  }
}

function renderTeacherStudentsUI(t){
  if(!t) return;
  const allList = t.students || [];

  if ($('countAllSt')) $('countAllSt').textContent = allList.length;
  if ($('countTuitionSt')) $('countTuitionSt').textContent = allList.filter(s => s.type === 'tuition').length;
  if ($('countSchoolSt')) $('countSchoolSt').textContent = allList.filter(s => s.type === 'school').length;

  const searchInput = $('teacherStudentSearch');
  const q = (searchInput?.value || '').trim().toLowerCase();

  const filtered = allList.filter(s => {
    if (currentStudentCategoryFilter !== 'all' && s.type !== currentStudentCategoryFilter) return false;
    if (currentStudentClassFilter !== 'all' && String(s.className || '').trim() !== currentStudentClassFilter) return false;
    if (!q) return true;
    return [s.name, s.className, s.roll, s.contact, s.portalId].some(v => String(v || '').toLowerCase().includes(q));
  });

  $('teacherStudentsList').innerHTML = filtered.map(s => `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <b>${esc(s.name)}</b>
        <span class="pill ${s.type === 'school' ? 'blue' : 'green'}">${s.type.toUpperCase()}</span>
      </div>
      <small class="muted">Class: <b style="color:var(--brand)">${esc(s.className || '-')}</b> | Roll: <b>${esc(s.roll || '-')}</b></small><br>
      <small>Parent: ${esc(s.father || '-')} | ☎ ${esc(s.contact || '-')}</small>
      ${s.portalLinked ? `<br><small class="pill blue">Portal ID: ${esc(s.portalId)}</small>` : ''}
      ${s.weakness ? `<p style="margin:6px 0 0;font-size:12px;color:var(--orange)"><b>Note:</b> ${esc(s.weakness)}</p>` : ''}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn blue btn-sm" onclick="openStudentComprehensiveReport('${esc(s.id)}')">📊 Full Report</button>
        <button class="btn light btn-sm" onclick="openEditStudentModal('${esc(s.id)}')">✏️ Edit</button>
        <button class="btn red btn-sm" onclick="deleteTeacherStudent('${esc(s.id)}')">🗑️ Delete</button>
      </div>
    </div>`).join('') || '<p class="muted" style="padding:10px">No students match this category and class filter.</p>';

  const options = '<option value="">-- Choose Student --</option>' + allList.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.className || '-')} | Roll: ${esc(s.roll || '-')})</option>`).join('');
  if ($('payStudentSelect')) $('payStudentSelect').innerHTML = options;
  if ($('weaknessStudentSel')) $('weaknessStudentSel').innerHTML = options;
}

function closeComprehensiveModal() {
  $('studentComprehensiveModal').classList.remove('show');
}

function openStudentComprehensiveReport(sid) {
  const t = getActiveTeacher();
  if (!t) return;
  const s = t.students.find(x => String(x.id) === String(sid));
  if (!s) return safeAlert('Student record not found.');

  $('scrModalTitle').innerHTML = `📊 Comprehensive Dossier: <b>${esc(s.name)}</b>`;

  const dues = (s.type === 'tuition') ? calculateOutstandingForStudent(t, s, monthNow()) : 0;
  const feeHistory = (t.transactions || []).filter(x => String(x.studentId) === String(s.id));

  const offlineScores = [];
  (t.offlineMarks || []).forEach(om => {
    const sc = (om.scores || []).find(x => String(x.studentId) === String(s.id));
    if (sc) {
      offlineScores.push({
        title: om.title,
        date: om.date,
        score: sc.score,
        max: om.maxMarks,
        pct: ((sc.score / om.maxMarks) * 100).toFixed(1)
      });
    }
  });

  const onlineScores = db.testResults.filter(r => 
    (s.portalId && String(r.studentId) === String(s.portalId)) ||
    (s.contact && cleanPhone(r.studentPhone) === cleanPhone(s.contact))
  );

  let attSummaryText = '';
  if (s.type === 'school') {
    const currM = monthNow();
    const agg = (s.monthlyAttendance && s.monthlyAttendance[currM]) || {};
    const w = Number(agg.workingDays) || 0;
    const p = Number(agg.presentDays) || 0;
    const pct = w > 0 ? ((p / w) * 100).toFixed(1) : '100.0';
    attSummaryText = `<b style="color:var(--green)">${pct}%</b>School Monthly (${p}/${w} Days)`;
  } else {
    let presentCount = 0, absentCount = 0;
    Object.entries(s.attendance || {}).forEach(([dt, stat]) => {
      if (dt.startsWith(monthNow())) {
        if (stat === 'Present') presentCount++;
        else if (stat === 'Absent') absentCount++;
      }
    });
    const held = presentCount + absentCount;
    const attPct = held > 0 ? ((presentCount / held) * 100).toFixed(1) : '100.0';
    attSummaryText = `<b style="color:var(--green)">${attPct}%</b>Tuition Monthly (${presentCount}/${held} Held)`;
  }

  $('scrModalBody').innerHTML = `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h3 style="margin:0;color:var(--brand);font-size:18px">${esc(s.name)}</h3>
          <small class="muted">Class: <b>${esc(s.className || '-')}</b> | Roll: <b>${esc(s.roll || '-')}</b> | Type: <b class="pill ${s.type === 'school' ? 'blue' : 'green'}">${esc(s.type.toUpperCase())}</b></small>
        </div>
        <div style="text-align:right">
          <small class="muted">Contact / Parent</small>
          <div style="font-size:12px"><b>☎ ${esc(s.contact || '-')}</b> (${esc(s.father || 'Parent')})</div>
        </div>
      </div>
      ${s.weakness ? `<p style="margin:8px 0 0;font-size:12px;color:var(--orange);background:#fff7ed;padding:6px;border-radius:6px"><b>Teacher Remark:</b> ${esc(s.weakness)}</p>` : ''}
    </div>

    <div class="stats" style="margin-bottom:12px">
      <div class="stat">${attSummaryText}Attendance</div>
      <div class="stat"><b style="color:${dues > 0 ? 'var(--red)' : 'var(--green)'}">${money(dues)}</b>Pending Dues</div>
      <div class="stat"><b style="color:var(--brand)">${offlineScores.length}</b>Offline Tests</div>
      <div class="stat"><b>${feeHistory.length}</b>Paid Slips</div>
    </div>

    <h4 style="margin:12px 0 6px">📝 Exam & Unit Test Performance</h4>
    <div class="tablewrap" style="max-height:160px;margin-bottom:14px">
      ${(offlineScores.length || onlineScores.length) ? `
        <table>
          <thead><tr><th>Exam Title</th><th>Type</th><th>Date</th><th>Score</th><th>Percentage</th></tr></thead>
          <tbody>
            ${offlineScores.map(o => `
              <tr>
                <td><b>${esc(o.title)}</b></td>
                <td><span class="pill gray">Offline Unit</span></td>
                <td>${esc(o.date)}</td>
                <td>${o.score} / ${o.max}</td>
                <td><b>${o.pct}%</b></td>
              </tr>
            `).join('')}
            ${onlineScores.map(m => `
              <tr>
                <td><b>${esc(m.testTitle)}</b></td>
                <td><span class="pill blue">Online Mock</span></td>
                <td>${esc(m.date)}</td>
                <td>${m.score} / ${m.total}</td>
                <td><b>${((m.score / m.total) * 100).toFixed(1)}%</b></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="muted" style="padding:8px">No test records uploaded yet.</p>'}
    </div>

    <h4 style="margin:12px 0 6px">💰 Fee Payment History</h4>
    <div class="tablewrap" style="max-height:160px">
      ${feeHistory.length ? `
        <table>
          <thead><tr><th>Paid Date</th><th>Billing Month</th><th>Amount</th><th>Mode</th><th>Receipt Ref</th></tr></thead>
          <tbody>
            ${feeHistory.map(f => `
              <tr>
                <td>${esc(f.date)}</td>
                <td><b>${esc(f.month)}</b></td>
                <td style="color:var(--green);font-weight:700">${money(f.amount)}</td>
                <td>${esc(f.mode)}</td>
                <td><code>#${esc(String(f.id).slice(-6))}</code></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="muted" style="padding:8px">No fee transactions recorded for this student.</p>'}
    </div>
  `;

  $('studentComprehensiveModal').classList.add('show');
}

function setAttendanceCategoryFilter(cat) {
  currentAttCategoryFilter = cat;
  $('attFilterAllBtn').className = cat === 'all' ? 'btn btn-sm' : 'btn light btn-sm';
  $('attFilterTuitionBtn').className = cat === 'tuition' ? 'btn green btn-sm' : 'btn light btn-sm';
  $('attFilterSchoolBtn').className = cat === 'school' ? 'btn blue btn-sm' : 'btn light btn-sm';

  const isSchoolMode = cat === 'school';
  $('attDailyContainer').style.display = isSchoolMode ? 'none' : 'block';
  $('attSchoolAggregateContainer').style.display = isSchoolMode ? 'block' : 'none';

  populateAttendanceClassFilterDropdown(getActiveTeacher());
  if (isSchoolMode) {
    renderSchoolAggregateAttendance(getActiveTeacher());
  } else {
    renderAttendanceUI(getActiveTeacher());
    renderMonthlyAttendanceReport(getActiveTeacher());
  }
}

function onAttendanceClassFilterChange() {
  currentAttClassFilter = $('attFilterClassSelect')?.value || 'all';
  if (currentAttCategoryFilter === 'school') {
    renderSchoolAggregateAttendance(getActiveTeacher());
  } else {
    renderAttendanceUI(getActiveTeacher());
    renderMonthlyAttendanceReport(getActiveTeacher());
  }
}

function populateAttendanceClassFilterDropdown(t) {
  if (!t) return;
  const select = $('attFilterClassSelect');
  if (!select) return;

  const currentVal = select.value;
  let students = t.students || [];
  if (currentAttCategoryFilter !== 'all') {
    students = students.filter(s => s.type === currentAttCategoryFilter);
  }

  const classes = [...new Set(students.map(s => String(s.className || '').trim()).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">All Classes</option>' + 
    classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  if (classes.includes(currentVal)) {
    select.value = currentVal;
    currentAttClassFilter = currentVal;
  } else {
    select.value = 'all';
    currentAttClassFilter = 'all';
  }
}

function renderAttendanceUI(t){
  if (!t) return;
  const dt = $('attRegisterDate')?.value || today();
  let students = t.students || [];

  if (currentAttCategoryFilter !== 'all') {
    students = students.filter(s => s.type === currentAttCategoryFilter);
  }
  if (currentAttClassFilter !== 'all') {
    students = students.filter(s => String(s.className || '').trim() === currentAttClassFilter);
  }

  $('attendanceRegisterBox').innerHTML = `
    <table><thead><tr><th>Student</th><th>Class</th><th>Status (${dt})</th><th>Action</th></tr></thead>
    <tbody>${students.map(s => {
      s.attendance = s.attendance || {};
      const status = s.attendance[dt] || 'Not Marked';
      const cls = status === 'Present' ? 'green' : status === 'Absent' ? 'red' : status === 'Holiday' ? 'orange' : 'gray';
      return `<tr>
        <td><b>${esc(s.name)}</b> <small class="muted">(${esc(s.roll || '-')})</small></td>
        <td>${esc(s.className || '-')}</td>
        <td><span class="pill ${cls}">${status}</span></td>
        <td>
          <button class="btn green btn-sm" onclick="setAttendance('${esc(s.id)}','${dt}','Present')">Present</button>
          <button class="btn red btn-sm" onclick="setAttendance('${esc(s.id)}','${dt}','Absent')">Absent</button>
          <button class="btn orange btn-sm" onclick="setAttendance('${esc(s.id)}','${dt}','Holiday')">Holiday</button>
        </td></tr>`;
    }).join('')}</tbody></table>`;
}

function setAttendance(sid, dt, status){
  const t = getActiveTeacher(), s = t?.students.find(x => String(x.id) === String(sid));
  if (!s) return;
  s.attendance = s.attendance || {};
  s.attendance[dt] = status;
  save();
}

function markWholeDayHoliday(){
  const t = getActiveTeacher();
  if (!t) return;
  const dt = $('attRegisterDate')?.value || today();
  if (!confirm(`Mark ${dt} as Holiday for the currently filtered batch?`)) return;

  let students = t.students || [];
  if (currentAttCategoryFilter !== 'all') students = students.filter(s => s.type === currentAttCategoryFilter);
  if (currentAttClassFilter !== 'all') students = students.filter(s => String(s.className || '').trim() === currentAttClassFilter);

  students.forEach(s => {
    s.attendance = s.attendance || {};
    s.attendance[dt] = 'Holiday';
  });
  save();
  safeAlert(`Attendance for ${dt} marked as Holiday.`);
}

function renderMonthlyAttendanceReport(t){
  if (!t) return;
  const selMonth = $('attMonthSelect')?.value || monthNow();
  const summaryBox = $('attendanceMonthlySummaryBox');
  if (!summaryBox) return;

  let students = t.students || [];
  if (currentAttCategoryFilter !== 'all') students = students.filter(s => s.type === currentAttCategoryFilter);
  if (currentAttClassFilter !== 'all') students = students.filter(s => String(s.className || '').trim() === currentAttClassFilter);

  const rows = students.map(s => {
    s.attendance = s.attendance || {};
    let present = 0, absent = 0, holidays = 0;
    Object.entries(s.attendance).forEach(([dateStr, status]) => {
      if (dateStr.startsWith(selMonth)) {
        if (status === 'Present') present++;
        else if (status === 'Absent') absent++;
        else if (status === 'Holiday') holidays++;
      }
    });
    const workingHeld = present + absent;
    const pct = workingHeld > 0 ? ((present / workingHeld) * 100).toFixed(1) : '100.0';
    return `<tr>
      <td><b>${esc(s.name)}</b> <small class="muted">(${esc(s.roll || '-')})</small></td>
      <td>${esc(s.className || '-')}</td>
      <td>${workingHeld}</td>
      <td style="color:var(--green);font-weight:700">${present}</td>
      <td style="color:var(--red);font-weight:700">${absent}</td>
      <td style="color:var(--orange)">${holidays}</td>
      <td><b>${pct}%</b></td>
    </tr>`;
  });

  summaryBox.innerHTML = rows.length ? `
    <table><thead><tr><th>Student</th><th>Class</th><th>Held</th><th>Present</th><th>Absent</th><th>Holidays</th><th>Attendance %</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>` : '<p class="muted">No student records found.</p>';
}

function renderSchoolAggregateAttendance(t) {
  if (!t) return;
  const selMonth = $('schoolAttMonthInput')?.value || monthNow();
  const box = $('schoolAggregateTableBox');
  if (!box) return;

  let schoolStudents = (t.students || []).filter(s => s.type === 'school');
  if (currentAttClassFilter !== 'all') {
    schoolStudents = schoolStudents.filter(s => String(s.className || '').trim() === currentAttClassFilter);
  }

  box.innerHTML = schoolStudents.length ? `
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Class</th>
          <th>Roll</th>
          <th style="width:120px">Working Days</th>
          <th style="width:120px">Days Present</th>
          <th>Days Absent (Auto)</th>
          <th>Attendance %</th>
        </tr>
      </thead>
      <tbody>
        ${schoolStudents.map(s => {
          s.monthlyAttendance = s.monthlyAttendance || {};
          const rec = s.monthlyAttendance[selMonth] || { workingDays: 24, presentDays: 22 };
          const absent = Math.max(0, rec.workingDays - rec.presentDays);
          const pct = rec.workingDays > 0 ? ((rec.presentDays / rec.workingDays) * 100).toFixed(1) : '100.0';
          return `
            <tr>
              <td><b>${esc(s.name)}</b></td>
              <td>${esc(s.className || '-')}</td>
              <td>${esc(s.roll || '-')}</td>
              <td>
                <input type="number" class="sch-att-working" data-sid="${esc(s.id)}" value="${rec.workingDays}" 
                       style="padding:4px;width:90px" oninput="recomputeSchoolAttRow(this)">
              </td>
              <td>
                <input type="number" class="sch-att-present" data-sid="${esc(s.id)}" value="${rec.presentDays}" 
                       style="padding:4px;width:90px" oninput="recomputeSchoolAttRow(this)">
              </td>
              <td><span id="abs_${esc(s.id)}" style="color:var(--red);font-weight:700">${absent}</span></td>
              <td><b id="pct_${esc(s.id)}" style="color:var(--green)">${pct}%</b></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  ` : '<p class="muted">No school students found for this selection.</p>';
}

function recomputeSchoolAttRow(input) {
  const sid = input.dataset.sid;
  const row = input.closest('tr');
  const w = Number(row.querySelector('.sch-att-working').value) || 0;
  const p = Number(row.querySelector('.sch-att-present').value) || 0;
  const abs = Math.max(0, w - p);
  const pct = w > 0 ? ((p / w) * 100).toFixed(1) : '100.0';
  
  const absEl = $('abs_' + sid);
  const pctEl = $('pct_' + sid);
  if (absEl) absEl.textContent = abs;
  if (pctEl) pctEl.textContent = `${pct}%`;
}

function applyDefaultWorkingDaysToAll() {
  const def = Number($('schoolDefaultWorkingDays').value) || 24;
  document.querySelectorAll('.sch-att-working').forEach(inp => {
    inp.value = def;
    recomputeSchoolAttRow(inp);
  });
}

function saveSchoolAggregateAttendance() {
  const t = getActiveTeacher();
  if (!t) return;
  const selMonth = $('schoolAttMonthInput')?.value || monthNow();

  document.querySelectorAll('.sch-att-working').forEach(wInput => {
    const sid = wInput.dataset.sid;
    const row = wInput.closest('tr');
    const pInput = row.querySelector('.sch-att-present');
    const w = Number(wInput.value) || 0;
    const p = Number(pInput.value) || 0;

    const s = t.students.find(x => String(x.id) === String(sid));
    if (s) {
      s.monthlyAttendance = s.monthlyAttendance || {};
      s.monthlyAttendance[selMonth] = { workingDays: w, presentDays: p };
    }
  });

  save();
  safeAlert('School monthly attendance register saved successfully.');
}

function populateTeacherSelfProfile(t) {
  const p = t.profile || {};
  $('tpProfileName').value = p.name || t.name || '';
  $('tpProfileDob').value = p.dob || '';
  $('tpProfileFather').value = p.father || '';
  $('tpProfileMother').value = p.mother || '';
  $('tpProfileContact').value = p.contact || t.contact || '';
  $('tpProfileSchool').value = p.school || '';
  $('tpProfileAddress').value = p.address || '';
}

function saveTeacherProfileSelf() {
  const t = getActiveTeacher();
  if (!t) return;
  const name = $('tpProfileName').value.trim();
  if (!name) return safeAlert('Name cannot be blank.');

  t.name = name;
  t.profile = {
    name,
    dob: $('tpProfileDob').value,
    father: $('tpProfileFather').value.trim(),
    mother: $('tpProfileMother').value.trim(),
    contact: cleanPhone($('tpProfileContact').value.trim()),
    school: $('tpProfileSchool').value.trim(),
    address: $('tpProfileAddress').value.trim()
  };
  save();
  safeAlert('Teacher profile updated successfully.');
}

function populateStudentSelfProfile() {
  if (currentUser?.role !== 'student') return;
  const s = db.students.find(x => String(x.id) === String(currentUser.id));
  if (!s) return;
  const p = s.profile || {};
  $('spProfileName').value = p.name || s.name || '';
  $('spProfileDob').value = p.dob || '';
  $('spProfileFather').value = p.father || '';
  $('spProfileMother').value = p.mother || '';
  $('spProfileContact').value = p.contact || s.contact || '';
  $('spProfileAddress').value = p.address || '';
}

function saveStudentProfileSelf() {
  if (currentUser?.role !== 'student') return;
  const s = db.students.find(x => String(x.id) === String(currentUser.id));
  if (!s) return;
  const name = $('spProfileName').value.trim();
  if (!name) return safeAlert('Name cannot be blank.');

  s.name = name;
  s.profile = {
    name,
    dob: $('spProfileDob').value,
    father: $('spProfileFather').value.trim(),
    mother: $('spProfileMother').value.trim(),
    contact: cleanPhone($('spProfileContact').value.trim()),
    address: $('spProfileAddress').value.trim()
  };
  save();
  safeAlert('Personal profile saved successfully.');
}

function renderStudentPerformanceReport() {
  if (currentUser?.role !== 'student') return;
  const container = $('studentReportCardContent');
  if (!container) return;

  const currentM = monthNow();
  let teacherRecords = [];
  db.teachers.forEach(t => {
    const st = (t.students || []).find(x => x.portalId === currentUser.id || cleanPhone(x.contact) === cleanPhone(currentUser.contact));
    if (st) teacherRecords.push({ teacher: t, student: st });
  });

  let present = 0, totalClasses = 0;
  teacherRecords.forEach(tr => {
    if (tr.student.type === 'school') {
      const agg = (tr.student.monthlyAttendance && tr.student.monthlyAttendance[currentM]) || {};
      totalClasses += Number(agg.workingDays) || 0;
      present += Number(agg.presentDays) || 0;
    } else {
      Object.entries(tr.student.attendance || {}).forEach(([dt, stat]) => {
        if (dt.startsWith(currentM)) {
          if (stat === 'Present') { present++; totalClasses++; }
          else if (stat === 'Absent') { totalClasses++; }
        }
      });
    }
  });
  const attPct = totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(1) : '100.0';

  const mockAttempts = db.testResults.filter(r => String(r.studentId) === String(currentUser.id));
  const totalScoreObt = mockAttempts.reduce((a, b) => a + Number(b.score || 0), 0);
  const totalMax = mockAttempts.reduce((a, b) => a + Number(b.total || 0), 0);
  const mockAvg = totalMax > 0 ? ((totalScoreObt / totalMax) * 100).toFixed(1) : '0.0';

  let offlineScoresList = [];
  teacherRecords.forEach(tr => {
    (tr.teacher.offlineMarks || []).forEach(om => {
      const match = (om.scores || []).find(sc => String(sc.studentId) === String(tr.student.id));
      if (match) {
        offlineScoresList.push({
          test: om.title,
          date: om.date,
          score: match.score,
          max: om.maxMarks,
          pct: ((match.score / om.maxMarks) * 100).toFixed(1)
        });
      }
    });
  });

  container.innerHTML = `
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><b style="color:var(--green)">${attPct}%</b>Monthly Attendance</div>
      <div class="stat"><b style="color:var(--brand)">${mockAttempts.length}</b>Mock Tests Attempted</div>
      <div class="stat"><b style="color:var(--orange)">${mockAvg}%</b>Mock Exam Average</div>
    </div>

    <h4 style="margin:16px 0 8px 0">Offline Chapter & Unit Test Scores</h4>
    <div class="tablewrap">
      ${offlineScoresList.length ? `
        <table>
          <thead><tr><th>Test Name</th><th>Date</th><th>Score</th><th>Max</th><th>Percentage</th></tr></thead>
          <tbody>${offlineScoresList.map(s => `
            <tr><td><b>${esc(s.test)}</b></td><td>${esc(s.date)}</td><td>${s.score}</td><td>${s.max}</td><td><b>${s.pct}%</b></td></tr>
          `).join('')}</tbody>
        </table>
      ` : '<p class="muted">No offline test records uploaded by your teacher yet.</p>'}
    </div>
  `;
}

function openRolloverModal() {
  const t = getActiveTeacher();
  if (!t) return;
  const container = $('rolloverStudentList');
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th><input type="checkbox" onchange="toggleAllRollover(this)"></th>
          <th>Student Name</th>
          <th>Roll No</th>
          <th>Current Class</th>
          <th>Target Class (+1)</th>
        </tr>
      </thead>
      <tbody>
        ${(t.students || []).map(s => {
          const nextClass = computeNextClass(s.className);
          return `
            <tr>
              <td><input type="checkbox" class="ro-check" data-sid="${esc(s.id)}"></td>
              <td><b>${esc(s.name)}</b></td>
              <td>${esc(s.roll || '-')}</td>
              <td>${esc(s.className || '-')}</td>
              <td style="color:var(--green);font-weight:700">${esc(nextClass)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  $('rolloverModal').classList.add('show');
}
function closeRolloverModal() { $('rolloverModal').classList.remove('show'); }

function toggleAllRollover(master) {
  document.querySelectorAll('.ro-check').forEach(cb => cb.checked = master.checked);
}

function computeNextClass(current) {
  const str = String(current || '').trim();
  const match = str.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return str.replace(String(num), String(num + 1));
  }
  return str ? `${str} (Promoted)` : 'Class 1';
}

function executeBulkClassPromotion() {
  const t = getActiveTeacher();
  if (!t) return;
  const checked = document.querySelectorAll('.ro-check:checked');
  if (!checked.length) return safeAlert('Please select at least one student to promote.');
  if (!confirm(`Promote ${checked.length} selected students to the next class?`)) return;

  checked.forEach(cb => {
    const sid = cb.dataset.sid;
    const s = t.students.find(x => String(x.id) === String(sid));
    if (s) s.className = computeNextClass(s.className);
  });
  save();
  closeRolloverModal();
  safeAlert(`${checked.length} students promoted to their next academic class.`);
}

function executeBulkPurgeSelected() {
  const t = getActiveTeacher();
  if (!t) return;
  const checked = document.querySelectorAll('.ro-check:checked');
  if (!checked.length) return safeAlert('Please select at least one student to purge.');
  if (!confirm(`Warning: Permanently remove ${checked.length} selected students to free memory?`)) return;

  const removeIds = new Set(Array.from(checked).map(cb => cb.dataset.sid));
  t.students = t.students.filter(s => !removeIds.has(String(s.id)));
  t.transactions = t.transactions.filter(x => !removeIds.has(String(x.studentId)));
  save();
  closeRolloverModal();
  safeAlert('Selected student records purged successfully.');
}

function downloadCSV(filename, rows) {
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportAttendanceCSV() {
  const t = getActiveTeacher();
  if (!t) return;
  const selMonth = $('attMonthSelect')?.value || monthNow();
  const header = ["Student Name", "Roll No", "Class", "Classes Held", "Present", "Absent", "Holidays", "Attendance %"];
  const rows = [header];

  (t.students || []).forEach(s => {
    let p = 0, a = 0, h = 0;
    Object.entries(s.attendance || {}).forEach(([dt, stat]) => {
      if (dt.startsWith(selMonth)) {
        if (stat === 'Present') p++;
        else if (stat === 'Absent') a++;
        else if (stat === 'Holiday') h++;
      }
    });
    const held = p + a;
    const pct = held > 0 ? ((p / held) * 100).toFixed(1) + '%' : '100%';
    rows.push([s.name, s.roll || '-', s.className || '-', held, p, a, h, pct]);
  });

  downloadCSV(`Attendance_${selMonth}.csv`, rows);
}

function exportOfflineMarksCSV() {
  const t = getActiveTeacher();
  if (!t) return;
  const title = $('offlineTestName')?.value.trim() || 'Unit_Test';
  const header = ["Student Name", "Roll No", "Class", "Marks Obtained"];
  const rows = [header];

  (t.students || []).forEach(s => {
    const inp = document.querySelector(`.offline-score-input[data-sid="${s.id}"]`);
    rows.push([s.name, s.roll || '-', s.className || '-', inp?.value || '0']);
  });

  downloadCSV(`OfflineMarks_${title}_${today()}.csv`, rows);
}

function generateTuitionRoll(teacher){
  const currentYear = new Date().getFullYear();
  const prefix = `EC-${currentYear}-`;
  const existingNums = (teacher.students || [])
    .filter(s => s.type === 'tuition' && String(s.roll || '').startsWith(prefix))
    .map(s => {
      const numPart = parseInt(String(s.roll).replace(prefix, ''), 10);
      return isNaN(numPart) ? 0 : numPart;
    });
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

function openEditStudentModal(id){
  const t=getActiveTeacher(), s=t?.students.find(x=>String(x.id)===String(id));
  if(!s) return;
  $('editStId').value=s.id;
  $('editStName').value=s.name||'';
  $('editStFather').value=s.father||'';
  $('editStContact').value=s.contact||'';
  $('editStClass').value=s.className||'';
  $('editStRoll').value=s.roll||'';
  $('editStFee').value=s.fee||0;
  $('editStudentModal').classList.add('show');
}
function closeEditStudentModal(){ $('editStudentModal').classList.remove('show'); }

function updateTeacherStudent(){
  const t=getActiveTeacher();
  const sid=$('editStId').value;
  const s=t?.students.find(x=>String(x.id)===String(sid));
  if(!s) return;
  const name=$('editStName').value.trim();
  if(!name) return safeAlert('Student name is required.');
  s.name=name;
  s.father=$('editStFather').value.trim();
  s.contact=cleanPhone($('editStContact').value.trim());
  s.className=$('editStClass').value.trim();
  s.roll=$('editStRoll').value.trim();
  s.fee=Math.max(0,Number($('editStFee').value)||0);
  save();
  closeEditStudentModal();
  safeAlert('Student details updated.');
}

function deleteTeacherStudent(id){
  const t=getActiveTeacher();
  if(!t || !confirm('Delete this student and all linked records?')) return;
  t.students=t.students.filter(s=>String(s.id)!==String(id));
  t.transactions=(t.transactions||[]).filter(x=>String(x.studentId)!==String(id));
  save();
}

function saveOfflineMarks(){
  const t=getActiveTeacher();
  if(!t) return;
  const title=$('offlineTestName').value.trim();
  const max=Number($('offlineTestMax').value);
  const dt=$('offlineTestDate').value||today();
  if(!title||max<=0) return safeAlert('Enter test name and valid maximum marks.');
  const scores=[];
  document.querySelectorAll('.offline-score-input').forEach(inp=>{
    scores.push({ studentId:inp.dataset.sid, score:Number(inp.value)||0 });
  });
  t.offlineMarks=t.offlineMarks||[];
  t.offlineMarks.push({ id:makeId('omark'), title, maxMarks:max, date:dt, scores });
  save();
  $('offlineTestName').value='';
  safeAlert('Offline test marks recorded successfully.');
}

function renderCopyCheckinUI(t){
  if(!t) return;
  const tbl=$('copyCheckinTable');
  if(!tbl) return;
  const schoolStudents=(t.students||[]).filter(s=>s.type==='school');
  tbl.innerHTML=schoolStudents.length?`
    <table><thead><tr><th>Student</th><th>Roll</th><th>Class</th><th>Notebook Status</th></tr></thead>
    <tbody>${schoolStudents.map(s=>`
      <tr>
        <td><b>${esc(s.name)}</b></td><td>${esc(s.roll||'-')}</td><td>${esc(s.className||'-')}</td>
        <td>
          <select data-copy-sid="${esc(s.id)}">
            <option value="Checked">✅ Checked / Complete</option>
            <option value="Pending">⏳ Pending / Incomplete</option>
            <option value="Not Brought">❌ Not Brought</option>
          </select>
        </td>
      </tr>`).join('')}</tbody></table>`:'<p class="muted">No school students registered yet.</p>';
}

function saveCopyCheckin(){
  const t=getActiveTeacher();
  if(!t) return;
  const ch=$('copyChapterName').value.trim();
  if(!ch) return safeAlert('Please enter chapter or exercise name.');
  const records=[];
  document.querySelectorAll('[data-copy-sid]').forEach(sel=>{
    records.push({ studentId:sel.dataset.copySid, status:sel.value });
  });
  t.copyCheckins=t.copyCheckins||[];
  t.copyCheckins.push({ id:makeId('copy'), chapter:ch, subject:$('copySubject').value, date:today(), records });
  save();
  $('copyChapterName').value='';
  safeAlert('Notebook check-in status saved.');
}

function renderProjectTrackerUI(t){
  if(!t) return;
  const tbl=$('projectSubmissionTable');
  if(!tbl) return;
  const schoolStudents=(t.students||[]).filter(s=>s.type==='school');
  tbl.innerHTML=schoolStudents.length?`
    <table><thead><tr><th>Student</th><th>Roll</th><th>Submission Status</th><th>Grade / Marks</th></tr></thead>
    <tbody>${schoolStudents.map(s=>`
      <tr>
        <td><b>${esc(s.name)}</b></td><td>${esc(s.roll||'-')}</td>
        <td>
          <select data-proj-sid="${esc(s.id)}">
            <option value="Submitted">✅ Submitted</option>
            <option value="In Progress">⏳ In Progress</option>
            <option value="Late">⚠️ Late Submission</option>
            <option value="Not Started">❌ Not Started</option>
          </select>
        </td>
        <td><input type="text" data-proj-grade="${esc(s.id)}" placeholder="e.g. A+ or 19/20" style="width:90px;padding:4px"></td>
      </tr>`).join('')}</tbody></table>`:'<p class="muted">No school students registered yet.</p>';
}

function saveProjectTrack(){
  const t=getActiveTeacher();
  if(!t) return;
  const title=$('projTitle').value.trim();
  if(!title) return safeAlert('Please enter project title.');
  const records=[];
  document.querySelectorAll('[data-proj-sid]').forEach(sel=>{
    const sid=sel.dataset.projSid;
    const gradeInput=document.querySelector(`[data-proj-grade="${sid}"]`);
    records.push({ studentId:sid, status:sel.value, grade:gradeInput?.value.trim()||'' });
  });
  t.projects=t.projects||[];
  t.projects.push({ id:makeId('proj'), title, date:$('projDate').value||today(), deadline:$('projDeadline').value||'', records });
  save();
  $('projTitle').value='';
  safeAlert('Project submission records saved.');
}

function recordTeacherFee(){
  const t=getActiveTeacher();
  const sid=String($('payStudentSelect').value);
  const amount=Number($('payAmount').value);
  const month=$('payBillingMonth').value||monthNow();
  const date=$('payDate').value||today();
  if(!sid || !t) return safeAlert('Select a student.');
  if(!Number.isFinite(amount)||amount<=0) return safeAlert('Enter a valid payment amount.');
  if(!/^\d{4}-\d{2}$/.test(month)) return safeAlert('Select a valid billing month.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return safeAlert('Select a valid payment date.');
  const st=t.students.find(s=>String(s.id)===sid);
  if(!st) return safeAlert('Student record not found.');
  t.transactions=t.transactions||[];
  t.transactions.push({
    id:makeId('fee'),studentId:sid,month,amount,date,
    mode:$('payMode').value,txn:$('payTxn').value.trim(),createdAt:new Date().toISOString()
  });
  save();
  $('payAmount').value=''; $('payTxn').value='';
  safeAlert('Fee transaction saved.');
}

function renderTeacherFeesUI(t){
  if(!t) return;
  const current=monthNow();
  const rows=[];
  t.students.filter(s=>s.type==='tuition' && Number(s.fee)>0).forEach(s=>{
    const due=calculateOutstandingForStudent(t,s,current);
    if(due>0){
      rows.push(`<tr><td><b>${esc(s.name)}</b> <small class="muted">(${esc(s.roll||'-')})</small></td><td>Outstanding</td><td>${money(s.fee)}</td>
        <td style="color:var(--red);font-weight:700">${money(due)}</td>
        <td><button class="btn green btn-sm" onclick="sendWhatsAppFeeReminder('${esc(s.name)}','${esc(s.contact)}',${due})">💬 WhatsApp</button></td></tr>`);
    }
  });
  $('teacherPendingFeesTable').innerHTML=rows.length?
    `<table><thead><tr><th>Student</th><th>Status</th><th>Monthly Fee</th><th>Total Due</th><th>Action</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
    :'<div class="notice success">No outstanding tuition balance.</div>';

  const filterMonth = $('feeFilterMonth')?.value || '';
  let txns=[...(t.transactions||[])];
  if(filterMonth){
    txns = txns.filter(x=>String(x.month)===filterMonth || String(x.date||'').startsWith(filterMonth));
  }
  txns.sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  $('teacherTransactionsTable').innerHTML=txns.length?`
    <table><thead><tr><th>Date</th><th>Student</th><th>Month</th><th>Amount</th><th>Mode</th><th>Action</th></tr></thead>
    <tbody>${txns.map(x=>{
      const st=t.students.find(s=>String(s.id)===String(x.studentId));
      return `<tr><td>${esc(x.date)}</td><td>${esc(st?.name||'Unknown')}</td><td>${esc(x.month)}</td>
        <td style="color:var(--green);font-weight:700">${money(x.amount)}</td><td>${esc(x.mode)}</td>
        <td><button class="btn light btn-sm" onclick="printReceipt('${esc(x.id)}')">🧾 Slip</button>
            <button class="btn light btn-sm" onclick="editFee('${esc(x.id)}')">✏️</button>
            <button class="btn red btn-sm" onclick="deleteFee('${esc(x.id)}')">🗑️</button></td></tr>`;
    }).join('')}</tbody></table>`:'<p class="muted">No payments logged for this selection.</p>';
}

function editFee(fid){
  const t=getActiveTeacher(), tx=t?.transactions.find(x=>String(x.id)===String(fid));
  if(!tx) return;
  const amount=prompt('Amount (₹):',String(tx.amount)); if(amount===null) return;
  if(!Number.isFinite(Number(amount))||Number(amount)<=0) return safeAlert('Invalid amount.');
  const month=prompt('Billing month (YYYY-MM):',tx.month); if(month===null) return;
  if(!/^\d{4}-\d{2}$/.test(month)) return safeAlert('Invalid month.');
  tx.amount=Number(amount); tx.month=month;
  save();
}
function deleteFee(fid){
  const t=getActiveTeacher();
  if(!t || !confirm('Delete this transaction permanently?')) return;
  t.transactions=(t.transactions||[]).filter(x=>String(x.id)!==String(fid));
  save();
}

function printReceipt(fid){
  const t=getActiveTeacher(), tx=t?.transactions.find(x=>String(x.id)===String(fid));
  if(!tx) return;
  const s=t.students.find(x=>String(x.id)===String(tx.studentId));
  const logoSrc = getActiveLogo();

  $('receiptArea').innerHTML=`<div style="border:2px solid #0f172a;padding:18px;border-radius:10px">
    <div style="text-align:center;border-bottom:1px dashed #cbd5e1;padding-bottom:8px">
      <img src="${logoSrc}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-bottom:4px"><br>
      <h3 style="margin:0">${esc(t.name)}</h3><small>Official Payment Receipt • EduConnect</small>
    </div>
    <p style="margin:8px 0 4px"><b>Receipt No:</b> #${esc(String(tx.id).slice(-8))} | <b>Date:</b> ${esc(tx.date)}</p>
    <p style="margin:4px 0"><b>Student:</b> ${esc(s?.name||'-')} | <b>Roll:</b> ${esc(s?.roll||'-')} | <b>Class:</b> ${esc(s?.className||'-')}</p>
    <p style="margin:4px 0"><b>Fee Cycle:</b> ${esc(tx.month)} | <b>Mode:</b> ${esc(tx.mode)}</p>
    <h2 style="margin:12px 0">${money(tx.amount)} Paid</h2>
    <div style="text-align:right;margin-top:20px"><small>Authorized Signature</small></div>
  </div>`;
  $('receiptModal').classList.add('show');
}

function sendWhatsAppFeeReminder(name,contact,due){
  if(!contact) return safeAlert('No WhatsApp number for this student.');
  const num=cleanPhone(contact);
  if(num.length!==12) return safeAlert('Contact number is invalid.');
  const msg=`Dear Parent, reminder from ${getActiveTeacher()?.name||'EduConnect'} regarding ${name}'s outstanding tuition fee of ${money(due)}. Kindly clear the pending dues. Thank you.`;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
}

function saveStudyMaterial(){
  if(currentUser?.role!=='teacher') return;
  const title=$('matTitle').value.trim(), content=$('matContent').value.trim();
  if(!title||!content) return safeAlert('Enter material title and content.');
  db.materials.push({
    id:makeId('mat'),teacherId:String(currentUser.id),teacherName:currentUser.name,
    title,subject:$('matSubject').value,access:$('matAccess').value,content,createdAt:new Date().toISOString()
  });
  save(); $('matTitle').value=''; $('matContent').value='';
  safeAlert('Study material published.');
}

function renderPublicMaterials(){
  $('publicMaterialGrid').innerHTML = db.materials.map(m => {
    let contentHtml = '';
    if(m.access === 'public'){
      const isLink = String(m.content).trim().startsWith('http');
      if(isLink){
        contentHtml = `<a href="${esc(m.content.trim())}" target="_blank" rel="noopener" class="btn light btn-sm" style="display:inline-flex;width:auto">📄 Open / Download ↗</a>`;
      } else {
        contentHtml = `<p style="font-size:13px;margin:8px 0;line-height:1.4">${esc(m.content)}</p>`;
      }
    } else {
      contentHtml = '<p style="font-size:12px;color:var(--muted);margin:8px 0"><i>🔒 Locked for enrolled students.</i></p>';
    }

    const extra = `Subject: ${m.subject} | By: ${m.teacherName}`;

    return `
      <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <b style="font-size:14px;line-height:1.3">${esc(m.title)}</b>
            <span class="pill ${m.access === 'public' ? 'green' : 'red'}" style="flex-shrink:0">${m.access === 'public' ? 'FREE' : '🔒 PAID'}</span>
          </div>
          <small class="muted" style="display:block;margin:4px 0 8px 0">Subject: ${esc(m.subject)} • By: ${esc(m.teacherName)}</small>
          ${contentHtml}
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;display:flex;justify-content:flex-end">
          <button class="btn light btn-sm" onclick="shareContent('material', '${esc(m.title)}', '${esc(extra)}')">
            📤 Share
          </button>
        </div>
      </div>`;
  }).join('') || '<p class="muted">No study materials published yet.</p>';
}

function renderTeacherMaterialsUI(t){
  const mats=db.materials.filter(m=>String(m.teacherId)===String(t.id));
  $('teacherMaterialsTable').innerHTML=mats.length?`
    <table><thead><tr><th>Title</th><th>Subject</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${mats.map(m=>`<tr><td><b>${esc(m.title)}</b></td><td>${esc(m.subject)}</td>
      <td><span class="pill ${m.access==='public'?'green':'red'}">${m.access.toUpperCase()}</span></td>
      <td><button class="btn light btn-sm" onclick="toggleMaterialAccess('${esc(m.id)}')">Switch</button>
          <button class="btn red btn-sm" onclick="deleteMaterial('${esc(m.id)}')">Delete</button></td></tr>`).join('')}</tbody></table>`
    :'<p class="muted">No study materials published yet.</p>';
}
function toggleMaterialAccess(mid){
  const m=db.materials.find(x=>String(x.id)===String(mid));
  if(m && String(m.teacherId)===String(currentUser?.id)){m.access=m.access==='public'?'paid':'public';save();}
}
function deleteMaterial(mid){
  const m=db.materials.find(x=>String(x.id)===String(mid));
  if(!m || String(m.teacherId)!==String(currentUser?.id)) return;
  if(confirm('Delete this material?')){db.materials=db.materials.filter(x=>x!==m);save();}
}

function saveStudentWeakness(){
  const t=getActiveTeacher(), sid=String($('weaknessStudentSel').value), note=$('weaknessNotesText').value.trim();
  const s=t?.students.find(x=>String(x.id)===sid);
  if(!s||!note) return safeAlert('Select a student and enter a note.');
  s.weakness=note; save(); $('weaknessNotesText').value=''; safeAlert('Student note saved.');
}
function saveClassDiary(){
  const t=getActiveTeacher(), dt=$('diaryDate').value||today(), hw=$('diaryContent').value.trim();
  if(!hw) return safeAlert('Enter homework.');
  t.diary=t.diary||[];
  t.diary.push({id:makeId('diary'),date:dt,content:hw});
  save(); $('diaryContent').value=''; safeAlert('Diary saved.');
}
function renderDiaryUI(t){
  const logs=[...(t.diary||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10);
  $('diaryDisplayLogs').innerHTML=logs.map(d=>`<div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:10px;margin-bottom:8px">
    <b>Date: ${esc(d.date)}</b><p style="margin:4px 0">${esc(d.content)}</p></div>`).join('') || '<p class="muted">No diary entries.</p>';
}

let draftQuestions=[];
let activeExam=null;
let activeExamTimer=null;
let tabSwitchCount=0;
let examSubmitting=false;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderHomeLiveTests() {
  const container = $('homeLiveTestsGrid');
  if (!container) return;
  const approved = (db.tests || []).filter(t => t.status === 'approved');

  if (!approved.length) {
    container.innerHTML = '<p class="muted" style="padding:10px">No mock tests are currently live. Stay tuned!</p>';
    return;
  }

  const isEducatorOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher');

  container.innerHTML = approved.map(t => {
    const details = `Subject: ${t.subject} | Duration: ${t.duration} Mins | Questions: ${t.questions.length}`;
    return `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:14px;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <b style="font-size:16px;color:var(--brand)">${esc(t.title)}</b>
          <span class="pill blue">${esc(t.subject)}</span>
        </div>
        <div style="margin:8px 0;font-size:13px;color:#64748b">
          ⏱️ Duration: <b>${Number(t.duration) || 0} Mins</b> &nbsp;|&nbsp; ❓ Questions: <b>${t.questions.length}</b>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        ${isEducatorOrAdmin ? `
          <button class="btn light btn-sm" style="flex:1" onclick="openTestPaperInspector('${esc(t.id)}')">
            👁️ View Questions
          </button>
        ` : `
          <button class="btn green btn-sm" style="flex:1" onclick="attemptTestFromHome('${esc(t.id)}')">
            📝 Attempt Test ➔
          </button>
        `}
        <button class="btn light btn-sm" title="Share with students" onclick="shareContent('test', '${esc(t.title)}', '${esc(details)}')">
          📤 Share
        </button>
      </div>
    </div>
  `;}).join('');
}

function attemptTestFromHome(tid) {
  if (!currentUser) {
    openLoginModal('student');
    return;
  }
  if (currentUser.role !== 'student') {
    openTestPaperInspector(tid);
    return;
  }
  switchTab('tests');
  startTest(tid);
}

function addQuestionDraftRow(){
  draftQuestions.push({q:'',options:['','','',''],correct:0});
  renderQuestionDraftRows();
}
function renderQuestionDraftRows(){
  $('mcqQuestionsDraftArea').innerHTML=draftQuestions.map((item,idx)=>`
    <div style="border:1px solid #cbd5e1;padding:10px;border-radius:8px;margin-bottom:10px;background:#fff">
      <label>Question ${idx+1}</label>
      <input value="${esc(item.q)}" oninput="draftQuestions[${idx}].q=this.value" placeholder="Enter Question text">
      <div class="grid g2" style="margin-top:6px">
        ${[0,1,2,3].map(o=>`<input value="${esc(item.options[o])}" oninput="draftQuestions[${idx}].options[${o}]=this.value" placeholder="Option ${String.fromCharCode(65+o)}">`).join('')}
      </div>
      <label style="margin-top:6px">Correct Option</label>
      <select onchange="draftQuestions[${idx}].correct=Number(this.value)">
        ${[0,1,2,3].map(o=>`<option value="${o}" ${item.correct===o?'selected':''}>${String.fromCharCode(65+o)}</option>`).join('')}
      </select>
      <button class="btn red btn-sm" style="margin-top:6px" onclick="draftQuestions.splice(${idx},1);renderQuestionDraftRows()">Remove Question</button>
    </div>`).join('');
}
function submitTestForAdminApproval(){
  if(currentUser?.role!=='teacher') return;
  const title=$('tcTestTitle').value.trim();
  const duration=Math.min(240,Math.max(1,Number($('tcTestDuration').value)||15));
  if(!title||draftQuestions.length===0) return safeAlert('Add a test title and at least one question.');
  const clean=draftQuestions.map(q=>({
    q:String(q.q||'').trim(),
    options:q.options.map(x=>String(x||'').trim()),
    correct:Number(q.correct)
  }));
  if(clean.some(q=>!q.q||q.options.some(o=>!o))) return safeAlert('Every question and all four options are required.');
  db.tests.push({
    id:makeId('test'),teacherId:String(currentUser.id),title,
    subject:$('tcTestSubject').value,duration,questions:clean,status:'pending',
    createdAt:new Date().toISOString()
  });
  draftQuestions=[]; renderQuestionDraftRows(); $('tcTestTitle').value='';
  save(); 
  safeAlert('Test submitted for admin approval.');
  renderTeacherCreatedTests(getActiveTeacher());
}

function renderTeacherCreatedTests(t) {
  const container = $('teacherCreatedTestsBox');
  if (!container) return;
  const myTests = (db.tests || []).filter(x => String(x.teacherId) === String(t?.id));

  container.innerHTML = myTests.length ? `
    <table>
      <thead>
        <tr>
          <th>Test Title</th>
          <th>Subject</th>
          <th>Questions</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${myTests.map(test => `
          <tr>
            <td><b>${esc(test.title)}</b></td>
            <td><span class="pill blue">${esc(test.subject)}</span></td>
            <td>${test.questions.length}</td>
            <td>
              <span class="pill ${test.status === 'approved' ? 'green' : test.status === 'pending' ? 'orange' : 'red'}">
                ${esc(test.status.toUpperCase())}
              </span>
            </td>
            <td style="white-space:nowrap">
              <button class="btn light btn-sm" onclick="openTestPaperInspector('${esc(test.id)}')">👁️ View Paper</button>
              <button class="btn red btn-sm" onclick="deleteTestRecord('${esc(test.id)}')">🗑️ Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p class="muted">You have not created any tests yet.</p>';
}

function renderStudentTestsUI(){
  if(currentUser?.role!=='student') return;
  const approved=db.tests.filter(t=>t.status==='approved');
  $('availableTestsGrid').innerHTML=approved.map(t=>{
    const attempted=db.testResults.some(r=>String(r.testId)===String(t.id)&&String(r.studentId)===String(currentUser.id));
    const details = `Subject: ${t.subject} | Questions: ${t.questions.length}`;
    return `<div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0">
      <div style="display:flex;justify-content:space-between"><b>${esc(t.title)}</b><span class="pill blue">${esc(t.subject)}</span></div>
      <p class="muted" style="font-size:12px;margin:4px 0 8px">Questions: ${t.questions.length} | Time: ${Number(t.duration)||0} mins</p>
      <div style="display:flex;gap:6px">
        ${attempted?'<button class="btn light btn-sm" disabled style="flex:1">Already Attempted</button>':
        `<button class="btn green btn-sm" style="flex:1" onclick="startTest('${esc(t.id)}')">Start Test</button>`}
        <button class="btn light btn-sm" onclick="shareContent('test', '${esc(t.title)}', '${esc(details)}')">📤 Share</button>
      </div>
    </div>`;
  }).join('')||'<p class="muted">No approved tests available right now.</p>';

  const results=db.testResults.filter(r=>String(r.studentId)===String(currentUser.id))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('studentMyResults').innerHTML=results.length?`
    <table><thead><tr><th>Test</th><th>Score</th><th>Total</th><th>%</th><th>Date</th><th>Review</th></tr></thead>
    <tbody>${results.map(r=>`<tr><td><b>${esc(r.testTitle)}</b></td><td>${r.score}</td><td>${r.total}</td>
      <td>${r.total?((Number(r.score)/Number(r.total))*100).toFixed(1):0}\%</td><td>${esc(r.date)}</td>
      <td><button class="btn light btn-sm" onclick="reviewTestSolutions('${esc(r.id)}')">Review</button></td></tr>`).join('')}</tbody></table>`
    :'<p class="muted">No tests attempted yet.</p>';
}

function startTest(tid){
  if(currentUser?.role !== 'student' || activeExam) return;
  const t = db.tests.find(x => String(x.id) === String(tid) && x.status === 'approved');
  if(!t) return safeAlert('Test not found or not approved.');
  if(db.testResults.some(r => String(r.testId) === String(t.id) && String(r.studentId) === String(currentUser.id)))
    return safeAlert('You have already attempted this test.');

  const randomizedQuestions = shuffleArray(t.questions).map(q => {
    const indexedOptions = q.options.map((opt, optIndex) => ({
      text: opt,
      isOriginalCorrect: optIndex === Number(q.correct)
    }));
    const shuffledOptions = shuffleArray(indexedOptions);
    const newCorrectIndex = shuffledOptions.findIndex(o => o.isOriginalCorrect);

    return {
      q: q.q,
      options: shuffledOptions.map(o => o.text),
      correct: newCorrectIndex
    };
  });

  activeExam = {
    test: {
      ...t,
      questions: randomizedQuestions
    },
    originalTestId: t.id,
    answers: {},
    endAt: Date.now() + Math.max(1, Number(t.duration) || 15) * 60000
  };

  tabSwitchCount = 0; 
  examSubmitting = false;
  
  if ($('testDirectoryCard'))$('testDirectoryCard').style.display = 'none';
  if ($('testTakingArea'))$('testTakingArea').style.display = 'block';
  if ($('currentTestTitle'))$('currentTestTitle').textContent = t.title;
  if ($('currentTestSubject'))$('currentTestSubject').textContent = t.subject;
  
  renderActiveExam();
  updateExamTimer();
  activeExamTimer = setInterval(updateExamTimer, 500);
}

function renderActiveExam(){
  const t = activeExam?.test; 
  if(!t) return;
  
  const qList = $('testQuestionList');
  if(qList) qList.style.maxHeight = '62vh';

  $('testQuestionList').innerHTML = t.questions.map((q, idx) => `
    <div class="exam-q-box">
      <div class="exam-q-title">Q${idx + 1}. ${esc(q.q)}</div>
      ${q.options.map((opt, o) => {
        const isChecked = Number(activeExam.answers[idx]) === o;
        return `
          <label class="exam-opt-label" style="${isChecked ? 'background:#dbeafe;border-color:#3b82f6;font-weight:700' : ''}">
            <input type="radio" name="q_${idx}" value="${o}" ${isChecked ? 'checked' : ''}
              onchange="activeExam.answers[${idx}]=Number(this.value);renderActiveExam()" style="width:auto">
            <span>${esc(opt)}</span>
          </label>
        `;
      }).join('')}
    </div>
  `).join('');
}

function updateExamTimer(){
  if(!activeExam) return;
  const left=Math.max(0,activeExam.endAt-Date.now());
  const totalSec=Math.ceil(left/1000);
  const mins=Math.floor(totalSec/60), secs=totalSec%60;
  $('testTimerBadge').textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  if(left<=0) submitCurrentTest(true);
}
function stopExamTimer(){
  if(activeExamTimer){clearInterval(activeExamTimer);activeExamTimer=null;}
}
document.addEventListener('visibilitychange',()=>{
  if(activeExam && document.hidden){
    tabSwitchCount++;
    if(tabSwitchCount<3) safeAlert(`Warning: Window tab switch detected (${tabSwitchCount}/3).`);
    if(tabSwitchCount>=3) submitCurrentTest(true);
  }
});

function submitCurrentTest(auto = false){
  if(!activeExam || examSubmitting) return;
  examSubmitting = true;
  stopExamTimer();
  
  const examInstance = activeExam.test;
  let score = 0;
  
  examInstance.questions.forEach((q, i) => {
    if (Number(activeExam.answers[i]) === Number(q.correct)) {
      score++;
    }
  });

  const record = {
    id: makeId('result'),
    testId: String(activeExam.originalTestId || examInstance.id),
    testTitle: examInstance.title,
    studentId: String(currentUser.id),
    studentName: currentUser.name,
    studentPhone: currentUser.contact || '',
    score: score,
    total: examInstance.questions.length,
    date: today(),
    submittedQuestions: examInstance.questions,
    userAnswers: { ...activeExam.answers },
    submittedAt: new Date().toISOString(),
    tabSwitches: tabSwitchCount,
    autoSubmitted: !!auto
  };

  db.testResults.push(record);
  save();
  
  activeExam = null; 
  examSubmitting = false;
  
  if ($('testTakingArea'))$('testTakingArea').style.display = 'none';
  if ($('testDirectoryCard'))$('testDirectoryCard').style.display = 'block';
  
  renderStudentTestsUI();
  safeAlert(`Test submitted successfully!\nYour Score: ${score} / ${examInstance.questions.length}`);
}

function reviewTestSolutions(resultId){
  const r = db.testResults.find(x => String(x.id) === String(resultId));
  if(!r) return safeAlert('Result not found.');

  const questionsList = r.submittedQuestions || db.tests.find(x => String(x.id) === String(r.testId))?.questions;
  if(!questionsList) return safeAlert('Solution data is no longer available.');

  const body = questionsList.map((q, idx) => {
    const given = r.userAnswers?.[idx];
    const isCorrect = Number(given) === Number(q.correct);
    return `
      <div style="margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:10px">
        <b style="font-size:14px;color:#0f172a">Q${idx + 1}. ${esc(q.q)}</b><br>
        <div style="margin-top:6px;font-size:13px">
          <span style="color:${isCorrect ? 'var(--green)' : 'var(--red)'};font-weight:700">
            ${isCorrect ? '✅' : '❌'} Your Answer: ${given !== undefined ? esc(q.options[Number(given)] || 'Invalid') : 'Not Answered'}
          </span><br>
          ${!isCorrect ? `<span style="color:var(--green);font-weight:600">Correct Answer: ${esc(q.options[q.correct])}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modalbox" style="max-width:680px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px">
        <h3 style="margin:0">📝 Test Solutions Review</h3>
        <button class="btn light btn-sm" id="closeReview">✕</button>
      </div>
      <p style="margin:0 0 12px 0;font-size:14px">
        <b>${esc(r.testTitle)}</b> — Final Score: <b style="color:var(--brand)">${r.score} / ${r.total}</b> (${r.total ? ((r.score / r.total) * 100).toFixed(1) : 0}%)
      </p>
      <div style="max-height:60vh;overflow-y:auto;padding-right:6px">${body}</div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#closeReview').onclick = () => modal.remove();
}

function renderPublicLeaderboard(){
  const sorted=[...db.testResults].filter(r=>Number(r.total)>0)
    .sort((a,b)=>(b.score/b.total)-(a.score/a.total)).slice(0,5);
  $('landingLeaderboard').innerHTML=sorted.length?`
    <table><thead><tr><th>Rank</th><th>Student</th><th>Exam</th><th>Score</th></tr></thead>
    <tbody>${sorted.map((r,i)=>`<tr><td><b>#${i+1}</b></td><td>${esc(r.studentName)}</td>
      <td>${esc(r.testTitle)}</td><td>${r.score}/${r.total}</td></tr>`).join('')}</tbody></table>`
    :'<p class="muted">Leaderboard will update once students complete tests.</p>';
}

function renderPublicStories() {
  const container = $('storiesContainer');
  const creationCard = $('storyCreationCard');
  if (creationCard) {
    const canManage = currentUser && (currentUser.role === 'teacher' || currentUser.role === 'admin');
    creationCard.style.display = canManage ? 'block' : 'none';
  }
  if (!db.stories || !db.stories.length) {
    container.innerHTML = '<p class="muted">No stories published yet.</p>';
    return;
  }
  container.innerHTML = db.stories.map((s, i) => {
    const canDelete = currentUser && (currentUser.role === 'admin' || (currentUser.role === 'teacher' && s.authorId === currentUser.id));
    const rawText = String(s.text || '').trim();
    const shortSnippet = rawText.length > 110 ? rawText.slice(0, 110).trim() + '...' : rawText;

    return `
      <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;padding:12px;margin-bottom:0" 
           onclick="openStoryModal('${esc(s.id)}')">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <h4 style="margin:0 0 4px 0;color:var(--brand)">${i + 1}. ${esc(s.title)}</h4>
            ${canDelete ? `<button class="btn red btn-sm" onclick="event.stopPropagation(); deleteStory('${esc(s.id)}')">🗑️</button>` : ''}
          </div>
          <p class="story-preview">${esc(shortSnippet)}</p>
        </div>
        <div style="margin-top:auto;padding-top:8px;border-top:1px dashed #e2e8f0;display:flex;justify-content:space-between;align-items:center">
          <small style="color:var(--green);font-size:11px"><b>Moral:</b> ${esc(s.moral)}</small>
          <span style="font-size:11px;font-weight:700;color:var(--brand)">Read More →</span>
        </div>
      </div>`;
  }).join('');
}

function openStoryModal(id) {
  const story = db.stories.find(s => String(s.id) === String(id));
  if (!story) return;
  $('modalStoryTitle').textContent = story.title;
  $('modalStoryBody').textContent = story.text;
  $('modalStoryMoral').textContent = story.moral;
  $('storyViewModal').classList.add('show');
}
function closeStoryModal() { $('storyViewModal').classList.remove('show'); }

function addNewStory() {
  if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'admin')) {
    return safeAlert('Only logged-in teachers or administrators can publish stories.');
  }
  const title = $('storyInputTitle').value.trim();
  const text = $('storyInputText').value.trim();
  const moral = $('storyInputMoral').value.trim();
  if (!title || !text || !moral) return safeAlert('Please enter title, story text, and moral.');

  db.stories.push({ id:makeId('story'), authorId:String(currentUser.id), title, text, moral, createdAt:new Date().toISOString() });
  save();
  $('storyInputTitle').value = ''; $('storyInputText').value = '';$('storyInputMoral').value = '';
  safeAlert('Story published successfully.');
}

function deleteStory(storyId) {
  if (!currentUser || !confirm('Delete this story?')) return;
  const target = db.stories.find(s => String(s.id) === String(storyId));
  if (!target) return;
  if (currentUser.role !== 'admin' && target.authorId !== currentUser.id) return safeAlert('Permission denied.');
  db.stories = db.stories.filter(s => String(s.id) !== String(storyId));
  save();
}

const baseSudoku=[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]];
let sSol=[], sPuz=[];
let sudokuSeconds = 0;
let sudokuTimerInterval = null;

function sh(a){return [...a].sort(()=>Math.random()-.5);}
function makeSudokuSol(){
  const rb=sh([0,1,2]), cs=sh([0,1,2]);
  const rows=rb.flatMap(b=>sh([0,1,2]).map(r=>b*3+r));
  const cols=cs.flatMap(b=>sh([0,1,2]).map(c=>b*3+c));
  const nums=sh([1,2,3,4,5,6,7,8,9]);
  return rows.map(r=>cols.map(c=>nums[baseSudoku[r][c]-1]));
}

function startSudokuTimer() {
  clearInterval(sudokuTimerInterval);
  updateSudokuTimerUI();
  sudokuTimerInterval = setInterval(() => { sudokuSeconds++; updateSudokuTimerUI(); }, 1000);
}
function stopSudokuTimer() { 
  if(sudokuTimerInterval){
    clearInterval(sudokuTimerInterval);
    sudokuTimerInterval = null;
  }
}
function updateSudokuTimerUI() {
  const el = $('sudokuTimerText');
  if (!el) return;
  const m = String(Math.floor(sudokuSeconds / 60)).padStart(2, '0');
  const s = String(sudokuSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

document.addEventListener('visibilitychange', () => {
  const curHash = location.hash.replace('#', '');
  if (document.hidden) {
    stopSudokuTimer();
  } else if (curHash === 'games' && !document.hidden && sPuz.length) {
    startSudokuTimer();
  }
});

function newSudoku(){
  sSol = makeSudokuSol();
  sPuz = sSol.map(r => [...r]);
  const holes = {easy: 30, medium: 42, hard: 52}[$('sudokuDiff')?.value || 'easy'] || 30;
  sh([...Array(81).keys()]).slice(0, holes).forEach(k => sPuz[Math.floor(k / 9)][k % 9] = 0);
  sudokuSeconds = 0;
  renderSudoku();
  startSudokuTimer();
  updateSudokuProgress();
  const msg = $('sudokuMsg');
  if (msg) { msg.textContent = 'Fill 1-9 without duplicates per row, column, and block.'; msg.style.color = 'var(--muted)'; }
}

function renderSudoku(){
  let h = '<div class="sudoku-grid-wrap"><div class="sudoku-grid">';
  for(let r = 0; r < 9; r++){
    const isRowThick = (r === 2 || r === 5);
    for(let c = 0; c < 9; c++){
      const v = sPuz[r][c];
      const fixed = v !== 0;
      h += `
        <div class="sudoku-cell ${isRowThick ? 'row-divider' : ''}">
          <input class="sudoku-input ${fixed ? 'fixed' : ''}" 
                 ${fixed ? 'readonly' : ''} 
                 value="${v || ''}" 
                 maxlength="1" 
                 inputmode="numeric" 
                 data-r="${r}" 
                 data-c="${c}" 
                 oninput="onSudokuInput(this)">
        </div>`;
    }
  }
  h += '</div></div>';
  $('sudokuBox').innerHTML = h;
}

function onSudokuInput(input) {
  input.value = input.value.replace(/[^1-9]/g, '').slice(0, 1);
  input.classList.remove('wrong');
  const progress = updateSudokuProgress();
  if (progress === 100) checkSudoku(true);
}

function updateSudokuProgress() {
  const inputs = document.querySelectorAll('#sudokuBox input');
  if (!inputs.length) return 0;
  let filledCount = 0;
  inputs.forEach(x => { if (x.value && x.value.trim() !== '') filledCount++; });
  const pct = Math.round((filledCount / 81) * 100);
  if ($('sudokuProgressText'))$('sudokuProgressText').textContent = `${pct}%`;
  if ($('sudokuProgressBar'))$('sudokuProgressBar').style.width = `${pct}%`;
  return pct;
}

function checkSudoku(isAuto = false){
  let ok = true, allFilled = true;
  const inputs = document.querySelectorAll('#sudokuBox input');
  inputs.forEach(x => {
    const r = +x.dataset.r, c = +x.dataset.c, v = Number(x.value);
    if (!v) allFilled = false;
    else if (v !== sSol[r][c]) { ok = false; x.classList.add('wrong'); }
  });
  const msg = $('sudokuMsg');
  if (!msg) return;
  if (allFilled && ok) {
    stopSudokuTimer();
    msg.textContent = `Solved Correctly in ${$('sudokuTimerText').textContent}! 🎉`;
    msg.style.color = 'var(--green)';
  } else if (!ok) {
    msg.textContent = isAuto ? '100% filled, but mistakes found.' : 'Mistakes highlighted in red.';
    msg.style.color = 'var(--red)';
  } else {
    msg.textContent = 'All entries so far are correct.';
    msg.style.color = 'var(--brand)';
  }
}

function solveSudoku(){
  stopSudokuTimer();
  document.querySelectorAll('#sudokuBox input').forEach(x => {
    x.value = sSol[+x.dataset.r][+x.dataset.c];
    x.classList.remove('wrong');
  });
  updateSudokuProgress();
  const msg = $('sudokuMsg');
  if (msg) { msg.textContent = 'Solution revealed.'; msg.style.color = 'var(--orange)'; }
}

function calcPercentage(){
  const m=Number($('toolMaxMarks').value),o=Number($('toolObtMarks').value);
  if(!Number.isFinite(m)||m<=0||!Number.isFinite(o)||o<0||o>m) return safeAlert('Enter marks between 0 and maximum marks.');
  $('toolResult').innerHTML=`<b>${((o/m)*100).toFixed(2)}%</b>${o} / ${m}`;
}

function refreshAllViews(){
  try{
    renderHomeLiveTests();
    renderPublicMaterials(); 
    renderPublicLeaderboard(); 
    renderPublicStories();
    renderFooterDynamicData();
    renderSocialLinks();
    if(currentUser?.role==='student') {
      renderStudentTestsUI();
      renderStudentQueriesList();
    }
    if(currentUser?.role==='teacher'||currentUser?.role==='admin') renderWorkspace();
  }catch(e){console.error('Render error:',e);}
}

window.addEventListener('beforeunload',e=>{
  if(activeExam){ e.preventDefault(); e.returnValue='Exam in progress.'; }
});

window.addEventListener('DOMContentLoaded',async()=>{
  loadLocal();
  updateAuthUI();

  const initialTab = location.hash.replace('#', '') || 'landing';
  switchTab(initialTab, false);
  history.replaceState({ tab: initialTab }, '', '#' + initialTab);

  if($('payBillingMonth'))$('payBillingMonth').value=monthNow();
  if($('payDate'))$('payDate').value=today();
  if($('diaryDate'))$('diaryDate').value=today();
  if($('attRegisterDate'))$('attRegisterDate').value=today();
  if($('attMonthSelect'))$('attMonthSelect').value=monthNow();
  if($('schoolAttMonthInput'))$('schoolAttMonthInput').value=monthNow();
  if($('feeFilterMonth'))$('feeFilterMonth').value=monthNow();
  if($('offlineTestDate'))$('offlineTestDate').value=today();
  if($('projDate'))$('projDate').value=today();

  renderQuestionDraftRows();
  newSudoku();
  renderFooterDynamicData();
  renderSocialLinks();
  refreshAllViews();
  await initCloud();
  updateAuthUI();
});