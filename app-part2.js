async function sendChat() {
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
