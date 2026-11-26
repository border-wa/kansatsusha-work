/* =========================================================
   render.js ― 文章データを、画面の部品にする
   文章そのものは content/ のファイルにあります。
   ここには文章を書きこみません。
   ========================================================= */
(function () {
  "use strict";

  /* 文字を安全に画面へ出すための変換 */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* 画面の文章用：
     「恐れ」に自動でふりがな(おそ)を付けます。
     content/ のファイルには、ふつうに「恐れ」と書いておけば大丈夫です。 */
  function rich(s) {
    return esc(s).replace(/恐れ/g, "<ruby>恐<rt>おそ</rt></ruby>れ");
  }

  /* HTMLの文字列から、画面の部品を一つ作る */
  function html(str) {
    var t = document.createElement("template");
    t.innerHTML = str.trim();
    return t.content;
  }

  function paras(list) {
    return (list || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
  }

  /* ACIM原文の折りたたみ */
  function acimBlock(ref, data, ui) {
    var p = (data.passages || {})[ref];
    if (!p) return "";
    var original = p.en
      ? '<p class="acim-en" lang="en">' + esc(p.en) + "</p>"
      : '<p class="muted">' + rich(ui.acim.pending) + "</p>";
    return (
      "<details>" +
        "<summary>" + rich(ui.acim.showOriginal) + "(" + esc(ref) + ")</summary>" +
        '<p class="acim-ref">' + esc(ref) + "</p>" +
        "<p>" + rich(p.ja) + "</p>" +
        original +
        '<p class="small">' + rich(ui.acim.source) + '：<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(ref) + " ― acim.org</a></p>" +
      "</details>"
    );
  }

  /* ---- Markdownでコピー ---- */

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallbackCopy(text); }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  /* コピーの部品。getText は、押したときの文章(Markdown)を返す関数 */
  function copyBox(getText, ui) {
    var canShare = typeof navigator.share === "function";
    var box = html(
      '<div class="copy-box">' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" data-act="copy">' + rich(ui.copy.button) + "</button>" +
          (canShare ? '<button type="button" class="btn" data-act="share">' + rich(ui.copy.share) + "</button>" : "") +
        "</div>" +
        '<p class="copy-msg" role="status" aria-live="polite"></p>' +
      "</div>"
    ).firstElementChild;

    var msg = box.querySelector(".copy-msg");

    function showFallback(text) {
      msg.textContent = ui.copy.fallback;
      var old = box.querySelector(".copy-fallback");
      if (old) old.remove();
      var ta = document.createElement("textarea");
      ta.className = "copy-fallback";
      ta.readOnly = true;
      ta.value = text;
      box.appendChild(ta);
      ta.focus();
      ta.select();
    }

    box.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      var text = getText();
      if (!text) { msg.textContent = ui.copy.empty; return; }
      if (btn.dataset.act === "share") {
        navigator.share({ text: text }).catch(function () { /* やめたときは何もしない */ });
        return;
      }
      copyText(text).then(function (ok) {
        if (ok) msg.textContent = ui.copy.done;
        else showFallback(text);
      });
    });
    return box;
  }

  /* 今の日時を「2026-11-26 18:30」の形にする */
  function stamp(d) {
    d = d || new Date();
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) +
      " " + two(d.getHours()) + ":" + two(d.getMinutes());
  }

  /* ---- タイマー ----
     残り時間は小さな数字で、主には円の減り方で見せます。
     終わったら、短い振動(できる端末だけ)と、円のやわらかい変化で知らせます。音は出しません。 */
  var running = [];
  function stopTimers() {
    running.forEach(function (t) { clearInterval(t); });
    running = [];
  }

  function timer(seconds, ui) {
    var CIRC = 2 * Math.PI * 52;
    var box = html(
      '<div class="timer">' +
        '<svg viewBox="0 0 120 120" aria-hidden="true">' +
          '<circle class="timer-bg" cx="60" cy="60" r="52"></circle>' +
          '<circle class="timer-fg" cx="60" cy="60" r="52" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="0"></circle>' +
        "</svg>" +
        '<div class="timer-side">' +
          '<button type="button" class="btn timer-btn">' + rich(ui.timer.start) + "</button>" +
          '<p class="timer-left" aria-live="off"></p>' +
          '<p class="timer-msg" role="status" aria-live="polite"></p>' +
        "</div>" +
      "</div>"
    ).firstElementChild;

    var fg = box.querySelector(".timer-fg");
    var btn = box.querySelector(".timer-btn");
    var left = box.querySelector(".timer-left");
    var msg = box.querySelector(".timer-msg");
    var total = seconds * 1000, remain = total, endAt = 0, iv = null;

    function two(n) { return (n < 10 ? "0" : "") + n; }
    function draw() {
      fg.setAttribute("stroke-dashoffset", String(CIRC * (1 - remain / total)));
      var s = Math.ceil(remain / 1000);
      left.textContent = ui.timer.left + " " + Math.floor(s / 60) + ":" + two(s % 60);
    }
    function halt() {
      if (iv) { clearInterval(iv); running = running.filter(function (x) { return x !== iv; }); iv = null; }
    }
    draw();

    btn.addEventListener("click", function () {
      if (iv) {
        remain = Math.max(0, endAt - Date.now());
        halt();
        btn.innerHTML = rich(ui.timer.resume);
        return;
      }
      if (remain <= 0) { remain = total; box.classList.remove("done"); msg.textContent = ""; }
      endAt = Date.now() + remain;
      btn.innerHTML = rich(ui.timer.pause);
      iv = setInterval(function () {
        remain = Math.max(0, endAt - Date.now());
        draw();
        if (remain <= 0) {
          halt();
          box.classList.add("done");
          btn.innerHTML = rich(ui.timer.again);
          msg.textContent = ui.timer.done;
          try { if (navigator.vibrate) navigator.vibrate([160, 100, 160]); } catch (e) { /* 何もしない */ }
        }
      }, 250);
      running.push(iv);
    });
    return box;
  }

  window.R = {
    timer: timer,
    stopTimers: stopTimers,
    esc: esc,
    rich: rich,
    html: html,
    paras: paras,
    acimBlock: acimBlock,
    copyBox: copyBox,
    copyText: copyText,
    stamp: stamp
  };
})();
