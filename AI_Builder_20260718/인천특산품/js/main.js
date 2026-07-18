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
   판매처 지도 (OpenStreetMap + Leaflet — API 키·도메인 등록 불필요)
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
  var mapEl = document.getElementById('storeMap');
  var placeholder = document.getElementById('mapPlaceholder');
  if (!mapEl || !listEl) return;

  var map = null, markers = [];

  function esc(s) {
    return ('' + (s == null ? '' : s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---- 사이드 목록 렌더 ----
  STORES.forEach(function (s, i) {
    var li = document.createElement('li');
    li.className = 'store';
    li.setAttribute('data-i', i);
    li.innerHTML =
      '<div class="store__top"><span class="store__name">' + esc(s.name) + '</span>' +
      '<span class="store__tag">' + esc(s.tag) + '</span></div>' +
      '<p class="store__desc">' + esc(s.desc) + '</p>' +
      '<div class="store__addr">' + esc(s.addr) + '</div>';
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
    if (!map) return;
    var s = STORES[i];
    map.setView([s.lat, s.lng], 13, { animate: true });
    markers[i].openPopup();
  }

  function showMsg(html, isErr) {
    if (!placeholder) return;
    placeholder.innerHTML = html;
    placeholder.classList.toggle('err', !!isErr);
    placeholder.style.display = 'flex';
  }

  // ---- 지도 초기화 ----
  function initMap() {
    if (!window.L) {
      showMsg('지도 라이브러리를 불러오지 못했습니다.<br>네트워크(unpkg.com) 연결을 확인하세요.', true);
      return;
    }
    if (placeholder) placeholder.style.display = 'none';

    map = L.map(mapEl, { scrollWheelZoom: false }).setView([37.55, 126.62], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var pin = L.divIcon({
      className: 'map-pin', html: '<span></span>',
      iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12]
    });

    var bounds = [];
    STORES.forEach(function (s, i) {
      var m = L.marker([s.lat, s.lng], { icon: pin, title: s.name }).addTo(map);
      m.bindPopup(
        '<div class="iw"><div class="iw__name">' + esc(s.name) + '</div>' +
        '<span class="iw__tag">' + esc(s.tag) + '</span>' +
        '<div class="iw__desc">' + esc(s.desc) + '</div>' +
        '<div class="iw__addr">📍 ' + esc(s.addr) + '</div></div>'
      );
      m.on('click', function () { setActive(i); });
      markers.push(m);
      bounds.push([s.lat, s.lng]);
    });
    map.fitBounds(bounds, { padding: [40, 40] });
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }
})();
