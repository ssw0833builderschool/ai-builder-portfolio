/* ============================================================
   Supabase 인증 + 예약 (supabase-js CDN, 빌드 도구 없음)
   ============================================================ */
(function () {
  'use strict';

  // ---- 설정 (공개 anon/publishable 키 — 클라이언트 노출 정상) ----
  var SUPABASE_URL = 'https://wvjaiqaxkstaunttfnpl.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_tZ1f6Gno8uU8Pofaz4bIrA_EJVkOZGN';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('supabase-js CDN 로드 실패');
    var b = document.getElementById('btnLogin');
    if (b) { b.textContent = '회원기능 오류'; b.disabled = true; }
    return;
  }
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---- DOM ----
  var $ = function (id) { return document.getElementById(id); };
  var navUser = $('navUser'), btnLogin = $('btnLogin'), btnLogout = $('btnLogout');
  var modal = $('authModal'), authForm = $('authForm');
  var authEmail = $('authEmail'), authPassword = $('authPassword');
  var authTitle = $('authTitle'), authSub = $('authSub'), authSubmit = $('authSubmit');
  var authMsg = $('authMsg'), authToggle = $('authToggle'), authToggleText = $('authToggleText');
  var btnGoogle = $('btnGoogle');
  var bookingGuest = $('bookingGuest'), bookingWrap = $('bookingWrap'), bookingLoginBtn = $('bookingLoginBtn');
  var bookingForm = $('bookingForm'), bookingMsg = $('bookingMsg'), myResList = $('myResList');

  var mode = 'login';

  // ---- 유틸 ----
  function setMsg(el, text, kind) {
    var base = (el === authMsg) ? 'auth-msg' : 'booking__msg';
    el.textContent = text || '';
    el.className = base + (kind ? ' ' + kind : '');
  }
  function esc(s) {
    return ('' + (s == null ? '' : s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return '';
    var p = ('' + d).split('-');
    return p.length === 3 ? p[0] + '. ' + p[1] + '. ' + p[2] : d;
  }
  function ko(m) {
    if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (/already registered|already been/i.test(m)) return '이미 가입된 이메일입니다. 로그인해 주세요.';
    if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 합니다.';
    if (/Email not confirmed/i.test(m)) return '이메일 인증이 필요합니다. 메일함의 링크를 확인해 주세요.';
    if (/valid email|Unable to validate email/i.test(m)) return '이메일 형식을 확인해 주세요.';
    return m;
  }

  // ---- 모달 ----
  function setMode(m) {
    mode = m;
    var login = m === 'login';
    authTitle.textContent = login ? '로그인' : '회원가입';
    authSub.textContent = login ? '인천 명품 회원으로 로그인하세요.' : '이메일로 간편하게 가입하세요.';
    authSubmit.textContent = login ? '로그인' : '가입하기';
    authToggleText.textContent = login ? '계정이 없으신가요?' : '이미 계정이 있으신가요?';
    authToggle.textContent = login ? '회원가입' : '로그인';
    authPassword.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
    setMsg(authMsg, '');
  }
  function openModal(m) {
    setMode(m || 'login');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { authEmail.focus(); }, 60);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    authForm.reset();
    setMsg(authMsg, '');
  }

  if (btnLogin) btnLogin.addEventListener('click', function () { openModal('login'); });
  if (bookingLoginBtn) bookingLoginBtn.addEventListener('click', function () { openModal('login'); });
  if (authToggle) authToggle.addEventListener('click', function () { setMode(mode === 'login' ? 'signup' : 'login'); });
  modal.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  // ---- 가입 / 로그인 ----
  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = authEmail.value.trim(), pw = authPassword.value;
    authSubmit.disabled = true;
    setMsg(authMsg, '처리 중…');
    var req = mode === 'login'
      ? sb.auth.signInWithPassword({ email: email, password: pw })
      : sb.auth.signUp({ email: email, password: pw });
    req.then(function (res) {
      authSubmit.disabled = false;
      if (res.error) { setMsg(authMsg, ko(res.error.message), 'err'); return; }
      if (mode === 'signup') {
        if (res.data && res.data.session) {
          setMsg(authMsg, '가입 완료! 로그인되었습니다.', 'ok');
          setTimeout(closeModal, 900);
        } else {
          setMsg(authMsg, '가입 확인 메일을 보냈습니다. 메일의 링크를 클릭한 뒤 로그인해 주세요.', 'ok');
        }
      } else {
        setMsg(authMsg, '로그인 성공', 'ok');
        setTimeout(closeModal, 500);
      }
    }).catch(function (err) {
      authSubmit.disabled = false;
      setMsg(authMsg, '오류: ' + err.message, 'err');
    });
  });

  // ---- Google 로그인 ----
  if (btnGoogle) btnGoogle.addEventListener('click', function () {
    setMsg(authMsg, 'Google 로그인으로 이동 중…');
    sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname }
    }).then(function (res) {
      if (res.error) {
        setMsg(authMsg, 'Google 로그인이 아직 설정되지 않았습니다. (' + res.error.message + ')', 'err');
      }
    }).catch(function (err) {
      setMsg(authMsg, '오류: ' + err.message, 'err');
    });
  });

  // ---- 로그아웃 ----
  if (btnLogout) btnLogout.addEventListener('click', function () { sb.auth.signOut(); });

  // ---- 로그인 상태 반영 ----
  function updateUI(user) {
    var on = !!user;
    if (navUser) { navUser.textContent = on ? user.email : ''; navUser.hidden = !on; }
    if (btnLogin) btnLogin.hidden = on;
    if (btnLogout) btnLogout.hidden = !on;
    if (bookingGuest) bookingGuest.hidden = on;
    if (bookingWrap) bookingWrap.hidden = !on;
    if (on) loadMyReservations();
    else if (myResList) myResList.innerHTML = '';
  }

  sb.auth.getSession().then(function (res) {
    updateUI(res.data.session ? res.data.session.user : null);
  });
  sb.auth.onAuthStateChange(function (_evt, session) {
    updateUI(session ? session.user : null);
  });

  // ---- 예약 신청 ----
  if (bookingForm) bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('bkName').value.trim();
    var phone = $('bkPhone').value.trim();
    var res_date = $('bkDate').value;
    var note = $('bkNote').value.trim();
    var btn = $('bkSubmit');
    btn.disabled = true;
    setMsg(bookingMsg, '예약 신청 중…');
    sb.auth.getUser().then(function (u) {
      var user = u.data.user;
      if (!user) { setMsg(bookingMsg, '로그인이 필요합니다.', 'err'); btn.disabled = false; return; }
      return sb.from('reservations')
        .insert({ name: name, phone: phone, note: note, res_date: res_date, user_id: user.id })
        .then(function (r) {
          btn.disabled = false;
          if (r.error) { setMsg(bookingMsg, '예약 실패: ' + r.error.message, 'err'); return; }
          setMsg(bookingMsg, '예약이 접수되었습니다. 감사합니다!', 'ok');
          bookingForm.reset();
          loadMyReservations();
        });
    }).catch(function (err) {
      btn.disabled = false;
      setMsg(bookingMsg, '오류: ' + err.message, 'err');
    });
  });

  // ---- 내 예약 목록 (본인 것만) ----
  function loadMyReservations() {
    if (!myResList) return;
    myResList.innerHTML = '<li class="res--empty">불러오는 중…</li>';
    sb.auth.getUser().then(function (u) {
      var user = u.data.user;
      if (!user) { myResList.innerHTML = ''; return; }
      return sb.from('reservations')
        .select('*')
        .eq('user_id', user.id)
        .order('res_date', { ascending: true })
        .then(function (r) {
          if (r.error) {
            myResList.innerHTML = '<li class="res--empty">예약을 불러오지 못했습니다: ' + esc(r.error.message) + '</li>';
            return;
          }
          var rows = r.data || [];
          if (!rows.length) { myResList.innerHTML = '<li class="res--empty">아직 예약 내역이 없습니다.</li>'; return; }
          myResList.innerHTML = rows.map(function (x) {
            return '<li class="res"><div class="res__date">' + fmtDate(x.res_date) + '</div>' +
              '<div class="res__meta">' + esc(x.name) + ' · ' + esc(x.phone) + '</div>' +
              (x.note ? '<div class="res__note">' + esc(x.note) + '</div>' : '') + '</li>';
          }).join('');
        });
    });
  }
})();
