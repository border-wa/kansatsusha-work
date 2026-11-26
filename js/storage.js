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

  /* ---- 「今日、見えたこと」の記録 ----
     一件の形：
       { id, t(日付と時刻), no(実習の番号。なければ null),
         text(本文), blind(「見えなかった」の印), from("write" | "practice" | "pause"),
         fields([{k: 欄の名前, v: 書いたこと}]) } */
  function newId() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function getRecords() {
    var list = get("records", []);
    return Array.isArray(list) ? list : [];
  }
  function saveRecords(list) {
    list.sort(function (a, b) { return a.t < b.t ? 1 : a.t > b.t ? -1 : 0; });
    return set("records", list);
  }
  function addRecord(r) {
    var list = getRecords();
    r.id = r.id || newId();
    r.t = r.t || new Date().toISOString();
    list.push(r);
    return saveRecords(list);
  }
  function updateRecord(id, patch) {
    var list = getRecords();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) list[i][k] = patch[k];
      }
    }
    return saveRecords(list);
  }
  function removeRecord(id) {
    return saveRecords(getRecords().filter(function (r) { return r.id !== id; }));
  }

  window.Store = {
    available: function () { return available; },
    get: get,
    set: set,
    remove: remove,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    getRecords: getRecords,
    addRecord: addRecord,
    updateRecord: updateRecord,
    removeRecord: removeRecord
  };
})();
