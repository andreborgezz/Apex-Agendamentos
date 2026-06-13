/**
 * index.js — Autenticação (Login)
 * Chama POST /usuarios/login via API REST do backend.
 * Sessão salva no localStorage via Session (components/api.js).
 */

import { API, Session } from './components/api.js';
import { Toast }        from './components/toast.js';

/* ── SPRINGS ─────────────────────────────────────────────── */
const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

/* ── ELEMENTOS ───────────────────────────────────────────── */
const card        = document.getElementById('auth-card');
const form        = document.getElementById('form-login');
const emailInput  = document.getElementById('input-email');
const senhaInput  = document.getElementById('input-senha');
const btnLogin    = document.getElementById('btn-login');
const btnToggle   = document.getElementById('btn-toggle-senha');
const btnText     = btnLogin.querySelector('.btn-text');
const btnLoading  = btnLogin.querySelector('.btn-loading');

/* ── ANIMAÇÃO DE ENTRADA ─────────────────────────────────── */
anime({
  targets: card,
  opacity: [0, 1],
  translateY: [24, 0],
  ...SPRING_ENTRADA,
});

/* ── SESSÃO EXISTENTE → REDIRECIONA (só em produção) ─────── */
const _isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if (!_isDev && Session.existe()) {
  window.location.href = 'pages/dashboard/dashboard.html';
}

/* ── AUTO-SAVE EMAIL ─────────────────────────────────────── */
const LS_EMAIL   = 'apex_login_email';
const savedEmail = localStorage.getItem(LS_EMAIL);
if (savedEmail) emailInput.value = savedEmail;
emailInput.addEventListener('input', () => {
  localStorage.setItem(LS_EMAIL, emailInput.value);
});

/* ── TOGGLE SENHA ────────────────────────────────────────── */
btnToggle.addEventListener('click', () => {
  const visible = senhaInput.type === 'text';
  senhaInput.type = visible ? 'password' : 'text';
  const icon = btnToggle.querySelector('i');
  icon.className = visible ? 'ti ti-eye' : 'ti ti-eye-off';
  anime({ targets: icon, scale: [0.8, 1], ...SPRING_MICRO });
});

/* ── SUBMIT ──────────────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email) { Toast.warning('Informe o e-mail.'); emailInput.focus(); return; }
  if (!senha) { Toast.warning('Informe a senha.'); senhaInput.focus(); return; }

  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');
  btnLogin.disabled = true;

  try {
    await API.login(email, senha);

    localStorage.removeItem(LS_EMAIL);
    Toast.success('Bem-vindo! Redirecionando...');

    anime({
      targets: card,
      opacity: [1, 0],
      translateY: [0, -16],
      ...SPRING_MICRO,
      complete: () => {
        window.location.href = 'pages/dashboard/dashboard.html';
      },
    });

  } catch (err) {
    Toast.error(err.message || 'Falha ao autenticar. Tente novamente.');

    anime({
      targets: card,
      translateX: [-8, 8, -6, 6, -4, 4, 0],
      duration: 400,
      easing: 'easeInOutSine',
    });

  } finally {
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
    btnLogin.disabled = false;
  }
});
