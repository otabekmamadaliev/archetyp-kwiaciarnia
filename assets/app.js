/* ARCHETYP KWIACIARNIA — skrypt tylko tej strony. Bez zależności.
 *
 * Zamówienie działa BEZ SERWERA: formularz waliduje, składa czytelną wiadomość
 * i przekazuje ją na telefon pracowni (WhatsApp, SMS jako zapas). U realnego
 * klienta podmienia się wyłącznie numer w site.config.json.
 */
(function () {
  'use strict';

  var T = {}, D = {};
  try { T = JSON.parse(document.getElementById('i18n').textContent) || {}; } catch (e) {}
  try { D = JSON.parse(document.getElementById('dane').textContent) || {}; } catch (e) {}
  var t = function (k, d) { return T[k] || d || ''; };
  var spokojnie = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return document.querySelector(s); };

  var belka = $('.belka');
  if (belka) {
    var cien = function () { belka.classList.toggle('przewiniety', window.scrollY > 30); };
    cien(); window.addEventListener('scroll', cien, { passive: true });
  }

  var btnMenu = $('.ham'), menu = document.getElementById('mm');
  if (btnMenu && menu) {
    var etyk = btnMenu.getAttribute('aria-label');
    btnMenu.addEventListener('click', function () {
      var otwarte = menu.classList.toggle('otwarte');
      btnMenu.setAttribute('aria-expanded', String(otwarte));
      btnMenu.setAttribute('aria-label', otwarte ? t('closeMenu', etyk) : etyk);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { menu.classList.remove('otwarte'); btnMenu.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('otwarte')) btnMenu.click();
    });
  }

  if ('IntersectionObserver' in window && !spokojnie) {
    var cele = document.querySelectorAll('.okazja, .produkt, .dostawa-lista li, .opinia, .atuty li');
    var io = new IntersectionObserver(function (wpisy) {
      wpisy.forEach(function (w) {
        if (!w.isIntersecting) return;
        w.target.style.transition = 'opacity .6s ease, transform .6s cubic-bezier(.2,.7,.3,1)';
        w.target.style.opacity = 1; w.target.style.transform = 'none';
        io.unobserve(w.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .05 });
    [].forEach.call(cele, function (el, i) {
      el.style.opacity = 0; el.style.transform = 'translateY(14px)';
      el.style.transitionDelay = (i % 5) * 60 + 'ms';
      io.observe(el);
    });
  }

  [].forEach.call(document.querySelectorAll('a.lang'), function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('jezyk', (a.getAttribute('hreflang') || a.textContent).trim().toLowerCase().slice(0, 2)); } catch (e) {}
    });
  });

  /* ========================================================= zamówienie */
  var form = document.getElementById('zam-form');
  if (!form || !D.zam) return;

  var poleOkazja = document.getElementById('pole-okazja');
  var poleData = document.getElementById('pole-data');
  var poleGodzina = document.getElementById('pole-godzina');
  var poleBudzet = document.getElementById('pole-budzet');
  var poleDostawa = document.getElementById('pole-dostawa');
  var grupaAdres = document.getElementById('grupa-adres');
  var poleAdres = document.getElementById('pole-adres');
  var komunikat = document.getElementById('zam-komunikat');
  var jezyk = document.documentElement.lang || 'pl';

  function wypelnij(select, lista, zPusta) {
    select.innerHTML = '';
    if (zPusta) {
      var p = document.createElement('option');
      p.value = ''; p.textContent = (D.slowa && D.slowa.choose) || '—';
      select.appendChild(p);
    }
    (lista || []).forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      select.appendChild(o);
    });
  }

  wypelnij(poleOkazja, D.okazje, true);
  wypelnij(poleBudzet, D.zam.budzety, true);
  wypelnij(poleDostawa, D.zam.dostawa, false);

  /* Data: dziś jako domyślna, przeszłość zablokowana. Kwiaty zamawia się
     na konkretny dzień — to jedyne pole, którego nie da się dopytać później. */
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }
  var dzis = new Date();
  poleData.min = iso(dzis);
  poleData.max = iso(new Date(dzis.getTime() + (D.zam.dniNaprzod || 30) * 864e5));
  poleData.value = iso(dzis);

  function zbudujGodziny() {
    poleGodzina.innerHTML = '';
    var wybrana = new Date(poleData.value + 'T00:00:00');
    var dzisiaj = wybrana.toDateString() === new Date().toDateString();
    var teraz = new Date();
    var wolne = 0;
    for (var g = (D.zam.godzinaOd || 9); g <= (D.zam.godzinaDo || 18); g++) {
      var etykieta = String(g).padStart(2, '0') + ':00';
      var o = document.createElement('option');
      o.value = etykieta; o.textContent = etykieta;
      // Godzina, która dziś już minęła, nie może być do wyboru.
      if (dzisiaj && teraz.getHours() >= g) o.disabled = true; else wolne++;
      poleGodzina.appendChild(o);
    }
    var pierwsza = poleGodzina.querySelector('option:not([disabled])');
    if (pierwsza) pierwsza.selected = true;
    return wolne;
  }

  /* Jeśli na dziś nie ma już żadnej godziny, przesuwamy datę na jutro —
     pusta lista bez wyjaśnienia wygląda jak zepsuty formularz. */
  if (zbudujGodziny() === 0) {
    poleData.value = iso(new Date(dzis.getTime() + 864e5));
    zbudujGodziny();
  }
  poleData.addEventListener('change', zbudujGodziny);

  /* Adres pokazuje się tylko przy dostawie. Pole, którego nie trzeba wypełniać,
     nie powinno w ogóle stać na drodze. */
  function przelaczAdres() {
    var dostawa = poleDostawa.selectedIndex > 0;
    grupaAdres.hidden = !dostawa;
    poleAdres.required = dostawa;
  }
  poleDostawa.addEventListener('change', przelaczAdres);
  przelaczAdres();

  function pokaz(txt, zle) {
    komunikat.textContent = txt;
    komunikat.className = 'zam-komunikat ' + (zle ? 'zle' : 'ok');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var okazja = poleOkazja.value;
    var budzet = poleBudzet.value;
    var imie = document.getElementById('pole-imie').value.trim();
    var tel = document.getElementById('pole-tel').value.trim();
    var bilecik = document.getElementById('pole-bilecik').value.trim();
    var adres = poleAdres.value.trim();

    if (!okazja || !poleData.value || !budzet) { pokaz(t('zFill'), true); return; }
    if (!grupaAdres.hidden && !adres) { pokaz(t('zAddress'), true); return; }
    if (!imie || tel.replace(/\D/g, '').length < 9) { pokaz(t('zPhone'), true); return; }

    var czytelna = new Intl.DateTimeFormat(jezyk, { weekday: 'long', day: 'numeric', month: 'long' })
      .format(new Date(poleData.value + 'T00:00:00'));

    var tresc = [
      D.firma, '---',
      okazja,
      czytelna + ', ' + poleGodzina.value,
      budzet,
      poleDostawa.value + (adres ? ' — ' + adres : ''),
      bilecik ? 'bilecik: ' + bilecik : '',
      '---', imie, tel
    ].filter(Boolean).join('\n');

    var numer = String(D.tel || '').replace(/\D/g, '');
    if (!numer) { pokaz(t('zNoChannel'), true); return; }

    pokaz(t('zOpening'), false);
    var okno = window.open('https://wa.me/' + numer + '?text=' + encodeURIComponent(tresc), '_blank', 'noopener');
    if (!okno) location.href = 'sms:+' + numer + '?body=' + encodeURIComponent(tresc);
    setTimeout(function () { pokaz(t('zDone'), false); }, 900);
  });

  /* Dziś i jutro na wierzchu, reszta tygodnia w ciągu pod spodem.
     Liczy przeglądarka — strona jest statyczna i data budowania nic tu nie znaczy. */
  (function () {
    var sekcja = document.querySelector('.godziny-listek');
    if (!sekcja) return;
    var dzis = (new Date().getDay() + 6) % 7;
    var jutro = (dzis + 1) % 7;
    var etyk = { };
    etyk[dzis] = sekcja.getAttribute('data-etyk-dzis');
    etyk[jutro] = sekcja.getAttribute('data-etyk-jutro');

    [dzis, jutro].forEach(function (i) {
      var kafel = sekcja.querySelector('.para-dnia[data-dzien="' + i + '"]');
      if (!kafel) return;
      kafel.hidden = false;
      var e = kafel.querySelector('.para-etyk');
      if (e) e.textContent = etyk[i] || '';
      // Dziś dostaje mocniejsze wyróżnienie niż jutro — to jest dzień,
      // w którym zamówienie jeszcze zdąży się zrealizować.
      if (i === dzis) kafel.classList.add('para-dnia--dzis');
    });

    // Dwa dni pokazane wyżej znikają z ciągu, żeby nie powtarzać ich dwa razy.
    [dzis, jutro].forEach(function (i) {
      var w = sekcja.querySelector('.reszta-dzien[data-dzien="' + i + '"]');
      if (!w) return;
      var sep = w.nextElementSibling;
      if (sep && sep.classList.contains('reszta-sep')) sep.remove();
      else {
        var poprz = w.previousElementSibling;
        if (poprz && poprz.classList.contains('reszta-sep')) poprz.remove();
      }
      w.remove();
    });
  })();
  /* Kartka "otwarte teraz". Liczona z PRAWDZIWYCH godzin — wpisany na sztywno
     wolny termin zestarzalby sie w tydzien. Gdy dzien nie ma znanych godzin,
     kartka zostaje ukryta zamiast zgadywac. */
  (function(){
    var k=document.getElementById('kartka-stan');
    if(!k||!D.godziny||!D.stan) return;
    var g=D.godziny, teraz=new Date(), dzis=(teraz.getDay()+6)%7;
    var minuty=teraz.getHours()*60+teraz.getMinutes();
    var hhmm=function(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
    var tytul=k.querySelector('[data-stan-tytul]'), opis=k.querySelector('[data-stan-opis]');
    var dzisiaj=g[dzis];
    if(dzisiaj && minuty>=dzisiaj[0] && minuty<dzisiaj[1]){
      tytul.textContent=D.stan.terazOtwarte;
      opis.textContent=D.stan.doGodz.replace('{g}',hhmm(dzisiaj[1]));
      k.hidden=false; k.classList.add('kartka--otwarte'); return;
    }
    for(var i=0;i<7;i++){
      var d=(dzis+i)%7, z=g[d];
      if(!z) continue;
      if(i===0 && minuty>=z[0]) continue;
      tytul.textContent=D.stan.zamkniete;
      opis.textContent=D.stan.otwieramy
        .replace('{d}', i===0 ? '' : (D.dniTyg&&D.dniTyg[d]||''))
        .replace('{g}', hhmm(z[0])).replace(/\s+/g,' ').trim();
      k.hidden=false; return;
    }
  })();

})();
