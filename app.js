const API = window.MELODIA_API_URL;
let state = {
  user: null, accessToken: null, refreshToken: null, screenStack: ['home'],
  currentGenre: '', currentSong: null, currentChatUser: null, currentTicket: null,
  regType: 'listener', payPlan: 'mensuel', payOperator: 'airtel', supCat: 'paiement',
  diaAmount: null, buyAmount: null, adminTab: 'payments'
};

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.accessToken) headers['Authorization'] = 'Bearer ' + state.accessToken;
  let res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401 && state.refreshToken && !opts._retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return api(path, { ...opts, _retry: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

async function tryRefresh() {
  try {
    const res = await fetch(API + '/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken })
    });
    if (!res.ok) return false;
    const data = await res.json();
    state.accessToken = data.accessToken;
    localStorage.setItem('mel_access', data.accessToken);
    return true;
  } catch { return false; }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span>' : label;
}

function toggleAuth(which) {
  ['login', 'register', 'admin', 'forgot'].forEach(k => {
    document.getElementById('auth-' + k).style.display = k === which ? 'block' : 'none';
  });
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('auth-suc').style.display = 'none';
}
function showForgot() { toggleAuth('forgot'); }
function selType(t) {
  state.regType = t;
  document.getElementById('tc-listener').classList.toggle('sel-listener', t === 'listener');
  document.getElementById('tc-artist').classList.toggle('sel-artist', t === 'artist');
}
function authError(msg) {
  const e = document.getElementById('auth-err');
  e.textContent = msg; e.style.display = 'block';
}

async function doLogin() {
  const email = document.getElementById('li-email').value.trim();
  const pass = document.getElementById('li-pass').value;
  if (!email || !pass) return authError('Remplis tous les champs.');
  setLoading('li-btn', true, 'Se connecter');
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
    onAuthSuccess(data);
  } catch (e) { authError(e.message); }
  setLoading('li-btn', false, 'Se connecter');
}

async function doRegister() {
  const name = document.getElementById('re-name').value.trim();
  const email = document.getElementById('re-email').value.trim();
  const pass = document.getElementById('re-pass').value;
  if (!name || !email || !pass) return authError('Remplis tous les champs.');
  setLoading('re-btn', true, 'Créer mon compte');
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password: pass, role: state.regType }) });
    onAuthSuccess(data);
  } catch (e) { authError(e.message); }
  setLoading('re-btn', false, 'Créer mon compte');
}

async function doAdminLogin() {
  const email = document.getElementById('ad-email').value.trim();
  const pass = document.getElementById('ad-pass').value;
  if (!email || !pass) return authError('Remplis tous les champs.');
  setLoading('ad-btn', true, 'Connexion admin');
  try {
    const data = await api('/auth/admin-login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
    onAuthSuccess(data);
  } catch (e) { authError(e.message); }
  setLoading('ad-btn', false, 'Connexion admin');
}

async function doForgot() {
  const email = document.getElementById('fp-email').value.trim();
  if (!email) return authError('Entre ton email.');
  setLoading('fp-btn', true, 'Envoyer le lien');
  try {
    const data = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    const s = document.getElementById('auth-suc');
    s.textContent = data.message; s.style.display = 'block';
  } catch (e) { authError(e.message); }
  setLoading('fp-btn', false, 'Envoyer le lien');
}

function doGoogle() {
  showToast('Connexion Google : configure GOOGLE_CLIENT_ID côté backend (voir README) pour activer ce bouton.');
}

function onAuthSuccess(data) {
  state.user = data.user;
  state.accessToken = data.accessToken;
  state.refreshToken = data.refreshToken;
  localStorage.setItem('mel_access', data.accessToken);
  localStorage.setItem('mel_refresh', data.refreshToken);
  enterApp();
}

function logout() {
  api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: state.refreshToken }) }).catch(() => {});
  localStorage.removeItem('mel_access'); localStorage.removeItem('mel_refresh');
  state.user = null; state.accessToken = null; state.refreshToken = null;
  document.getElementById('screen-auth').classList.add('active');
  document.querySelectorAll('.screen').forEach(s => { if (s.id !== 'screen-auth') s.classList.remove('active'); });
  document.getElementById('bottom-nav').style.display = 'none';
  toggleAuth('login');
}

async function tryAutoLogin() {
  const access = localStorage.getItem('mel_access');
  const refresh = localStorage.getItem('mel_refresh');
  if (!access || !refresh) return;
  state.accessToken = access; state.refreshToken = refresh;
  try {
    const data = await api('/auth/me');
    state.user = data.user;
    enterApp();
  } catch { logout(); }
}

function enterApp() {
  document.getElementById('bottom-nav').style.display = 'flex';
  document.getElementById('home-hello').textContent = `Bonjour ${state.user.name.split(' ')[0]} 👋`;
  document.getElementById('artist-space-row').style.display = state.user.role === 'artist' ? 'flex' : 'none';
  document.getElementById('admin-space-row').style.display = state.user.role === 'admin' ? 'flex' : 'none';
  nav('home');
  loadGenres();
  loadHomeSongs();
  checkNotifications();
}

const NAV_TABS = ['home', 'explorer', 'chatlist', 'profile'];
function nav(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + screen);
  if (el) el.classList.add('active');
  if (state.screenStack[state.screenStack.length - 1] !== screen) state.screenStack.push(screen);
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.tab === screen));
  document.getElementById('bottom-nav').style.display = NAV_TABS.includes(screen) ? 'flex' : (state.user ? 'none' : 'none');
  const loaders = {
    explorer: loadExplorer, profile: loadProfile, notifications: loadNotifications,
    'support-list': loadTickets, artist: loadArtistDashboard, chatlist: loadChatList,
    diamonds: loadDiamondsScreen, admin: loadAdminDashboard
  };
  if (loaders[screen]) loaders[screen]();
}
function navBack() {
  state.screenStack.pop();
  const prev = state.screenStack.pop() || 'home';
  nav(prev);
}

function songRow(s) {
  return `<div class="song-row" onclick="openPlayer('${s.id}')">
    <img src="${s.cover_url || placeholderCover(s.title)}">
    <div class="song-info"><div class="song-title">${escapeHtml(s.title)}</div><div class="song-sub">${escapeHtml(s.artist_name || '')}</div></div>
    <div class="song-play">▶</div>
  </div>`;
}
function placeholderCover(title) {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(title)}&backgroundColor=1a1a26`;
}
function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let allSongsCache = [];
async function loadHomeSongs() {
  try {
    const data = await api('/songs');
    allSongsCache = data.songs;
    const el = document.getElementById('home-songs');
    el.innerHTML = data.songs.length ? data.songs.slice(0, 8).map(songRow).join('') :
      `<div class="empty"><div class="ic">🎵</div><div class="t">Aucune chanson pour l'instant</div><div class="d">Reviens bientôt !</div></div>`;
  } catch (e) { showToast(e.message); }
}
function loadGenres() {
  const genres = ['Rap', 'Afrobeat', 'Congo', 'Love', 'Trap', 'R&B', 'Gospel', 'Electro'];
  document.getElementById('genre-chips').innerHTML = genres.map(g =>
    `<div class="chip ${state.currentGenre === g ? 'on' : ''}" onclick="filterGenre('${g}')">${g}</div>`).join('');
}
function filterGenre(g) { state.currentGenre = state.currentGenre === g ? '' : g; loadGenres(); loadExplorer(); }
async function loadExplorer() {
  const q = document.getElementById('exp-search')?.value || '';
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (state.currentGenre) params.set('genre', state.currentGenre);
    const data = await api('/songs?' + params.toString());
    allSongsCache = data.songs;
    document.getElementById('exp-songs').innerHTML = data.songs.length ? data.songs.map(songRow).join('') :
      `<div class="empty"><div class="ic">🔍</div><div class="t">Aucun résultat</div><div class="d">Essaie une autre recherche.</div></div>`;
  } catch (e) { showToast(e.message); }
}

function openPlayer(songId) {
  const song = allSongsCache.find(s => s.id === songId);
  if (!song) return;
  state.currentSong = song;
  document.getElementById('pl-cover').src = song.cover_url || placeholderCover(song.title);
  document.getElementById('pl-title').textContent = song.title;
  document.getElementById('pl-artist').textContent = song.artist_name || '';
  document.getElementById('pl-dur').textContent = formatTime(song.duration_seconds || 210);
  document.getElementById('pl-time').textContent = '0:00';
  document.getElementById('pl-progress').style.width = '0%';
  document.getElementById('pl-playbtn').textContent = '▶';
  nav('player');
  api(`/songs/${songId}/play`, { method: 'POST' }).catch(() => {});
}
function closePlayer() { navBack(); }
let playInterval;
function togglePlay() {
  const btn = document.getElementById('pl-playbtn');
  const playing = btn.textContent === '⏸';
  if (playing) { btn.textContent = '▶'; clearInterval(playInterval); }
  else {
    btn.textContent = '⏸';
    let pct = parseFloat(document.getElementById('pl-progress').style.width) || 0;
    const dur = state.currentSong?.duration_seconds || 210;
    playInterval = setInterval(() => {
      pct += 100 / dur;
      if (pct >= 100) { pct = 100; clearInterval(playInterval); btn.textContent = '▶'; }
      document.getElementById('pl-progress').style.width = pct + '%';
      document.getElementById('pl-time').textContent = formatTime((pct / 100) * dur);
    }, 1000);
  }
}
function formatTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
async function likeSong() {
  if (!state.currentSong) return;
  try { const r = await api(`/songs/${state.currentSong.id}/like`, { method: 'POST' }); showToast(r.liked ? 'Ajouté aux titres likés ❤️' : 'Retiré des titres likés'); }
  catch (e) { showToast(e.message); }
}

async function loadProfile() {
  try {
    const data = await api('/auth/me');
    state.user = data.user;
    const u = state.user;
    document.getElementById('pr-avatar').src = u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}&backgroundColor=1DB954`;
    document.getElementById('pr-name').textContent = u.name;
    document.getElementById('pr-role').textContent = u.role === 'artist' ? 'Artiste' + (u.verified_artist ? ' ✓' : '') : (u.role === 'admin' ? 'Administrateur' : 'Auditeur');
    document.getElementById('premium-status').textContent = u.premium && u.premium_until
      ? 'Actif depuis le ' + new Date(u.premium_started_at).toLocaleDateString('fr-FR') + ' — jusqu\'au ' + new Date(u.premium_until).toLocaleDateString('fr-FR')
      : 'Non actif — Découvrir';
    document.getElementById('artist-space-row').style.display = u.role === 'artist' ? 'flex' : 'none';
    document.getElementById('admin-space-row').style.display = u.role === 'admin' ? 'flex' : 'none';
  } catch (e) { showToast(e.message); }
}

async function checkNotifications() {
  try {
    const data = await api('/notifications');
    const unread = data.notifications.filter(n => !n.read).length;
    document.getElementById('notif-dot').style.display = unread ? 'block' : 'none';
  } catch {}
}
async function loadNotifications() {
  try {
    const data = await api('/notifications');
    const el = document.getElementById('notif-list');
    el.innerHTML = data.notifications.length ? data.notifications.map(n => `
      <div class="list-row" style="align-items:flex-start;flex-direction:column;cursor:pointer;" onclick="markRead('${n.id}')">
        <div style="display:flex;justify-content:space-between;width:100%;">
          <b style="font-size:13.5px;">${!n.read ? '🟢 ' : ''}${escapeHtml(n.title)}</b>
          <span style="font-size:10px;color:var(--mut);font-weight:500;">${new Date(n.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        <div style="font-size:12px;color:var(--mut);font-weight:500;margin-top:5px;">${escapeHtml(n.body)}</div>
      </div>`).join('') : `<div class="empty"><div class="ic">🔔</div><div class="t">Aucune notification</div><div class="d">Tu es à jour !</div></div>`;
    document.getElementById('notif-dot').style.display = 'none';
  } catch (e) { showToast(e.message); }
}
function markRead(id) { api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {}); }

function selCat(c) {
  state.supCat = c;
  document.querySelectorAll('#sup-cats .cat-card').forEach(el => el.classList.toggle('on', el.dataset.cat === c));
}
async function submitTicket() {
  const subject = document.getElementById('sup-subject').value.trim();
  const message = document.getElementById('sup-message').value.trim();
  if (!subject || !message) return showToast('Remplis le sujet et le message.');
  setLoading('sup-submit-btn', true, 'Envoyer');
  try {
    await api('/support', { method: 'POST', body: JSON.stringify({ category: state.supCat, subject, message }) });
    showToast('Demande envoyée !');
    document.getElementById('sup-subject').value = ''; document.getElementById('sup-message').value = '';
    nav('support-list');
  } catch (e) { showToast(e.message); }
  setLoading('sup-submit-btn', false, 'Envoyer');
}
const STATUS_LABEL = { en_attente: 'En attente', en_cours: 'En cours', resolue: 'Résolue', pending: 'En attente', validated: 'Validée', rejected: 'Rejetée' };
async function loadTickets() {
  try {
    const data = await api('/support/mine');
    const el = document.getElementById('support-tickets');
    el.innerHTML = data.tickets.length ? data.tickets.map(t => `
      <div class="list-row" onclick="openTicket('${t.id}')">
        <div><div style="font-size:13.5px;">${escapeHtml(t.subject)}</div><div style="font-size:11px;color:var(--mut);font-weight:500;margin-top:3px;">${t.category}</div></div>
        <span class="status-pill status-${t.status}">${STATUS_LABEL[t.status]}</span>
      </div>`).join('') : `<div class="empty"><div class="ic">🛟</div><div class="t">Aucune demande</div><div class="d">Besoin d'aide ? Crée une nouvelle demande.</div></div>`;
  } catch (e) { showToast(e.message); }
}
async function openTicket(id) {
  state.currentTicket = id;
  nav('support-thread');
  try {
    const data = await api(`/support/${id}`);
    document.getElementById('sup-thread-title').textContent = data.ticket.subject;
    document.getElementById('sup-thread-status').textContent = STATUS_LABEL[data.ticket.status];
    document.getElementById('sup-thread-status').className = 'status-pill status-' + data.ticket.status;
    document.getElementById('sup-thread-msgs').innerHTML = data.messages.map(m =>
      `<div class="bubble ${m.is_admin ? 'theirs' : 'mine'}">${escapeHtml(m.content)}</div>`).join('');
  } catch (e) { showToast(e.message); }
}
async function sendTicketReply() {
  const input = document.getElementById('sup-reply-input');
  const msg = input.value.trim();
  if (!msg || !state.currentTicket) return;
  input.value = '';
  try { await api(`/support/${state.currentTicket}/reply`, { method: 'POST', body: JSON.stringify({ message: msg }) }); openTicket(state.currentTicket); }
  catch (e) { showToast(e.message); }
}

async function loadArtistDashboard() {
  try {
    const dash = await api('/artist/me/dashboard');
    document.getElementById('art-balance').textContent = dash.balance_fcfa.toLocaleString('fr-FR') + ' FCFA';
    document.getElementById('art-songcount').textContent = dash.songCount;
    document.getElementById('art-followers').textContent = dash.followers;
    const songs = await api('/songs/mine');
    document.getElementById('art-songs').innerHTML = songs.songs.length ? songs.songs.map(s => `
      <div class="song-row"><img src="${s.cover_url || placeholderCover(s.title)}">
        <div class="song-info"><div class="song-title">${escapeHtml(s.title)}</div><div class="song-sub">${s.plays} écoutes · ${s.likes} likes</div></div>
        <span class="status-pill status-${s.status === 'approved' ? 'validated' : s.status === 'rejected' ? 'rejected' : 'pending'}">${s.status === 'approved' ? 'Publiée' : s.status === 'rejected' ? 'Rejetée' : 'En attente'}</span>
      </div>`).join('') : `<div class="empty"><div class="ic">🎵</div><div class="t">Aucune chanson</div><div class="d">Ajoute ton premier titre !</div></div>`;
  } catch (e) { showToast(e.message); }
}
async function uploadSong() {
  const title = document.getElementById('up-title').value.trim();
  const genre = document.getElementById('up-genre').value.trim();
  const audio_url = document.getElementById('up-audio').value.trim();
  const cover_url = document.getElementById('up-cover').value.trim();
  if (!title) return showToast('Le titre est requis.');
  setLoading('up-btn', true, 'Envoyer pour validation');
  try {
    await api('/songs', { method: 'POST', body: JSON.stringify({ title, genre, audio_url, cover_url }) });
    showToast('Chanson envoyée pour validation !');
    document.getElementById('up-title').value = ''; document.getElementById('up-genre').value = '';
    document.getElementById('up-audio').value = ''; document.getElementById('up-cover').value = '';
    nav('artist');
  } catch (e) { showToast(e.message); }
  setLoading('up-btn', false, 'Envoyer pour validation');
}

async function loadChatList() {
  try {
    const data = await api('/artist/chat');
    const el = document.getElementById('chat-list');
    el.innerHTML = data.conversations.length ? data.conversations.map(c => `
      <div class="chat-row" onclick="openChat('${c.user_id}','${escapeHtml(c.name)}')">
        <img src="${c.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.name)}&backgroundColor=1a1a26`}">
        <div style="flex:1;"><div class="chat-name">${escapeHtml(c.name)}</div><div class="chat-msg">${escapeHtml(c.last_message || '')}</div></div>
        ${c.unread ? `<div class="unread">${c.unread}</div>` : ''}
      </div>`).join('') : `<div class="empty"><div class="ic">💬</div><div class="t">Aucun message</div><div class="d">Discute avec tes artistes préférés depuis leur profil.</div></div>`;
  } catch (e) { showToast(e.message); }
}
async function openChat(userId, name) {
  state.currentChatUser = userId;
  document.getElementById('ct-name').textContent = name;
  nav('chatthread');
  try {
    const data = await api(`/artist/chat/${userId}`);
    document.getElementById('ct-msgs').innerHTML = async function sendChat() {
  const input = document.getElementById('ct-input');
  const msg = input.value.trim();
  if (!msg || !state.currentChatUser) return;
  input.value = '';
  try { await api(`/artist/chat/${state.currentChatUser}`, { method: 'POST', body: JSON.stringify({ content: msg }) }); openChat(state.currentChatUser, document.getElementById('ct-name').textContent); }
  catch (e) { showToast(e.message); }
}

const PLAN_PRICES = { mensuel: 1000, trimestriel: 2400, annuel: 8400 };
const PLAN_DESC = { mensuel: 'Accès complet pendant 1 mois', trimestriel: 'Accès complet pendant 3 mois', annuel: 'Accès complet pendant 1 an (-20%)' };
function selPlan(p) {
  state.payPlan = p;
  document.querySelectorAll('.plan-opt').forEach(el => el.classList.toggle('on', el.dataset.plan === p));
  document.getElementById('pay-amount').textContent = PLAN_PRICES[p].toLocaleString('fr-FR') + ' FCFA';
  document.getElementById('pay-desc').textContent = PLAN_DESC[p];
}
function selOp(op) {
  state.payOperator = op;
  document.querySelectorAll('.pay-opt').forEach(el => {
    el.classList.toggle('sel', el.dataset.op === op);
    el.querySelector('.radio').classList.toggle('on', el.dataset.op === op);
  });
}
async function submitPayment() {
  setLoading('pay-btn', true, 'Confirmer le paiement');
  try {
    const data = await api('/payments', { method: 'POST', body: JSON.stringify({ plan: state.payPlan, operator: state.payOperator }) });
    showToast(`Transaction ${data.payment.code} enregistrée. En attente de validation.`);
    nav('profile');
  } catch (e) { showToast(e.message); }
  setLoading('pay-btn', false, 'Confirmer le paiement');
}

const GIFT_AMOUNTS = [10, 50, 100, 500];
const BUY_PACKS = { 10: 200, 50: 1000, 100: 2000, 500: 10000 };
function loadDiamondsScreen() {
  document.getElementById('my-diamonds').textContent = '💎 ' + (state.user.diamonds || 0);
  document.getElementById('dia-artist-name').textContent = state.currentSong?.artist_name || "l'artiste";
  document.getElementById('gift-amounts').innerHTML = GIFT_AMOUNTS.map(a =>
    `<div class="dopt ${state.diaAmount === a ? 'on' : ''}" onclick="selDia(${a})"><div class="amt">💎 ${a}</div><div class="price">Envoyer</div></div>`).join('');
  document.getElementById('buy-amounts').innerHTML = Object.entries(BUY_PACKS).map(([d, p]) =>
    `<div class="dopt ${state.buyAmount == d ? 'on' : ''}" onclick="selBuy(${d})"><div class="amt">💎 ${d}</div><div class="price">${Number(p).toLocaleString('fr-FR')} FCFA</div></div>`).join('');
}
function selDia(a) { state.diaAmount = a; loadDiamondsScreen(); }
function selBuy(a) { state.buyAmount = a; loadDiamondsScreen(); }
async function sendGift() {
  if (!state.diaAmount) return showToast('Choisis un montant de diamants.');
  if (!state.currentSong) return showToast('Ouvre une chanson pour identifier l\'artiste.');
  setLoading('gift-btn', true, 'Envoyer les diamants');
  try {
    await api(`/artist/${state.currentSong.artist_id}/gift`, { method: 'POST', body: JSON.stringify({ amount: state.diaAmount }) });
    showToast('Diamants envoyés, merci pour ton soutien ! 💚');
    const me = await api('/auth/me'); state.user = me.user;
    loadDiamondsScreen();
  } catch (e) { showToast(e.message); }
  setLoading('gift-btn', false, 'Envoyer les diamants');
}

async function loadAdminDashboard() {
  try {
    const stats = await api('/admin/stats');
    document.getElementById('ad-stat-users').textContent = stats.users;
    document.getElementById('ad-stat-revenue').textContent = stats.revenue.toLocaleString('fr-FR');
    document.getElementById('ad-stat-pending').textContent = stats.pendingPayments;
    document.getElementById('ad-stat-tickets').textContent = stats.openTickets;
  } catch (e) { showToast(e.message); }
  adminTab(state.adminTab);
}
function adminTab(tab) {
  state.adminTab = tab;
  document.querySelectorAll('#screen-admin .chip').forEach(c => c.classList.toggle('on', c.dataset.tab === tab));
  const fns = { payments: adminLoadPayments, songs: adminLoadSongs, support: adminLoadSupport, users: adminLoadUsers, notify: adminNotifyForm };
  fns[tab]();
}
async function adminLoadPayments() {
  const el = document.getElementById('admin-content');
  el.innerHTML = 'Chargement...';
  try {
    const data = await api('/payments/admin/all?status=pending');
    el.innerHTML = data.payments.length ? data.payments.map(p => `
      <div class="list-row" style="flex-direction:column;align-items:stretch;">
        <div style="display:flex;justify-content:space-between;"><b>${escapeHtml(p.user_name)}</b><span style="color:var(--grn);">${p.amount_fcfa.toLocaleString('fr-FR')} FCFA</span></div>
        <div style="font-size:11px;color:var(--mut);font-weight:500;margin:4px 0 10px;">${p.code} · ${p.plan} · ${p.operator === 'airtel' ? 'Airtel Money' : 'MTN MoMo'}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn sm" style="flex:1;" onclick="adminValidatePayment('${p.id}')">✓ Valider</button>
          <button class="btn sm danger" style="flex:1;" onclick="adminRejectPayment('${p.id}')">✕ Rejeter</button>
        </div>
      </div>`).join('') : `<div class="empty"><div class="ic">✅</div><div class="t">Aucun paiement en attente</div></div>`;
  } catch (e) { el.innerHTML = ''; showToast(e.message); }
}
async function adminValidatePayment(id) { try { await api(`/payments/admin/${id}/validate`, { method: 'POST' }); showToast('Paiement validé.'); adminLoadPayments(); } catch (e) { showToast(e.message); } }
async function adminRejectPayment(id) { try { await api(`/payments/admin/${id}/reject`, { method: 'POST' }); showToast('Paiement rejeté.'); adminLoadPayments(); } catch (e) { showToast(e.message); } }

async function adminLoadSongs() {
  const el = document.getElementById('admin-content');
  el.innerHTML = 'Chargement...';
  try {
    const data = await api('/admin/songs/pending');
    el.innerHTML = data.songs.length ? data.songs.map(s => `
      <div class="list-row" style="flex-direction:column;align-items:stretch;">
        <div style="display:flex;justify-content:space-between;"><b>${escapeHtml(s.title)}</b><span style="font-size:11px;color:var(--mut);">${escapeHtml(s.artist_name)}</span></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn sm" style="flex:1;" onclick="adminApproveSong('${s.id}')">✓ Approuver</button>
          <button class="btn sm danger" style="flex:1;" onclick="adminRejectSong('${s.id}')">✕ Rejeter</button>
        </div>
      </div>`).join('') : `<div class="empty"><div class="ic">🎵</div><div class="t">Aucune chanson en attente</div></div>`;
  } catch (e) { el.innerHTML = ''; showToast(e.message); }
}
async function adminApproveSong(id) { try { await api(`/admin/songs/${id}/approve`, { method: 'POST' }); showToast('Chanson approuvée.'); adminLoadSongs(); } catch (e) { showToast(e.message); } }
async function adminRejectSong(id) { try { await api(`/admin/songs/${id}/reject`, { method: 'POST' }); showToast('Chanson rejetée.'); adminLoadSongs(); } catch (e) { showToast(e.message); } }

async function adminLoadSupport() {
  const el = document.getElementById('admin-content');
  el.innerHTML = 'Chargement...';
  try {
    const data = await api('/support/admin/all');
    el.innerHTML = data.tickets.length ? data.tickets.map(t => `
      <div class="list-row" onclick="adminOpenTicket('${t.id}')">
        <div><div style="font-size:13.5px;">${escapeHtml(t.subject)}</div><div style="font-size:11px;color:var(--mut);font-weight:500;">${escapeHtml(t.user_name)} · ${t.category}</div></div>
        <span class="status-pill status-${t.status}">${STATUS_LABEL[t.status]}</span>
      </div>`).join('') : `<div class="empty"><div class="ic">🛟</div><div class="t">Aucun ticket</div></div>`;
  } catch (e) { el.innerHTML = ''; showToast(e.message); }
}
function adminOpenTicket(id) { state.currentTicket = id; state.screenStack.push('admin'); nav('support-thread'); openTicket(id); }

async function adminLoadUsers() {
  const el = document.getElementById('admin-content');
  el.innerHTML = 'Chargement...';
  try {
    const data = await api('/admin/users');
    el.innerHTML = data.users.map(u => `
      <div class="list-row" style="flex-direction:column;align-items:stretch;">
        <div style="display:flex;justify-content:space-between;"><b>${escapeHtml(u.name)}</b><span style="font-size:11px;color:var(--mut);">${u.role}${u.blocked ? ' · bloqué' : ''}</span></div>
        <div style="font-size:11px;color:var(--mut);font-weight:500;margin:2px 0 10px;">${escapeHtml(u.email)}</div>
        <div style="display:flex;gap:8px;">
          ${u.blocked
            ? `<button class="btn sm" style="flex:1;" onclick="adminUnblock('${u.id}')">Débloquer</button>`
            : `<button class="btn sm danger" style="flex:1;" onclick="adminBlock('${u.id}')">Bloquer</button>`}
          ${u.role === 'artist' && !u.verified_artist ? `<button class="btn sm outline" style="flex:1;" onclick="adminVerify('${u.id}')">Vérifier</button>` : ''}
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = ''; showToast(e.message); }
}
async function adminBlock(id) { try { await api(`/admin/users/${id}/block`, { method: 'POST' }); adminLoadUsers(); } catch (e) { showToast(e.message); } }
async function adminUnblock(id) { try { await api(`/admin/users/${id}/unblock`, { method: 'POST' }); adminLoadUsers(); } catch (e) { showToast(e.message); } }
async function adminVerify(id) { try { await api(`/admin/users/${id}/verify-artist`, { method: 'POST' }); showToast('Artiste vérifié.'); adminLoadUsers(); } catch (e) { showToast(e.message); } }

function adminNotifyForm() {
  document.getElementById('admin-content').innerHTML = `
    <label class="lbl">Destinataires</label>
    <div class="chip-row"><div class="chip on" id="aud-all" onclick="selAudience('all')">Tous</div><div class="chip" id="aud-artists" onclick="selAudience('artists')">Artistes</div><div class="chip" id="aud-listeners" onclick="selAudience('listeners')">Auditeurs</div></div>
    <label class="lbl">Titre</label><input class="inp" id="notif-title" placeholder="Titre du message">
    <label class="lbl">Message</label><textarea class="inp" id="notif-body" placeholder="Contenu du message..."></textarea>
    <button class="btn" id="notif-send-btn" onclick="adminSendNotification()">Envoyer la notification</button>`;
  window.adminAudience = 'all';
}
function selAudience(a) {
  window.adminAudience = a;
  ['all', 'artists', 'listeners'].forEach(x => document.getElementById('aud-' + x).classList.toggle('on', x === a));
}
async function adminSendNotification() {
  const title = document.getElementById('notif-title').value.trim();
  const body = document.getElementById('notif-body').value.trim();
  if (!title || !body) return showToast('Remplis le titre et le message.');
  setLoading('notif-send-btn', true, 'Envoyer la notification');
  try {
    await api('/notifications', { method: 'POST', body: JSON.stringify({ title, body, audience: window.adminAudience }) });
    showToast('Notification envoyée !');
    document.getElementById('notif-title').value = ''; document.getElementById('notif-body').value = '';
  } catch (e) { showToast(e.message); }
  setLoading('notif-send-btn', false, 'Envoyer la notification');
}

tryAutoLogin();
