import { API, Session } from '../../components/api.js';
import { Toast }        from '../../components/toast.js';

const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)',  duration: 600 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

const card           = document.getElementById('auth-card');
const form           = document.getElementById('form-cadastro');
const nomeInput      = document.getElementById('input-nome');
const emailInput     = document.getElementById('input-email');
const senhaInput     = document.getElementById('input-senha');
const confirmarInput = document.getElementById('input-confirmar');
const btnCadastrar   = document.getElementById('btn-cadastrar');
const btnText        = btnCadastrar.querySelector('.btn-text');
const btnLoading     = btnCadastrar.querySelector('.btn-loading');
const strengthBar    = document.getElementById('strength-bar');

/* ── ANIMAÇÃO DE ENTRADA ─────────────────────────────────── */
anime({ targets: card, opacity: [0, 1], translateY: [24, 0], ...SPRING_ENTRADA });

/* ── SESSÃO EXISTENTE → REDIRECIONA ──────────────────────── */
if (Session.existe()) {
  window.location.href = '/pages/dashboard/dashboard.html';
}

/* ── TOGGLE SENHA ────────────────────────────────────────── */
function _setupToggle(btnId, inputEl) {
  document.getElementById(btnId).addEventListener('click', () => {
    const visible = inputEl.type === 'text';
    inputEl.type = visible ? 'password' : 'text';
    const icon = document.getElementById(btnId).querySelector('i');
    icon.className = visible ? 'ti ti-eye' : 'ti ti-eye-off';
    anime({ targets: icon, scale: [0.8, 1], ...SPRING_MICRO });
  });
}
_setupToggle('btn-toggle-senha', senhaInput);
_setupToggle('btn-toggle-confirmar', confirmarInput);

/* ── FORÇA DA SENHA ──────────────────────────────────────── */
senhaInput.addEventListener('input', () => {
  const v = senhaInput.value;
  let score = 0;
  if (v.length >= 6)           score++;
  if (v.length >= 10)          score++;
  if (/[A-Z]/.test(v))         score++;
  if (/[0-9]/.test(v))         score++;
  if (/[^A-Za-z0-9]/.test(v))  score++;

  const pct   = (score / 5) * 100;
  const color = score <= 1 ? 'var(--danger)' : score <= 3 ? 'var(--warning)' : 'var(--success)';
  strengthBar.style.width      = `${pct}%`;
  strengthBar.style.background = color;
});

/* ── SUBMIT ──────────────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome      = nomeInput.value.trim();
  const email     = emailInput.value.trim();
  const senha     = senhaInput.value;
  const confirmar = confirmarInput.value;

  if (!nome)             { Toast.warning('Informe seu nome.');                         nomeInput.focus();      return; }
  if (!email)            { Toast.warning('Informe o e-mail.');                         emailInput.focus();     return; }
  if (senha.length < 6)  { Toast.warning('A senha precisa ter pelo menos 6 caracteres.'); senhaInput.focus(); return; }
  if (senha !== confirmar) { Toast.warning('As senhas não coincidem.');                confirmarInput.focus(); return; }

  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');
  btnCadastrar.disabled = true;

  try {
    await API.registrar({ nome_usuario: nome, email_usuario: email, senha_usuario: senha });

    Toast.success('Conta criada com sucesso! Faça login para continuar.');

    anime({
      targets: card,
      opacity: [1, 0],
      translateY: [0, -16],
      ...SPRING_MICRO,
      complete: () => { window.location.href = '/index.html'; },
    });

  } catch (err) {
    Toast.error(err.message || 'Erro ao criar conta. Tente novamente.');

    anime({
      targets: card,
      translateX: [-8, 8, -6, 6, -4, 4, 0],
      duration: 400,
      easing: 'easeInOutSine',
    });

  } finally {
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
    btnCadastrar.disabled = false;
  }
});
