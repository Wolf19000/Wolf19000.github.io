(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GLYPHS = "01#/\\<>_*+=$%";

  function glyph() { return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }

  /* Fit each line of the poster type to the full column width */
  var lines = Array.prototype.slice.call(document.querySelectorAll(".nl"));
  function fitLines() {
    lines.forEach(function (line) {
      if (line.dataset.decoding) return;
      var available = line.parentElement.clientWidth;
      line.style.fontSize = "100px";
      var width = line.getBoundingClientRect().width;
      if (width > 0 && available > 0) {
        /* The hero's name also has to leave room for the buttons on short screens */
        var cap = line.closest(".hero") ? Math.max(96, (window.innerHeight - 290) / 1.92) : Infinity;
        line.style.fontSize = Math.min(100 * available / width, cap).toFixed(2) + "px";
      }
    });
  }

  /* Decode effect: characters resolve from random symbols into the real text */
  function decode(el, duration) {
    if (reduced || el.dataset.decoding) return;
    var text = el.textContent;
    var chars = Array.prototype.map.call(text, function (c) {
      var span = document.createElement("span");
      span.className = "ch";
      span.textContent = c === " " ? " " : c;
      return span;
    });
    el.dataset.decoding = "1";
    el.textContent = "";
    chars.forEach(function (s) { el.appendChild(s); });
    var targets = chars.map(function (s, i) {
      s.style.width = s.getBoundingClientRect().width + "px";
      return { at: (i / chars.length) * duration * .7 + Math.random() * duration * .3, c: text[i], last: 0 };
    });
    var start = performance.now();
    (function step(now) {
      var t = now - start;
      targets.forEach(function (o, i) {
        if (t >= o.at) {
          chars[i].textContent = o.c === " " ? " " : o.c;
        } else if (o.c !== " " && now - o.last > 55) {
          chars[i].textContent = glyph();
          o.last = now;
        }
      });
      if (t < duration) {
        requestAnimationFrame(step);
      } else {
        el.textContent = text;
        delete el.dataset.decoding;
        fitLines();
      }
    })(start);
  }

  var heroLines = Array.prototype.slice.call(document.querySelectorAll(".hero .nl"));
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    fitLines();
    document.querySelectorAll(".name").forEach(function (n) { n.classList.add("ready"); });
    heroLines.forEach(function (line, i) {
      setTimeout(function () { decode(line, 1300); }, i * 180);
    });
  }
  var fontsReady = document.fonts && document.fonts.load
    ? document.fonts.load('400 100px Anton', "AB")
    : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1200); })]).then(boot);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLines);

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitLines, 120);
  });

  /* Scramble nav labels on hover */
  document.querySelectorAll(".nav a").forEach(function (a) {
    var label = a.textContent;
    var running = false;
    a.addEventListener("mouseenter", function () {
      if (reduced || running) return;
      running = true;
      var start = performance.now();
      (function step(now) {
        var shown = Math.floor((now - start) / 28);
        if (shown >= label.length) {
          a.textContent = label;
          running = false;
          return;
        }
        a.textContent = label.slice(0, shown) + Array.prototype.map.call(label.slice(shown), function (c) { return c === " " ? " " : glyph(); }).join("");
        requestAnimationFrame(step);
      })(start);
    });
  });

  /* Mark things as they arrive */
  var watched = document.querySelectorAll(".wipe, .row");
  document.querySelectorAll(".rows").forEach(function (list) {
    Array.prototype.forEach.call(list.children, function (item, i) {
      item.style.setProperty("--d", (i * 90) + "ms");
    });
  });
  if ("IntersectionObserver" in window && !reduced) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("seen");
          seen.unobserve(e.target);
        }
      });
    }, { threshold: .2, rootMargin: "0px 0px -6% 0px" });
    watched.forEach(function (el) { seen.observe(el); });

    var hablemos = document.querySelector("#hablemos .nl");
    var once = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        decode(hablemos, 1000);
        once.disconnect();
      }
    }, { threshold: .5 });
    once.observe(hablemos);

    /* Counters run up to their real value when they arrive */
    document.querySelectorAll(".count").forEach(function (el) {
      var target = Number(el.textContent);
      var counter = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        counter.disconnect();
        var start = performance.now();
        (function step(now) {
          var p = Math.min(1, (now - start) / 1100);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        })(start);
      }, { threshold: .4 });
      counter.observe(el);
    });
  } else {
    watched.forEach(function (el) { el.classList.add("seen"); });
  }

  /* Statement fills in word by word with the scroll */
  var statement = document.getElementById("statement");
  var words = statement.textContent.trim().split(/\s+/);
  statement.setAttribute("aria-label", statement.textContent.trim());
  statement.textContent = "";
  var wordEls = words.map(function (w, i) {
    var s = document.createElement("span");
    s.className = "w";
    s.setAttribute("aria-hidden", "true");
    s.textContent = w;
    statement.appendChild(s);
    if (i < words.length - 1) statement.appendChild(document.createTextNode(" "));
    return s;
  });

  /* Scroll-linked pieces */
  var progressBar = document.getElementById("progress");
  var track = document.querySelector(".track");
  var ticking = false;
  function onScroll() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    progressBar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";

    var loop = track.scrollWidth / 2;
    if (!reduced && loop > 0) track.style.transform = "translateX(" + (-(window.scrollY * .4 % loop)).toFixed(1) + "px)";

    var r = statement.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = (vh * .82 - r.top) / (r.height + vh * .3);
    var count = reduced ? wordEls.length : Math.round(Math.max(0, Math.min(1, p)) * wordEls.length);
    wordEls.forEach(function (w, i) { w.classList.toggle("on", i < count); });
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* Cursor that inverts whatever sits under it */
  var cursor = document.getElementById("cursor");
  if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var cx = 0, cy = 0, tx = 0, ty = 0, scale = 1, targetScale = 1;
    window.addEventListener("pointermove", function (e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!cursor.classList.contains("on")) {
        cx = tx;
        cy = ty;
        cursor.classList.add("on");
      }
      targetScale = e.target.closest && e.target.closest("a, button, input, .row, .cell") ? 2.6 : 1;
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { cursor.classList.remove("on"); });
    (function follow() {
      cx += (tx - cx) * .18;
      cy += (ty - cy) * .18;
      scale += (targetScale - scale) * .15;
      cursor.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px) scale(" + scale.toFixed(3) + ")";
      requestAnimationFrame(follow);
    })();
  }

  /* Mobile menu */
  var menuBtn = document.getElementById("menu-btn");
  var panel = document.getElementById("menu-panel");
  function setMenu(open) {
    panel.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Cerrar" : "Menú";
    document.documentElement.style.overflow = open ? "hidden" : "";
  }
  menuBtn.addEventListener("click", function () { setMenu(!panel.classList.contains("open")); });
  panel.addEventListener("click", function (e) { if (e.target.tagName === "A") setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  /* Console */
  var body = document.getElementById("term-body");
  var form = document.getElementById("term-form");
  var input = document.getElementById("term-input");
  /* Each page defines its own commands. Each line: [text, css class, link] */
  var COMMANDS = window.SITE_COMMANDS || {};
  var ALIASES = window.SITE_ALIASES || {};

  function addLine(text, cls, href) {
    var p = document.createElement("p");
    if (href) {
      var a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = text;
      p.appendChild(a);
    } else {
      p.textContent = text || " ";
      if (cls) p.className = cls;
    }
    body.appendChild(p);
  }
  function echo(raw) {
    var p = document.createElement("p");
    p.className = "cmd";
    p.textContent = (window.SITE_PROMPT || "alexis@cv:~$") + " " + raw;
    body.appendChild(p);
  }
  function run(raw) {
    var text = raw.trim();
    if (!text) return;
    var key = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    key = ALIASES[key] || key;
    if (key === "clear") {
      body.textContent = "";
      return;
    }
    if (body.children.length) addLine("");
    echo(text);
    if (Object.prototype.hasOwnProperty.call(COMMANDS, key)) {
      COMMANDS[key].forEach(function (l) { addLine(l[0], l[1], l[2]); });
    } else if (key === "sudo" || key.indexOf("sudo ") === 0) {
      addLine("Permiso denegado. Mejor escríbeme: contacto");
    } else {
      addLine("Comando no encontrado: " + text + ". Escribe help para ver la lista.");
    }
    body.scrollTop = body.scrollHeight;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run(input.value);
    input.value = "";
  });
  document.getElementById("chips").addEventListener("click", function (e) {
    var cmd = e.target.getAttribute && e.target.getAttribute("data-cmd");
    if (cmd) run(cmd);
  });

  /* Copy email */
  var copyBtn = document.getElementById("copy");
  var mail = document.getElementById("mail");
  function flash(label) {
    copyBtn.textContent = label;
    setTimeout(function () { copyBtn.textContent = "copiar"; }, 1600);
  }
  function selectMail() {
    var range = document.createRange();
    range.selectNodeContents(mail);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    flash("seleccionado");
  }
  copyBtn.addEventListener("click", function () {
    if (!navigator.clipboard) { selectMail(); return; }
    navigator.clipboard.writeText(mail.textContent).then(function () { flash("copiado"); }, selectMail);
  });

  /* Hero background: a field of characters that answers to the pointer */
  var canvas = document.getElementById("field");
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;

  var RAMP = " .,:;-~+=*#%@";
  var CELL_W = 17;
  var CELL_H = 25;
  var RADIUS = 220;
  var width = 0, height = 0, cols = 0, rows = 0;
  var px = -9999, py = -9999, ptx = -9999, pty = -9999;
  var heroVisible = true;
  var hero = canvas.parentElement;

  function sizeField() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CELL_W);
    rows = Math.ceil(height / CELL_H);
    ctx.font = '400 13px "IBM Plex Mono", Consolas, monospace';
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
  }

  function drawField(now) {
    var time = now * .00032;
    ctx.clearRect(0, 0, width, height);
    for (var r = 0; r < rows; r++) {
      var fade = 1 - (r / rows) * .6;
      var y = r * CELL_H;
      for (var c = 0; c < cols; c++) {
        var x = c * CELL_W;
        var n = (Math.sin(c * .17 + time * 2.1) + Math.sin(r * .31 - time * 1.7) + Math.sin((c + r) * .08 + time)) / 3;
        n = (n + 1) / 2;
        var dx = x - px;
        var dy = y - py;
        var glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / RADIUS);
        glow *= glow;
        var v = n * n * .62 + glow * .9;
        if (v < .13) continue;
        var ch = RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
        if (glow > .3 && Math.random() < .06) ch = Math.random() < .5 ? "0" : "1";
        ctx.globalAlpha = Math.min(.9, v * .42 * fade + glow * .7);
        ctx.fillText(ch, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  sizeField();
  drawField(performance.now());
  window.addEventListener("resize", function () {
    sizeField();
    drawField(performance.now());
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { sizeField(); drawField(performance.now()); });
  }

  if (!reduced) {
    hero.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      ptx = e.clientX - rect.left;
      pty = e.clientY - rect.top;
      if (px < -1000) { px = ptx; py = pty; }
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { ptx = -9999; pty = -9999; });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; }).observe(hero);
    }
    var lastFrame = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!heroVisible || document.hidden || now - lastFrame < 50) return;
      lastFrame = now;
      if (ptx < -1000) { px = -9999; py = -9999; }
      else { px += (ptx - px) * .2; py += (pty - py) * .2; }
      drawField(now);
    })(performance.now());
  }
})();
