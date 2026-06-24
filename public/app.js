const $ = (selector) => document.querySelector(selector);
const authDialog = $('#authDialog');
const authForm = $('#authForm');
const authTitle = $('#authTitle');
const authMessage = $('#authMessage');
const sessionPanel = $('#sessionPanel');
const projectForm = $('#projectForm');
const projectsEl = $('#projects');
const adminPanel = $('#adminPanel');
const logoutBtn = $('#logoutBtn');
let mode = 'login';
let token = localStorage.getItem('cloudpress_token') || '';

const api = async (path, options = {}) => {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
};

function openAuth(nextMode) {
  mode = nextMode;
  authTitle.textContent = mode === 'signup' ? '가입' : '로그인';
  authMessage.textContent = mode === 'signup' ? '첫 관리자 이메일은 ADMIN_EMAIL 환경 변수와 일치할 때 관리자 권한을 받습니다.' : '계정으로 콘솔에 접속하세요.';
  authDialog.showModal();
}

document.querySelectorAll('[data-open-auth]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.openAuth)));
$('#closeAuth').addEventListener('click', () => authDialog.close());

function renderProjects(projects = []) {
  projectsEl.innerHTML = projects.map((project) => `<article class="project"><div class="flex items-center justify-between gap-3"><h3 class="font-black">${project.name}</h3><span class="badge">${project.type}</span></div><p class="mt-3 text-sm text-slate-300">상태: ${project.status} · 지역: ${project.region}</p><p class="mt-2 text-xs text-slate-500">${new Date(project.createdAt).toLocaleString('ko-KR')}</p></article>`).join('') || '<p class="text-slate-400">아직 생성된 프로젝트가 없습니다.</p>';
}

async function refresh() {
  if (!token) {
    sessionPanel.textContent = '로그인하면 프로젝트 생성과 관리자 기능을 사용할 수 있습니다.';
    projectForm.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    adminPanel.classList.add('hidden');
    projectsEl.innerHTML = '';
    return;
  }
  try {
    const me = await api('/me');
    sessionPanel.innerHTML = `<b>${me.user.email}</b>님 환영합니다. 역할: <span class="badge">${me.user.role}</span>`;
    projectForm.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    renderProjects(me.projects);
    if (me.user.role === 'admin') {
      const stats = await api('/admin/stats');
      adminPanel.classList.remove('hidden');
      adminPanel.innerHTML = `<h3 class="font-black text-amber-100">관리자 패널</h3><p class="mt-2 text-sm text-amber-50/80">사용자 ${stats.users}명 · 프로젝트 ${stats.projects}개 · 감사 로그 ${stats.auditLogs}건 · 상태 ${stats.status}</p>`;
    } else adminPanel.classList.add('hidden');
  } catch (error) {
    localStorage.removeItem('cloudpress_token'); token = ''; await refresh();
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(authForm));
  try {
    const data = await api(mode === 'signup' ? '/auth/signup' : '/auth/login', { method: 'POST', body: JSON.stringify(body) });
    token = data.token;
    localStorage.setItem('cloudpress_token', token);
    authDialog.close();
    authForm.reset();
    await refresh();
  } catch (error) { authMessage.textContent = error.message; }
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(projectForm));
  try {
    const data = await api('/projects', { method: 'POST', body: JSON.stringify(body) });
    renderProjects(data.projects);
    projectForm.reset();
  } catch (error) { sessionPanel.textContent = error.message; }
});

logoutBtn.addEventListener('click', async () => { token = ''; localStorage.removeItem('cloudpress_token'); await refresh(); });
refresh();
