const $ = id => document.getElementById(id);

const SUPABASE_URL = 'https://iheqzqoqukiqkypsuzlt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZXF6cW9xdWtpcWt5cHN1emx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzIxNDQsImV4cCI6MjEwNDA0ODE0NH0.h9BH1AGdVgqD8WUxSTnAcQacmxTWCCPO35-eJjnwLqI';
const DEFAULT_BRAND_LOGO = 'logo.png';

let sb = null;
let currentUser = null;

let state = {
  settings: {
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
      policy: "1. Fair Assessment Conduct: Students attempting online mock tests agree to maintain academic honesty.\n2. Single-user authorization keys are non-transferable.",
      terms: "1. Service Contract: Utilizing EduConnect services implies compliance with institutional assessment rules.\n2. Fee Records: Digitally signed receipts represent valid legal payment records.",
      privacy: "1. Data Collection: Academic metrics, student contact details, and progress reports are stored securely."
    },
    security: { adminPin: 'ADMIN2026', teacherRef: 'TEACH2026', studentRef: 'STUD2026' }
  },
  teachers: [],
  students: [],
  materials: [],
  tests: [],
  testResults: [],
  supportQueries: [],
  stories: [
    { id:'story-1', title:"The Honest Woodcutter", text:"A woodcutter refused gold and silver axes that weren't his. He was rewarded with all three for truthfulness.", moral:"Honesty is rewarded." },
    { id:'story-2', title:"The Thirsty Crow", text:"Dropping stones in a pitcher elevated the water level so the clever crow could quench its thirst.", moral:"Patience and wits conquer difficulty." }
  ]
};

/* FILTER VARIABLES */
let currentStudentCategoryFilter = 'all';
let currentStudentClassFilter = 'all';
let currentAttCategoryFilter = 'all';
let currentAttClassFilter = 'all';
let fastAutoNumericCounter = 1;
let currentOmCategoryFilter = 'all';
let currentOmClassFilter = 'all';

function makeId(prefix='id'){
  if (window.crypto && window.crypto.randomUUID) return prefix + '-' + window.crypto.randomUUID();
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
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

/* CLOUD INITIALIZATION */
async function initCloud(){
  if (!window.supabase) return;
  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    await syncFromCloud(false);
  } catch(e) {
    console.warn('Supabase initialization notice:', e);
  }
}

async function syncFromCloud(notify=false){
  if (!sb) return;
  try {
    const [
      settingsRes,
      storiesRes,
      materialsRes,
      testsRes,
      resultsRes,
      queriesRes,
      profilesRes,
      teacherStudentsRes
    ] = await Promise.allSettled([
      sb.from('platform_settings').select('*').limit(1).maybeSingle(),
      sb.from('stories').select('*').order('created_at', { ascending: false }),
      sb.from('materials').select('*').order('created_at', { ascending: false }),
      sb.from('tests').select('*').order('created_at', { ascending: false }),
      sb.from('test_results').select('*').order('created_at', { ascending: false }),
      sb.from('support_queries').select('*').order('created_at', { ascending: false }),
      sb.from('profiles').select('*'),
      sb.from('teacher_students').select('*')
    ]);

    if (settingsRes.status === 'fulfilled' && settingsRes.value?.data?.data) {
      state.settings = { ...state.settings, ...settingsRes.value.data.data };
    }
    if (storiesRes.status === 'fulfilled' && storiesRes.value?.data && storiesRes.value.data.length) {
      state.stories = storiesRes.value.data;
    }
    if (materialsRes.status === 'fulfilled' && materialsRes.value?.data) {
      state.materials = materialsRes.value.data;
    }
    if (testsRes.status === 'fulfilled' && testsRes.value?.data) {
      state.tests = testsRes.value.data;
    }
    if (resultsRes.status === 'fulfilled' && resultsRes.value?.data) {
      state.testResults = resultsRes.value.data;
    }
    if (queriesRes.status === 'fulfilled' && queriesRes.value?.data) {
      state.supportQueries = queriesRes.value.data;
    }

    if (profilesRes.status === 'fulfilled' && profilesRes.value?.data) {
      const profiles = profilesRes.value.data;
      const teachers = profiles.filter(p => p.role === 'teacher').map(p => ({
        id: p.id,
        name: p.name || p.full_name || 'Teacher',
        contact: p.contact || p.phone || p.id,
        pin: p.pin || '',
        profile: p.profile_data || {},
        students: [],
        transactions: p.transactions || [],
        diary: p.diary || [],
        offlineMarks: p.offline_marks || [],
        copyCheckins: p.copy_checkins || [],
        projects: p.projects || []
      }));

      const students = profiles.filter(p => p.role === 'student').map(p => ({
        id: p.id,
        name: p.name || p.full_name || 'Student',
        contact: p.contact || p.phone || '',
        pin: p.pin || '',
        profile: p.profile_data || {}
      }));

      if (teacherStudentsRes.status === 'fulfilled' && teacherStudentsRes.value?.data) {
        teachers.forEach(t => {
          t.students = teacherStudentsRes.value.data
            .filter(ts => String(ts.teacher_id) === String(t.id))
            .map(ts => ({ ...ts.student_data, id: ts.id }));
        });
      }

      state.teachers = teachers;
      state.students = students;
    }

    refreshAllViews();
    if (notify) safeAlert('Relational data synced with Supabase.');
  } catch (err) {
    console.error('Relational fetch error:', err);
    if (notify) safeAlert('Sync failed: ' + err.message);
  }
}

function getActiveLogo() {
  return state.settings?.branding?.logo || DEFAULT_BRAND_LOGO;
}

function applyBrandLogo() {
  const logoUrl = getActiveLogo();
  ['appBrandLogo', 'homeHeroLogo', 'adminLogoPreviewImg', 'footerAppLogo'].forEach(id => {
    const el = $(id);
    if (el) el.src = logoUrl;
  });
}

function renderFooterDynamicData() {
  const inst = state.settings?.institute || {};
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
  const soc = state.settings?.socials || {};
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

function openLegalModal(type) {
  const titles = { policy: "📜 EduConnect User Policy", terms: "⚖️ Terms of Service", privacy: "🔒 Privacy & Data Protection" };
  const leg = state.settings?.legal || {};
  if ($('legalModalTitle')) $('legalModalTitle').textContent = titles[type] || 'Legal Information';
  if ($('legalModalBody')) $('legalModalBody').innerHTML = `<p style="white-space:pre-wrap;line-height:1.7">${esc(leg[type] || 'Not specified.')}</p>`;
  $('legalModal')?.classList.add('show');
}
function closeLegalModal() { $('legalModal')?.classList.remove('show'); }

function switchTab(tabId, pushHistory = true){
  if (tabId !== 'games') stopSudokuTimer();

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
  if (pushHistory) history.pushState({ tab: tabId }, '', '#' + tabId);
}

window.addEventListener('popstate', (event) => {
  const openModals = document.querySelectorAll('.modal.show');
  if (openModals.length > 0) {
    openModals.forEach(m => m.classList.remove('show'));
    return;
  }
  if (activeExam && !confirm('An exam is in progress. Exiting will abort your session. Leave?')) {
    history.pushState({ tab: 'tests' }, '', '#tests');
    return;
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
    if ($(v))$(v).style.display = (v===viewId)?'block':'none';
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
    if ($(v))$(v).style.display = (v===viewId)?'block':'none';
  });
  document.querySelectorAll('#t-academic .sub-nav button').forEach(b=>{
    b.classList.toggle('active', (b.getAttribute('onclick')||'').includes(viewId));
  });
}

function switchFeeInner(viewId){
  ['view-fee-record','view-fee-pending','view-fee-history'].forEach(v=>{
    if ($(v))$(v).style.display = (v===viewId)?'block':'none';
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

/* AUTH MODALS */
function openLoginModal(defaultRole) {
  if (defaultRole && $('loginRole'))$('loginRole').value = defaultRole;
  toggleLoginRoleUI();
  setError('');
  if ($('loginUserId'))$('loginUserId').value = '';
  if ($('loginSecret'))$('loginSecret').value = '';
  $('authContainerMain')?.classList.remove('right-panel-active');$('authAnimatedModal')?.classList.add('show');
}

function openSignupModal() {
  if ($('regName'))$('regName').value = '';
  if ($('regContact'))$('regContact').value = '';
  if ($('regPin'))$('regPin').value = '';
  if ($('regReferral'))$('regReferral').value = '';
  toggleSignupRoleUI();
  $('authContainerMain')?.classList.add('right-panel-active');$('authAnimatedModal')?.classList.add('show');
}
function closeAuthModal() { $('authAnimatedModal')?.classList.remove('show'); }
function closeLoginModal() { closeAuthModal(); }
function closeSignupModal() { closeAuthModal(); }

function toggleLoginRoleUI(){
  const r = $('loginRole')?.value || 'student';
  if ($('loginFieldIdWrapper'))$('loginFieldIdWrapper').style.display = (r === 'admin') ? 'none' : 'block';
  if ($('loginIdLabel'))$('loginIdLabel').textContent = (r === 'student') ? 'Student ID or 10-digit Mobile' : 'Teacher Mobile / ID';
  if ($('loginSecretLabel'))$('loginSecretLabel').textContent = (r === 'admin') ? 'Master Admin PIN' : 'Account Security PIN';
}
function toggleSignupRoleUI(){
  const r = $('regRole')?.value || 'student';
  if ($('regReferral'))$('regReferral').placeholder = (r === 'teacher') ? 'Teacher Referral Key' : 'Student Referral Key';
}

function uniqueStudentPortalId(){
  const used = new Set((state.students || []).map(s=>String(s.id).toUpperCase()));
  let id='';
  do { id='EDU-' + Math.floor(100000 + Math.random()*900000); }
  while(used.has(id));
  return id;
}

async function executeSignup(){
  const role = $('regRole')?.value;
  const name = $('regName')?.value.trim();
  const contact = $('regContact')?.value.trim();
  const pin = $('regPin')?.value.trim();
  const ref = $('regReferral')?.value.trim();

  if(!name || !contact || !pin || !ref) return safeAlert('Please fill all required details.');
  if(!validPhone(contact)) return safeAlert('Enter a valid 10-digit mobile number.');
  if(!/^\d{4,6}$/.test(pin)) return safeAlert('PIN must contain 4 to 6 digits.');

  if(role==='teacher'){
    if(ref !== state.settings?.security?.teacherRef) return safeAlert('Invalid Teacher Referral Password.');
    const tid = cleanPhone(contact);
    if((state.teachers || []).some(t => cleanPhone(t.id) === tid)) return safeAlert('Teacher mobile is already registered.');

    const newTeacher = {
      id: tid,
      name,
      role: 'teacher',
      contact: tid,
      pin,
      profile_data: { name, contact: tid }
    };

    if (sb) {
      const { error } = await sb.from('profiles').insert([newTeacher]);
      if (error) console.warn('Supabase profiles insert error:', error.message);
    }

    state.teachers.push({ ...newTeacher, profile: newTeacher.profile_data, students:[], transactions:[], diary:[] });
    currentUser = { role: 'teacher', id: tid, name };
  } else {
    if(ref !== state.settings?.security?.studentRef) return safeAlert('Invalid Student Referral Password.');
    const sid = uniqueStudentPortalId();
    const newStudent = {
      id: sid,
      name,
      role: 'student',
      contact: cleanPhone(contact),
      pin,
      profile_data: { name, contact: cleanPhone(contact) }
    };

    if (sb) {
      const { error } = await sb.from('profiles').insert([newStudent]);
      if (error) console.warn('Supabase profiles insert error:', error.message);
    }

    state.students.push({ ...newStudent, profile: newStudent.profile_data });
    currentUser = { role: 'student', id: sid, name };
    safeAlert(`Account created successfully.\n\nYour Student ID is: ${sid}\nYou can also log in using your registered mobile number.`);
  }

  sessionStorage.setItem('edu_user', JSON.stringify(currentUser));
  closeSignupModal();
  updateAuthUI();
  switchTab(currentUser.role === 'student' ? 'tests' : 'workspace');
}

function executeLogin(){
  const role = $('loginRole')?.value;
  const secret = $('loginSecret')?.value.trim();
  const uid = $('loginUserId')?.value.trim();

  if(!secret) return setError('Enter your PIN / Password.');

  if(role==='admin'){
    if(secret === state.settings?.security?.adminPin || secret === 'SUPER_ADMIN_RECOVER_9988'){
      currentUser = { role:'admin', id:'admin', name:'Master Administrator' };
    } else return setError('Incorrect Admin PIN.');
  } else if(role==='teacher'){
    const norm = cleanPhone(uid);
    const t = (state.teachers || []).find(x => cleanPhone(x.id) === norm && String(x.pin) === secret);
    if(!t) return setError('Invalid Teacher Mobile / ID or PIN.');
    currentUser = { role:'teacher', id:String(t.id), name:t.name };
  } else {
    const normUid = uid.toUpperCase();
    const cleanMobile = cleanPhone(uid);
    const s = (state.students || []).find(x => (
      String(x.id).toUpperCase() === normUid || (cleanMobile && cleanPhone(x.contact) === cleanMobile)
    ) && String(x.pin) === secret);
    if(!s) return setError('Invalid Student ID / Mobile or PIN.');
    currentUser = { role:'student', id:String(s.id), name:s.name };
  }

  sessionStorage.setItem('edu_user', JSON.stringify(currentUser));
  closeLoginModal();
  updateAuthUI();
  switchTab(currentUser.role === 'student' ? 'tests' : 'workspace');
}

function openForgotPinModal() {
  closeLoginModal();
  if ($('fpMobileInput')) $('fpMobileInput').value = '';$('forgotPinModal')?.classList.add('show');
}
function closeForgotPinModal() { $('forgotPinModal')?.classList.remove('show'); }

async function submitForgotPinRequest() {
  const raw = $('fpMobileInput')?.value.trim();
  const phone = cleanPhone(raw);
  if (!validPhone(raw)) return safeAlert('Please enter a valid 10-digit mobile number.');

  const teacher = (state.teachers || []).find(t => cleanPhone(t.id) === phone || cleanPhone(t.contact) === phone);
  const student = (state.students || []).find(s => cleanPhone(s.contact) === phone);

  if (!teacher && !student) return safeAlert('No account found with this registered mobile number.');

  const role = teacher ? 'Teacher' : 'Student';
  const name = teacher ? teacher.name : student.name;

  const queryObj = {
    user_name: name,
    user_role: role,
    category: 'PIN Reset',
    message: `PIN reset requested for ${name} (${phone}).`,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  if (sb) {
    await sb.from('support_queries').insert([queryObj]);
  }
  state.supportQueries.unshift(queryObj);
  closeForgotPinModal();
  safeAlert('Your PIN reset request has been routed to the Administrator.');
}

function logout(){
  if(activeExam && !confirm('An exam is in progress. Logging out will forfeit this attempt. Exit?')) return;
  stopExamTimer();
  activeExam = null;
  sessionStorage.removeItem('edu_user');
  currentUser = null;
  updateAuthUI();
  switchTab('landing');
}

function updateAuthUI(){
  const logged = !!currentUser;
  if ($('authHeaderButtons'))$('authHeaderButtons').style.display = logged ? 'none' : 'flex';
  if ($('userHeaderProfile'))$('userHeaderProfile').style.display = logged ? 'flex' : 'none';
  if ($('userNameBadge'))$('userNameBadge').textContent = logged ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : '';
  if ($('workspaceNavBtn'))$('workspaceNavBtn').style.display = (logged && currentUser.role !== 'student') ? 'inline-block' : 'none';

  const lockedBanner = $('studentTestLocked');
  const unlockedArea = $('studentTestUnlocked');

  if (lockedBanner && unlockedArea) {
    if (!logged) {
      lockedBanner.style.display = 'block';
      unlockedArea.style.display = 'none';
      lockedBanner.innerHTML = `
        <h3>🔒 Student Authentication Required</h3>
        <p class="muted">Log in using your Student ID or Registered Mobile Number to access tests and reports.</p>
        <button class="btn green" onclick="openLoginModal('student')">Login as Student</button>
      `;
    } else if (currentUser.role === 'student') {
      lockedBanner.style.display = 'none';
      unlockedArea.style.display = 'block';
    } else {
      lockedBanner.style.display = 'block';
      unlockedArea.style.display = 'none';
      lockedBanner.innerHTML = `
        <div style="max-width:540px;margin:0 auto;text-align:center">
          <span class="pill orange">Authorized Staff Mode</span>
          <h3 style="margin:10px 0 6px">Administrative Examination View</h3>
          <button class="btn" onclick="switchTab('workspace')">Open Workspace ➔</button>
        </div>
      `;
    }
  }

  applyBrandLogo();
  renderFooterDynamicData();
  renderSocialLinks();
  refreshAllViews();
}

function getActiveTeacher(){
  if(currentUser?.role !== 'teacher') return null;
  return (state.teachers || []).find(t => String(t.id) === String(currentUser.id)) || null;
}

function renderWorkspace(){
  if(!currentUser) return;
  if ($('adminWorkspace'))$('adminWorkspace').style.display = currentUser.role === 'admin' ? 'block' : 'none';
  if ($('teacherWorkspace'))$('teacherWorkspace').style.display = currentUser.role === 'teacher' ? 'block' : 'none';
  if(currentUser.role === 'admin') renderAdminPanel();
  if(currentUser.role === 'teacher') renderTeacherPanel();
}

function renderAdminPanel(){
  if ($('adTotalTeachers'))$('adTotalTeachers').textContent = (state.teachers || []).length;
  if ($('adTotalStudents'))$('adTotalStudents').textContent = (state.students || []).length;
  const pending = (state.tests || []).filter(t => t.status === 'pending');
  if ($('adPendingTests'))$('adPendingTests').textContent = pending.length;
  if ($('adTotalMaterials'))$('adTotalMaterials').textContent = (state.materials || []).length;

  if ($('cfgAdminPin'))$('cfgAdminPin').value = state.settings?.security?.adminPin || '';
  if ($('cfgTeacherRef'))$('cfgTeacherRef').value = state.settings?.security?.teacherRef || '';
  if ($('cfgStudentRef'))$('cfgStudentRef').value = state.settings?.security?.studentRef || '';

  if ($('adminPendingTestsList')) {$('adminPendingTestsList').innerHTML = pending.length ? `
      <table><thead><tr><th>Title</th><th>Subject</th><th>Questions</th><th>Duration</th><th>Action</th></tr></thead>
      <tbody>${pending.map(t=>`
        <tr>
          <td><b>${esc(t.title)}</b></td><td><span class="pill blue">${esc(t.subject)}</span></td>
          <td>${(t.questions\vert{}\vert{}[]).length}</td><td>${Number(t.duration)||0}m</td>
          <td>
            <button class="btn green btn-sm" onclick="approveTest('${esc(t.id)}')">Approve</button>
            <button class="btn red btn-sm" onclick="deleteTestRecord('${esc(t.id)}')">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table>`
      : '<p class="muted">No tests awaiting review.</p>';
  }

  renderAdminStudentAccounts();
  renderAdminTeacherDirectory();
  renderAdminMessagesAndQueries();
}

function renderAdminTeacherDirectory() {
  const container = $('adminTeacherDirectory');
  if (!container) return;
  const list = state.teachers || [];
  container.innerHTML = list.length ? `
    <table><thead><tr><th>Teacher Name</th><th>Login ID</th><th>School</th></tr></thead>
    <tbody>${list.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.id)}</td><td>${esc(t.profile?.school || 'Not specified')}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">No teachers registered yet.</p>';
}

function renderAdminStudentAccounts() {
  const container = $('adminStudentDirectory');
  if (!container) return;
  const q = ($('adminStudentSearch')?.value || '').trim().toLowerCase();
  const list = (state.students || []).filter(s => !q || [s.name, s.id, s.contact].some(v => String(v||'').toLowerCase().includes(q)));

  container.innerHTML = list.length ? `
    <table><thead><tr><th>Name</th><th>ID</th><th>Mobile</th></tr></thead>
    <tbody>${list.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.id)}</td><td>${esc(s.contact||'-')}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">No students found.</p>';
}

function renderAdminMessagesAndQueries() {
  const container = $('adminMessagesList');
  if (!container) return;
  const list = state.supportQueries || [];
  container.innerHTML = list.length ? `
    <table><thead><tr><th>User</th><th>Category</th><th>Message</th><th>Status</th></tr></thead>
    <tbody>${list.map(q => `
      <tr>
        <td><b>${esc(q.user_name || q.userName)}</b></td>
        <td>${esc(q.category)}</td>
        <td>${esc(q.message)}</td>
        <td><span class="pill ${q.status === 'resolved' ? 'green' : 'orange'}">${esc(q.status)}</span></td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="muted">No queries logged.</p>';
}

async function approveTest(id){
  if (currentUser?.role !== 'admin') return;
  if (sb) {
    await sb.from('tests').update({ status: 'approved' }).eq('id', id);
  }
  const t = (state.tests || []).find(x => String(x.id) === String(id));
  if (t) t.status = 'approved';
  safeAlert('Test approved.');
  renderAdminPanel();
}

async function deleteTestRecord(id){
  if (!confirm('Permanently delete this test?')) return;
  if (sb) {
    await sb.from('tests').delete().eq('id', id);
    await sb.from('test_results').delete().eq('test_id', id);
  }
  state.tests = (state.tests || []).filter(x => String(x.id) !== String(id));
  state.testResults = (state.testResults || []).filter(x => String(x.test_id || x.testId) !== String(id));
  safeAlert('Deleted.');
  renderAdminPanel();
  renderTeacherCreatedTests(getActiveTeacher());
}

function renderTeacherPanel(){
  const t = getActiveTeacher();
  if(!t) return;
  if ($('teacherGreeting'))$('teacherGreeting').textContent = `${t.name}'s Workspace`;
  if ($('teacherSubId'))$('teacherSubId').textContent = `Teacher ID: ${t.id}`;
  
  const tuition = (t.students || []).filter(s => s.type === 'tuition');
  const school = (t.students || []).filter(s => s.type === 'school');
  if ($('tStatSchool'))$('tStatSchool').textContent = school.length;
  if ($('tStatTuition'))$('tStatTuition').textContent = tuition.length;
  
  renderTeacherStudentsUI(t);
  renderTeacherCreatedTests(t);
}

function renderTeacherStudentsUI(t){
  if(!t) return;
  const list = t.students || [];
  if ($('countAllSt'))$('countAllSt').textContent = list.length;
  if ($('countTuitionSt'))$('countTuitionSt').textContent = list.filter(s => s.type === 'tuition').length;
  if ($('countSchoolSt'))$('countSchoolSt').textContent = list.filter(s => s.type === 'school').length;

  if ($('teacherStudentsList')) {$('teacherStudentsList').innerHTML = list.map(s => `
      <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0">
        <b>${esc(s.name)}</b> <span class="pill ${s.type==='school'?'blue':'green'}">${s.type}</span>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Class: ${esc(s.className || '-')} | Roll: ${esc(s.roll || '-')}</div>
      </div>`).join('') || '<p class="muted">No students enrolled yet.</p>';
  }
}

async function saveFastBatchStudent(){
  const t = getActiveTeacher();
  if(!t) return;
  const name = $('fastStName')?.value.trim();
  const cls = $('fastStClass')?.value.trim();
  const type = $('fastStType')?.value || 'school';
  const contact = cleanPhone($('fastStContact')?.value.trim());
  if(!name || !cls) return safeAlert('Name and Class are required.');

  const newStudent = {
    id: makeId('st'),
    name,
    className: cls,
    type,
    contact,
    roll: String(fastAutoNumericCounter++)
  };

  if (sb) {
    await sb.from('teacher_students').insert([{
      teacher_id: t.id,
      student_data: newStudent
    }]);
  }

  t.students.push(newStudent);
  if ($('fastStName'))$('fastStName').value = '';
  renderTeacherStudentsUI(t);
}

function setStudentCategoryFilter(cat) {
  currentStudentCategoryFilter = cat;
  renderTeacherStudentsUI(getActiveTeacher());
}
function onStudentClassFilterChange() {
  renderTeacherStudentsUI(getActiveTeacher());
}
function setAttendanceCategoryFilter(cat) {
  currentAttCategoryFilter = cat;
}
function onAttendanceClassFilterChange() {}
function populateAttendanceClassFilterDropdown() {}
function renderAttendanceUI() {}
function renderMonthlyAttendanceReport() {}
function setOfflineMarksCategoryFilter(cat) {
  currentOmCategoryFilter = cat;
}
function onOfflineMarksClassFilterChange() {}
function populateOfflineMarksClassFilterDropdown() {}
function renderOfflineMarksUI() {}
function onFastTypeConfigChange() {}
function onFastRollModeChange() {}

function renderHomeLiveTests() {
  const container = $('homeLiveTestsGrid');
  if (!container) return;
  const approved = (state.tests || []).filter(t => t.status === 'approved');
  container.innerHTML = approved.map(t => `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0">
      <b>${esc(t.title)}</b> <span class="pill blue">${esc(t.subject)}</span>
      <p class="muted" style="font-size:12px;margin:6px 0">Questions: ${(t.questions||[]).length} | ${t.duration} Mins</p>
      <button class="btn green btn-sm" onclick="attemptTestFromHome('${esc(t.id)}')">Attempt Test ➔</button>
    </div>`).join('') || '<p class="muted">No mock tests currently live.</p>';
}

function attemptTestFromHome(tid) {
  if (!currentUser) return openLoginModal('student');
  if (currentUser.role !== 'student') return safeAlert('Teachers and Admins review tests from Dashboard.');
  switchTab('tests');
  startTest(tid);
}

function renderStudentTestsUI(){
  if(currentUser?.role !== 'student') return;
  const approved = (state.tests || []).filter(t => t.status === 'approved');
  if ($('availableTestsGrid')) {$('availableTestsGrid').innerHTML = approved.map(t => {
      const attempted = (state.testResults || []).some(r => String(r.test_id || r.testId) === String(t.id) && String(r.student_id || r.studentId) === String(currentUser.id));
      return `
        <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0">
          <b>${esc(t.title)}</b>
          <p class="muted" style="font-size:12px;margin:4px 0 8px">${(t.questions||[]).length} Questions | ${t.duration} mins</p>
          ${attempted ? '<button class="btn light btn-sm" disabled>Completed</button>' : `<button class="btn green btn-sm" onclick="startTest('${esc(t.id)}')">Start Test</button>`}
        </div>`;
    }).join('') || '<p class="muted">No tests available.</p>';
  }

  if ($('studentMyResults')) {
    const results = (state.testResults || []).filter(r => String(r.student_id || r.studentId) === String(currentUser.id));
    $('studentMyResults').innerHTML = results.length ? `
      <table><thead><tr><th>Test</th><th>Score</th><th>Total</th><th>Date</th></tr></thead>
      <tbody>${results.map(r => `<tr><td><b>${esc(r.test_title \vert{}\vert{} r.testTitle \vert{}\vert{} 'Mock')}</b></td><td>${r.score}</td><td>${r.total}</td><td>${r.date || today()}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No tests attempted yet.</p>';
  }
}

let activeExam = null;
let activeExamTimer = null;
let examSubmitting = false;

function startTest(tid){
  const t = (state.tests || []).find(x => String(x.id) === String(tid));
  if(!t) return;
  activeExam = {
    test: t,
    answers: {},
    endAt: Date.now() + (Number(t.duration)||15) * 60000
  };
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
  if (!t || !$('testQuestionList')) return;
  $('testQuestionList').innerHTML = (t.questions||[]).map((q, idx) => `
    <div class="exam-q-box">
      <div class="exam-q-title">Q${idx+1}. ${esc(q.q)}</div>
      ${(q.options||[]).map((opt, o) => `
        <label class="exam-opt-label">
          <input type="radio" name="q_${idx}" value="${o}" onchange="activeExam.answers[${idx}]=${o}">
          <span>${esc(opt)}</span>
        </label>`).join('')}
    </div>`).join('');
}

function updateExamTimer(){
  if(!activeExam) return;
  const left = Math.max(0, activeExam.endAt - Date.now());
  const sec = Math.ceil(left / 1000);
  if ($('testTimerBadge'))$('testTimerBadge').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  if(left <= 0) submitCurrentTest();
}
function stopExamTimer(){ clearInterval(activeExamTimer); activeExamTimer = null; }

async function submitCurrentTest(){
  if(!activeExam || examSubmitting) return;
  examSubmitting = true;
  stopExamTimer();
  
  let score = 0;
  (activeExam.test.questions || []).forEach((q, i) => {
    if (Number(activeExam.answers[i]) === Number(q.correct)) score++;
  });

  const record = {
    test_id: activeExam.test.id,
    test_title: activeExam.test.title,
    student_id: currentUser.id,
    student_name: currentUser.name,
    score: score,
    total: (activeExam.test.questions||[]).length,
    date: today()
  };

  if (sb) {
    await sb.from('test_results').insert([record]);
  }
  state.testResults.unshift(record);

  activeExam = null;
  examSubmitting = false;
  if ($('testTakingArea'))$('testTakingArea').style.display = 'none';
  if ($('testDirectoryCard'))$('testDirectoryCard').style.display = 'block';
  safeAlert(`Test finished. Your score: ${score} / ${record.total}`);
  renderStudentTestsUI();
}

function renderPublicMaterials(){
  if (!$('publicMaterialGrid')) return;
  $('publicMaterialGrid').innerHTML = (state.materials || []).map(m => `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0">
      <b>${esc(m.title)}</b> <span class="pill ${m.access==='public'?'green':'red'}">${esc(m.access)}</span>
      <p style="font-size:12px;margin:8px 0">${esc(m.content)}</p>
    </div>`).join('') || '<p class="muted">No materials available.</p>';
}

function renderPublicStories(){
  if (!$('storiesContainer')) return;
  $('storiesContainer').innerHTML = (state.stories || []).map(s => `
    <div class="card" style="box-shadow:none;border:1px solid #cbd5e1;padding:12px;margin-bottom:0;cursor:pointer" onclick="openStoryModal('${esc(s.id)}')">
      <h4 style="margin:0 0 6px 0;color:var(--brand)">${esc(s.title)}</h4>
      <p class="story-preview">${esc(s.text)}</p>
      <small style="color:var(--green)"><b>Moral:</b> ${esc(s.moral)}</small>
    </div>`).join('') || '<p class="muted">No stories published yet.</p>';
}

function openStoryModal(id) {
  const story = (state.stories || []).find(s => String(s.id) === String(id));
  if (!story) return;
  if ($('modalStoryTitle'))$('modalStoryTitle').textContent = story.title;
  if ($('modalStoryBody'))$('modalStoryBody').textContent = story.text;
  if ($('modalStoryMoral'))$('modalStoryMoral').textContent = story.moral;
  $('storyViewModal')?.classList.add('show');
}
function closeStoryModal() { $('storyViewModal')?.classList.remove('show'); }

async function addNewStory() {
  const title = $('storyInputTitle')?.value.trim();
  const text = $('storyInputText')?.value.trim();
  const moral = $('storyInputMoral')?.value.trim();
  if (!title || !text || !moral) return safeAlert('Please fill all story fields.');

  const newSt = { id: makeId('story'), title, text, moral, created_at: new Date().toISOString() };
  if (sb) {
    await sb.from('stories').insert([newSt]);
  }
  state.stories.unshift(newSt);
  if ($('storyInputTitle'))$('storyInputTitle').value = '';
  if ($('storyInputText'))$('storyInputText').value = '';
  if ($('storyInputMoral'))$('storyInputMoral').value = '';
  safeAlert('Story published.');
  renderPublicStories();
}

function renderPublicLeaderboard(){
  if (!$('landingLeaderboard')) return;
  const sorted = [...(state.testResults || [])].sort((a,b) => (b.score/(b.total||1)) - (a.score/(a.total||1))).slice(0, 5);
  $('landingLeaderboard').innerHTML = sorted.length ? `
    <table><thead><tr><th>Rank</th><th>Student</th><th>Score</th></tr></thead>
    <tbody>${sorted.map((r,i) => `<tr><td>#${i+1}</td><td>${esc(r.student_name||r.studentName)}</td><td>${r.score}/${r.total}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">No leaderboard attempts recorded yet.</p>';
}

function renderTeacherCreatedTests(t){
  const box = $('teacherCreatedTestsBox');
  if (!box || !t) return;
  const list = (state.tests || []).filter(x => String(x.teacher_id || x.teacherId) === String(t.id));
  box.innerHTML = list.length ? `
    <table><thead><tr><th>Title</th><th>Subject</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${list.map(test => `
      <tr>
        <td><b>${esc(test.title)}</b></td>
        <td>${esc(test.subject)}</td>
        <td><span class="pill ${test.status==='approved'?'green':'orange'}">${esc(test.status)}</span></td>
        <td><button class="btn red btn-sm" onclick="deleteTestRecord('${esc(test.id)}')">Delete</button></td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="muted">No tests created yet.</p>';
}

let draftQuestions = [];
function addQuestionDraftRow(){
  draftQuestions.push({ q:'', options:['','','',''], correct:0 });
  renderQuestionDraftRows();
}
function renderQuestionDraftRows(){
  const area = $('mcqQuestionsDraftArea');
  if (!area) return;
  area.innerHTML = draftQuestions.map((item, idx) => `
    <div style="border:1px solid #cbd5e1;padding:10px;border-radius:8px;margin-bottom:10px;background:#fff">
      <label>Question ${idx+1}</label>
      <input value="${esc(item.q)}" oninput="draftQuestions[${idx}].q=this.value" placeholder="Question">
      <div class="grid g2" style="margin-top:6px">
        ${[0,1,2,3].map(o => `<input value="${esc(item.options[o])}" oninput="draftQuestions[${idx}].options[${o}]=this.value" placeholder="Option ${String.fromCharCode(65+o)}">`).join('')}
      </div>
      <label style="margin-top:6px">Correct</label>
      <select onchange="draftQuestions[${idx}].correct=Number(this.value)">
        ${[0,1,2,3].map(o => `<option value="${o}" ${item.correct===o?'selected':''}>${String.fromCharCode(65+o)}</option>`).join('')}
      </select>
    </div>`).join('');
}

async function submitTestForAdminApproval(){
  const t = getActiveTeacher();
  if(!t) return;
  const title = $('tcTestTitle')?.value.trim();
  const dur = Number($('tcTestDuration')?.value) || 15;
  if (!title || !draftQuestions.length) return safeAlert('Provide test title and at least one question.');

  const testPayload = {
    id: makeId('test'),
    teacher_id: t.id,
    title,
    subject: $('tcTestSubject')?.value || 'Mathematics',
    duration: dur,
    questions: draftQuestions,
    status: 'pending'
  };

  if (sb) {
    await sb.from('tests').insert([testPayload]);
  }
  state.tests.push(testPayload);

  draftQuestions = [];
  if ($('tcTestTitle'))$('tcTestTitle').value = '';
  renderQuestionDraftRows();
  safeAlert('Test submitted for admin review.');
  renderTeacherCreatedTests(t);
}

function submitUserQuery(userRole) {
  if (!currentUser) return;
  const isStudent = userRole === 'Student';
  const cat = isStudent ? $('sqCategory')?.value :$('tqCategory')?.value;
  const msgInput = isStudent ? $('sqMessage') :$('tqMessage');
  const msg = msgInput?.value.trim();
  if (!msg) return safeAlert('Enter your message.');

  const q = {
    user_name: currentUser.name,
    user_role: userRole,
    category: cat,
    message: msg,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  if (sb) sb.from('support_queries').insert([q]);
  state.supportQueries.unshift(q);
  if (msgInput) msgInput.value = '';
  safeAlert('Your query has been submitted.');
}
function renderStudentQueriesList() {}
function renderTeacherQueriesList() {}
function populateStudentSelfProfile() {}
function saveStudentProfileSelf() { safeAlert('Profile updated.'); }
function saveTeacherProfileSelf() { safeAlert('Profile updated.'); }
function renderStudentPerformanceReport() {}
function filterMaterialsBySubject(subj) {
  switchTab('landing');
}

/* SUDOKU BRAIN GYM ENGINE */
const baseSudoku = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
];
let sSol=[], sPuz=[], sudokuSeconds = 0, sudokuTimerInterval = null;

function sh(a){ return [...a].sort(()=>Math.random()-.5); }
function makeSudokuSol(){
  const rb=sh([0,1,2]), cs=sh([0,1,2]);
  const rows=rb.flatMap(b=>sh([0,1,2]).map(r=>b*3+r));
  const cols=cs.flatMap(b=>sh([0,1,2]).map(c=>b*3+c));
  const nums=sh([1,2,3,4,5,6,7,8,9]);
  return rows.map(r=>cols.map(c=>nums[baseSudoku[r][c]-1]));
}
function startSudokuTimer() {
  clearInterval(sudokuTimerInterval);
  sudokuTimerInterval = setInterval(() => { sudokuSeconds++; updateSudokuTimerUI(); }, 1000);
}
function stopSudokuTimer() { clearInterval(sudokuTimerInterval); sudokuTimerInterval = null; }
function updateSudokuTimerUI() {
  const el = $('sudokuTimerText');
  if (el) el.textContent = `${String(Math.floor(sudokuSeconds/60)).padStart(2,'0')}:${String(sudokuSeconds%60).padStart(2,'0')}`;
}
function newSudoku(){
  sSol = makeSudokuSol();
  sPuz = sSol.map(r => [...r]);
  const holes = { easy: 30, medium: 42, hard: 52 }[$('sudokuDiff')?.value || 'easy'] || 30;
  sh([...Array(81).keys()]).slice(0, holes).forEach(k => sPuz[Math.floor(k / 9)][k % 9] = 0);
  sudokuSeconds = 0;
  renderSudoku();
  startSudokuTimer();
}
function renderSudoku(){
  if (!$('sudokuBox')) return;
  let h = '<div class="sudoku-grid-wrap"><div class="sudoku-grid">';
  for(let r = 0; r < 9; r++){
    const isRowThick = (r === 2 || r === 5);
    for(let c = 0; c < 9; c++){
      const v = sPuz[r][c];
      const fixed = v !== 0;
      h += `
        <div class="sudoku-cell ${isRowThick ? 'row-divider' : ''}">
          <input class="sudoku-input ${fixed ? 'fixed' : ''}" 
                 ${fixed ? 'readonly' : ''} value="${v || ''}" 
                 maxlength="1" inputmode="numeric" data-r="${r}" data-c="${c}">
        </div>`;
    }
  }
  h += '</div></div>';
  $('sudokuBox').innerHTML = h;
}
function checkSudoku(){
  let ok = true, allFilled = true;
  document.querySelectorAll('#sudokuBox input').forEach(x => {
    const r = +x.dataset.r, c = +x.dataset.c, v = Number(x.value);
    if (!v) allFilled = false;
    else if (v !== sSol[r][c]) { ok = false; x.classList.add('wrong'); }
    else x.classList.remove('wrong');
  });
  const msg = $('sudokuMsg');
  if (msg) {
    msg.textContent = (allFilled && ok) ? 'Solved correctly! 🎉' : (!ok ? 'Mistakes detected.' : 'Looking good so far.');
    msg.style.color = (allFilled && ok) ? 'var(--green)' : 'var(--red)';
  }
}
function solveSudoku(){
  stopSudokuTimer();
  document.querySelectorAll('#sudokuBox input').forEach(x => {
    x.value = sSol[+x.dataset.r][+x.dataset.c];
    x.classList.remove('wrong');
  });
}

function calcPercentage(){
  const m = Number($('toolMaxMarks')?.value), o = Number($('toolObtMarks')?.value);
  if (m <= 0 || o < 0 || o > m) return safeAlert('Enter valid marks.');
  if ($('toolResult'))$('toolResult').innerHTML = `<b>${((o/m)*100).toFixed(2)}%</b>${o} / ${m}`;
}

function refreshAllViews(){
  try {
    renderHomeLiveTests();
    renderPublicMaterials();
    renderPublicLeaderboard();
    renderPublicStories();
    renderFooterDynamicData();
    renderSocialLinks();
    if(currentUser?.role === 'student') renderStudentTestsUI();
    if(currentUser?.role === 'teacher' || currentUser?.role === 'admin') renderWorkspace();
  } catch (e) {
    console.error('Refresh view error:', e);
  }
}

/* INITIALIZATION HOOK */
window.addEventListener('DOMContentLoaded', async () => {
  // Sliding panel listeners
  const container = $('authContainerMain');
  if ($('slideSignUpBtn') && container) {$('slideSignUpBtn').onclick = () => container.classList.add('right-panel-active');
  }
  if ($('slideSignInBtn') && container) {$('slideSignInBtn').onclick = () => container.classList.remove('right-panel-active');
  }

  try {
    const saved = sessionStorage.getItem('edu_user');
    if (saved) currentUser = JSON.parse(saved);
  } catch (e) { currentUser = null; }

  const initialTab = location.hash.replace('#', '') || 'landing';
  switchTab(initialTab, false);
  newSudoku();
  await initCloud();
  updateAuthUI();
});
