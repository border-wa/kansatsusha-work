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

  window.R = {
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
