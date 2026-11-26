/* =========================================================
   app.js ― 画面の切り替え
   アドレスの「#/〜」の部分で、どの画面を出すかを決めます。
     #/home           ホーム
     #/guide          案内書の目次     #/guide/3   第3章
     #/practices      実習一覧
     #/practice/2     実習2の始まり    #/practice/2/1  実習2の手順1
     #/practice/2/end 実習2のおわり
     #/pause          一秒後の問い
     #/records        記録
     #/check          自己点検
     #/settings       設定
     #/sources        出典
   ========================================================= */
(function () {
  "use strict";

  var C = {};   // content/ から読みこんだ文章
  var view = document.getElementById("view");
  var titleEl = document.getElementById("title");
  var backBtn = document.getElementById("back");
  var backTo = "#/home";

  var FILES = ["ui", "guide", "practices", "plan30", "checklist", "acim", "sources"];

  /* ---- 文章の読みこみ ---- */
  function loadContent() {
    return Promise.all(FILES.map(function (name) {
      return fetch("content/" + name + ".json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(name);
        return r.json();
      }).then(function (data) { C[name] = data; });
    }));
  }

  /* ---- 画面の共通部分 ---- */
  function setFrame(opts) {
    titleEl.innerHTML = R.rich(opts.title || C.ui.appTitle);
    document.title = (opts.title ? opts.title + " ― " : "") + C.ui.appTitle;
    backTo = opts.back || null;
    backBtn.hidden = !backTo;
    var tabs = document.querySelectorAll("#tabs a");
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].dataset.tab === opts.tab) tabs[i].setAttribute("aria-current", "page");
      else tabs[i].removeAttribute("aria-current");
    }
  }

  function show(content) {
    view.innerHTML = "";
    if (typeof content === "string") view.appendChild(R.html(content));
    else view.appendChild(content);
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener("click", function () {
    if (backTo) location.hash = backTo;
  });

  /* =======================================================
     ホーム
     ======================================================= */
  function viewHome() {
    var u = C.ui.home;
    setFrame({ tab: "home" });
    show(
      '<a class="btn btn-main pause-btn" href="#/pause">' + R.rich(u.pauseButton) +
        "<small>" + R.rich(u.pauseHint) + "</small></a>" +

      "<h2>" + R.rich(u.todayHeading) + "</h2>" +
      '<p class="muted">' + R.rich(u.todayPending) + "</p>" +
      '<a class="btn" href="#/practices">' + R.rich(u.freeButton) + "</a>" +

      '<a class="btn" href="#/records">' + R.rich(u.writeButton) + "</a>" +

      '<p class="carry"><span class="muted">' + R.rich(u.carryHeading) + "</span>" + R.rich(u.carryLine) + "</p>" +

      '<div class="btn-row">' +
        '<a class="btn btn-quiet" href="#/check">' + R.rich(u.check) + "</a>" +
        '<a class="btn btn-quiet" href="#/settings">' + R.rich(u.settings) + "</a>" +
        '<a class="btn btn-quiet" href="#/sources">' + R.rich(u.sources) + "</a>" +
      "</div>"
    );
  }

  /* =======================================================
     案内書
     ======================================================= */
  function viewGuideList() {
    setFrame({ tab: "guide", title: C.guide.title });
    var s = C.guide.chapters.map(function (ch) {
      return '<a class="card" href="#/guide/' + R.esc(ch.id) + '">' +
        '<p class="card-label">' + R.rich(ch.label) + "</p>" +
        '<p class="card-title">' + R.rich(ch.title) + "</p>" +
        '<p class="card-text">' + R.rich(ch.point) + "</p>" +
      "</a>";
    }).join("");
    show(s);
  }

  function viewGuideChapter(id) {
    var list = C.guide.chapters;
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
    if (idx < 0) return viewGuideList();
    var ch = list[idx];
    var u = C.ui.guide;
    setFrame({ tab: "guide", title: ch.label, back: "#/guide" });

    var s = "<h2>" + R.rich(ch.title) + "</h2>" +
      '<p class="point">' + R.rich(ch.point) + "</p>";

    if (ch.body && ch.body.length) s += R.paras(ch.body);
    else s += '<p class="muted">' + R.rich(u.bodyPending) + "</p>";

    if (ch.table) {
      s += '<div class="pairs">' + ch.table.rows.map(function (r) {
        return '<div class="pair"><p class="pair-q">' + R.rich(r[0]) + '</p><p class="pair-a">' + R.rich(r[1]) + "</p></div>";
      }).join("") + "</div>";
    }
    if (ch.safety) s += '<p class="gentle">' + R.rich(C.ui.safety.full) + "</p>";
    if (ch.link) s += '<a class="btn" href="' + R.esc(ch.link.to) + '">' + R.rich(ch.link.text) + "</a>";
    (ch.acim || []).forEach(function (ref) { s += R.acimBlock(ref, C.acim, C.ui); });

    s += '<div class="btn-row">';
    s += idx > 0 ? '<a class="btn" href="#/guide/' + R.esc(list[idx - 1].id) + '">' + R.rich(u.prev) + "</a>" : "";
    s += idx < list.length - 1 ? '<a class="btn" href="#/guide/' + R.esc(list[idx + 1].id) + '">' + R.rich(u.next) + "</a>" : "";
    s += "</div>";
    show(s);
  }

  /* =======================================================
     実習
     ======================================================= */
  function findPractice(no) {
    var ps = C.practices.practices;
    for (var i = 0; i < ps.length; i++) if (String(ps[i].no) === String(no)) return ps[i];
    return null;
  }

  function hasFields(p) {
    return p.steps.some(function (st) { return st.fields && st.fields.length; });
  }

  function hasValues(values) {
    return Object.keys(values || {}).some(function (k) { return values[k] && values[k].trim(); });
  }

  /* 実習で書いたことを、記録の形 [{k, v}] にする */
  function practiceFields(p, values) {
    var out = [];
    p.steps.forEach(function (st) {
      (st.fields || []).forEach(function (f) {
        var v = (values[f.id] || "").trim();
        if (!v) return;
        var label = f.label;
        if (f.ref && (values[f.ref] || "").trim()) label += "(" + values[f.ref].trim() + ")";
        out.push({ k: label, v: v });
      });
    });
    return out;
  }

  /* 書いたことを、Markdown の文章にする */
  function practiceMarkdown(p) {
    var values = Store.getDraft(p.no).values || {};
    if (!hasValues(values)) return "";
    var out = ["## " + C.ui.practice.label + p.no + " " + p.title, R.stamp(), ""];
    p.steps.forEach(function (st) {
      var lines = [];
      (st.fields || []).forEach(function (f) {
        var v = (values[f.id] || "").trim();
        if (!v) return;
        var label = f.label;
        if (f.ref && (values[f.ref] || "").trim()) label += "(" + values[f.ref].trim() + ")";
        lines.push("- " + label + "：" + v.replace(/\n/g, "\n  "));
      });
      if (lines.length) {
        out.push("**" + st.text + "**");
        out = out.concat(lines);
        out.push("");
      }
    });
    return out.join("\n").trim() + "\n";
  }

  function viewPracticeList() {
    setFrame({ tab: "practices", title: C.practices.title });
    var s = '<p class="muted">' + R.rich(C.practices.lead) + "</p>";
    s += C.practices.practices.map(function (p) {
      return '<a class="card" href="#/practice/' + p.no + '">' +
        '<p class="card-label">' + R.rich(C.ui.practice.label) + p.no + "</p>" +
        '<p class="card-title">' + R.rich(p.title) + "</p>" +
        '<p class="card-text">' + R.rich(p.aim) + "</p>" +
      "</a>";
    }).join("");
    show(s);
  }

  function viewPracticeIntro(p) {
    var u = C.ui.practice;
    setFrame({ tab: "practices", title: u.label + p.no, back: "#/practices" });
    var draft = Store.getDraft(p.no);
    var s = "<h2>" + R.rich(p.title) + "</h2>";
    if (p.startNote) s += '<p class="gentle">' + R.rich(p.startNote) + "</p>";
    s += "<h3>" + R.rich(u.aim) + "</h3><p>" + R.rich(p.aim) + "</p>";
    s += "<h3>" + R.rich(u.time) + "</h3><p>" + R.rich(p.time) + "</p>";
    if (p.caution) s += '<p class="gentle">' + R.rich(p.caution) + "</p>";
    s += "<details><summary>" + R.rich(u.showExample) + "</summary><p>" + R.rich(p.example) + "</p></details>";
    s += '<a class="btn btn-main" href="#/practice/' + p.no + '/1">' + R.rich(u.start) + "</a>";
    if (hasValues(draft.values)) {
      s += '<p class="muted small">' + R.rich(u.draftNote) + "</p>";
      s += '<button type="button" class="btn btn-quiet" id="clear-draft">' + R.rich(u.clearDraft) + "</button>";
    }
    show(s);
    var clear = document.getElementById("clear-draft");
    if (clear) clear.addEventListener("click", function () {
      if (confirm(u.confirmClear)) {
        Store.clearDraft(p.no);
        viewPracticeIntro(p);
      }
    });
  }

  function viewPracticeStep(p, n) {
    var u = C.ui.practice;
    var total = p.steps.length;
    if (n < 1 || n > total) { location.hash = "#/practice/" + p.no; return; }
    var st = p.steps[n - 1];
    var draft = Store.getDraft(p.no);
    var values = draft.values || (draft.values = {});

    setFrame({ tab: "practices", title: u.label + p.no + " " + u.stepOf + n + "/" + total, back: "#/practice/" + p.no });

    var bar = '<div class="progress" aria-hidden="true">';
    for (var i = 1; i <= total; i++) bar += '<span class="' + (i <= n ? "on" : "") + '"></span>';
    bar += "</div>";

    var s = bar + '<p class="step-text">' + R.rich(st.text) + "</p>";
    if (st.note) s += '<p class="muted small">' + R.rich(st.note) + "</p>";

    (st.fields || []).forEach(function (f) {
      var refText = f.ref ? (values[f.ref] || "").trim() : "";
      s += '<div class="field">' +
        (refText ? '<span class="ref">「' + R.rich(refText) + "」</span>" : "") +
        '<label for="f-' + R.esc(f.id) + '">' + R.rich(f.label) + "</label>" +
        '<textarea id="f-' + R.esc(f.id) + '" data-id="' + R.esc(f.id) + '" rows="2">' + R.esc(values[f.id] || "") + "</textarea>" +
      "</div>";
    });

    if (st.timer) s += '<div id="timer-slot"></div>';
    if (st.prayer) s += '<p class="prayer">' + R.rich(st.prayer) + "</p>";

    var prev = n > 1 ? "#/practice/" + p.no + "/" + (n - 1) : "#/practice/" + p.no;
    var next = n < total ? "#/practice/" + p.no + "/" + (n + 1) : "#/practice/" + p.no + "/end";
    s += '<div class="btn-row">' +
      '<a class="btn" href="' + prev + '">' + R.rich(u.back) + "</a>" +
      '<a class="btn btn-main" href="' + next + '">' + R.rich(n < total ? u.next : u.finish) + "</a>" +
    "</div>";

    var frag = R.html(s);
    var wrap = document.createElement("div");
    wrap.appendChild(frag);
    if (hasFields(p)) wrap.appendChild(R.copyBox(function () { return practiceMarkdown(p); }, C.ui));
    show(wrap);
    if (st.timer) document.getElementById("timer-slot").appendChild(R.timer(st.timer, C.ui));

    view.querySelectorAll("textarea[data-id]").forEach(function (ta) {
      ta.addEventListener("input", function () {
        var d = Store.getDraft(p.no);
        d.values = d.values || {};
        d.values[ta.dataset.id] = ta.value;
        Store.saveDraft(p.no, d);
      });
    });
  }

  function viewPracticeEnd(p) {
    var u = C.ui.practice;
    setFrame({ tab: "practices", title: u.label + p.no + " " + u.endTitle, back: "#/practice/" + p.no + "/" + p.steps.length });
    var s = "<h2>" + R.rich(p.title) + "</h2>" +
      '<p class="muted">' + R.rich(u.endNote) + "</p>" +
      "<h3>" + R.rich(u.insight) + "</h3>" +
      '<p class="point">' + R.rich(p.insight) + "</p>" +
      "<h3>" + R.rich(u.example) + "</h3><p>" + R.rich(p.example) + "</p>";
    if (p.acimNote || (p.acim && p.acim.length)) s += "<h3>" + R.rich(u.acim) + "</h3>";
    if (p.acimNote) s += "<p>" + R.rich(p.acimNote) + "</p>";
    (p.acim || []).forEach(function (ref) { s += R.acimBlock(ref, C.acim, C.ui); });

    var d0 = Store.getDraft(p.no);
    s += '<div class="field"><label for="seen">' + R.rich(u.seenLabel) + "</label>" +
      '<textarea id="seen" rows="3">' + R.esc(d0.seen || "") + "</textarea></div>" +
      '<label class="check-row"><input type="checkbox" id="blind"' + (d0.blind ? " checked" : "") + "> " +
        R.rich(C.ui.records.blind) + "</label>" +
      '<button type="button" class="btn btn-main" id="save-record">' + R.rich(u.saveRecord) + "</button>" +
      '<p class="copy-msg" id="save-msg" role="status" aria-live="polite"></p>';

    var wrap = document.createElement("div");
    wrap.appendChild(R.html(s));
    if (hasFields(p)) wrap.appendChild(R.copyBox(function () { return practiceMarkdown(p); }, C.ui));
    wrap.appendChild(R.html(
      '<button type="button" class="btn" id="again">' + R.rich(u.again) + "</button>" +
      '<a class="btn btn-quiet" href="#/practices">' + R.rich(u.toList) + "</a>"
    ));
    show(wrap);

    function keepEnd() {
      var d = Store.getDraft(p.no);
      d.seen = document.getElementById("seen").value;
      d.blind = document.getElementById("blind").checked;
      Store.saveDraft(p.no, d);
    }
    document.getElementById("seen").addEventListener("input", keepEnd);
    document.getElementById("blind").addEventListener("change", keepEnd);
    document.getElementById("save-record").addEventListener("click", function () {
      var d = Store.getDraft(p.no);
      var fields = practiceFields(p, d.values || {});
      var text = (document.getElementById("seen").value || "").trim();
      var blind = document.getElementById("blind").checked;
      var msg = document.getElementById("save-msg");
      if (!text && !blind && !fields.length) { msg.textContent = C.ui.records.emptyText; return; }
      Store.addRecord({ no: p.no, text: text, blind: blind, from: "practice", fields: fields });
      Store.clearDraft(p.no);
      document.getElementById("seen").value = "";
      document.getElementById("blind").checked = false;
      msg.textContent = u.savedRecord;
    });

    document.getElementById("again").addEventListener("click", function () {
      var d = Store.getDraft(p.no);
      if ((hasValues(d.values) || (d.seen || "").trim()) &&
          !confirm(u.confirmAgain)) {
        return;
      }
      Store.clearDraft(p.no);
      location.hash = "#/practice/" + p.no + "/1";
    });
  }

  /* =======================================================
     一秒後の問い
     ======================================================= */
  function viewPause() {
    var u = C.ui.pause;
    setFrame({ title: " ", back: "#/home" });
    show(
      '<div class="pause-view">' +
        '<p class="pause-q">' + R.rich(u.question) + "</p>" +
        '<div class="breath" aria-hidden="true"><span></span></div>' +
        '<div class="pause-memo" id="pause-memo" hidden>' +
          '<textarea id="pause-text" rows="2" aria-label="' + R.esc(u.memo) + '" placeholder="' + R.esc(u.memoPlaceholder) + '"></textarea>' +
          '<button type="button" class="btn btn-main" id="pause-save">' + R.rich(u.memoSave) + "</button>" +
        "</div>" +
        '<p class="copy-msg" id="pause-msg" role="status" aria-live="polite"></p>' +
        '<div class="btn-row">' +
          '<a class="btn" href="#/home">' + R.rich(u.close) + "</a>" +
          '<button type="button" class="btn" id="pause-open-memo">' + R.rich(u.memo) + "</button>" +
        "</div>" +
      "</div>"
    );
    document.getElementById("pause-open-memo").addEventListener("click", function () {
      document.getElementById("pause-memo").hidden = false;
      this.hidden = true;
      document.getElementById("pause-text").focus();
    });
    document.getElementById("pause-save").addEventListener("click", function () {
      var ta = document.getElementById("pause-text");
      var v = ta.value.trim();
      if (!v) { ta.focus(); return; }
      Store.addRecord({ no: null, text: v, blind: false, from: "pause", fields: [] });
      ta.value = "";
      document.getElementById("pause-memo").hidden = true;
      document.getElementById("pause-open-memo").hidden = false;
      document.getElementById("pause-msg").textContent = u.memoSaved;
    });
  }

  /* =======================================================
     記録(今日、見えたこと)・自己点検・設定
     ======================================================= */
  var recFilter = null;

  function recordMarkdown(r) {
    var u = C.ui.records;
    var p = r.no ? findPractice(r.no) : null;
    var head = "### " + R.stamp(new Date(r.t));
    if (p) head += " " + C.ui.practice.label + p.no + " " + p.title;
    else if (r.from === "pause") head += " " + u.fromPause;
    var out = [head];
    (r.fields || []).forEach(function (f) { out.push("- " + f.k + "：" + String(f.v).replace(/\n/g, "\n  ")); });
    if (r.blind) out.push(u.blind);
    if (r.text) out.push(r.text);
    return out.join("\n");
  }

  function practiceChips(name, selected, withAll) {
    var u = C.ui.records;
    var s = '<div class="chips" role="radiogroup">';
    var first = withAll ? u.filterAll : u.none;
    s += '<label class="chip"><input type="radio" name="' + name + '" value=""' + (selected == null ? " checked" : "") + "><span>" + R.rich(first) + "</span></label>";
    C.practices.practices.forEach(function (p) {
      s += '<label class="chip"><input type="radio" name="' + name + '" value="' + p.no + '"' + (selected == p.no ? " checked" : "") +
        ' aria-label="' + R.esc(C.ui.practice.label + p.no + " " + p.title) + '"><span>' + p.no + "</span></label>";
    });
    return s + "</div>";
  }

  function viewRecords() {
    var u = C.ui.records;
    setFrame({ tab: "records", title: u.title });
    var draft = Store.get("draft.write", { text: "", no: null, blind: false });

    var all = Store.getRecords();
    var list = all.filter(function (r) { return recFilter == null || r.no == recFilter; });

    var s =
      '<div class="field"><label for="w-text">' + R.rich(u.formLabel) + "</label>" +
      '<textarea id="w-text" rows="3" placeholder="' + R.esc(u.placeholder) + '">' + R.esc(draft.text) + "</textarea></div>" +
      '<p class="muted small">' + R.rich(u.practiceLabel) + "</p>" + practiceChips("w-no", draft.no, false) +
      '<label class="check-row"><input type="checkbox" id="w-blind"' + (draft.blind ? " checked" : "") + "> " + R.rich(u.blind) + "</label>" +
      '<p class="muted small">' + R.rich(u.blindNote) + "</p>" +
      '<button type="button" class="btn btn-main" id="w-save">' + R.rich(u.save) + "</button>" +
      '<p class="copy-msg" id="w-msg" role="status" aria-live="polite"></p>';

    if (all.length) s += '<hr class="sep">' + practiceChips("f-no", recFilter, true);

    if (!all.length) s += '<p class="muted">' + R.rich(u.empty) + "</p>";
    else if (!list.length) s += '<p class="muted">' + R.rich(u.emptyFilter) + "</p>";

    s += '<div id="rec-list">' + list.map(function (r) {
      var p = r.no ? findPractice(r.no) : null;
      var tags = [];
      if (p) tags.push(C.ui.practice.label + p.no);
      if (r.from === "pause") tags.push(u.fromPause);
      if (r.blind) tags.push(u.blind);
      return '<div class="rec" data-id="' + R.esc(r.id) + '">' +
        '<p class="rec-meta">' + R.esc(R.stamp(new Date(r.t))) + (tags.length ? "　" + R.rich(tags.join("・")) : "") + "</p>" +
        ((r.fields || []).length ? '<p class="rec-fields">' + r.fields.map(function (f) { return R.rich(f.k) + "：" + R.rich(f.v); }).join("<br>") + "</p>" : "") +
        (r.text ? '<p class="rec-text">' + R.rich(r.text) + "</p>" : "") +
        '<div class="rec-acts">' +
          '<button type="button" data-a="edit">' + R.rich(u.edit) + "</button>" +
          '<button type="button" data-a="del">' + R.rich(u.delete) + "</button>" +
        "</div>" +
      "</div>";
    }).join("") + "</div>";

    var wrap = document.createElement("div");
    wrap.appendChild(R.html(s));
    if (list.length) {
      var copyUi = Object.assign({}, C.ui, { copy: Object.assign({}, C.ui.copy, { button: u.copyAll }) });
      wrap.appendChild(R.copyBox(function () { return list.map(recordMarkdown).join("\n\n") + "\n"; }, copyUi));
    }
    show(wrap);

    function keep() {
      var no = view.querySelector('input[name="w-no"]:checked');
      Store.set("draft.write", {
        text: document.getElementById("w-text").value,
        no: no && no.value ? +no.value : null,
        blind: document.getElementById("w-blind").checked
      });
    }
    document.getElementById("w-text").addEventListener("input", keep);
    document.getElementById("w-blind").addEventListener("change", keep);
    view.querySelectorAll('input[name="w-no"]').forEach(function (i) { i.addEventListener("change", keep); });

    document.getElementById("w-save").addEventListener("click", function () {
      keep();
      var d = Store.get("draft.write", {});
      var text = (d.text || "").trim();
      if (!text && !d.blind) { document.getElementById("w-msg").textContent = u.emptyText; return; }
      Store.addRecord({ no: d.no || null, text: text, blind: !!d.blind, from: "write", fields: [] });
      Store.remove("draft.write");
      viewRecords();
      document.getElementById("w-msg").textContent = u.saved;
    });

    view.querySelectorAll('input[name="f-no"]').forEach(function (i) {
      i.addEventListener("change", function () { recFilter = i.value ? +i.value : null; viewRecords(); });
    });

    view.querySelectorAll(".rec").forEach(function (el) {
      var id = el.dataset.id;
      el.querySelector('[data-a="del"]').addEventListener("click", function () {
        if (confirm(u.confirmDelete)) { Store.removeRecord(id); viewRecords(); }
      });
      el.querySelector('[data-a="edit"]').addEventListener("click", function () { editRecord(el, id); });
    });
  }

  function editRecord(el, id) {
    var u = C.ui.records;
    var r = Store.getRecords().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var s = '<p class="rec-meta">' + R.esc(R.stamp(new Date(r.t))) + "</p>";
    (r.fields || []).forEach(function (f, i) {
      s += '<div class="field"><label for="e-f' + i + '">' + R.rich(f.k) + "</label>" +
        '<textarea id="e-f' + i + '" data-i="' + i + '" rows="2">' + R.esc(f.v) + "</textarea></div>";
    });
    s += '<div class="field"><label for="e-text">' + R.rich(u.formLabel) + "</label>" +
      '<textarea id="e-text" rows="3">' + R.esc(r.text) + "</textarea></div>" +
      '<p class="muted small">' + R.rich(u.practiceLabel) + "</p>" + practiceChips("e-no", r.no, false) +
      '<label class="check-row"><input type="checkbox" id="e-blind"' + (r.blind ? " checked" : "") + "> " + R.rich(u.blind) + "</label>" +
      '<div class="btn-row">' +
        '<button type="button" class="btn" id="e-cancel">' + R.rich(u.cancel) + "</button>" +
        '<button type="button" class="btn btn-main" id="e-save">' + R.rich(u.saveEdit) + "</button>" +
      "</div>";
    el.innerHTML = "";
    el.appendChild(R.html(s));
    el.querySelector("#e-cancel").addEventListener("click", viewRecords);
    el.querySelector("#e-save").addEventListener("click", function () {
      var fields = (r.fields || []).map(function (f, i) {
        return { k: f.k, v: el.querySelector('[data-i="' + i + '"]').value.trim() };
      }).filter(function (f) { return f.v; });
      var no = el.querySelector('input[name="e-no"]:checked');
      Store.updateRecord(id, {
        text: el.querySelector("#e-text").value.trim(),
        blind: el.querySelector("#e-blind").checked,
        no: no && no.value ? +no.value : null,
        fields: fields
      });
      viewRecords();
    });
    el.querySelector("#e-text").focus();
  }

  function viewCheck() {
    setFrame({ title: C.checklist.title, back: "#/home" });
    var s = '<p class="gentle">' + R.rich(C.checklist.lead) + "</p>";
    s += C.checklist.items.map(function (it) {
      return '<div class="card"><p class="card-text">' + R.rich(it.text) + "</p></div>";
    }).join("");
    s += '<p class="muted small">' + R.rich(C.ui.check.pending) + "</p>";
    show(s);
  }

  function viewSettings() {
    setFrame({ title: C.ui.settings.title, back: "#/home" });
    show(
      '<p class="muted">' + R.rich(C.ui.settings.pending) + "</p>" +
      '<p class="gentle">' + R.rich(C.ui.safety.full) + "</p>" +
      '<a class="btn" href="#/sources">' + R.rich(C.sources.title) + "</a>"
    );
  }

  function viewSources() {
    var src = C.sources;
    setFrame({ title: src.title, back: "#/home" });
    function links(list) {
      return "<ul>" + list.map(function (l) {
        return '<li><a href="' + R.esc(l.url) + '" target="_blank" rel="noopener">' + R.esc(l.text) + "</a></li>";
      }).join("") + "</ul>";
    }
    var k = src.krishnamurti, a = src.acim;
    show(
      "<h2>" + R.rich(k.heading) + "</h2>" +
      '<p class="point">' + R.rich(k.summary) + "</p>" +
      '<p class="muted small">' + R.rich(k.note) + "</p>" + links(k.links) +
      "<h2>" + R.rich(a.heading) + "</h2>" +
      '<p class="muted small">' + R.rich(a.note) + "</p>" + links(a.links) +
      '<p class="muted small">' + R.rich(a.copyright) + "</p>"
    );
  }

  /* =======================================================
     どの画面を出すか
     ======================================================= */
  function route() {
    R.stopTimers();
    var parts = (location.hash || "#/home").replace(/^#\/?/, "").split("/");
    var page = parts[0] || "home";
    switch (page) {
      case "home": return viewHome();
      case "guide": return parts[1] ? viewGuideChapter(parts[1]) : viewGuideList();
      case "practices": return viewPracticeList();
      case "practice": {
        var p = findPractice(parts[1]);
        if (!p) return viewPracticeList();
        if (!parts[2]) return viewPracticeIntro(p);
        if (parts[2] === "end") return viewPracticeEnd(p);
        return viewPracticeStep(p, parseInt(parts[2], 10));
      }
      case "pause": return viewPause();
      case "records": return viewRecords();
      case "check": return viewCheck();
      case "settings": return viewSettings();
      case "sources": return viewSources();
      default: return viewHome();
    }
  }

  /* ---- はじまり ---- */
  loadContent().then(function () {
    var labels = document.querySelectorAll("#tabs a");
    for (var i = 0; i < labels.length; i++) {
      labels[i].querySelector(".tab-label").textContent = C.ui.tabs[labels[i].dataset.tab];
    }
    if (!Store.available()) {
      var note = document.getElementById("storage-note");
      note.textContent = C.ui.storageUnavailable;
      note.hidden = false;
    }
    window.addEventListener("hashchange", route);
    route();
  }).catch(function () {
    view.innerHTML = "<p>文章を読みこめませんでした。ページを開き直してください。</p>";
  });
})();
