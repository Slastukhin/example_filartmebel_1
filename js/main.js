/* ==========================================================================
   Филарт Мебель — Вариант 1 (ТЗ v2). Vanilla JS, без зависимостей.
   Модули: header, menu, modal, forms (маска + валидация + отправка),
           filters, calculator (пакет × длина), sliders (scroll-snap),
           lightbox (2 фото проекта), reveal, bottomBar.
   Файл подключён с defer — DOM уже готов к моменту выполнения.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Формат числа: 105000 → «105 000 ₽» (неразрывный пробел) */
  function formatMoney(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  /* ------------------------------------------------------------------------
     1. HEADER — тень при скролле
     ------------------------------------------------------------------------ */
  function initHeader() {
    var header = $('#header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------------
     2. MENU — бургер на < 1024px
     ------------------------------------------------------------------------ */
  function initMenu() {
    var burger = $('#burger');
    var nav = $('#nav');
    if (!burger || !nav) return null;
    var mq = window.matchMedia('(min-width: 1024px)');

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      document.body.classList.toggle('modal-open', open);
    }

    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); burger.focus(); }
    });
    var onChange = function (ev) { if (ev.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);

    return { close: function () { setOpen(false); } };
  }

  /* ------------------------------------------------------------------------
     3. MODAL — модальная форма (bottom-sheet на мобильных), фокус-ловушка
     ------------------------------------------------------------------------ */
  function initModal() {
    var modal = $('#lead-modal');
    if (!modal) return null;
    var dialog = $('.modal__dialog', modal);
    var form = $('form', modal);
    var opener = null;
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function focusables() {
      return $$(FOCUSABLE, dialog).filter(function (el) { return el.offsetParent !== null; });
    }

    function open(context, trigger) {
      opener = trigger || document.activeElement;
      if (form && form.__setContext) form.__setContext(context || {});
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      window.setTimeout(function () {
        var success = $('[data-form-success]', dialog);
        var target = (success && !success.hidden) ? success : $('input[name="name"]', dialog);
        if (target) target.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 60);
    }

    function close() {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      if (form && form.__isSent && form.__isSent()) form.__reset();
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
      opener = null;
    }

    $$('[data-modal-close]', modal).forEach(function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var list = focusables();
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });

    return { open: open, close: close };
  }

  /* Все кнопки с data-open-form → открывают модалку с контекстом */
  function initOpeners(modalApi, menuApi) {
    if (!modalApi) return;
    $$('[data-open-form]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (menuApi) menuApi.close();
        modalApi.open({
          topic: btn.getAttribute('data-topic') || '',
          project: btn.getAttribute('data-project') || '',
          params: btn.getAttribute('data-params') || ''
        }, btn);
      });
    });
  }

  /* ------------------------------------------------------------------------
     4. FORMS — маска телефона, валидация, имитация отправки, успех
     ------------------------------------------------------------------------ */
  function formatPhone(raw) {
    var d = raw.replace(/\D/g, '');
    if (d.charAt(0) === '7' || d.charAt(0) === '8') d = d.slice(1);
    d = d.slice(0, 10);
    var out = '+7';
    if (d.length > 0) out += ' (' + d.slice(0, 3);
    if (d.length >= 3) out += ')';
    if (d.length > 3) out += ' ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }

  function attachPhoneMask(input) {
    input.addEventListener('input', function (e) {
      var digits = input.value.replace(/\D/g, '');
      if (!digits || (e.inputType === 'deleteContentBackward' && digits.length <= 1)) {
        input.value = '';
        return;
      }
      input.value = formatPhone(input.value);
    });
    input.addEventListener('focus', function () {
      if (!input.value) input.value = '+7 (';
    });
    input.addEventListener('blur', function () {
      if (input.value.replace(/\D/g, '').length <= 1) input.value = '';
    });
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text');
      input.value = formatPhone(text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function initForm(form) {
    var phone = $('[data-phone]', form);
    var consent = $('input[name="consent"]', form);
    var submitBtn = $('[data-submit]', form);
    var submitText = $('[data-submit-text]', form);
    var success = form.parentElement ? $('[data-form-success]', form.parentElement) : null;
    var contextBox = $('[data-form-context]', form);
    var contextText = $('[data-form-context-text]', form);
    var contextClear = $('[data-form-context-clear]', form);
    var hidden = {
      topic: $('input[name="topic"]', form),
      project: $('input[name="project"]', form),
      params: $('input[name="params"]', form)
    };
    var originalBtnText = submitText ? submitText.textContent : '';
    var sent = false;

    if (phone) attachPhoneMask(phone);

    function fieldOf(input) { return input.closest('.field'); }

    function setError(input, message) {
      var field = fieldOf(input);
      if (!field) return;
      var err = $('.field__error', field);
      field.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      if (err) err.textContent = message;
    }

    function clearError(input) {
      var field = fieldOf(input);
      if (!field) return;
      var err = $('.field__error', field);
      field.classList.remove('has-error');
      input.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    }

    function validate() {
      var firstInvalid = null;
      if (phone) {
        var digits = phone.value.replace(/\D/g, '');
        if (digits.length !== 11) {
          setError(phone, digits.length <= 1 ? 'Укажите номер телефона — по нему мы перезвоним' : 'Номер должен содержать 11 цифр: +7 (___) ___-__-__');
          firstInvalid = firstInvalid || phone;
        } else clearError(phone);
      }
      if (consent) {
        if (!consent.checked) {
          setError(consent, 'Без согласия с пользовательским соглашением мы не сможем Вам перезвонить');
          firstInvalid = firstInvalid || consent;
        } else clearError(consent);
      }
      return firstInvalid;
    }

    if (phone) phone.addEventListener('input', function () { if (phone.value.replace(/\D/g, '').length === 11) clearError(phone); });
    if (consent) consent.addEventListener('change', function () { if (consent.checked) clearError(consent); });

    /* Контекст заявки: тема / проект (пакет) / параметры калькулятора */
    function setContext(ctx) {
      ctx = ctx || {};
      hidden.topic.value = ctx.topic || '';
      hidden.project.value = ctx.project || '';
      hidden.params.value = ctx.params || '';
      var parts = [];
      if (ctx.topic) parts.push('Тема: ' + ctx.topic);
      if (ctx.project) parts.push(ctx.project);
      if (ctx.params) parts.push(ctx.params);
      if (contextBox && contextText) {
        contextText.textContent = parts.join(' · ');
        contextBox.hidden = parts.length === 0;
      }
      /* Текст кнопки зависит от темы: для замера — «Записаться на замер» */
      if (submitText && !sent) {
        submitText.textContent = ctx.topic === 'Замер' ? 'Записаться на замер' : originalBtnText;
      }
    }
    if (contextClear) contextClear.addEventListener('click', function () { setContext({}); });

    function reset() {
      form.reset();
      setContext({});
      [phone, consent].forEach(function (i) { if (i) clearError(i); });
      if (submitBtn) { submitBtn.disabled = false; }
      if (submitText) submitText.textContent = originalBtnText;
      form.hidden = false;
      if (success) success.hidden = true;
      sent = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var invalid = validate();
      if (invalid) { invalid.focus(); return; }

      var payload = {
        form: form.getAttribute('data-form') || 'form',
        name: ($('input[name="name"]', form) || {}).value || '',
        phone: phone ? phone.value : '',
        comment: ($('textarea[name="comment"]', form) || {}).value || '',
        topic: hidden.topic.value,
        project: hidden.project.value,
        params: hidden.params.value,
        consent: consent ? consent.checked : false,
        sentAt: new Date().toISOString()
      };

      var btnLabel = submitText ? submitText.textContent : '';
      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.textContent = 'Отправляем…';

      /* Имитация запроса: 700 мс → успех, без перезагрузки страницы */
      window.setTimeout(function () {
        console.log('[Филарт Мебель] Заявка:', payload);
        sent = true;
        if (submitText) submitText.textContent = btnLabel;
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus({ preventScroll: false });
        }
      }, 700);
    });

    form.__setContext = setContext;
    form.__reset = reset;
    form.__isSent = function () { return sent; };
  }

  function initForms() {
    $$('form.form').forEach(initForm);
  }

  /* ------------------------------------------------------------------------
     5. FILTERS — проекты: пакет / фасад
     ------------------------------------------------------------------------ */
  function initFilters() {
    var root = $('#filters');
    var grid = $('#projects-grid');
    if (!root || !grid) return;
    var chips = $$('.chip[data-filter-group]', root);
    var cards = $$('.project', grid);
    var count = $('#filters-count');
    var resetBtn = $('#filters-reset');
    var empty = $('#projects-empty');
    var slider = grid.closest('[data-slider]');
    var state = { package: null, facade: null };
    var total = cards.length;

    function wordFor(n) {
      var m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 'проект';
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'проекта';
      return 'проектов';
    }

    function apply() {
      var shown = 0;
      cards.forEach(function (card) {
        var ok = Object.keys(state).every(function (group) {
          if (!state[group]) return true;
          var values = (card.getAttribute('data-' + group) || '').split(/\s+/);
          return values.indexOf(state[group]) !== -1;
        });
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      chips.forEach(function (chip) {
        var active = state[chip.getAttribute('data-filter-group')] === chip.getAttribute('data-filter-value');
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', String(active));
      });
      var anyActive = Object.keys(state).some(function (k) { return !!state[k]; });
      if (count) {
        count.textContent = anyActive
          ? (shown ? 'Найдено ' + shown + ' ' + wordFor(shown) + ' из ' + total : 'Ничего не найдено')
          : 'Показаны все ' + total + ' ' + wordFor(total);
      }
      if (resetBtn) resetBtn.hidden = !anyActive;
      if (empty) empty.hidden = shown !== 0;
      if (slider) slider.hidden = shown === 0;
      /* Слайдер пересчитывает точки по видимым карточкам */
      grid.dispatchEvent(new CustomEvent('slider:refresh'));
    }

    function reset() {
      state = { package: null, facade: null };
      apply();
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var group = chip.getAttribute('data-filter-group');
        var value = chip.getAttribute('data-filter-value');
        state[group] = state[group] === value ? null : value;
        apply();
      });
    });
    $$('#filters-reset, [data-filters-reset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        reset();
        var first = chips[0];
        if (first) first.focus({ preventScroll: true });
      });
    });

    apply();
  }

  /* ------------------------------------------------------------------------
     6. CALCULATOR — ориентир: пакет × длина (ТЗ 1.5, без коэффициентов)
     ------------------------------------------------------------------------ */
  function initCalculator() {
    var root = $('#calc');
    if (!root) return;
    var chips = $$('[data-calc-package]', root);
    var length = $('#calc-length');
    var lengthOut = $('#calc-length-out');
    var result = $('#calc-result');
    var resultSub = $('#calc-result-sub');
    var submit = $('#calc-submit');
    if (!chips.length || !length) return;

    var price = parseInt(chips[0].getAttribute('data-calc-package'), 10);
    var name = chips[0].getAttribute('data-calc-name');
    chips.forEach(function (c) {
      if (c.classList.contains('is-active')) {
        price = parseInt(c.getAttribute('data-calc-package'), 10);
        name = c.getAttribute('data-calc-name');
      }
    });

    function lengthLabel(v) { return v.toFixed(1).replace('.', ',') + ' м'; }

    function compute() {
      var len = parseFloat(length.value) || 0;
      var total = Math.round(len * price / 1000) * 1000;
      if (lengthOut) lengthOut.textContent = lengthLabel(len);
      if (result) result.textContent = 'от ' + formatMoney(total);
      if (resultSub) resultSub.textContent = name + ' · ' + lengthLabel(len) + ' × ' + formatMoney(price) + '/пог. м';
      if (submit) {
        submit.setAttribute('data-params', 'Пакет: ' + name + ', длина: ' + lengthLabel(len) + ' (ориентир ' + 'от ' + formatMoney(total) + ')');
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        price = parseInt(chip.getAttribute('data-calc-package'), 10);
        name = chip.getAttribute('data-calc-name');
        chips.forEach(function (c) {
          var active = c === chip;
          c.classList.toggle('is-active', active);
          c.setAttribute('aria-pressed', String(active));
        });
        compute();
      });
    });
    length.addEventListener('input', compute);
    compute();
  }

  /* ------------------------------------------------------------------------
     7. SLIDERS — scroll-snap контейнер + точки + стрелки, без автопрокрутки.
        Активная точка обновляется по scroll-событию (rAF-троттлинг).
     ------------------------------------------------------------------------ */
  function initSlider(root) {
    var track = $('[data-slider-track]', root);
    var dotsBox = $('[data-slider-dots]', root);
    var prev = $('[data-slider-prev]', root);
    var next = $('[data-slider-next]', root);
    if (!track) return;
    var items = [];
    var dots = [];
    var active = 0;
    var ticking = false;

    function isSliding() {
      /* В режиме сетки (overflow: visible) слайдер не активен */
      return window.getComputedStyle(track).overflowX !== 'visible';
    }

    function visibleItems() {
      return $$('.slider__item', track).filter(function (el) { return !el.classList.contains('is-hidden') && el.offsetParent !== null; });
    }

    function buildDots() {
      if (!dotsBox) return;
      dotsBox.innerHTML = '';
      dots = items.map(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slider__dot';
        b.setAttribute('aria-label', 'Карточка ' + (i + 1) + ' из ' + items.length);
        b.addEventListener('click', function () { scrollToIndex(i); });
        dotsBox.appendChild(b);
        return b;
      });
    }

    function scrollToIndex(i) {
      if (!items.length) return;
      i = Math.max(0, Math.min(items.length - 1, i));
      var left = items[i].offsetLeft - track.offsetLeft - parseFloat(window.getComputedStyle(track).paddingLeft || 0);
      /* Плавность задаёт CSS (scroll-behavior: smooth на треке; auto при prefers-reduced-motion) */
      track.scrollLeft = left;
    }

    function updateActive() {
      ticking = false;
      if (!items.length) return;
      var padLeft = parseFloat(window.getComputedStyle(track).paddingLeft || 0);
      var pos = track.scrollLeft + padLeft;
      var best = 0, bestDist = Infinity;
      items.forEach(function (el, i) {
        var d = Math.abs((el.offsetLeft - track.offsetLeft) - pos);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      /* У правого края считаем активной последнюю карточку */
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) best = items.length - 1;
      active = best;
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === active);
        if (i === active) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (prev) prev.disabled = active <= 0;
      if (next) next.disabled = active >= items.length - 1;
    }

    function refresh() {
      items = visibleItems();
      buildDots();
      var controls = $('[data-slider-controls]', root);
      if (controls) controls.hidden = items.length <= 1;
      updateActive();
    }

    track.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(updateActive); ticking = true; }
    }, { passive: true });
    if (prev) prev.addEventListener('click', function () { scrollToIndex(active - 1); });
    if (next) next.addEventListener('click', function () { scrollToIndex(active + 1); });
    track.addEventListener('slider:refresh', refresh);
    window.addEventListener('resize', function () { if (isSliding()) updateActive(); });

    refresh();
  }

  function initSliders() {
    $$('[data-slider]').forEach(initSlider);
  }

  /* ------------------------------------------------------------------------
     8. LIGHTBOX — 2 фото проекта: ручная навигация, ESC, стрелки
     ------------------------------------------------------------------------ */
  function initLightbox() {
    var box = $('#lightbox');
    if (!box) return;
    var img = $('#lightbox-img', box);
    var title = $('#lightbox-title', box);
    var counter = $('#lightbox-counter', box);
    var prev = $('[data-lightbox-prev]', box);
    var next = $('[data-lightbox-next]', box);
    var closeBtn = $('.lightbox__close', box);
    var photos = [];
    var alt = '';
    var index = 0;
    var opener = null;

    function render() {
      if (!photos.length) return;
      img.src = photos[index];
      img.alt = alt + ' — фото ' + (index + 1) + ' из ' + photos.length;
      if (counter) counter.textContent = (index + 1) + ' / ' + photos.length;
      if (prev) prev.disabled = photos.length < 2;
      if (next) next.disabled = photos.length < 2;
    }

    function open(btn) {
      photos = (btn.getAttribute('data-photos') || '').split('|').filter(Boolean);
      alt = btn.getAttribute('data-title') || 'Проект';
      index = 0;
      opener = btn;
      if (title) title.textContent = alt;
      render();
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      /* Предзагрузка второго фото, чтобы переключение было мгновенным */
      if (photos[1]) { var pre = new Image(); pre.src = photos[1]; }
      window.setTimeout(function () { if (closeBtn) closeBtn.focus({ preventScroll: true }); }, 0);
    }

    function close() {
      if (!box.classList.contains('is-open')) return;
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      img.src = '';
      if (opener) opener.focus({ preventScroll: true });
      opener = null;
    }

    function step(delta) {
      if (photos.length < 2) return;
      index = (index + delta + photos.length) % photos.length;
      render();
    }

    $$('[data-lightbox]').forEach(function (btn) {
      btn.addEventListener('click', function () { open(btn); });
    });
    $$('[data-lightbox-close]', box).forEach(function (el) { el.addEventListener('click', close); });
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'Tab') {
        /* Простая фокус-ловушка внутри лайтбокса */
        var list = $$('button:not([disabled])', box);
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ------------------------------------------------------------------------
     9. REVEAL — появление блоков при прокрутке (IntersectionObserver)
     ------------------------------------------------------------------------ */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------------
     10. BOTTOM BAR — мобильная панель после прокрутки hero
     ------------------------------------------------------------------------ */
  function initBottomBar() {
    var bar = $('#bottom-bar');
    var hero = $('#top');
    if (!bar || !hero) return;

    function setVisible(v) {
      bar.classList.toggle('is-visible', v);
      bar.setAttribute('aria-hidden', String(!v));
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        var entry = entries[0];
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      }, { threshold: 0 });
      io.observe(hero);
    } else {
      window.addEventListener('scroll', function () {
        setVisible(window.scrollY > hero.offsetHeight);
      }, { passive: true });
    }
  }

  /* ------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------ */
  initHeader();
  var menuApi = initMenu();
  initForms();
  var modalApi = initModal();
  initOpeners(modalApi, menuApi);
  initSliders();
  initFilters();
  initCalculator();
  initLightbox();
  initReveal();
  initBottomBar();
})();
