/* Wires the Classic / Mandala switch and the mandala's sliders. Mandala is the default. */
(function () {
    'use strict';
    var body = document.body;
    var canvas = document.getElementById('mandala');
    var errEl = document.getElementById('mandala-error');
    var toggle = document.querySelectorAll('.mode-toggle button');
    var M = window.GryphonMandala;
    var STORE = 'gryphon-mode';

    function setMode(mode, remember) {
        var mandala = mode === 'mandala';
        body.classList.toggle('mode-mandala', mandala);
        toggle.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
        if (remember) { try { localStorage.setItem(STORE, mode); } catch (e) {} }
        if (mandala) {
            var err = M.start(canvas);
            errEl.hidden = !err;
            if (err) errEl.textContent = err;
        } else {
            M.stop();
        }
    }

    toggle.forEach(function (b) {
        b.addEventListener('click', function () { setMode(b.dataset.mode, true); });
    });

    // sliders
    var sliders = document.querySelectorAll('.mandala-sliders input[type="range"]');
    function showValue(s) {
        var out = s.parentNode.querySelector('output');
        if (out) out.textContent = (+s.value).toFixed(2);
    }
    function syncControls() {
        sliders.forEach(function (s) { s.value = M.params[s.name]; showValue(s); });
        document.querySelectorAll('#mandala-folds button').forEach(function (b) {
            b.setAttribute('aria-pressed', String(+b.dataset.v === M.params.folds));
        });
        var uv = document.getElementById('mandala-uv');
        uv.setAttribute('aria-pressed', String(!!M.params.uv));
        uv.textContent = M.params.uv ? 'uv light on' : 'uv light off';
    }
    sliders.forEach(function (s) {
        s.addEventListener('input', function () { M.set(s.name, s.value); showValue(s); });
    });
    document.getElementById('mandala-folds').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        M.set('folds', b.dataset.v); syncControls();
    });
    document.getElementById('mandala-uv').addEventListener('click', function () {
        M.set('uv', M.params.uv ? 0 : 1); syncControls();
    });
    document.getElementById('mandala-pour').addEventListener('click', function () { M.pour(); });
    var pngBtn = document.getElementById('mandala-png'), gifBtn = document.getElementById('mandala-gif');
    pngBtn.addEventListener('click', function () {
        pngBtn.disabled = true; pngBtn.textContent = 'saving\u2026';
        // let the label paint before the (blocking) big render starts
        setTimeout(function () {
            M.savePNG(set.pngSize).catch(function (e) {
                errEl.textContent = 'Couldn\u2019t save the image: ' + (e && e.message ? e.message : e); errEl.hidden = false;
            }).then(function () { pngBtn.disabled = false; pngBtn.textContent = 'save png'; });
        }, 30);
    });
    // save settings, remembered in this browser
    var SET_KEY = 'gryphon-save-settings';
    var set = { pngSize: 2048, gifLen: 5, gifSize: 640, vidLen: 10, vidSize: 2048 };
    try { Object.assign(set, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) {}
    var panel = document.getElementById('mandala-settings'), gear = document.getElementById('mandala-gear');
    function paintSettings() {
        panel.querySelectorAll('.chips').forEach(function (g) {
            g.querySelectorAll('button').forEach(function (b) {
                b.setAttribute('aria-pressed', String(+b.dataset.v === +set[g.dataset.key]));
            });
        });
    }
    panel.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var g = b.closest('.chips'); if (!g) return;
        set[g.dataset.key] = +b.dataset.v;
        try { localStorage.setItem(SET_KEY, JSON.stringify(set)); } catch (err) {}
        paintSettings();
    });
    function showPanel(on) { panel.hidden = !on; gear.setAttribute('aria-expanded', String(on)); }
    gear.addEventListener('click', function () { showPanel(panel.hidden); });
    document.addEventListener('click', function (e) {
        if (!panel.hidden && !panel.contains(e.target) && !gear.contains(e.target)) showPanel(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { showPanel(false); gear.focus(); } });
    paintSettings();

    var mp4Btn = document.getElementById('mandala-mp4');
    var busyEls = [pngBtn, gifBtn, mp4Btn];
    function busy(on) { busyEls.forEach(function (el) { el.disabled = on; }); }
    function fail(what, e) {
        console.error(e);
        errEl.textContent = 'Couldn\u2019t make the ' + what + ': ' + (e && e.message ? e.message : e); errEl.hidden = false;
    }
    gifBtn.addEventListener('click', function () {
        if (M.recording) return;
        busy(true);
        M.saveGIF({ seconds: set.gifLen, size: set.gifSize }, function (stage, f) {
            gifBtn.textContent = (stage === 'recording' ? 'recording ' : 'encoding ') + Math.round(f * 100) + '%';
        }).catch(function (e) { fail('GIF', e); })
          .then(function () { busy(false); gifBtn.textContent = 'save gif'; });
    });
    var vt = M.videoType();
    if (!vt) mp4Btn.hidden = true;  // no video recording in this browser
    else if (vt.indexOf('mp4') < 0) { mp4Btn.textContent = 'save video'; document.getElementById('set-video-name').textContent = 'video'; }
    var mp4Label = mp4Btn.textContent;
    mp4Btn.addEventListener('click', function () {
        if (M.recording) return;
        busy(true);
        M.saveVideo(set.vidLen, set.vidSize, function (f) { mp4Btn.textContent = 'recording ' + Math.round(f * 100) + '%'; })
          .catch(function (e) { fail('video', e); })
          .then(function () { busy(false); mp4Btn.textContent = mp4Label; });
    });
    syncControls();

    // ?mode=classic in the URL, else the visitor's last choice, else mandala
    var start = 'mandala';
    var q = new URLSearchParams(location.search).get('mode');
    if (q === 'mandala' || q === 'classic') start = q;
    else { try { start = localStorage.getItem(STORE) || 'mandala'; } catch (e) {} }
    setMode(start, false);
})();
