/*! Saigon Taste Booking – booking form widget. Same file is used by the WordPress plugin and the hosted page /book/<slug>. */
(function () {
  'use strict';
  var MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', afternoon: 'Afternoon', dinner: 'Dinner' };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function t12(hhmm) { var p = hhmm.split(':'), h = +p[0], m = +p[1]; return (h % 12 || 12) + (m ? ':' + p[1] : '') + ' ' + (h >= 12 ? 'pm' : 'am'); }
  function dParts(d) { var p = d.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function dLong(d) { var x = dParts(d); return DAYS[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; }
  function dShort(d) { var x = dParts(d); return DAYS[x.getUTCDay()].slice(0, 3) + ' ' + x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()].slice(0, 3); }

  function post(base, path, body) {
    return fetch(base.replace(/\/+$/, '') + '/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body || {}), credentials: 'same-origin', cache: 'no-store',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; });
    });
  }

  function mount(el) {
    if (el.__stb) return; el.__stb = true;
    var base = el.getAttribute('data-endpoint');
    var accent = el.getAttribute('data-accent');
    var privacyOverride = el.getAttribute('data-privacy') || '';
    var title = el.getAttribute('data-title') || 'Reserve your table';
    if (accent && /^#[0-9a-f]{3,8}$/i.test(accent)) el.style.setProperty('--stb-accent', accent);
    var S = { info: null, date: '', party: 2, time: null, avail: null, loading: false, sending: false, errors: {}, done: null, started: Date.now(), f: { first: '', last: '', phone: '', email: '', note: '', consent: false } };
    var uid = 'stb' + Math.random().toString(36).slice(2, 8);

    el.innerHTML = '<div class="stb-box"><p class="stb-muted">Loading booking form…</p></div>';
    post(base, 'info').then(function (info) {
      if (info.__status !== 200) return fail(info.__status === 401 ? 'This booking form is not connected yet. Please call the restaurant.' : 'The booking form is unavailable right now. Please call the restaurant.');
      S.info = info; if (privacyOverride) S.info.privacyUrl = privacyOverride;
      S.date = info.firstOpen; S.party = Math.min(2, info.maxParty);
      if (!info.online) { render(); return; }
      load();
    }).catch(function () { fail('The booking form could not load. Please check your connection or call the restaurant.'); });

    function fail(msg) { el.innerHTML = '<div class="stb-box"><p class="stb-alert" role="alert">' + esc(msg) + '</p></div>'; }
    function phone() { return S.info ? S.info.phoneFmt : ''; }

    function load() {
      S.loading = true; render();
      var want = S.date + '|' + S.party;
      post(base, 'availability', { date: S.date, party: S.party }).then(function (a) {
        if (want !== S.date + '|' + S.party) return; // a newer request is on its way
        S.avail = a.__status === 200 ? a : { state: 'error', groups: [] };
        S.loading = false;
        if (S.time && !(S.avail.groups || []).some(function (g) { return g.slots.some(function (s) { return s.time === S.time && !s.full; }); })) S.time = null;
        render();
      }).catch(function () { S.loading = false; S.avail = { state: 'error', groups: [] }; render(); });
    }

    function keep() {
      var q = function (n) { return el.querySelector('[name="' + n + '"]'); };
      ['first', 'last', 'phone', 'email', 'note'].forEach(function (n) { if (q(n)) S.f[n] = q(n).value; });
      if (q('consent')) S.f.consent = q('consent').checked;
    }

    var MSG = {
      first: 'Please enter your first name.', last: 'Please enter your last name.',
      phone: 'Please enter an Australian phone number, e.g. 0412 345 678.', email: 'Please enter a valid email address.',
      party: function () { return 'Online bookings are for 1–' + S.info.maxParty + ' guests.'; },
      consent: 'Please tick the box to agree before sending.',
      time: { required: 'Please choose a time.', outside: 'That time is no longer available. Please choose another time.', full: 'That time has just filled up. Please choose another time.', paused: function () { return 'Online bookings are paused. Please call us on ' + phone() + '.'; } },
      dup: function () { return 'You already have a booking request for this day. Please call us on ' + phone() + ' to change it.'; },
    };
    function errText(k, code) {
      var m = MSG[k]; if (m && typeof m === 'object') m = m[code] || m.required;
      return typeof m === 'function' ? m() : (m || 'Please check this field.');
    }
    function err(k) { return S.errors[k] ? '<span class="stb-err" id="' + uid + '-e-' + k + '">' + esc(errText(k, S.errors[k])) + '</span>' : ''; }
    function aria(k) { return S.errors[k] ? ' aria-invalid="true" aria-describedby="' + uid + '-e-' + k + '"' : ''; }

    function slotsHtml() {
      if (S.loading && !S.avail) return '<p class="stb-muted">Checking available times…</p>';
      var a = S.avail || { state: 'error' };
      var msgs = {
        closed: 'We\'re closed on ' + dLong(S.date) + (a.note ? ' (' + esc(a.note) + ')' : '') + '. Please pick another day.',
        none: 'No more times available on ' + dLong(S.date) + '. Please pick another day.',
        past: 'Please choose a date from today onwards.', toofar: 'That date is too far ahead for online bookings.',
        paused: 'Online bookings are paused at the moment. Please call us on ' + esc(phone()) + '.',
        error: 'We couldn\'t load times. Please try again or call us on ' + esc(phone()) + '.',
      };
      if (a.state !== 'ok') return '<p class="stb-empty">' + (msgs[a.state] || msgs.error) + '</p>';
      return a.groups.map(function (g) {
        return '<div class="stb-group"><p class="stb-meal">' + MEALS[g.meal] + '</p><div class="stb-slots" role="group" aria-label="' + MEALS[g.meal] + ' times">' +
          g.slots.map(function (s) {
            return '<button type="button" class="stb-slot" data-time="' + s.time + '" aria-pressed="' + (S.time === s.time) + '"' + (s.full ? ' disabled title="Fully booked"' : '') + '>' + t12(s.time) + '</button>';
          }).join('') + '</div></div>';
      }).join('') + (S.loading ? '<p class="stb-muted">Updating…</p>' : '');
    }

    function hoursHtml() {
      var i = S.info;
      var row = function (label, ss) { return '<tr><td>' + label + '</td><td>' + (ss.length ? ss.map(function (s) { return t12(s.open) + ' – ' + t12(s.close); }).join('<br>') : 'Closed') + '</td></tr>'; };
      return '<details class="stb-hours"><summary>Booking hours (' + esc(i.city) + ' time)</summary><table>' +
        i.week.map(function (w) { return row(DAYS[w.day], w.sessions); }).join('') +
        (i.specials.length ? '<tr><th colspan="2">Holiday hours</th></tr>' + i.specials.map(function (s) { return row(dShort(s.date) + (s.note ? '<br><small>' + esc(s.note) + '</small>' : ''), s.sessions); }).join('') : '') +
        '</table></details>';
    }

    function render() {
      var i = S.info;
      if (S.done) {
        var d = S.done;
        el.innerHTML = '<div class="stb-box stb-done" role="status" tabindex="-1"><h3 class="stb-title">Request received</h3>' +
          '<p>Thanks, ' + esc(S.f.first || 'there') + '. We\'ve got your request for <b>' + esc(d.party) + ' ' + (d.party > 1 ? 'guests' : 'guest') + '</b> on <b>' + esc(dLong(d.date)) + ' at ' + esc(t12(d.time)) + '</b>.</p>' +
          '<p class="stb-muted">Your reference</p><p class="stb-ref">' + esc(d.ref) + '</p>' +
          '<p>This isn\'t a confirmation yet. We\'ll email <b>' + esc(d.email) + '</b> as soon as the restaurant confirms your table.</p>' +
          '<button type="button" class="stb-btn stb-again">Make another booking</button></div>';
        var box = el.querySelector('.stb-done'); box.focus({ preventScroll: true });
        el.querySelector('.stb-again').onclick = function () { S.done = null; S.time = null; S.errors = {}; S.started = Date.now(); S.f = { first: '', last: '', phone: '', email: '', note: '', consent: false }; load(); };
        return;
      }
      if (!i.online) { el.innerHTML = '<div class="stb-box"><h3 class="stb-title">' + esc(title) + '</h3><p class="stb-empty">Online bookings are paused at the moment. Please call us on ' + esc(phone()) + '.</p></div>'; return; }
      var opts = ''; for (var n = 1; n <= i.maxParty; n++) opts += '<option value="' + n + '"' + (n === S.party ? ' selected' : '') + '>' + n + (n > 1 ? ' guests' : ' guest') + '</option>';
      var f = S.f;
      el.innerHTML = '<form class="stb-box" novalidate>' +
        '<h3 class="stb-title">' + esc(title) + '</h3><p class="stb-muted">Choose a date to see available times. Times are ' + esc(i.city) + ' time.</p>' +
        '<div class="stb-row"><label class="stb-field" for="' + uid + '-date">Date<input id="' + uid + '-date" type="date" name="date" min="' + i.today + '" max="' + i.maxDate + '" value="' + S.date + '" required></label>' +
        '<label class="stb-field" for="' + uid + '-party">Guests<select id="' + uid + '-party" name="party">' + opts + '</select></label></div>' +
        '<p class="stb-muted stb-small">More than ' + i.maxParty + '? Call us on ' + esc(phone()) + '.</p>' +
        '<div class="stb-times" aria-live="polite">' + slotsHtml() + err('time') + '</div>' +
        '<div class="stb-row"><label class="stb-field" for="' + uid + '-first">First name<input id="' + uid + '-first" name="first" autocomplete="given-name" maxlength="60" value="' + esc(f.first) + '"' + aria('first') + '>' + err('first') + '</label>' +
        '<label class="stb-field" for="' + uid + '-last">Last name<input id="' + uid + '-last" name="last" autocomplete="family-name" maxlength="60" value="' + esc(f.last) + '"' + aria('last') + '>' + err('last') + '</label></div>' +
        '<div class="stb-row"><label class="stb-field" for="' + uid + '-phone">Mobile<input id="' + uid + '-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0412 345 678" maxlength="20" value="' + esc(f.phone) + '"' + aria('phone') + '>' + err('phone') + '</label>' +
        '<label class="stb-field" for="' + uid + '-email">Email (for your confirmation)<input id="' + uid + '-email" name="email" type="email" autocomplete="email" maxlength="190" value="' + esc(f.email) + '"' + aria('email') + '>' + err('email') + '</label></div>' +
        '<label class="stb-field" for="' + uid + '-note">Special requests (optional)<textarea id="' + uid + '-note" name="note" rows="3" maxlength="500" placeholder="Allergies, high chair, occasion…">' + esc(f.note) + '</textarea></label>' +
        '<div class="stb-hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<label class="stb-consent" for="' + uid + '-consent"><input id="' + uid + '-consent" type="checkbox" name="consent"' + (f.consent ? ' checked' : '') + aria('consent') + '><span>We collect your name, phone and email only to manage this booking and contact you about it.' + (i.privacyUrl ? ' See our <a href="' + esc(i.privacyUrl) + '" target="_blank" rel="noopener">privacy policy</a>.' : '') + '</span></label>' + err('consent') +
        (S.errors.dup ? '<p class="stb-alert" role="alert">' + esc(errText('dup')) + '</p>' : '') +
        (S.errors._ ? '<p class="stb-alert" role="alert">' + esc(S.errors._) + '</p>' : '') +
        '<button type="submit" class="stb-btn"' + (S.sending ? ' disabled' : '') + '>' + (S.sending ? 'Sending…' : 'Request booking') + '</button>' +
        '<p class="stb-muted stb-small stb-center">You\'ll receive an email once the restaurant confirms.</p>' +
        hoursHtml() + '</form>';
      bind();
    }

    function bind() {
      var form = el.querySelector('form');
      form.querySelector('[name="date"]').addEventListener('change', function (e) { keep(); if (e.target.value) { S.date = e.target.value; S.time = null; delete S.errors.time; load(); } });
      form.querySelector('[name="party"]').addEventListener('change', function (e) { keep(); S.party = +e.target.value; load(); });
      form.querySelector('.stb-times').addEventListener('click', function (e) {
        var b = e.target.closest('.stb-slot'); if (!b || b.disabled) return;
        keep(); S.time = b.getAttribute('data-time'); delete S.errors.time; render();
        var again = el.querySelector('.stb-slot[data-time="' + S.time + '"]'); if (again) again.focus();
      });
      form.addEventListener('submit', submit);
    }

    function submit(e) {
      e.preventDefault(); if (S.sending) return;
      keep();
      var f = S.f, er = {};
      if (!S.time) er.time = 'required';
      if (!f.first.trim()) er.first = 'required';
      if (!f.last.trim()) er.last = 'required';
      if (!/^(\+?61|0)?\s*[23478](\s*\d){8}$/.test(f.phone.replace(/[()\-.]/g, ' ').trim())) er.phone = 'invalid';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) er.email = 'invalid';
      if (!f.consent) er.consent = 'required';
      S.errors = er;
      if (Object.keys(er).length) { render(); focusError(); return; }
      S.sending = true; render();
      post(base, 'book', {
        date: S.date, time: S.time, party: S.party, first: f.first, last: f.last, phone: f.phone, email: f.email, note: f.note, consent: true,
        website: (el.querySelector('[name="website"]') || {}).value || '', elapsed: Date.now() - S.started,
      }).then(function (r) {
        S.sending = false;
        if (r.ok) { S.done = r; render(); return; }
        if (r.__status === 422 && r.errors) { S.errors = r.errors; if (r.errors.time) { S.time = null; load(); } else render(); focusError(); return; }
        S.errors = { _: r.__status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : 'We couldn\'t send your request. Please try again or call us on ' + phone() + '.' };
        render();
      }).catch(function () { S.sending = false; S.errors = { _: 'We couldn\'t send your request. Please check your connection and try again, or call us on ' + phone() + '.' }; render(); });
    }
    function focusError() {
      setTimeout(function () {
        var x = el.querySelector('[aria-invalid="true"]') || el.querySelector('.stb-err, .stb-alert');
        if (x) { x.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (x.focus) x.focus({ preventScroll: true }); }
      }, 30);
    }
  }

  function init() { var els = document.querySelectorAll('.stb[data-endpoint]'); for (var i = 0; i < els.length; i++) mount(els[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.SaigonTasteBooking = { init: init };
})();
