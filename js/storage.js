/* =========================================================
   storage.js ― 記録の保存と読み込み
   記録は、この端末のブラウザの中(localStorage)にだけ残します。
   外には送りません。
   保存できない端末(プライベートブラウズなど)でも、
   アプリが止まらないようにしてあります。
   ========================================================= */
(function () {
  "use strict";

  var PREFIX = "kansatsusha.";
  var memory = {};          // 保存できないときの、一時的な置き場所
  var available = false;

  try {
    var testKey = PREFIX + "__test";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    available = true;
  } catch (e) {
    available = false;
  }

  function get(key, fallback) {
    var raw = null;
    try {
      raw = available ? window.localStorage.getItem(PREFIX + key) : memory[key];
    } catch (e) {
      raw = memory[key];
    }
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    var raw = JSON.stringify(value);
    memory[key] = raw;
    if (!available) return false;
    try {
      window.localStorage.setItem(PREFIX + key, raw);
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(key) {
    delete memory[key];
    if (!available) return;
    try { window.localStorage.removeItem(PREFIX + key); } catch (e) { /* 何もしない */ }
  }

  /* ---- 実習の書きかけ ---- */
  function getDraft(no) {
    return get("draft." + no, { values: {} });
  }
  function saveDraft(no, draft) {
    return set("draft." + no, draft);
  }
  function clearDraft(no) {
    remove("draft." + no);
  }

  window.Store = {
    available: function () { return available; },
    get: get,
    set: set,
    remove: remove,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft
  };
})();
