/* INCHEON PREMIUM — interactions */
(function () {
  'use strict';

  /* ---- Loader ---- */
  window.addEventListener('load', function () {
    setTimeout(function () {
      var l = document.getElementById('loader');
      if (l) l.classList.add('done');
    }, 1700);
  });

  /* ---- Nav: scrolled state + scroll progress ---- */
  var nav = document.getElementById('nav');
  var progress = document.getElementById('progress');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (nav) nav.classList.toggle('scrolled', y > 60);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ---- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('navMenu');
  function toggleMenu(force) {
    var open = force !== undefined ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    burger.classList.toggle('open', open);
  }
  if (burger) burger.addEventListener('click', function () { toggleMenu(); });
  if (menu) menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { toggleMenu(false); });
  });

  /* ---- Reveal on scroll ---- */
  var revs = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    revs.forEach(function (r) { io.observe(r); });
  } else {
    revs.forEach(function (r) { r.classList.add('in'); });
  }

  /* ---- Count-up stats ---- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var isYear = target > 1800 && target < 2100;
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.floor(eased * target);
      el.textContent = (isYear ? val : val.toLocaleString('ko-KR')) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = (isYear ? target : target.toLocaleString('ko-KR')) + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* ---- Gentle parallax on hero media (kenburns stays on .hero__img) ---- */
  var heroMedia = document.querySelector('.hero__media');
  var heroContent = document.querySelector('.hero__content');
  if (heroMedia && window.matchMedia('(min-width:900px)').matches) {
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y < window.innerHeight) {
        heroMedia.style.transform = 'translateY(' + y * 0.14 + 'px)';
        if (heroContent) heroContent.style.transform = 'translateY(' + y * 0.06 + 'px)';
      }
    }, { passive: true });
  }
})();

/* ============================================================
   판매처 지도 (Kakao Maps) — 키는 kakaomap.env 에서 로드
   ============================================================ */
(function () {
  'use strict';

  // ---- 판매처 데이터 (직접 수정하세요) ----
  var STORES = [
    { name: '강화풍물시장', tag: '순무·인삼', lat: 37.7466, lng: 126.4874,
      addr: '인천 강화군 강화읍 중앙로 17-9',
      desc: '강화 순무·인삼·속노랑고구마 등 강화 특산이 한자리에 모인 대표 재래시장.' },
    { name: '소래포구 종합어시장', tag: '해산물', lat: 37.4013, lng: 126.7376,
      addr: '인천 남동구 소래역로 12',
      desc: '물때에 맞춰 들어오는 그날의 바다. 꽃게·대하·새우젓으로 이름난 수도권 최대 어시장.' },
    { name: '인천종합어시장', tag: '밴댕이·젓갈', lat: 37.4666, lng: 126.6237,
      addr: '인천 중구 참외전로 190',
      desc: '봄 밴댕이와 각종 젓갈, 건어물까지 — 인천 앞바다의 발효미식을 만나는 곳.' },
    { name: '강화인삼센터', tag: '6년근 인삼', lat: 37.7360, lng: 126.4790,
      addr: '인천 강화군 강화읍 중앙로 12',
      desc: '바다 안개를 머금은 강화 6년근 수삼·홍삼을 산지에서 직접 구매할 수 있는 전문 센터.' },
    { name: '신포국제시장', tag: '먹거리·특산', lat: 37.4730, lng: 126.6285,
      addr: '인천 중구 우현로49번길 11',
      desc: '개항장의 정취가 남은 100년 시장. 신포닭강정과 만두, 인천 먹거리의 성지.' },
    { name: '인천 개항장·차이나타운', tag: '관광·먹거리', lat: 37.4753, lng: 126.6178,
      addr: '인천 중구 차이나타운로 44',
      desc: '붉은 등불의 거리에서 즐기는 짜장면과 공갈빵, 근대 개항장 산책까지 한번에.' }
  ];

  var listEl = document.getElementById('storeList');
  var mapEl = document.getElementById('kakaoMap');
  var placeholder = document.getElementById('mapPlaceholder');
  if (!mapEl || !listEl) return;

  var markers = [], infowindows = [], kmap = null;

  // ---- 사이드 목록 렌더 ----
  STORES.forEach(function (s, i) {
    var li = document.createElement('li');
    li.className = 'store';
    li.setAttribute('data-i', i);
    li.innerHTML =
      '<div class="store__top"><span class="store__name">' + s.name + '</span>' +
      '<span class="store__tag">' + s.tag + '</span></div>' +
      '<p class="store__desc">' + s.desc + '</p>' +
      '<div class="store__addr">' + s.addr + '</div>';
    li.addEventListener('click', function () { focusStore(i); });
    listEl.appendChild(li);
  });

  function setActive(i) {
    listEl.querySelectorAll('.store').forEach(function (el, idx) {
      el.classList.toggle('active', idx === i);
    });
  }

  function focusStore(i) {
    setActive(i);
    if (!kmap) return;
    var s = STORES[i];
    kmap.panTo(new kakao.maps.LatLng(s.lat, s.lng));
    infowindows.forEach(function (iw) { iw.close(); });
    infowindows[i].open(kmap, markers[i]);
  }

  // ---- 안내 메시지 ----
  function showMsg(html, isErr) {
    if (!placeholder) return;
    placeholder.innerHTML = html;
    placeholder.classList.toggle('err', !!isErr);
    placeholder.style.display = 'flex';
  }

  // ---- 지도 초기화 ----
  function initMap() {
    if (placeholder) placeholder.style.display = 'none';
    kmap = new kakao.maps.Map(mapEl, {
      center: new kakao.maps.LatLng(37.55, 126.62),
      level: 9
    });
    kmap.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

    var bounds = new kakao.maps.LatLngBounds();
    STORES.forEach(function (s, i) {
      var pos = new kakao.maps.LatLng(s.lat, s.lng);
      bounds.extend(pos);
      var marker = new kakao.maps.Marker({ map: kmap, position: pos, title: s.name });
      var iw = new kakao.maps.InfoWindow({
        content: '<div class="iw"><div class="iw__name">' + s.name + '</div>' +
          '<span class="iw__tag">' + s.tag + '</span>' +
          '<div class="iw__desc">' + s.desc + '</div>' +
          '<div class="iw__addr">📍 ' + s.addr + '</div></div>',
        removable: true
      });
      kakao.maps.event.addListener(marker, 'click', function () { focusStore(i); });
      markers.push(marker);
      infowindows.push(iw);
    });
    kmap.setBounds(bounds);
  }

  // ---- Kakao SDK 동적 로드 ----
  function loadSDK(key) {
    var sc = document.createElement('script');
    sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' +
      encodeURIComponent(key) + '&libraries=services';
    sc.onload = function () { kakao.maps.load(initMap); };
    sc.onerror = function () {
      showMsg('지도를 불러오지 못했습니다.<br>키가 올바른지, 카카오 개발자센터에 <b>도메인이 등록</b>되었는지 확인하세요.', true);
    };
    document.head.appendChild(sc);
  }

  // ---- kakaomap.env 에서 키 읽기 ----
  fetch('kakaomap.env', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('env not found'); return r.text(); })
    .then(function (txt) {
      var m = txt.match(/^\s*KAKAO_MAP(?:_API)?_KEY\s*=\s*(.+)\s*$/m);
      var key = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
      if (!key || /여기에|YOUR|placeholder/i.test(key)) {
        showMsg('<b>카카오맵 키가 필요합니다.</b><br>' +
          '<code>kakaomap.env</code> 파일의 <code>KAKAO_MAP_KEY</code> 값을 실제 JavaScript 키로 교체하세요.<br>' +
          '<a href="https://developers.kakao.com" target="_blank" rel="noopener">developers.kakao.com</a> 에서 발급', true);
        return;
      }
      loadSDK(key);
    })
    .catch(function () {
      showMsg('<b>환경설정 파일을 읽을 수 없습니다.</b><br>' +
        'file:// 로 직접 열면 동작하지 않습니다. <b>로컬 서버</b>(예: VS Code Live Server)로 실행하세요.', true);
    });
})();
