/* Wires the Classic / Mandala switch and the mandala's sliders. Classic is the default. */
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
    function syncControls() {
        sliders.forEach(function (s) { s.value = M.params[s.name]; });
        document.querySelectorAll('#mandala-folds button').forEach(function (b) {
            b.setAttribute('aria-pressed', String(+b.dataset.v === M.params.folds));
        });
        var uv = document.getElementById('mandala-uv');
        uv.setAttribute('aria-pressed', String(!!M.params.uv));
        uv.textContent = M.params.uv ? 'uv light on' : 'uv light off';
    }
    sliders.forEach(function (s) {
        s.addEventListener('input', function () { M.set(s.name, s.value); });
    });
    document.getElementById('mandala-folds').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        M.set('folds', b.dataset.v); syncControls();
    });
    document.getElementById('mandala-uv').addEventListener('click', function () {
        M.set('uv', M.params.uv ? 0 : 1); syncControls();
    });
    document.getElementById('mandala-pour').addEventListener('click', function () { M.pour(); });
    document.getElementById('mandala-reset').addEventListener('click', function () { M.reset(); syncControls(); });
    syncControls();

    // ?mode=mandala in the URL, else the visitor's last choice, else classic
    var start = 'classic';
    var q = new URLSearchParams(location.search).get('mode');
    if (q === 'mandala' || q === 'classic') start = q;
    else { try { start = localStorage.getItem(STORE) || 'classic'; } catch (e) {} }
    setMode(start, false);
})();
