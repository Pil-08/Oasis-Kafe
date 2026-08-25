(function () {
  'use strict';

  /* ---------- datos inyectados en build ---------- */
  var readJSON = function (id) {
    var n = document.getElementById(id);
    try { return n ? JSON.parse(n.textContent) : null; }
    catch (e) { console.error('[oasis] JSON invalido en #' + id, e); return null; }
  };

  var MENU   = readJSON('dataMenu')   || { config: {}, categorias: [], etiquetas: {} };
  var I18N   = readJSON('dataI18n')   || {};
  var PHOTOS = readJSON('dataPhotos') || {};
  var HOURS  = readJSON('dataHours')  || [];
  var SITE   = readJSON('dataSite')   || {};

  var CFG = MENU.config || {};
  var PORCION = (CFG.porcion || {});
  var PRECIO_PORCION = PORCION.precio || 3.45;
  var PORCIONES_TARTA = PORCION.porTarta || 8;
  var MEDIA_TARTA = Math.floor(PORCIONES_TARTA / 2);
  var LOCALE_MAP = { es: 'es-ES', eu: 'eu-ES', en: 'en-GB', fr: 'fr-FR' };
  var STORE_KEYS = { lang: 'oasis.lang', cart: 'oasis.cart' };

  /* ---------- utilidades ---------- */
  function el(tag, props) {
    var n = document.createElement(tag), k;
    if (props) for (k in props) {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else if (k === 'html') n.innerHTML = props[k];      // solo con markup propio
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== null && props[k] !== undefined && props[k] !== false) n.setAttribute(k, props[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  function store(key, val) {
    try {
      if (val === undefined) { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* modo privado: seguimos en memoria */ }
    return null;
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /* ---------- idioma ---------- */
  var lang = 'es';
  function detectLang() {
    var saved = store(STORE_KEYS.lang);
    if (saved && I18N[saved]) return saved;
    var navs = navigator.languages || [navigator.language || 'es'];
    for (var i = 0; i < navs.length; i++) {
      var code = String(navs[i]).slice(0, 2).toLowerCase();
      if (I18N[code]) return code;
    }
    return 'es';
  }
  function t(key, vars) {
    var dict = I18N[lang] || I18N.es || {};
    var s = dict[key];
    if (s === undefined) s = (I18N.es || {})[key];
    if (s === undefined) return key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  /** Nombres/descripciones de producto: cae a es si no hay traduccion. */
  function tx(obj) {
    if (!obj) return '';
    return obj[lang] || obj.es || obj[Object.keys(obj)[0]] || '';
  }
  function money(v) {
    return new Intl.NumberFormat(LOCALE_MAP[lang] || 'es-ES',
      { style: 'currency', currency: CFG.moneda || 'EUR' }).format(v);
  }

  function applyI18n() {
    document.documentElement.lang = lang;
    var i, n, nodes;
    nodes = document.querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) { n = nodes[i]; n.textContent = t(n.getAttribute('data-i18n')); }
    nodes = document.querySelectorAll('[data-i18n-placeholder]');
    for (i = 0; i < nodes.length; i++) { n = nodes[i]; n.placeholder = t(n.getAttribute('data-i18n-placeholder')); }
    nodes = document.querySelectorAll('[data-i18n-aria-label]');
    for (i = 0; i < nodes.length; i++) { n = nodes[i]; n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria-label'))); }
    nodes = document.querySelectorAll('[data-i18n-title]');
    for (i = 0; i < nodes.length; i++) { n = nodes[i]; n.title = t(n.getAttribute('data-i18n-title')); }

    nodes = document.querySelectorAll('.lang-btn');
    for (i = 0; i < nodes.length; i++) {
      var on = nodes[i].getAttribute('data-lang') === lang;
      nodes[i].classList.toggle('is-active', on);
      nodes[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  function setLang(code) {
    if (!I18N[code]) return;
    lang = code; store(STORE_KEYS.lang, code);
    applyI18n(); resetClearBtn(); renderFilters(); renderTabs(); renderGallery();
    renderMenu(); renderHours(); renderDonut(); renderCart(); updateStatus();
  }

  /* ---------- horario (en la zona horaria del local, no la del visitante) ---------- */
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function shopNow() {
    try {
      var f = new Intl.DateTimeFormat('en-GB', {
        timeZone: SITE.timezone || 'Europe/Madrid',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      });
      var p = {}, parts = f.formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) p[parts[i].type] = parts[i].value;
      var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var d = map[p.weekday];
      if (d === undefined) throw new Error('weekday');
      return { day: d, min: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10) };
    } catch (e) {
      var n = new Date();
      return { day: n.getDay(), min: n.getHours() * 60 + n.getMinutes() };
    }
  }
  function toMin(hhmm) { var a = hhmm.split(':'); return (+a[0]) * 60 + (+a[1]); }
  function dayName(d, style) {
    try {
      var ref = new Date(Date.UTC(2024, 0, 7 + d)); // 2024-01-07 fue domingo
      return new Intl.DateTimeFormat(LOCALE_MAP[lang] || 'es-ES',
        { weekday: style || 'long', timeZone: 'UTC' }).format(ref);
    } catch (e) { return DAY_KEYS[d]; }
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function dayEntry(d) {
    for (var i = 0; i < HOURS.length; i++) if (HOURS[i].d === d) return HOURS[i];
    return { d: d, ranges: [] };
  }
  function fmtRanges(ranges) {
    if (!ranges || !ranges.length) return t('closedDay');
    return ranges.map(function (r) { return r[0] + ' – ' + r[1]; }).join(' · ');
  }
  function computeStatus() {
    var now = shopNow(), today = dayEntry(now.day), i, r;
    for (i = 0; i < today.ranges.length; i++) {
      r = today.ranges[i];
      if (now.min >= toMin(r[0]) && now.min < toMin(r[1])) return { open: true, until: r[1] };
    }
    for (i = 0; i < today.ranges.length; i++) {
      r = today.ranges[i];
      if (now.min < toMin(r[0])) return { open: false, next: r[0], sameDay: true };
    }
    for (var k = 1; k <= 7; k++) {
      var d = (now.day + k) % 7, e = dayEntry(d);
      if (e.ranges.length) return { open: false, next: e.ranges[0][0], nextDay: d };
    }
    return { open: false };
  }
  function updateStatus() {
    var s = computeStatus();
    var dot = document.getElementById('liveDot'), txt = document.getElementById('liveTxt');
    if (!dot || !txt) return;
    dot.className = 'live-dot ' + (s.open ? 'is-open' : 'is-closed');
    if (s.open) txt.textContent = t('statusOpen') + ' · ' + t('closesAt', { h: s.until });
    else if (s.sameDay) txt.textContent = t('statusClosed') + ' · ' + t('opensAt', { h: s.next });
    else if (s.nextDay !== undefined) txt.textContent = t('statusClosed') + ' · ' + t('opensDay', { d: dayName(s.nextDay), h: s.next });
    else txt.textContent = t('statusClosed');
  }
  function renderHours() {
    var body = document.getElementById('hoursTableBody');
    if (!body) return;
    body.textContent = '';
    var today = shopNow().day;
    var order = [1, 2, 3, 4, 5, 6, 0];
    order.forEach(function (d) {
      var e = dayEntry(d), isToday = d === today;
      var tdDay = el('td', null, cap(dayName(d)));
      if (isToday) {
        tdDay.appendChild(el('span', { class: 'today-tag' },
          el('span', { class: 'today-dot', 'aria-hidden': 'true' }), t('today')));
      }
      body.appendChild(el('tr', { class: isToday ? 'is-today' : null },
        tdDay, el('td', { text: fmtRanges(e.ranges) })));
    });
  }

  /* ---------- donut ---------- */
  var FLAVORS = [
    { id: 'platano',  dot: '#C2894F', top: '#E6BC80', side: '#A76F3B', crust: '#C2894F',
      name: { es: 'Plátano y dátil', eu: 'Banana eta datila', en: 'Banana & date', fr: 'Banane & datte' },
      desc: { es: 'Plátano maduro machacado y dátil natural. Esponjoso y dulce.',
              eu: 'Banana heldua eta datil naturala. Harroa eta gozoa.',
              en: 'Mashed ripe banana and natural dates. Soft and sweet.',
              fr: 'Banane mûre écrasée et dattes naturelles. Moelleux et sucré.' } },
    { id: 'calabaza', dot: '#C4813C', top: '#E9B571', side: '#A76A2E', crust: '#C4813C',
      name: { es: 'Calabaza y dátil', eu: 'Kalabaza eta datila', en: 'Pumpkin & date', fr: 'Potiron & datte' },
      desc: { es: 'Calabaza asada y especias suaves. Húmedo y aromático.',
              eu: 'Erretako kalabaza eta espezia leunak. Hezea eta usaintsua.',
              en: 'Roasted pumpkin and gentle spices. Moist and fragrant.',
              fr: 'Potiron rôti et épices douces. Moelleux et parfumé.' } },
    { id: 'boniato',  dot: '#B0713C', top: '#DCA974', side: '#95592C', crust: '#B0713C',
      name: { es: 'Boniato y dátil', eu: 'Boniatoa eta datila', en: 'Sweet potato & date', fr: 'Patate douce & datte' },
      desc: { es: 'Boniato al horno. El más denso y reconfortante.',
              eu: 'Labean egindako boniatoa. Trinkoena eta gozagarriena.',
              en: 'Oven-baked sweet potato. The richest, most comforting one.',
              fr: 'Patate douce au four. Le plus dense et réconfortant.' } },
    { id: 'manzana',  dot: '#CE9A5F', top: '#EFC894', side: '#B3803F', crust: '#CE9A5F',
      name: { es: 'Manzana y dátil', eu: 'Sagarra eta datila', en: 'Apple & date', fr: 'Pomme & datte' },
      desc: { es: 'Manzana rallada y canela. El más ligero de todos.',
              eu: 'Sagar birrindua eta kanela. Guztietan arinena.',
              en: 'Grated apple and cinnamon. The lightest of them all.',
              fr: 'Pomme râpée et cannelle. Le plus léger de tous.' } }
  ];
  var flavorId = FLAVORS[0].id;
  function paintDonut(f) {
    var top = document.getElementById('donutTop'), side = document.getElementById('donutSide'),
        crust = document.getElementById('donutCrust');
    if (top) top.setAttribute('fill', f.top);
    if (side) side.setAttribute('fill', f.side);
    if (crust) crust.setAttribute('fill', f.crust);
    var ti = document.getElementById('donutTitle'), de = document.getElementById('donutDesc');
    if (ti) ti.textContent = tx(f.name);
    if (de) de.textContent = tx(f.desc);
  }
  function renderDonut() {
    var wrap = document.getElementById('donutFlavors');
    if (!wrap) return;
    wrap.textContent = '';
    FLAVORS.forEach(function (f) {
      var b = el('button', {
        type: 'button', class: 'flavor-btn', 'aria-pressed': f.id === flavorId ? 'true' : 'false',
        onclick: function () { flavorId = f.id; renderDonut(); }
      }, el('span', { class: 'flavor-dot', style: 'background:' + f.dot, 'aria-hidden': 'true' }), tx(f.name));
      wrap.appendChild(b);
    });
    paintDonut(FLAVORS.filter(function (f) { return f.id === flavorId; })[0] || FLAVORS[0]);
  }

  /* ---------- estado de la carta ---------- */
  var activeTab = (MENU.categorias[0] || {}).id;
  var activeFilter = 'all';
  var query = '';
  var portions = {};                       // id de tarta -> porciones elegidas

  function allItems() {
    var out = [];
    MENU.categorias.forEach(function (c) {
      c.items.forEach(function (i) { out.push({ cat: c, item: i }); });
    });
    return out;
  }
  function itemById(id) {
    var hit = allItems().filter(function (r) { return r.item.id === id; })[0];
    return hit || null;
  }
  function usedTags() {
    var set = {};
    allItems().forEach(function (r) { (r.item.tags || []).forEach(function (tg) { set[tg] = true; }); });
    return Object.keys(set);
  }
  function matches(item, cat) {
    if (activeFilter !== 'all' && (item.tags || []).indexOf(activeFilter) === -1) return false;
    if (!query) return true;
    // el texto de la categoria tambien cuenta: buscar "datil" trae todos los
    // donuts, aunque los especiales no lleven la palabra en su nombre
    var ctx = cat ? tx(cat.label) + ' ' + tx(cat.nota) : '';
    var hay = norm(tx(item.name) + ' ' + tx(item.desc) + ' ' + (item.tags || []).join(' ') + ' ' + ctx);
    return norm(query).split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function unitLabel(u) { return u === 'kg' ? t('perKg') : u === 'und' ? t('perUnit') : ''; }

  /* ---------- filtros ---------- */
  function renderFilters() {
    var wrap = document.getElementById('dietaryFiltersScroll');
    if (!wrap) return;
    wrap.textContent = '';
    var opts = [{ id: 'all', label: t('filterAll') }];
    usedTags().forEach(function (tg) {
      opts.push({ id: tg, label: tx((MENU.etiquetas || {})[tg]) || tg });
    });
    opts.forEach(function (o) {
      wrap.appendChild(el('button', {
        type: 'button', class: 'dietary-btn',
        'aria-pressed': o.id === activeFilter ? 'true' : 'false',
        onclick: function () { activeFilter = o.id; renderFilters(); renderMenu(); }
      }, o.label));
    });
  }

  /* ---------- pestañas ---------- */
  function renderTabs() {
    var wrap = document.getElementById('tabsScroll');
    if (!wrap) return;
    wrap.textContent = '';
    MENU.categorias.forEach(function (c) {
      var sel = c.id === activeTab;
      var b = el('button', {
        type: 'button', class: 'tab-btn', role: 'tab', id: 'tab-' + c.id,
        'aria-selected': sel ? 'true' : 'false', 'aria-controls': 'menuGrid',
        tabindex: sel ? '0' : '-1',
        onclick: function () { activeTab = c.id; renderTabs(); renderMenu(); }
      }, tx(c.label));
      if (c.paraLlevar) b.appendChild(el('span', { class: 'badge-takeaway', text: t('takeaway') }));
      wrap.appendChild(b);
    });
    wrap.onkeydown = function (ev) {
      var keys = { ArrowRight: 1, ArrowLeft: -1 };
      if (!(ev.key in keys)) return;
      ev.preventDefault();
      var ids = MENU.categorias.map(function (c) { return c.id; });
      var i = (ids.indexOf(activeTab) + keys[ev.key] + ids.length) % ids.length;
      activeTab = ids[i]; renderTabs(); renderMenu();
      var next = document.getElementById('tab-' + activeTab);
      if (next) next.focus();
    };
  }

  /* ---------- galeria del local ---------- */
  function photoNode(photo, altFallback) {
    if (photo && photo.src) {
      // Son data-URI, ya viven en el HTML: "lazy" solo sirve para peticiones de
      // red y aqui provoca que el decode dependa del IntersectionObserver, con
      // tarjetas en blanco intermitentes justo al cambiar de pestaña.
      return el('img', {
        src: photo.src, alt: tx(photo.alt) || altFallback || '', decoding: 'async',
        style: photo.pos ? '--pos:' + photo.pos : null
      });
    }
    return el('span', { class: 'photo-todo' },
      el('b', { text: t('photoPending') }),
      photo && photo.file ? el('code', { text: photo.file }) : null);
  }
  function renderGallery() {
    var sec = document.getElementById('tabGallery'), list = document.getElementById('galleryList');
    if (!sec || !list) return;
    var shots = (PHOTOS.local || []);
    if (!shots.length) { sec.hidden = true; return; }
    sec.hidden = false;
    list.textContent = '';
    shots.forEach(function (p) {
      var caption = tx(p.caption);
      var inner = photoNode(p, caption);
      var li = el('li', { class: 'gallery-item' });
      if (p.src) {
        li.appendChild(el('button', {
          type: 'button', class: 'gallery-btn',
          'aria-label': t('galleryOpen') + ': ' + caption,
          onclick: function () { openLightbox(p.src, caption); }
        }, inner));
      } else {
        li.appendChild(inner);
      }
      li.appendChild(el('span', { class: 'gallery-caption', text: caption }));
      list.appendChild(li);
    });
  }

  /* ---------- carta ---------- */
  function priceNode(item) {
    if (item.price === null || item.price === undefined) {
      return el('span', { class: 'menu-item-price is-ask', text: t('ask') });
    }
    var s = el('span', { class: 'menu-item-price' }, money(item.price));
    var u = unitLabel(item.unit);
    if (u) s.appendChild(el('span', { class: 'menu-item-unit', text: u }));
    return s;
  }
  function simpleRow(item) {
    var row = el('div', { class: 'menu-item-row' });
    var main = el('div', { class: 'menu-item-main' },
      el('span', { class: 'menu-item-name', text: tx(item.name) }),
      el('span', { class: 'menu-item-line', 'aria-hidden': 'true' }),
      priceNode(item));
    if (item.price !== null && item.price !== undefined) {
      main.appendChild(el('button', {
        type: 'button', class: 'btn-add-item',
        'aria-label': t('addToOrder') + ': ' + tx(item.name),
        onclick: function () { addSimple(item.id); }
      }, el('span', { 'aria-hidden': 'true', text: '+' })));
    }
    row.appendChild(main);
    if (tx(item.desc)) row.appendChild(el('p', { class: 'menu-item-desc', text: tx(item.desc) }));
    if ((item.tags || []).length) {
      var tags = el('span', { class: 'menu-item-tags' });
      item.tags.forEach(function (tg) {
        tags.appendChild(el('span', { class: 'tag-pill', text: tx((MENU.etiquetas || {})[tg]) || tg }));
      });
      row.appendChild(tags);
    }
    return row;
  }

  // Inicial decorativa: salta las palabras genericas para no repetir "T" de Tarta.
  var GENERICOS = ['tarta', 'bizcocho', 'plancha', 'de', 'del', 'la', 'el', 'los', 'las', 'al', 'con'];
  function initialOf(name) {
    var words = String(name || '').replace(/[("]/g, ' ').trim().split(/\s+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i] && GENERICOS.indexOf(words[i].toLowerCase()) === -1) return words[i].charAt(0).toUpperCase();
    }
    return (words[0] || '?').charAt(0).toUpperCase();
  }

  function portionText(n) {
    if (n === PORCIONES_TARTA) return { label: t('wholeCake'), milestone: true };
    if (n === MEDIA_TARTA) return { label: t('halfCake'), milestone: true };
    return { label: '', milestone: false };
  }
  function portionPriceOf(item) { return item.portionPrice || PRECIO_PORCION; }

  function tartaCard(item) {
    var photo = (PHOTOS.productos || {})[item.photo];
    var card = el('article', { class: 'tarta-card' });

    var figure = el('div', { class: 'tarta-photo' });
    if (photo && photo.src) {
      figure.appendChild(photoNode(photo, tx(item.name)));
      figure.appendChild(el('button', {
        type: 'button', class: 'tarta-photo-btn',
        'aria-label': t('galleryOpen') + ': ' + tx(item.name),
        onclick: function () { openLightbox(photo.src, tx(item.name)); }
      }));
    } else if (item.photo) {
      // hueco reservado: la foto existe en el plan pero aun no en assets/
      figure.appendChild(photoNode(null, tx(item.name)));
    } else {
      // sin foto prevista: rotulo de marca, no un hueco roto
      figure.classList.add('tarta-photo--mark');
      figure.appendChild(el('span', { class: 'tarta-initial', 'aria-hidden': 'true',
        text: initialOf(tx(item.name)) }));
    }
    card.appendChild(figure);

    var body = el('div', { class: 'tarta-body' },
      el('h3', { class: 'tarta-name', text: tx(item.name) }));
    if (tx(item.desc)) body.appendChild(el('p', { class: 'tarta-desc', text: tx(item.desc) }));

    var foot = el('div', { class: 'tarta-foot' });

    if (item.type === 'tarta') {
      if (item.pricePerKg) {
        body.appendChild(el('p', { class: 'tarta-price' },
          money(item.pricePerKg), el('small', { text: t('perKg') })));
      }
      if (!portions[item.id]) portions[item.id] = 1;

      var count = el('span', { class: 'portion-count' });
      var label = el('span', { class: 'portion-label' });
      var total = el('strong');
      var minus = el('button', { type: 'button', class: 'portion-btn', 'aria-label': t('less') }, '−');
      var plus  = el('button', { type: 'button', class: 'portion-btn', 'aria-label': t('more') }, '+');

      var sync = function () {
        var n = portions[item.id];
        var info = portionText(n);
        count.textContent = n + ' ' + (n === 1 ? t('slice') : t('slices'));
        label.textContent = info.label;
        label.classList.toggle('is-milestone', info.milestone);
        total.textContent = money(n * portionPriceOf(item));
        minus.disabled = n <= 1;
        plus.disabled = n >= PORCIONES_TARTA;
      };
      minus.addEventListener('click', function () {
        portions[item.id] = Math.max(1, portions[item.id] - 1); sync();
      });
      plus.addEventListener('click', function () {
        portions[item.id] = Math.min(PORCIONES_TARTA, portions[item.id] + 1); sync();
      });

      foot.appendChild(el('div', { class: 'portion-stepper' },
        minus, el('span', { class: 'portion-readout' }, count, label), plus));
      foot.appendChild(el('p', { class: 'tarta-total' },
        el('span', { class: 'tarta-hint', text: t('sliceHint') }), total));
      foot.appendChild(el('button', {
        type: 'button', class: 'btn btn-primary btn-sm btn-block',
        onclick: function () { addTarta(item.id, portions[item.id]); }
      }, t('addToOrder')));
      sync();
    } else {
      body.appendChild(item.price === null || item.price === undefined
        ? el('p', { class: 'tarta-price' }, el('small', { text: t('ask') }))
        : el('p', { class: 'tarta-price' }, money(item.price), el('small', { text: unitLabel(item.unit) })));
      if ((item.tags || []).length) {
        var tg2 = el('span', { class: 'menu-item-tags' });
        item.tags.forEach(function (tg) {
          tg2.appendChild(el('span', { class: 'tag-pill', text: tx((MENU.etiquetas || {})[tg]) || tg }));
        });
        body.appendChild(tg2);
      }
      if (item.price !== null && item.price !== undefined) {
        foot.appendChild(el('button', {
          type: 'button', class: 'btn btn-outline btn-sm btn-block',
          onclick: function () { addSimple(item.id); }
        }, t('addToOrder')));
      }
    }

    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function renderMenu() {
    var grid = document.getElementById('menuGrid');
    var tSec = document.getElementById('tartasSection');
    var tGrid = document.getElementById('tartasGrid');
    var empty = document.getElementById('menuEmpty');
    var noteEl = document.getElementById('categoryNote');
    if (!grid || !tSec || !tGrid) return;

    var searching = !!query || activeFilter !== 'all';
    var cats = searching ? MENU.categorias
                         : MENU.categorias.filter(function (c) { return c.id === activeTab; });

    grid.textContent = ''; tGrid.textContent = '';
    var shown = 0;

    // nota de categoria (solo cuando miramos una sola)
    var single = cats.length === 1 ? cats[0] : null;
    if (noteEl) {
      var noteTxt = single ? tx(single.nota) : '';
      var llevar = !!(single && single.paraLlevar);
      noteEl.textContent = '';
      if (llevar) noteEl.appendChild(el('span', { class: 'badge-takeaway', text: t('takeaway') }));
      if (noteTxt) noteEl.appendChild(el('span', { text: noteTxt }));
      noteEl.hidden = !(llevar || noteTxt);
    }

    var useCards = !!single && single.id === 'tartas';
    cats.forEach(function (c) {
      var items = c.items.filter(function (i) { return matches(i, c); });
      if (!items.length) return;
      if (searching) {
        var head = el('p', { class: 'menu-item-row' },
          el('span', { class: 'eyebrow', text: tx(c.label) }));
        grid.appendChild(head);
      }
      items.forEach(function (i) {
        shown++;
        if (useCards) tGrid.appendChild(tartaCard(i));
        else grid.appendChild(simpleRow(i));
      });
    });

    tSec.hidden = !useCards;
    grid.hidden = useCards;
    if (empty) empty.hidden = shown > 0;

    // panel accesible ligado a la pestaña activa
    grid.setAttribute('aria-labelledby', 'tab-' + activeTab);

  }

  /* ---------- carrito ---------- */
  var cart = store(STORE_KEYS.cart) || [];
  function saveCart() { store(STORE_KEYS.cart, cart); }

  function addSimple(id) {
    var line = cart.filter(function (l) { return l.id === id && l.kind === 'simple'; })[0];
    if (line) line.qty++; else cart.push({ id: id, kind: 'simple', qty: 1 });
    saveCart(); renderCart(); toast(t('added'));
  }
  function addTarta(id, n) {
    var line = cart.filter(function (l) { return l.id === id && l.kind === 'tarta'; })[0];
    if (line) line.qty += n; else cart.push({ id: id, kind: 'tarta', qty: n });
    saveCart(); renderCart(); toast(t('added'));
  }
  function bumpLine(idx, delta) {
    var l = cart[idx];
    if (!l) return;
    l.qty += delta;
    if (l.qty <= 0) cart.splice(idx, 1);
    saveCart(); renderCart();
  }
  function lineUnitPrice(l) {
    var r = itemById(l.id);
    if (!r) return 0;
    return l.kind === 'tarta' ? portionPriceOf(r.item) : (r.item.price || 0);
  }
  function cartTotal() {
    return cart.reduce(function (s, l) { return s + lineUnitPrice(l) * l.qty; }, 0);
  }
  function lineMeta(l) {
    if (l.kind !== 'tarta') return null;
    var whole = Math.floor(l.qty / PORCIONES_TARTA), rest = l.qty % PORCIONES_TARTA;
    if (l.qty === PORCIONES_TARTA) return t('wholeCake');
    if (l.qty === MEDIA_TARTA) return t('halfCake');
    if (whole && !rest) return whole + ' × ' + t('wholeCake');
    return null;
  }

  function renderCart() {
    var list = document.getElementById('cartItemsList');
    var totalEl = document.getElementById('cartTotalAmount');
    var badge = document.getElementById('headerCartBadge');
    var wa = document.getElementById('cartWaBtn');
    if (!list) return;

    list.textContent = '';
    if (!cart.length) {
      list.appendChild(el('p', { class: 'cart-empty', text: t('cartEmpty') }));
    }
    cart.forEach(function (l, idx) {
      var r = itemById(l.id);
      if (!r) return;
      var name = tx(r.item.name);
      var qtyTxt = l.kind === 'tarta'
        ? l.qty + ' ' + (l.qty === 1 ? t('slice') : t('slices'))
        : '× ' + l.qty;
      var info = el('div', { class: 'cart-item-info' },
        el('p', { class: 'cart-item-name', text: name }));
      var meta = lineMeta(l);
      info.appendChild(el('p', { class: 'cart-item-meta', text: meta ? qtyTxt + ' · ' + meta : qtyTxt }));

      list.appendChild(el('div', { class: 'cart-item' },
        info,
        el('div', { class: 'cart-qty' },
          el('button', { type: 'button', 'aria-label': t('less') + ': ' + name,
            onclick: function () { bumpLine(idx, -1); } }, '−'),
          el('span', { text: String(l.qty) }),
          el('button', { type: 'button', 'aria-label': t('more') + ': ' + name,
            onclick: function () { bumpLine(idx, 1); } }, '+')),
        el('span', { class: 'cart-item-price', text: money(lineUnitPrice(l) * l.qty) })));
    });

    var total = cartTotal();
    if (totalEl) totalEl.textContent = money(total);
    var units = cart.reduce(function (s, l) { return s + (l.kind === 'tarta' ? 1 : l.qty); }, 0);
    if (badge) { badge.textContent = String(units); badge.hidden = units === 0; }

    if (wa) {
      var lines = cart.map(function (l) {
        var r = itemById(l.id); if (!r) return '';
        var q = l.kind === 'tarta'
          ? l.qty + ' ' + (l.qty === 1 ? t('slice') : t('slices'))
          : l.qty + ' ×';
        return '• ' + q + ' ' + tx(r.item.name) + ' — ' + money(lineUnitPrice(l) * l.qty);
      }).filter(Boolean);
      var msg = t('waIntro') + '\n' + lines.join('\n') + '\n' + t('waTotal') + ': ' + money(total);
      wa.href = SITE.waBase + (lines.length ? '?text=' + encodeURIComponent(msg) : '');
    }
  }

  /* ---------- vaciar el pedido: dos toques ---------- */
  // Un toque accidental no puede borrar todo el pedido; el segundo confirma.
  var clearArmed = false, clearTimer = null;
  function resetClearBtn() {
    var btn = document.getElementById('cartClearBtn');
    clearArmed = false;
    window.clearTimeout(clearTimer);
    if (btn) { btn.textContent = t('cartClear'); btn.classList.remove('is-armed'); }
  }
  function handleClearClick() {
    var btn = document.getElementById('cartClearBtn');
    if (!cart.length) return;
    if (!clearArmed) {
      clearArmed = true;
      if (btn) { btn.textContent = t('cartClearConfirm'); btn.classList.add('is-armed'); }
      clearTimer = window.setTimeout(resetClearBtn, 4000);
      return;
    }
    cart = []; saveCart(); renderCart(); resetClearBtn();
  }

  /* ---------- drawer, lightbox, toast ---------- */
  var lastFocus = null;
  function trap(container) {
    return function (ev) {
      if (ev.key !== 'Tab') return;
      var f = container.querySelectorAll('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    };
  }
  var cartTrap = null;
  function openCart() {
    var d = document.getElementById('cartDrawer'), b = document.getElementById('cartBackdrop'),
        btn = document.getElementById('headerCartBtn');
    if (!d || !b) return;
    dismissToast(); // si se abre justo tras "anadido", que no se solapen
    lastFocus = document.activeElement;
    d.hidden = false; b.hidden = false;
    requestAnimationFrame(function () { d.classList.add('is-open'); b.classList.add('is-open'); });
    if (btn) btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    cartTrap = trap(d); d.addEventListener('keydown', cartTrap);
    var close = document.getElementById('closeCartBtn'); if (close) close.focus();
  }
  function closeCart() {
    var d = document.getElementById('cartDrawer'), b = document.getElementById('cartBackdrop'),
        btn = document.getElementById('headerCartBtn');
    if (!d || !b || d.hidden) return;
    d.classList.remove('is-open'); b.classList.remove('is-open');
    resetClearBtn();
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (cartTrap) { d.removeEventListener('keydown', cartTrap); cartTrap = null; }
    window.setTimeout(function () { d.hidden = true; b.hidden = true; }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openLightbox(src, caption) {
    var lb = document.getElementById('lightbox'), img = document.getElementById('lightboxImg'),
        cap2 = document.getElementById('lightboxCaption');
    if (!lb || !img) return;
    dismissToast();
    lastFocus = document.activeElement;
    img.src = src; img.alt = caption || '';
    if (cap2) cap2.textContent = caption || '';
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';
    var c = document.getElementById('lightboxClose'); if (c) c.focus();
  }
  function closeLightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb || lb.hidden) return;
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () { lb.hidden = true; }, 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  var toastTimer = null;
  function toast(msg) {
    var n = document.getElementById('toastMsg');
    if (!n) return;
    n.textContent = msg; n.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { n.classList.remove('is-visible'); }, 1800);
  }
  function dismissToast() {
    var n = document.getElementById('toastMsg');
    window.clearTimeout(toastTimer);
    if (n) n.classList.remove('is-visible');
  }

  /* ---------- arranque ---------- */
  function on(id, ev, fn) { var n = document.getElementById(id); if (n) n.addEventListener(ev, fn); }

  function init() {
    lang = detectLang();
    applyI18n();

    var langs = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < langs.length; i++) {
      langs[i].addEventListener('click', function () { setLang(this.getAttribute('data-lang')); });
    }

    on('menuSearchInput', 'input', function () { query = this.value.trim(); renderMenu(); });
    on('clearSearchBtn', 'click', function () {
      query = ''; activeFilter = 'all';
      var s = document.getElementById('menuSearchInput'); if (s) { s.value = ''; s.focus(); }
      renderFilters(); renderMenu();
    });
    on('headerCartBtn', 'click', openCart);
    on('closeCartBtn', 'click', closeCart);
    on('cartBackdrop', 'click', closeCart);
    on('cartClearBtn', 'click', handleClearClick);
    on('lightboxClose', 'click', closeLightbox);
    on('lightbox', 'click', function (ev) { if (ev.target === this) closeLightbox(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { closeLightbox(); closeCart(); }
    });

    var y = document.getElementById('footerYear');
    if (y) y.textContent = String(new Date().getFullYear());

    renderFilters(); renderTabs(); renderGallery(); renderMenu();
    renderHours(); renderDonut(); renderCart(); updateStatus();
    window.setInterval(updateStatus, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
