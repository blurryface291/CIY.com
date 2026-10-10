import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// WeTraders Supabase Configuration
const SUPABASE_URL = 'https://psghygzlcdlxcvtdcdyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZ2h5Z3psY2RseGN2dGRjZHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODE0MDYsImV4cCI6MjEwNDE1NzQwNn0.uUXLHhSb0DH4xM1neRSuFsReO4UnzTDD6bQ-3FtpkCo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------------
// ROLE & ROUTING DEFINITIONS
// -------------------------------------------------------------
export const ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
  MASTER: 'masterAdmin'
};

export const ROLE_LABEL = {
  [ROLES.STUDENT]: 'Student',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MASTER]: 'Master Admin'
};

export const HOME_FOR = {
  [ROLES.STUDENT]: 'student.html',
  [ROLES.ADMIN]: 'admin.html',
  [ROLES.MASTER]: 'master-admin.html'
};

export const RANK = { [ROLES.STUDENT]: 1, [ROLES.ADMIN]: 2, [ROLES.MASTER]: 3 };
export const atLeast = (r, min) => (RANK[r] || 0) >= (RANK[min] || 99);

// -------------------------------------------------------------
// AUTH GUARD
// -------------------------------------------------------------
export async function guard(minRole) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    location.replace('login.html');
    return new Promise(() => {}); // never resolve
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role || 'student';

  if (!atLeast(role, minRole)) {
    const d = document.getElementById('denyScreen');
    if (d) d.style.display = 'flex';
    document.getElementById('loadingScreen')?.remove();
    return new Promise(() => {});
  }

  document.getElementById('loadingScreen')?.remove();
  setupUI(session.user, role, profile);
  return { user: session.user, role, profile };
}

function setupUI(user, role, profile) {
  const disp = profile?.display_name || user.email;
  const avatar = profile?.photo_url || 'logo.png';
  
  const els = {
    userName: document.getElementById('userName'),
    userAvatar: document.getElementById('userAvatar'),
    userRoleLabel: document.getElementById('userRoleLabel')
  };
  
  if (els.userName) els.userName.textContent = disp;
  if (els.userAvatar) els.userAvatar.src = avatar;
  if (els.userRoleLabel) els.userRoleLabel.textContent = ROLE_LABEL[role] || 'Student';

  // Make logout handler globally available
  window.handleLogout = async () => {
    await supabase.auth.signOut();
    location.replace('login.html');
  };

  startIdleTimer();
}

// -------------------------------------------------------------
// IDLE SESSION TIMEOUT
// Signs the user out after IDLE_LIMIT_MS with no interaction.
// Activity is shared across tabs via localStorage, so working in
// one tab keeps the others alive.
// -------------------------------------------------------------
const IDLE_LIMIT_MS = 15 * 60 * 1000;  // 15 minutes
const IDLE_WARN_MS  = 60 * 1000;       // warn 1 minute before
const IDLE_CHECK_MS = 15 * 1000;       // how often we check
const IDLE_KEY      = 'wt_last_activity';

let idleWarned = false;
let idleStarted = false;

function markActivity() {
  try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch (e) { /* private mode */ }
  idleWarned = false;
}

function lastActivity() {
  try {
    const v = Number(localStorage.getItem(IDLE_KEY));
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  } catch (e) {
    return Date.now();
  }
}

export async function forceLogout(reason = 'timeout') {
  try { await supabase.auth.signOut(); } catch (e) { /* sign out regardless */ }
  location.replace('login.html?reason=' + encodeURIComponent(reason));
}

function startIdleTimer() {
  if (idleStarted) return;
  idleStarted = true;
  markActivity();

  let throttle = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - throttle < 5000) return;   // don't hammer localStorage
    throttle = now;
    markActivity();
  };

  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    .forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) onActivity();
  });

  setInterval(() => {
    const idle = Date.now() - lastActivity();
    if (idle >= IDLE_LIMIT_MS) {
      forceLogout('timeout');
      return;
    }
    if (idle >= IDLE_LIMIT_MS - IDLE_WARN_MS && !idleWarned) {
      idleWarned = true;
      toast('You will be signed out shortly due to inactivity.', true);
    }
  }, IDLE_CHECK_MS);
}

// -------------------------------------------------------------
// UI HELPERS
// -------------------------------------------------------------
export function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "<br>");
}

let toastTimer;
export function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'error' : 'success';
  el.style.display = 'block';
  el.style.opacity = '1';
  el.style.transform = 'translateY(0) translateX(-50%)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px) translateX(-50%)';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 3500);
}

export function inr(amt) {
  return '₹' + Number(amt || 0).toLocaleString('en-IN');
}

export function fmtDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' • ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function youTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
  return match ? match[1] : null;
}

// -------------------------------------------------------------
// NAVIGATION HELPERS
// -------------------------------------------------------------
export function initNav(map) {
  window.showSection = (id) => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`.nav-item[data-section="${id}"]`);
    if (item) item.classList.add('active');

    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    const sec = document.getElementById(`sec-${id}`);
    if (sec) sec.classList.add('active');

    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = map[id] || id;

    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('mobileOverlay')?.classList.remove('open');
    }
  };

  window.toggleSidebar = () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('mobileOverlay')?.classList.toggle('open');
  };
}

export function makeDeleter(collectionName, refreshCb) {
  return async (id) => {
    if (!confirm('Permanently delete this item?')) return;
    try {
      const { error } = await supabase.from(collectionName).delete().eq('id', id);
      if (error) throw error;
      toast('Item deleted.');
      if (refreshCb) refreshCb();
    } catch (e) {
      toast('Could not delete: ' + e.message, true);
    }
  };
}
