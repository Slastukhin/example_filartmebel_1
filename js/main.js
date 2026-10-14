/* Филарт Мебель — главная страница. Vanilla JS, без зависимостей.
   Модули: header, burger, heroSlider, scroller, gallery, slider, video,
   modal + form, reveal, bottomBar, toTop. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* ---------- Шапка: компактнее при прокрутке ---------- */
  function initHeader() {
    var header = $('[data-header]');
    if (!header) return;
    var tick = false;
    function paint() { header.classList.toggle('is-scrolled', window.scrollY > 24); tick = false; }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  }

  /* ---------- Бургер-меню ---------- */
  function initBurger() {
    var btn = $('[data-burger]'), menu = $('[data-mobile-menu]');
    if (!btn || !menu) return;
    function set(open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      document.body.classList.toggle('menu-open', open);
    }
    btn.addEventListener('click', function () { set(menu.hidden); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) set(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) { if (e.matches) set(false); });
  }

  /* ---------- Первый экран: два слайда, только ручное переключение ---------- */
  function initHero() {
    var root = $('[data-hero]');
    if (!root) return;
    var slides = $$('[data-hero-slide]', root), dots = $$('[data-hero-dot]', root);
    if (slides.length < 2) return;
    function go(i) {
      slides.forEach(function (s, k) { s.hidden = k !== i; s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); d.setAttribute('aria-selected', String(k === i)); });
    }
    dots.forEach(function (d) { d.addEventListener('click', function () { go(+d.getAttribute('data-hero-dot')); }); });
    /* свайп на тач-экранах */
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 50) return;
      var cur = slides.findIndex(function (s) { return !s.hidden; });
      go((cur + (dx < 0 ? 1 : slides.length - 1)) % slides.length);
    });
  }

  /* ---------- Лента логотипов: ручная прокрутка стрелками ---------- */
  function initScrollers() {
    $$('[data-scroller]').forEach(function (root) {
      var track = $('[data-scroller-track]', root), prev = $('[data-scroller-prev]', root), next = $('[data-scroller-next]', root);
      if (!track) return;
      function step() { return Math.max(200, track.clientWidth * 0.7); }
      function paint() {
        var max = track.scrollWidth - track.clientWidth;
        root.classList.toggle('at-start', track.scrollLeft <= 2);
        root.classList.toggle('at-end', track.scrollLeft >= max - 2);
        root.classList.toggle('no-scroll', max <= 2);
      }
      prev && prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: REDUCED ? 'auto' : 'smooth' }); });
      next && next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: REDUCED ? 'auto' : 'smooth' }); });
      track.addEventListener('scroll', paint, { passive: true });
      window.addEventListener('resize', paint);
      paint();
    });
  }

  /* ---------- Галерея фото (блок «Мебель и кухни»): ручное листание ---------- */
  function initGalleries() {
    $$('[data-gallery]').forEach(function (root) {
      var imgs = $$('.gallery__img', root), prev = $('[data-gallery-prev]', root), next = $('[data-gallery-next]', root), dotsBox = $('[data-gallery-dots]', root);
      if (imgs.length < 2) return;
      var i = 0, dots = [];
      function go(n) {
        i = (n + imgs.length) % imgs.length;
        imgs.forEach(function (im, k) { im.hidden = k !== i; im.classList.toggle('is-active', k === i); });
        dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      }
      if (dotsBox) imgs.forEach(function (_, k) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'gallery__dot';
        b.setAttribute('aria-label', 'Фото ' + (k + 1)); b.addEventListener('click', function () { go(k); });
        dotsBox.appendChild(b); dots.push(b);
      });
      prev && prev.addEventListener('click', function () { go(i - 1); });
      next && next.addEventListener('click', function () { go(i + 1); });
      var x0 = null;
      root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      root.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1); });
      go(0);
    });
  }

  /* ---------- Слайдер карточек (мобильные): scroll-snap, точки = реальные позиции ---------- */
  function initSliders() {
    $$('[data-slider]').forEach(function (root) {
      var track = $('[data-slider-track]', root), nav = $('[data-slider-nav]', root);
      if (!track || !nav) return;
      var dotsBox = $('[data-slider-dots]', nav), prev = $('[data-slider-prev]', nav), next = $('[data-slider-next]', nav);
      var items = [], dots = [], tick = false;
      function offset(el) { return el.offsetLeft - track.offsetLeft; }
      function scrollable() { return getComputedStyle(track).overflowX !== 'visible' && track.scrollWidth > track.clientWidth + 2; }
      function reachable() {
        var max = track.scrollWidth - track.clientWidth + 2;
        return $$(':scope > *', track).filter(function (el) { return offset(el) <= max; });
      }
      function current() {
        var x = track.scrollLeft, best = 0, bd = Infinity;
        items.forEach(function (el, k) { var d = Math.abs(offset(el) - x); if (d < bd) { bd = d; best = k; } });
        return best;
      }
      function go(k) { k = Math.max(0, Math.min(items.length - 1, k)); track.scrollTo({ left: offset(items[k]), behavior: REDUCED ? 'auto' : 'smooth' }); }
      function paint() {
        var k = current(), atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        dots.forEach(function (d, n) { d.setAttribute('aria-current', n === k ? 'true' : 'false'); });
        prev.disabled = track.scrollLeft <= 2; next.disabled = atEnd; tick = false;
      }
      function build() {
        dotsBox.innerHTML = ''; dots = [];
        if (!scrollable()) { nav.hidden = true; return; }
        items = reachable(); nav.hidden = items.length < 2;
        items.forEach(function (_, k) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'slider__dot';
          b.setAttribute('aria-label', 'Слайд ' + (k + 1) + ' из ' + items.length); b.addEventListener('click', function () { go(k); });
          dotsBox.appendChild(b); dots.push(b);
        });
        paint();
      }
      prev.addEventListener('click', function () { go(current() - 1); });
      next.addEventListener('click', function () { go(current() + 1); });
      track.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(paint); } }, { passive: true });
      var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(build, 120); });
      build();
    });
  }

  /* ---------- Видео: по клику подставляем плеер ВКонтакте ---------- */
  function initVideo() {
    $$('[data-video]').forEach(function (box) {
      var btn = $('[data-video-play]', box);
      if (!btn) return;
      btn.addEventListener('click', function () {
        var f = document.createElement('iframe');
        f.src = box.getAttribute('data-video'); f.title = 'Видео о производстве Филарт';
        f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture'); f.setAttribute('allowfullscreen', '');
        box.classList.add('is-playing'); box.appendChild(f);
        var fb = document.createElement('a'); fb.className = 'video__fallback'; fb.href = f.src; fb.target = '_blank'; fb.rel = 'noopener';
        fb.textContent = 'Если видео не открылось — смотреть ВКонтакте'; box.appendChild(fb);
      });
    });
  }

  /* ---------- Попап и форма ---------- */
  function initModal() {
    var modal = $('[data-modal]');
    if (!modal) return;
    var dialog = $('.modal__dialog', modal), form = $('[data-form]', modal), success = $('[data-form-success]', modal);
    var topicEl = $('[data-form-topic]', modal), submit = $('[data-form-submit]', form);
    var phone = $('input[name="phone"]', form), consent = $('input[name="consent"]', form);
    var phoneErr = $('#f-phone-err', modal), consentErr = $('#f-consent-err', modal);
    var opener = null;

    function focusables() { return $$('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])', dialog).filter(function (el) { return el.offsetParent !== null; }); }
    function open(btn) {
      opener = btn || null;
      var topic = btn && btn.getAttribute('data-topic');
      if (topicEl) { topicEl.hidden = !topic; topicEl.textContent = topic ? 'Интересует: ' + topic : ''; }
      form.hidden = false; success.hidden = true; form.reset(); clearErrors();
      modal.hidden = false; document.body.classList.add('modal-open');
      setTimeout(function () { var f = $('input[name="name"]', form); f && f.focus(); }, 40);
    }
    function close() {
      modal.hidden = true; document.body.classList.remove('modal-open');
      if (opener && opener.focus) opener.focus();
    }
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open-form]'); if (o) { e.preventDefault(); open(o); return; }
      if (e.target.closest('[data-modal-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* маска телефона +7 (___) ___-__-__ */
    function digits(v) { var d = v.replace(/\D/g, ''); if (d[0] === '8' || d[0] === '7') d = d.slice(1); return d.slice(0, 10); }
    function format(d) {
      var s = '+7';
      if (d.length) s += ' (' + d.slice(0, 3); if (d.length >= 3) s += ')';
      if (d.length > 3) s += ' ' + d.slice(3, 6); if (d.length > 6) s += '-' + d.slice(6, 8); if (d.length > 8) s += '-' + d.slice(8, 10);
      return s;
    }
    phone.addEventListener('input', function () { var d = digits(phone.value); phone.value = d.length ? format(d) : ''; setErr(phone, phoneErr, false); });
    phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
    phone.addEventListener('blur', function () { if (phone.value === '+7 (' || phone.value === '+7') phone.value = ''; });
    consent.addEventListener('change', function () { setErr(consent, consentErr, false); });

    function setErr(input, el, on) { input.setAttribute('aria-invalid', on ? 'true' : 'false'); if (el) el.hidden = !on; }
    function clearErrors() { setErr(phone, phoneErr, false); setErr(consent, consentErr, false); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null;
      if (digits(phone.value).length !== 10) { setErr(phone, phoneErr, true); ok = false; first = first || phone; }
      if (!consent.checked) { setErr(consent, consentErr, true); ok = false; first = first || consent; }
      if (!ok) { first.focus(); return; }
      var label = submit.textContent; submit.disabled = true; submit.textContent = 'Отправляем…';
      var data = { name: $('input[name="name"]', form).value.trim(), phone: phone.value, topic: topicEl ? topicEl.textContent : '' };
      setTimeout(function () {
        console.log('Заявка (демо, без отправки на сервер):', data);
        submit.disabled = false; submit.textContent = label;
        form.hidden = true; success.hidden = false; success.focus();
      }, 700);
    });
  }

  /* ---------- Появление блоков ---------- */
  function initReveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-visible'); }); return; }
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Нижняя панель на телефоне и кнопка «наверх» ---------- */
  function initBars() {
    var bar = $('[data-bottom-bar]'), top = $('[data-to-top]'), hero = $('.hero');
    if (!hero) return;
    var mq = window.matchMedia('(max-width: 767px)');
    function paint() {
      var past = window.scrollY > hero.offsetTop + hero.offsetHeight - 80;
      if (bar) { bar.hidden = !(past && mq.matches); document.body.classList.toggle('has-bar', !bar.hidden); }
      if (top) top.hidden = !past;
    }
    var tick = false;
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { paint(); tick = false; }); } }, { passive: true });
    mq.addEventListener('change', paint);
    top && top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });
    paint();
  }

  /* ---------- Параллакс (если на странице есть элементы с data-parallax) ---------- */
  function initParallax() {
    var els = $$('[data-parallax]');
    if (!els.length || REDUCED || window.matchMedia('(max-width: 1023px)').matches) return;
    var tick = false;
    function paint() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
        var k = parseFloat(el.getAttribute('data-parallax')) || 0.15;
        var y = (r.top + r.height / 2 - vh / 2) * -k;
        el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      });
      tick = false;
    }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  }

  initHeader(); initBurger(); initHero(); initScrollers(); initGalleries(); initSliders();
  initVideo(); initModal(); initReveal(); initBars(); initParallax();
})();
