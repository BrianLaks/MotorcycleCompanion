/* =========================================================================
   DESMO SERVICE COMPANION — app logic.
   Reference data comes from window.DB (data/*.js).
   User data lives in window.Store (js/store.js).
   ========================================================================= */
(function () {
"use strict";

const DB = window.DB, Store = window.Store;

/* ---------------- helpers ---------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = x => { const n = parseFloat(x); return isNaN(n) ? null : n; };
const fmtOdo = n => (n === null || n === undefined || n === "") ? "—" : Number(n).toLocaleString();
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
}
function daysBetween(a, b) { // b - a in days
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function snap(x, step) { return +(Math.round(x / step) * step).toFixed(2); }
function vbadge(v) { return v ? '<span class="ok">✓ verified</span>' : '<span class="verify">verify</span>'; }

/* ---------------- app state (UI only — not persisted user data) -------- */
const App = {
  tab: localStorage.getItem("desmo:tab") || "garage",
  bikeId: localStorage.getItem("desmo:bike") || null,
  wizard: null,          // {date, odometer, selected:Set} while picking
  completed: null,       // completion summary after finishing a session
};

function currentBike() {
  const bikes = Store.bikesForActiveUser();
  let b = bikes.find(x => x.id === App.bikeId);
  if (!b && bikes.length) { b = bikes[0]; App.bikeId = b.id; }
  return b || null;
}
function specFor(bike) {
  return bike ? DB.catalog.resolve(bike.modelId, bike.year) : null;
}
function scheduleFor(bike) {
  const spec = specFor(bike);
  return spec ? DB.schedules[spec.scheduleId] : null;
}

/* =========================================================================
   DUE-MAINTENANCE ENGINE
   ========================================================================= */
function intervalFor(item, unit) { return unit === "km" ? item.everyKm : item.everyMi; }

/* Status of one schedule item for a bike, evaluated at (atOdo, atDate). */
function dueStatus(bike, item, atOdo, atDate) {
  atOdo = atOdo ?? num(bike.odometer) ?? 0;
  atDate = atDate || todayStr();
  const last = Store.logForBike(bike.id, item.service)[0] || null;
  const dist = intervalFor(item, bike.unit);
  const soonDist = bike.unit === "km" ? 800 : 500;
  const soonDays = 30;

  if (!last) return { status: "unknown", last: null, dueOdo: null, dueDate: null };

  let dueOdo = null, dueDate = null, odoLeft = null, daysLeft = null;
  if (dist && last.odometer !== null && last.odometer !== undefined && last.odometer !== "") {
    dueOdo = Number(last.odometer) + dist;
    odoLeft = dueOdo - atOdo;
  }
  if (item.everyMonths && last.date) {
    dueDate = addMonths(last.date, item.everyMonths);
    daysLeft = daysBetween(atDate, dueDate);
  }

  let status = "ok";
  const overOdo = odoLeft !== null && odoLeft <= 0;
  const overDate = daysLeft !== null && daysLeft <= 0;
  const soonOdo = odoLeft !== null && odoLeft > 0 && odoLeft <= soonDist;
  const soonDate = daysLeft !== null && daysLeft > 0 && daysLeft <= soonDays;
  if (overOdo || overDate) status = "due";
  else if (soonOdo || soonDate) status = "soon";
  return { status, last, dueOdo, dueDate, odoLeft, daysLeft };
}

function dueSummary(bike) { // {due, soon, unknown}
  const sched = scheduleFor(bike);
  const out = { due: 0, soon: 0, unknown: 0 };
  if (!sched) return out;
  sched.items.forEach(item => {
    const st = dueStatus(bike, item).status;
    if (st === "due") out.due++;
    else if (st === "soon") out.soon++;
    else if (st === "unknown") out.unknown++;
  });
  return out;
}

const STATUS_PILL = {
  due:     { cls: "crit", txt: "DUE" },
  soon:    { cls: "warn", txt: "due soon" },
  ok:      { cls: "good", txt: "OK" },
  unknown: { cls: "na",  txt: "no record" },
};

/* =========================================================================
   APP BAR — user picker, storage chip, data buttons
   ========================================================================= */
function renderAppbar() {
  const users = Store.data.users;
  const sel = $("#userselect");
  sel.innerHTML = users.map(u =>
    `<option value="${esc(u.id)}" ${u.id === Store.data.activeUserId ? "selected" : ""}>${esc(u.name)}</option>`
  ).join("") + `<option value="__add">+ Add rider…</option>`;
  sel.style.display = users.length ? "" : "none";
}

function setStorageChip(mode, ok) {
  const el = $("#storagemode");
  if (!el) return;
  el.textContent = mode === "server" ? (ok ? "server · saved" : "server · SAVE FAILED") : (ok ? "this browser" : "local · SAVE FAILED");
  el.className = "storagemode " + (ok ? (mode === "server" ? "ok" : "") : "err");
  el.title = mode === "server"
    ? "User data is saved on the host via the built-in API."
    : "User data is saved in this browser only (localStorage). Use Export for backups.";
}

/* =========================================================================
   IDENTITY CARD + TABS
   ========================================================================= */
function renderIdCard() {
  const bike = currentBike();
  const box = $("#idcard");
  if (!bike) { box.style.display = "none"; return; }
  const s = specFor(bike);
  box.style.display = "";
  if (!s) {
    box.innerHTML = `<div class="cc"><div class="nm">${esc(bike.nickname || "Unknown model")}</div>
      <p class="note">Model "${esc(bike.modelId)}" is not in the catalog (data/catalog.js).</p></div>`;
    return;
  }
  box.innerHTML = `
    <div class="idcard-top">
      <div class="cc disp">
        <div class="yr">${esc(bike.year)} · ${esc(s.spark)}${bike.nickname ? ` · <span class="nick">${esc(bike.nickname)}</span>` : ""}</div>
        <div class="nm">${esc(s.name)}</div>
        <div class="cc-eng" style="font-size:13px;margin-top:2px">${esc(s.engine)}</div>
        <div class="disK"><span class="big mono">${fmtOdo(bike.odometer)}</span><span class="u">${esc(bike.unit)}</span></div>
      </div>
      <div class="facts">
        ${s.belt
          ? `<div class="fact"><div class="k">Timing belt ×2</div><div class="v mono">${esc(s.belt.part)}<br><small>${s.belt.teeth}T · ${esc(s.belt.width)}</small></div></div>`
          : `<div class="fact"><div class="k">Cam drive</div><div class="v" style="font-size:12.5px">Chain-driven — no timing belts</div></div>`}
        <div class="fact"><div class="k">Spark plugs ×${s.plugs.count}</div><div class="v">${esc(s.plugs.type)}<br><small>${esc(s.plugs.note)}</small></div></div>
        <div class="fact"><div class="k">Air filter</div><div class="v mono">${esc(s.airFilter.part)} ${s.airFilter.verified ? "" : '<span class="verify">verify</span>'}</div></div>
        <div class="fact"><div class="k">Oil filter</div><div class="v mono">${esc(s.oilFilter.part)}</div></div>
        <div class="fact"><div class="k">Shim family</div><div class="v" style="font-size:12.5px">${esc(s.shim)}</div></div>
      </div>
    </div>`;
}

const TABS = [
  ["garage",  "Garage"],
  ["due",     "Maintenance due"],
  ["service", "Start service"],
  ["teardown","3D teardown"],
  ["history", "History"],
  ["valves",  "Valves & shims"],
  ["belts",   "Belt tension"],
  ["reference","Reference"],
];
function renderTabs() {
  const bike = currentBike();
  const sum = bike ? dueSummary(bike) : { due: 0 };
  $("#tabs").innerHTML = TABS.map(([id, label]) => {
    const bubble = (id === "due" && sum.due > 0) ? `<span class="bubble">${sum.due}</span>` : "";
    return `<button role="tab" data-tab="${id}" aria-selected="${id === App.tab}">${label}${bubble}</button>`;
  }).join("");
}

/* =========================================================================
   PANEL — GARAGE
   ========================================================================= */
function panelGarage() {
  const users = Store.data.users;
  if (!users.length) {
    return `<section class="panel" data-panel="garage">
      <div class="card">
        <h2>Welcome — create the first rider</h2>
        <p class="note" style="margin-top:0">Riders own bikes; every bike keeps its own maintenance log. Add yourself first.</p>
        <div class="row-inline" style="margin-top:12px">
          <div class="field"><label>Rider name</label><input type="text" id="firstuser" class="mono" style="max-width:220px" placeholder="e.g. Brian"></div>
          <button class="iconbtn primary" id="firstuserbtn">Create rider</button>
        </div>
      </div>
    </section>`;
  }

  const bikes = Store.bikesForActiveUser();
  const cards = bikes.map(b => {
    const s = specFor(b);
    const sum = dueSummary(b);
    const chips =
      (sum.due ? `<span class="pill crit">${sum.due} due</span>` : "") +
      (sum.soon ? `<span class="pill warn">${sum.soon} soon</span>` : "") +
      (sum.unknown ? `<span class="pill na">${sum.unknown} no record</span>` : "") +
      (!sum.due && !sum.soon && !sum.unknown ? `<span class="pill good">all current</span>` : "");
    return `<div class="bikecard ${b.id === App.bikeId ? "selected" : ""}" data-selbike="${esc(b.id)}">
      <button class="rm" data-rmbike="${esc(b.id)}" title="Remove bike">✕</button>
      <div class="yr">${esc(b.year)} ${b.nickname ? "· " + esc(b.nickname) : ""}</div>
      <div class="nm">${esc(s ? s.name : b.modelId)}</div>
      <div class="odoline"><span class="o">${fmtOdo(b.odometer)}</span><span class="u">${esc(b.unit)}</span></div>
      <div class="duesum">${chips}</div>
    </div>`;
  }).join("");

  const modelOpts = Object.entries(DB.catalog.models).map(([id, m]) =>
    `<option value="${esc(id)}">${esc(m.name)}</option>`).join("");

  return `<section class="panel" data-panel="garage">
    <div class="card">
      <h2>${esc(Store.activeUser().name)}'s garage <span class="cnt">${bikes.length ? "· " + bikes.length : ""}</span></h2>
      ${bikes.length ? `<div class="garage-grid">${cards}</div>` : `<p class="empty">No bikes yet — add the first one below.</p>`}
    </div>
    <div class="card">
      <h2>Add a motorcycle</h2>
      <div class="row-inline">
        <div class="field"><label>Model</label><select id="nb_model" class="inp">${modelOpts}</select></div>
        <div class="field"><label>Year</label><select id="nb_year" class="inp"></select></div>
        <div class="field"><label>Nickname (optional)</label><input type="text" id="nb_nick" style="max-width:150px" placeholder="e.g. Rosso"></div>
        <div class="field"><label>Odometer</label><input type="number" id="nb_odo" placeholder="0" min="0" step="1"></div>
        <div class="field"><label>Unit</label><select id="nb_unit" class="inp"><option value="mi">miles</option><option value="km">km</option></select></div>
        <button class="iconbtn primary" id="nb_add">Add to garage</button>
      </div>
      <p class="note" style="margin-top:10px">A model not listed? Add it to <span class="mono">data/catalog.js</span> — see the README.</p>
    </div>
  </section>`;
}

function wireGarage() {
  const fb = $("#firstuserbtn");
  if (fb) fb.addEventListener("click", () => {
    const name = ($("#firstuser").value || "").trim();
    if (!name) return alert("Enter a name first.");
    const u = { id: Store.uid(), name };
    Store.data.users.push(u);
    Store.data.activeUserId = u.id;
    Store.save(); renderAll();
  });

  const modelSel = $("#nb_model");
  if (modelSel) {
    const fillYears = () => {
      const m = DB.catalog.models[modelSel.value];
      $("#nb_year").innerHTML = (m ? m.years : []).map(y =>
        `<option value="${y}" ${y === (m && m.defaultYear) ? "selected" : ""}>${y}</option>`).join("");
    };
    modelSel.addEventListener("change", fillYears);
    fillYears();
    $("#nb_add").addEventListener("click", () => {
      const bike = {
        id: Store.uid(), userId: Store.data.activeUserId,
        modelId: modelSel.value, year: Number($("#nb_year").value),
        nickname: ($("#nb_nick").value || "").trim(), vin: "",
        unit: $("#nb_unit").value, odometer: num($("#nb_odo").value) ?? 0,
        addedAt: todayStr(),
      };
      Store.data.bikes.push(bike);
      App.bikeId = bike.id; localStorage.setItem("desmo:bike", bike.id);
      Store.save(); renderAll();
    });
  }

  $$("[data-selbike]").forEach(el => el.addEventListener("click", e => {
    if (e.target.closest("[data-rmbike]")) return;
    App.bikeId = el.dataset.selbike;
    localStorage.setItem("desmo:bike", App.bikeId);
    renderAll();
  }));
  $$("[data-rmbike]").forEach(el => el.addEventListener("click", () => {
    const bike = Store.bike(el.dataset.rmbike);
    if (!bike) return;
    const n = Store.logForBike(bike.id).length;
    if (!confirm(`Remove ${bike.nickname || bike.modelId} and its ${n} log entr${n === 1 ? "y" : "ies"}? This can't be undone.`)) return;
    Store.data.bikes = Store.data.bikes.filter(b => b.id !== bike.id);
    Store.data.log = Store.data.log.filter(e2 => e2.bikeId !== bike.id);
    Store.data.sessions = Store.data.sessions.filter(s => s.bikeId !== bike.id);
    delete Store.data.worksheets[bike.id];
    if (App.bikeId === bike.id) App.bikeId = null;
    Store.save(); renderAll();
  }));
}

/* =========================================================================
   PANEL — MAINTENANCE DUE
   ========================================================================= */
function panelDue() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("due");
  const sched = scheduleFor(bike);
  if (!sched) return `<section class="panel" data-panel="due"><div class="card"><p class="empty">No schedule found for this model.</p></div></section>`;

  const sum = dueSummary(bike);
  const banner = sum.due
    ? `<div class="duebanner"><b>⚠ ${sum.due} service item${sum.due > 1 ? "s" : ""} due</b> on this bike — start a service from the <b>Start service</b> tab.</div>`
    : `<div class="duebanner allgood"><b>✓ Nothing overdue.</b> ${sum.soon ? sum.soon + " item(s) coming up soon." : "All tracked items current."} ${sum.unknown ? sum.unknown + " item(s) have no record yet — backfill in History." : ""}</div>`;

  const rows = sched.items.map(item => {
    const svc = DB.services[item.service] || { name: item.service };
    const st = dueStatus(bike, item);
    const pill = STATUS_PILL[st.status];
    const interval = [
      intervalFor(item, bike.unit) ? fmtOdo(intervalFor(item, bike.unit)) + " " + bike.unit : null,
      item.everyMonths ? item.everyMonths + " mo" : null,
    ].filter(Boolean).join(" / ");
    const lastTxt = st.last
      ? `${esc(st.last.date || "—")} · ${fmtOdo(st.last.odometer)} ${esc(bike.unit)}`
      : '<span class="empty">no record</span>';
    const nextTxt = st.last
      ? [st.dueOdo !== null ? fmtOdo(st.dueOdo) + " " + bike.unit : null, st.dueDate].filter(Boolean).join(" or ")
      : "—";
    const leftTxt = st.status === "unknown" ? "—" :
      [st.odoLeft !== null ? (st.odoLeft <= 0 ? fmtOdo(-st.odoLeft) + " " + bike.unit + " over" : fmtOdo(st.odoLeft) + " " + bike.unit) : null,
       st.daysLeft !== null ? (st.daysLeft <= 0 ? (-st.daysLeft) + " d over" : st.daysLeft + " d") : null]
      .filter(Boolean).join(" · ") || "—";
    return `<tr>
      <td><b>${esc(svc.name)}</b>${item.note ? `<br><span class="note">${esc(item.note)}</span>` : ""}</td>
      <td class="mono">${interval} ${item.verify ? '<span class="verify">verify</span>' : ""}</td>
      <td class="mono">${lastTxt}</td>
      <td class="mono">${nextTxt}</td>
      <td class="mono">${leftTxt}</td>
      <td><span class="pill ${pill.cls}">${pill.txt}</span></td>
    </tr>`;
  }).join("");

  return `<section class="panel" data-panel="due">
    ${banner}
    <div class="card">
      <h2>Current odometer</h2>
      <div class="row-inline">
        <div class="field"><label>Odometer (${esc(bike.unit)})</label>
          <input type="number" id="due_odo" value="${esc(bike.odometer)}" min="0" step="1" style="max-width:130px"></div>
        <p class="note" style="margin:0;max-width:480px">Keep this current — every due calculation runs off it. It also auto-advances when you complete a service at a higher reading.</p>
      </div>
    </div>
    <div class="card">
      <h2>Schedule — ${esc(sched.label)}</h2>
      <div class="scroll"><table>
        <tr><th>Service</th><th>Interval</th><th>Last done</th><th>Next due</th><th>Remaining</th><th>Status</th></tr>
        ${rows}
      </table></div>
      <p class="note">${esc(sched.note || "")} Items marked <span class="verify">verify</span> should be confirmed against your owner's manual.</p>
    </div>
  </section>`;
}

function wireDue() {
  const odo = $("#due_odo");
  if (odo) odo.addEventListener("change", () => {
    const bike = currentBike(); if (!bike) return;
    bike.odometer = num(odo.value) ?? bike.odometer;
    Store.save(); renderAll();
  });
}

function panelNeedBike(panelId) {
  return `<section class="panel" data-panel="${panelId}">
    <div class="card"><p class="empty">No bike selected — add or pick one in the <b>Garage</b> tab.</p></div>
  </section>`;
}

/* =========================================================================
   PANEL — START SERVICE (wizard + active session)
   ========================================================================= */
/* Resolve the shared teardown for a set of services: union their needed
   access modules, pull in transitive deps, and topo-sort so dependencies
   come first (bodywork before tank, coolant drained before radiator, …). */
function resolveAccess(bike, serviceIds) {
  const mods = (DB.accessModules || {})[bike.modelId] || {};
  const needed = new Set();
  serviceIds.forEach(id => (DB.services[id]?.needs || []).forEach(m => needed.add(m)));
  let changed = true;
  while (changed) {
    changed = false;
    [...needed].forEach(m => (mods[m]?.needs || []).forEach(d => { if (!needed.has(d)) { needed.add(d); changed = true; } }));
  }
  const ordered = [];
  const visit = (m, stack) => {
    if (ordered.includes(m) || !mods[m]) return;
    if (stack[m]) return; stack[m] = true;
    (mods[m].needs || []).forEach(d => visit(d, stack));
    if (!ordered.includes(m)) ordered.push(m);
  };
  [...needed].forEach(m => visit(m, {}));
  return { mods, ordered };
}

/* Build the combined checklist: teardown ONCE (shared modules) → all work →
   reassembly ONCE (reverse). Overlapping services share the strip-down. */
function sessionSteps(session, bike) {
  const out = [];
  const { mods, ordered } = resolveAccess(bike, session.services);
  const hasAccess = ordered.length > 0;

  ordered.forEach(mid => {
    const m = mods[mid];
    (m.teardown || []).forEach((text, i) => out.push({ key: "td_" + mid + "_" + i, phase: "teardown", group: m.label, groupId: mid, text }));
  });
  session.services.forEach(svcId => {
    const svc = DB.services[svcId]; if (!svc) return;
    const usesAccess = (svc.needs || []).length > 0 && hasAccess;
    const list = usesAccess ? (svc.work || svc.steps || []) : (svc.steps || svc.work || []);
    list.forEach((text, i) => out.push({ key: "wk_" + svcId + "_" + i, phase: "work", group: svc.name, groupId: svcId, svcId, text }));
  });
  [...ordered].reverse().forEach(mid => {
    const m = mods[mid];
    (m.restore || []).forEach((text, i) => out.push({ key: "rs_" + mid + "_" + i, phase: "restore", group: m.label, groupId: mid, text }));
  });
  return out;
}

function panelService() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("service");
  const session = Store.activeSession(bike.id);

  if (App.completed) return panelServiceComplete(bike);
  if (session) return panelSessionActive(bike, session);
  return panelWizard(bike);
}

function panelWizard(bike) {
  const sched = scheduleFor(bike);
  const w = App.wizard || (App.wizard = {
    date: todayStr(),
    odometer: bike.odometer ?? 0,
    selected: null, // filled after first render from due items
  });

  // Evaluate due state at the wizard's date/odo
  const items = (sched ? sched.items : []).map(item => {
    const st = dueStatus(bike, item, num(w.odometer), w.date);
    return { item, st, svc: DB.services[item.service] || { name: item.service } };
  });
  if (!w.selected) {
    w.selected = new Set(items.filter(x => x.st.status === "due").map(x => x.item.service));
  }

  const pickRows = items.map(({ item, st, svc }) => {
    const pill = STATUS_PILL[st.status];
    const why = st.status === "unknown" ? "no record yet"
      : st.last ? `last: ${st.last.date || "?"} @ ${fmtOdo(st.last.odometer)} ${bike.unit}` : "";
    return `<li>
      <input type="checkbox" data-wizsvc="${esc(item.service)}" id="wz_${esc(item.service)}" ${w.selected.has(item.service) ? "checked" : ""}>
      <div class="meta">
        <label for="wz_${esc(item.service)}"><span class="t">${esc(svc.name)}</span></label>
        <div class="d">${esc(why)}</div>
      </div>
      <span class="pill ${pill.cls}">${pill.txt}</span>
    </li>`;
  }).join("");

  const wspec = specFor(bike);
  const inSchedule = new Set((sched ? sched.items : []).map(i => i.service));
  const extraRows = Object.entries(DB.services)
    .filter(([id, svc]) => !inSchedule.has(id) && (!svc.applies || svc.applies(wspec)))
    .map(([id, svc]) => `<li>
      <input type="checkbox" data-wizsvc="${esc(id)}" id="wz_${esc(id)}" ${w.selected.has(id) ? "checked" : ""}>
      <div class="meta"><label for="wz_${esc(id)}"><span class="t">${esc(svc.name)}</span></label></div>
      <span class="pill na">unscheduled</span>
    </li>`).join("");

  const nSel = w.selected.size;
  return `<section class="panel" data-panel="service">
    <div class="wizsteps">
      <div class="ws on">1 · When & mileage</div><div class="ws on">2 · What's due</div><div class="ws">3 · Work the checklist</div><div class="ws">4 · Logged</div>
    </div>
    <div class="card">
      <h2>Service session — ${esc(bike.year)} ${esc(specFor(bike) ? specFor(bike).name : bike.modelId)}</h2>
      <div class="row-inline">
        <div class="field"><label>Date</label><input type="date" id="wz_date" value="${esc(w.date)}"></div>
        <div class="field"><label>Odometer (${esc(bike.unit)})</label>
          <input type="number" id="wz_odo" value="${esc(w.odometer)}" min="0" step="1" style="max-width:130px"></div>
      </div>
      <p class="note" style="margin-top:8px">Due status below is evaluated at this date and mileage — items already due are pre-selected.</p>
    </div>
    <div class="card">
      <h2>Select the work to perform</h2>
      <ul class="svcpick">${pickRows}</ul>
      ${extraRows ? `<div class="subhead">Other / unscheduled work</div><ul class="svcpick">${extraRows}</ul>` : ""}
      <div class="row-inline" style="margin-top:16px">
        <button class="iconbtn primary" id="wz_start" ${nSel ? "" : "disabled"}>Start service (${nSel} item${nSel === 1 ? "" : "s"})</button>
      </div>
    </div>
  </section>`;
}

function panelSessionActive(bike, session) {
  const steps = sessionSteps(session, bike);
  const done = steps.filter(s => session.checks[s.key]).length;
  const pct = steps.length ? Math.round(done / steps.length * 100) : 0;
  const spec = specFor(bike);

  const byPhase = { teardown: [], work: [], restore: [] };
  steps.forEach(s => byPhase[s.phase].push(s));

  const stepLi = (s, i) => {
    const checked = !!session.checks[s.key];
    return `<li class="${checked ? "done" : ""}">
      <input type="checkbox" data-sesscheck="${esc(s.key)}" id="ck_${esc(s.key)}" ${checked ? "checked" : ""}>
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <label for="ck_${esc(s.key)}">${esc(s.text)}</label></li>`;
  };

  // teardown / reassembly: one card, grouped by access module
  const phaseCard = (title, phaseSteps, subtitle) => {
    if (!phaseSteps.length) return "";
    let inner = "", last = null, n = 0, ul = "";
    const flush = () => { if (ul) inner += `<ul class="steps">${ul}</ul>`; ul = ""; };
    phaseSteps.forEach(s => {
      if (s.group !== last) { flush(); inner += `<div class="subhead">${esc(s.group)}</div>`; last = s.group; }
      ul += stepLi(s, n++);
    });
    flush();
    return `<div class="card"><h2>${esc(title)}</h2>${subtitle ? `<p class="note" style="margin-top:0">${esc(subtitle)}</p>` : ""}${inner}</div>`;
  };

  // work: a card per service (parts + notes + video)
  const workBySvc = {};
  byPhase.work.forEach(s => { (workBySvc[s.groupId] = workBySvc[s.groupId] || []).push(s); });
  const workCards = session.services.filter(id => workBySvc[id]).map(svcId => {
    const svc = DB.services[svcId]; if (!svc) return "";
    let n = 0;
    const rows = workBySvc[svcId].map(s => stepLi(s, n++)).join("");
    const parts = (svc.partsFor ? svc.partsFor(spec) : []).map(p =>
      `<span class="shopchip">${esc(p.label)} — <b>${esc(p.part)}</b></span>`).join("");
    const vidQuery = svc.videoSearchFor ? svc.videoSearchFor(spec, bike)
      : (svc.videoSearch || ((spec ? `${bike.year} ${spec.name} ` : "motorcycle ") + svc.name));
    return `<div class="card">
      <h2 style="display:flex;align-items:center;gap:8px">${esc(svc.name)} — work${svc.resetIndicator ? ' <span class="verify" title="Dash service reminder should be reset after this">resets indicator</span>' : ""}
        <span style="flex:1"></span>
        <a class="iconbtn" style="text-transform:none;letter-spacing:0" href="${esc(ytSearchUrl(vidQuery))}" target="_blank" rel="noopener" title="Search YouTube for this job">▶ Video</a>
      </h2>
      ${svc.note ? `<p class="note" style="margin-top:0">${esc(svc.note)}</p>` : ""}
      ${parts ? `<div class="shoplist" style="margin-bottom:12px">${parts}</div>` : ""}
      <ul class="steps">${rows}</ul>
      <div class="field" style="margin-top:12px"><label>Notes for the log (parts used, measurements, anything odd)</label>
        <textarea rows="2" data-sessnote="${esc(svcId)}">${esc(session.notes[svcId] || "")}</textarea></div>
    </div>`;
  }).join("");

  const shared = byPhase.teardown.length > 0;
  const teardownCard = phaseCard("① Teardown — done once", byPhase.teardown,
    shared ? "Shared access for every job below — you strip the bike down a single time, not once per service." : null);
  const reassemblyCard = phaseCard("③ Reassembly — reverse order", byPhase.restore,
    shared ? "Everything goes back together once, in reverse of the teardown." : null);

  return `<section class="panel" data-panel="service">
    <div class="wizsteps">
      <div class="ws done">1 · When & mileage</div><div class="ws done">2 · What's due</div><div class="ws on">3 · Work the checklist</div><div class="ws">4 · Logged</div>
    </div>
    <div class="card">
      <h2>Session in progress — started ${esc(session.startedAt)}</h2>
      <div class="row-inline">
        <div class="field"><label>Service date</label><div class="mono">${esc(session.date)}</div></div>
        <div class="field"><label>Odometer</label><div class="mono">${fmtOdo(session.odometer)} ${esc(bike.unit)}</div></div>
        <div class="field"><label>Work items</label><div class="mono">${session.services.map(id => esc((DB.services[id] || {}).short || id)).join(" · ")}</div></div>
      </div>
      ${shared ? `<p class="note" style="margin-top:8px">${session.services.length} jobs combined into one teardown — overlapping access is merged so nothing is stripped and rebuilt twice.</p>` : ""}
      <div style="margin-top:14px">
        <div class="progline"><span class="pct" id="sess_pct">${pct}%</span><div class="progress" style="flex:1"><span id="sess_bar" style="width:${pct}%"></span></div></div>
        <p class="note" id="sess_progtxt">${done} of ${steps.length} steps complete</p>
      </div>
      <div class="row-inline" style="margin-top:8px">
        <button class="iconbtn primary" id="sess_complete">Complete service & write log</button>
        <button class="iconbtn danger" id="sess_abandon">Abandon session</button>
      </div>
    </div>
    ${teardownCard}
    ${byPhase.work.length ? `<div class="subhead" style="margin:6px 2px">② Work at access</div>` : ""}
    ${workCards}
    ${reassemblyCard}
  </section>`;
}

function panelServiceComplete(bike) {
  const c = App.completed;
  const svcNames = c.services.map(id => (DB.services[id] || { name: id }).name);
  const resets = c.resetIds.map(id => DB.resets[id]).filter(Boolean);
  const resetHtml = resets.map(r => `
    <div class="card">
      <h2>Reset the bike's service reminder ${vbadge(r.verified)}</h2>
      <p class="note" style="color:var(--ink)">${esc(r.summary)}</p>
      ${r.options.map(o => `<div class="resetopt"><div class="b"></div><div><div class="t">${esc(o.label)}</div><div class="d">${esc(o.detail)}</div></div></div>`).join("")}
      <p class="note" style="margin-top:10px">${esc(r.note)}</p>
    </div>`).join("");
  return `<section class="panel" data-panel="service">
    <div class="wizsteps">
      <div class="ws done">1 · When & mileage</div><div class="ws done">2 · What's due</div><div class="ws done">3 · Work the checklist</div><div class="ws on">4 · Logged</div>
    </div>
    <div class="duebanner allgood"><b>✓ Service logged.</b> ${svcNames.map(esc).join(" · ")} recorded for ${esc(c.date)} at ${fmtOdo(c.odometer)} ${esc(bike.unit)} — see the History tab.</div>
    ${resetHtml}
    <div class="card">
      <div class="row-inline">
        <button class="iconbtn primary" id="done_ok">Done</button>
        <button class="iconbtn" id="done_history">View history</button>
      </div>
    </div>
  </section>`;
}

function wireService() {
  const bike = currentBike(); if (!bike) return;
  const session = Store.activeSession(bike.id);

  // wizard
  const wd = $("#wz_date"), wo = $("#wz_odo");
  const reEval = () => {
    // Newly-due items join the selection; the user's own picks are kept.
    const w = App.wizard, sched = scheduleFor(bike);
    (sched ? sched.items : []).forEach(item => {
      if (dueStatus(bike, item, num(w.odometer), w.date).status === "due") w.selected.add(item.service);
    });
    reRenderPanel("service");
  };
  if (wd) wd.addEventListener("change", () => { App.wizard.date = wd.value || todayStr(); reEval(); });
  if (wo) wo.addEventListener("change", () => { App.wizard.odometer = num(wo.value) ?? App.wizard.odometer; reEval(); });
  $$("[data-wizsvc]").forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) App.wizard.selected.add(cb.dataset.wizsvc);
    else App.wizard.selected.delete(cb.dataset.wizsvc);
    reRenderPanel("service");
  }));
  const startBtn = $("#wz_start");
  if (startBtn) startBtn.addEventListener("click", () => {
    const w = App.wizard;
    if (!w.selected.size) return;
    Store.data.sessions.push({
      id: Store.uid(), bikeId: bike.id,
      startedAt: new Date().toLocaleString(),
      date: w.date, odometer: num(w.odometer) ?? 0,
      services: Array.from(w.selected),
      checks: {}, notes: {}, status: "active",
    });
    App.wizard = null;
    Store.save(); renderAll();
  });

  // active session
  if (session) {
    $$("[data-sesscheck]").forEach(cb => cb.addEventListener("change", () => {
      if (cb.checked) session.checks[cb.dataset.sesscheck] = true;
      else delete session.checks[cb.dataset.sesscheck];
      cb.closest("li").classList.toggle("done", cb.checked);
      const steps = sessionSteps(session, bike);
      const done = steps.filter(s => session.checks[s.key]).length;
      const pct = steps.length ? Math.round(done / steps.length * 100) : 0;
      const bar = $("#sess_bar"), pctEl = $("#sess_pct"), txt = $("#sess_progtxt");
      if (bar) bar.style.width = pct + "%";
      if (pctEl) pctEl.textContent = pct + "%";
      if (txt) txt.textContent = `${done} of ${steps.length} steps complete`;
      Store.save();
    }));
    $$("[data-sessnote]").forEach(ta => ta.addEventListener("input", () => {
      session.notes[ta.dataset.sessnote] = ta.value;
      Store.save();
    }));
    const ab = $("#sess_abandon");
    if (ab) ab.addEventListener("click", () => {
      if (!confirm("Abandon this session? Checklist progress will be discarded and nothing will be logged.")) return;
      Store.data.sessions = Store.data.sessions.filter(s => s.id !== session.id);
      Store.save(); renderAll();
    });
    const cp = $("#sess_complete");
    if (cp) cp.addEventListener("click", () => {
      const steps = sessionSteps(session, bike);
      const done = steps.filter(s => session.checks[s.key]).length;
      if (done < steps.length &&
          !confirm(`${steps.length - done} step(s) are unchecked. Log the service anyway?`)) return;
      completeSession(bike, session);
    });
  }

  const dOk = $("#done_ok");
  if (dOk) dOk.addEventListener("click", () => { App.completed = null; renderAll(); });
  const dHist = $("#done_history");
  if (dHist) dHist.addEventListener("click", () => { App.completed = null; App.tab = "history"; localStorage.setItem("desmo:tab", App.tab); renderAll(); });
}

function completeSession(bike, session) {
  const spec = specFor(bike);
  const ws = Store.worksheet(bike.id);
  const resetIds = new Set();

  session.services.forEach(svcId => {
    const svc = DB.services[svcId] || {};
    const entry = {
      id: Store.uid(), bikeId: bike.id, serviceId: svcId,
      date: session.date, odometer: session.odometer,
      notes: (session.notes[svcId] || "").trim(),
      source: "session",
    };
    // snapshot measurement worksheets into the record
    if (svcId === "desmo_valve") entry.snapshot = JSON.parse(JSON.stringify({ targets: ws.targets, valves: ws.valves }));
    if (svcId === "belts") entry.snapshot = JSON.parse(JSON.stringify({ belt: ws.belt }));
    Store.data.log.push(entry);
    if (svc.resetIndicator && spec && spec.resetId) resetIds.add(spec.resetId);
  });

  if (session.odometer !== null && Number(session.odometer) > Number(bike.odometer || 0)) {
    bike.odometer = Number(session.odometer);
  }
  Store.data.sessions = Store.data.sessions.filter(s => s.id !== session.id);
  App.completed = { services: session.services, resetIds: Array.from(resetIds), date: session.date, odometer: session.odometer };
  Store.save(); renderAll();
}

/* =========================================================================
   REPORTS — printable maintenance report + per-bike data export.
   The report opens as a self-contained document so it can be printed /
   saved as PDF and handed to a buyer, shop, or kept for records.
   ========================================================================= */
function downloadFile(name, text, mime) {
  const blob = new Blob([text], { type: mime || "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/\s+/g, "-");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function snapshotSummary(entry) {
  const s = entry.snapshot;
  if (!s) return "";
  if (s.valves) {
    const rows = (DB.valvePositions || []).map(v => {
      const d = s.valves[v.id] || {};
      if (!d.mo && !d.mc && !d.so && !d.sc) return null;
      return `${esc(v.head)} ${esc(v.name)} — open ${esc(d.mo || "—")}mm (shim ${esc(d.so || "—")}), close ${esc(d.mc || "—")}mm (shim ${esc(d.sc || "—")})`;
    }).filter(Boolean);
    if (!rows.length) return "";
    return `<div class="snap"><b>Valve clearances recorded</b> — targets open/close ${esc(s.targets.open)}/${esc(s.targets.close)} mm<br>${rows.join("<br>")}</div>`;
  }
  if (s.belt) {
    const b = s.belt, brand = (DB.beltBrands[b.brand] || {}).label || b.brand;
    return `<div class="snap"><b>Belt tension recorded</b> — Horizontal ${esc(b.h_new || "—")}→${esc(b.h_after || "—")} Hz, Vertical ${esc(b.v_new || "—")}→${esc(b.v_after || "—")} Hz (${esc(brand)})</div>`;
  }
  return "";
}

function reportCss() {
  return `*{box-sizing:border-box}
  body{font:14px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#17181B;margin:0;background:#fff}
  .mono{font-family:ui-monospace,"Cascadia Code",Consolas,monospace;font-variant-numeric:tabular-nums}
  .wrap{max-width:820px;margin:0 auto;padding:30px 30px 50px}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #B81D24;padding-bottom:12px}
  h1{font-size:22px;margin:0}h3{margin:22px 0 6px;font-size:14px}
  .sub{color:#5b5e66;font-size:11px;text-transform:uppercase;letter-spacing:.12em}
  .id{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#cfd1d6;border:1px solid #cfd1d6;margin:16px 0}
  .id .c{background:#fff;padding:9px 11px}
  .id .k{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5b5e66}
  .id .v{font-weight:600;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 9px;border-bottom:1px solid #cfd1d6;vertical-align:top}
  th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5b5e66}
  .snap{color:#5b5e66;font-size:12px;margin-top:3px}
  .sign{margin-top:34px;display:flex;gap:36px}
  .sign .l{flex:1;border-top:1px solid #17181B;padding-top:5px;font-size:11px;color:#5b5e66}
  .disc{color:#5b5e66;font-size:11px;margin-top:20px;border-top:1px solid #cfd1d6;padding-top:10px}
  .bar{background:#f1f1ee;border-bottom:1px solid #cfd1d6;padding:10px 30px;display:flex;gap:10px;align-items:center}
  .bar button{font:inherit;padding:7px 13px;border:1px solid #9DA0A8;border-radius:7px;background:#fff;cursor:pointer}
  .bar span{color:#5b5e66;font-size:12px}
  @media print{.bar{display:none}.wrap{padding:0 6px}}`;
}

function buildReportHtml(bike) {
  const spec = specFor(bike);
  const user = Store.activeUser();
  const entries = Store.logForBike(bike.id);
  const sum = dueSummary(bike);
  const title = `${bike.year} ${spec ? spec.name : bike.modelId}${bike.nickname ? ` “${bike.nickname}”` : ""}`;
  const statusLine = sum.due ? `${sum.due} item(s) currently due` : (sum.soon ? `Current — ${sum.soon} due soon` : "All tracked items current");
  const rows = entries.map(e => {
    const svc = DB.services[e.serviceId] || { name: e.serviceId };
    return `<tr>
      <td class="mono">${esc(e.date || "—")}</td>
      <td class="mono">${fmtOdo(e.odometer)}</td>
      <td><b>${esc(svc.name)}</b>${e.source === "manual" ? ' <span class="snap">(backfilled record)</span>' : ""}
        ${e.notes ? `<div class="snap">${esc(e.notes)}</div>` : ""}
        ${snapshotSummary(e)}</td>
    </tr>`;
  }).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Maintenance Report — ${esc(title)}</title><style>${reportCss()}</style></head><body>
    <div class="bar"><button onclick="window.print()">Print / Save as PDF</button>
      <span>Choose “Save as PDF” as the destination in the print dialog.</span></div>
    <div class="wrap">
      <header><div><h1>Maintenance Report</h1><div class="sub">${esc(title)}</div></div>
        <div style="text-align:right"><div class="sub">Generated</div><div class="mono">${esc(todayStr())}</div></div></header>
      <div class="id">
        <div class="c"><div class="k">Owner / Rider</div><div class="v">${esc(user ? user.name : "—")}</div></div>
        <div class="c"><div class="k">Model / Year</div><div class="v">${esc(spec ? spec.name : bike.modelId)} · ${esc(bike.year)}</div></div>
        <div class="c"><div class="k">Engine</div><div class="v">${esc(spec ? spec.engine : "—")}</div></div>
        <div class="c"><div class="k">VIN</div><div class="v mono">${esc(bike.vin || "—")}</div></div>
        <div class="c"><div class="k">Odometer</div><div class="v mono">${fmtOdo(bike.odometer)} ${esc(bike.unit)}</div></div>
        <div class="c"><div class="k">Status</div><div class="v">${esc(statusLine)}</div></div>
      </div>
      <h3>Service history — ${entries.length} record(s)</h3>
      ${entries.length
        ? `<table><thead><tr><th>Date</th><th>Odometer (${esc(bike.unit)})</th><th>Service performed</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="snap">No service records yet.</p>`}
      <div class="sign"><div class="l">Serviced by</div><div class="l">Signature</div><div class="l">Date</div></div>
      <div class="disc">Generated by Desmo Service Companion. Records are owner-entered; values drawn from community references may require confirmation against the official manufacturer manual. This report reflects the data recorded in the app as of the generation date.</div>
    </div></body></html>`;
}

function openReport(bike) {
  const html = buildReportHtml(bike);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const w = window.open(url, "_blank");
  if (!w) downloadFile(`maintenance-report-${bike.year}-${(specFor(bike) || {}).name || bike.modelId}.html`, html, "text/html");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function exportBikeData(bike) {
  const data = {
    app: "Desmo Service Companion", exportedAt: todayStr(),
    bike, spec: specFor(bike),
    log: Store.logForBike(bike.id),
    worksheet: Store.data.worksheets[bike.id] || null,
  };
  downloadFile(`maintenance-data-${bike.year}-${(specFor(bike) || {}).name || bike.modelId}.json`, JSON.stringify(data, null, 2), "application/json");
}

/* =========================================================================
   PANEL — HISTORY
   ========================================================================= */
function panelHistory() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("history");
  const entries = Store.logForBike(bike.id);

  const rows = entries.map(e => {
    const svc = DB.services[e.serviceId] || { name: e.serviceId };
    const snap = e.snapshot ? ' <span class="ok" title="Measurement snapshot stored">📐 snapshot</span>' : "";
    return `<tr>
      <td class="mono">${esc(e.date || "—")}</td>
      <td class="mono">${fmtOdo(e.odometer)}</td>
      <td><b>${esc(svc.name)}</b>${snap}</td>
      <td>${esc(e.notes || "")}${e.source === "manual" ? ' <span class="note">(backfilled)</span>' : ""}</td>
      <td><button class="iconbtn danger" data-rmlog="${esc(e.id)}" title="Delete entry">✕</button></td>
    </tr>`;
  }).join("");

  const svcOpts = Object.entries(DB.services).map(([id, s]) =>
    `<option value="${esc(id)}">${esc(s.name)}</option>`).join("");

  return `<section class="panel" data-panel="history">
    <div class="card">
      <h2 style="display:flex;align-items:center;gap:8px">Maintenance log <span class="cnt">${entries.length ? "· " + entries.length + " entries" : ""}</span>
        <span style="flex:1"></span>
        <button class="iconbtn" id="rpt_open" ${entries.length ? "" : "disabled"} title="Open a printable maintenance report (Save as PDF)">Maintenance report</button>
        <button class="iconbtn" id="rpt_data" ${entries.length ? "" : "disabled"} title="Export this bike's data + log as JSON">Export data</button>
      </h2>
      ${entries.length
        ? `<div class="scroll"><table><tr><th>Date</th><th>Odometer (${esc(bike.unit)})</th><th>Service</th><th>Notes</th><th></th></tr>${rows}</table></div>`
        : `<p class="empty">Nothing logged yet. Complete a service, or backfill past work below so due-tracking has a baseline.</p>`}
    </div>
    <div class="card">
      <h2>Backfill a past service</h2>
      <p class="note" style="margin-top:0">Enter work done before you started using this app — the due calculator needs a "last done" point for each item.</p>
      <div class="row-inline" style="margin-top:10px">
        <div class="field"><label>Service</label><select id="bf_svc" class="inp">${svcOpts}</select></div>
        <div class="field"><label>Date</label><input type="date" id="bf_date" value="${esc(todayStr())}"></div>
        <div class="field"><label>Odometer (${esc(bike.unit)})</label><input type="number" id="bf_odo" min="0" step="1" style="max-width:120px"></div>
        <div class="field" style="flex:1;min-width:180px"><label>Notes</label><input type="text" id="bf_notes" style="max-width:none;width:100%" placeholder="shop, parts, etc."></div>
        <button class="iconbtn primary" id="bf_add">Add entry</button>
      </div>
    </div>
  </section>`;
}

function wireHistory() {
  const bike = currentBike(); if (!bike) return;
  const ro = $("#rpt_open"); if (ro) ro.addEventListener("click", () => openReport(bike));
  const rd = $("#rpt_data"); if (rd) rd.addEventListener("click", () => exportBikeData(bike));
  const add = $("#bf_add");
  if (add) add.addEventListener("click", () => {
    Store.data.log.push({
      id: Store.uid(), bikeId: bike.id,
      serviceId: $("#bf_svc").value,
      date: $("#bf_date").value || todayStr(),
      odometer: num($("#bf_odo").value),
      notes: ($("#bf_notes").value || "").trim(),
      source: "manual",
    });
    Store.save(); renderAll();
  });
  $$("[data-rmlog]").forEach(btn => btn.addEventListener("click", () => {
    if (!confirm("Delete this log entry?")) return;
    Store.data.log = Store.data.log.filter(e => e.id !== btn.dataset.rmlog);
    Store.save(); renderAll();
  }));
}

/* =========================================================================
   PANEL — VALVES & SHIMS (per garage bike, worksheet persisted in Store)
   ========================================================================= */
function panelValves() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("valves");
  const s = specFor(bike);
  if (!s) return `<section class="panel" data-panel="valves"><div class="card"><p class="empty">Model not in catalog.</p></div></section>`;
  const c = s.clearance;
  // The opener/closer shim calculator is desmodromic-specific. Conventional
  // (shim-under-bucket) engines like the KTM LC8 don't have closer shims.
  if (s.valveType && s.valveType !== "desmo") {
    return `<section class="panel" data-panel="valves"><div class="card">
      <h2>Valves & shims</h2>
      <p class="note" style="color:var(--ink);margin-top:0">This engine uses <b>conventional shim-under-bucket</b>
      valves (${esc(s.shim)}) — not the Ducati desmodromic system, so the opener/closer shim calculator here
      doesn't apply.</p>
      <div class="rule-box"><b>Conventional shim rule:</b> measure intake + exhaust clearance against spec
      (typical intake <span class="mono">${c.openMin}–${c.openMax}</span>, exhaust
      <span class="mono">${c.closeMin}–${c.closeMax}</span> mm — <span class="verify">verify</span>).
      A <u>thicker</u> shim <i>reduces</i> clearance. Record measurements in the service notes for now;
      a dedicated conventional-shim worksheet is on the roadmap.</div>
    </div></section>`;
  }
  const ws = Store.worksheet(bike.id);

  const rows = DB.valvePositions.map(v => {
    const d = ws.valves[v.id] || { mo: "", mc: "", so: "", sc: "" };
    return `<tr data-valve="${v.id}">
      <td><b>${esc(v.head)}</b><br><span class="note">${esc(v.name)}</span></td>
      <td><input type="number" step="0.01" data-vf="mo" value="${esc(d.mo)}" placeholder="mm"></td>
      <td><input type="number" step="0.05" data-vf="so" value="${esc(d.so)}" placeholder="mm"></td>
      <td class="mono out-o">—</td>
      <td style="border-right:1px solid var(--hair)"><span class="pill na stat-o">—</span></td>
      <td><input type="number" step="0.01" data-vf="mc" value="${esc(d.mc)}" placeholder="mm"></td>
      <td><input type="number" step="0.05" data-vf="sc" value="${esc(d.sc)}" placeholder="mm"></td>
      <td class="mono out-c">—</td>
      <td><span class="pill na stat-c">—</span></td>
    </tr>`;
  }).join("");

  return `<section class="panel" data-panel="valves">
    <div class="card">
      <h2>Target clearances <span class="verify">verify</span></h2>
      <div class="row-inline">
        <div class="field"><label>Opener target (mm)</label>
          <input type="number" step="0.01" id="tgtOpen" value="${esc(ws.targets.open)}"></div>
        <div class="field"><label>Closer target (mm)</label>
          <input type="number" step="0.01" id="tgtClose" value="${esc(ws.targets.close)}"></div>
        <p class="note" style="max-width:420px;margin:0">
          Typical Testastretta range — openers <b class="mono">${c.openMin}–${c.openMax}</b>,
          closers <b class="mono">${c.closeMin}–${c.closeMax}</b> mm. Confirm against your manual.</p>
      </div>
      <div class="rule-box">
        <b>Shim rule (desmo):</b> a thicker <u>opener</u> <i>reduces</i> opening clearance;
        a thicker <u>closer</u> <i>increases</i> closing clearance.<br>
        <code>new opener = current + (measured − target)</code> ·
        <code>new closer = current − (measured − target)</code>, snapped to 0.05 mm.
      </div>
    </div>
    <div class="card">
      <h2>Clearance worksheet & shim calculator</h2>
      <div class="scroll"><table>
        <tr>
          <th>Valve</th>
          <th>Open meas.</th><th>Open shim now</th><th>→ New open</th><th>Status</th>
          <th>Close meas.</th><th>Close shim now</th><th>→ New close</th><th>Status</th>
        </tr>
        ${rows}
      </table></div>
      <p class="note">Values save to this bike automatically. Completing a <b>Desmo service</b> session snapshots this whole worksheet into the log entry.</p>
    </div>
    <div class="card">
      <h2>Shim shopping list <span class="cnt" id="shopcount"></span></h2>
      <div class="shoplist" id="shoplist"></div>
      <p class="note" style="margin-top:12px">This platform uses the <b>${esc(s.shim)}</b> shim family. Verify by micing your removed shims.</p>
      <div class="subhead">Where to buy</div>
      <ul class="vendorlist">${DB.vendors.map(v => `<li><b>${esc(v[0])}</b> — ${esc(v[1])}</li>`).join("")}</ul>
    </div>
  </section>`;
}

function wireValves() {
  const bike = currentBike(); if (!bike || !specFor(bike)) return;
  const ws = Store.worksheet(bike.id);
  const to = $("#tgtOpen"), tc = $("#tgtClose");
  const recomputeAll = () => { DB.valvePositions.forEach(v => recomputeValve(v.id)); recomputeShopping(); };
  if (to) to.addEventListener("input", e => { ws.targets.open = num(e.target.value) ?? ws.targets.open; Store.save(); recomputeAll(); });
  if (tc) tc.addEventListener("input", e => { ws.targets.close = num(e.target.value) ?? ws.targets.close; Store.save(); recomputeAll(); });
  $$("tr[data-valve]").forEach(tr => {
    const id = tr.dataset.valve;
    tr.querySelectorAll("input[data-vf]").forEach(inp => {
      inp.addEventListener("input", e => {
        if (!ws.valves[id]) ws.valves[id] = { mo: "", mc: "", so: "", sc: "" };
        ws.valves[id][e.target.dataset.vf] = e.target.value;
        Store.save(); recomputeValve(id); recomputeShopping();
      });
    });
  });
  recomputeAll();
}

function clearanceStatus(val, min, max) {
  if (val === null) return { cls: "na", txt: "—" };
  if (val < min) return { cls: "crit", txt: "tight" };
  if (val > max) return { cls: "crit", txt: "loose" };
  return { cls: "good", txt: "in spec" };
}

function recomputeValve(id) {
  const bike = currentBike(); if (!bike) return;
  const s = specFor(bike); if (!s) return;
  const c = s.clearance, ws = Store.worksheet(bike.id), G = DB.shimGeometry;
  const tr = document.querySelector(`tr[data-valve="${id}"]`);
  if (!tr) return;
  const d = ws.valves[id] || {};
  const mo = num(d.mo), so = num(d.so), mc = num(d.mc), sc = num(d.sc);

  const soStat = clearanceStatus(mo, c.openMin, c.openMax);
  tr.querySelector(".stat-o").className = "pill " + soStat.cls + " stat-o";
  tr.querySelector(".stat-o").textContent = soStat.txt;
  const outO = tr.querySelector(".out-o");
  if (mo !== null && so !== null) {
    const newO = snap(so + (mo - ws.targets.open), G.openStep);
    if (Math.abs(newO - so) < 0.001) outO.innerHTML = '<span class="note">no change</span>';
    else {
      const oor = (newO < G.openRange[0] || newO > G.openRange[1]) ? ' <span class="verify">range</span>' : "";
      outO.innerHTML = `<b>${newO.toFixed(2)}</b>${oor}`;
    }
  } else outO.innerHTML = "—";

  const scStat = clearanceStatus(mc, c.closeMin, c.closeMax);
  tr.querySelector(".stat-c").className = "pill " + scStat.cls + " stat-c";
  tr.querySelector(".stat-c").textContent = scStat.txt;
  const outC = tr.querySelector(".out-c");
  if (mc !== null && sc !== null) {
    const newC = snap(sc - (mc - ws.targets.close), G.closeStep);
    if (Math.abs(newC - sc) < 0.001) outC.innerHTML = '<span class="note">no change</span>';
    else {
      const oor = (newC < G.closeRange[0] || newC > G.closeRange[1]) ? ' <span class="verify">range</span>' : "";
      outC.innerHTML = `<b>${newC.toFixed(2)}</b>${oor}`;
    }
  } else outC.innerHTML = "—";
}

function recomputeShopping() {
  const bike = currentBike(); if (!bike) return;
  const ws = Store.worksheet(bike.id), G = DB.shimGeometry;
  const bucket = {};
  DB.valvePositions.forEach(v => {
    const d = ws.valves[v.id] || {};
    const mo = num(d.mo), so = num(d.so), mc = num(d.mc), sc = num(d.sc);
    if (mo !== null && so !== null) {
      const newO = snap(so + (mo - ws.targets.open), G.openStep);
      if (Math.abs(newO - so) >= 0.001) { const k = "Opener " + newO.toFixed(2); bucket[k] = (bucket[k] || 0) + 1; }
    }
    if (mc !== null && sc !== null) {
      const newC = snap(sc - (mc - ws.targets.close), G.closeStep);
      if (Math.abs(newC - sc) >= 0.001) { const k = "Closer " + newC.toFixed(2); bucket[k] = (bucket[k] || 0) + 1; }
    }
  });
  const keys = Object.keys(bucket).sort();
  const box = $("#shoplist"), cnt = $("#shopcount");
  if (!box) return;
  if (!keys.length) { box.innerHTML = '<span class="empty">No shim changes yet — enter measurements above.</span>'; if (cnt) cnt.textContent = ""; return; }
  box.innerHTML = keys.map(k => {
    const [type, size] = k.split(" ");
    return `<span class="shopchip"><b>${bucket[k]}×</b> ${type} <b>${size}</b> mm</span>`;
  }).join("");
  if (cnt) cnt.textContent = "· " + keys.reduce((a, k) => a + bucket[k], 0) + " shims";
}

/* =========================================================================
   PANEL — BELT TENSION
   ========================================================================= */
function panelBelts() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("belts");
  const s = specFor(bike);
  if (s && !s.belt) { // chain-driven cams — no timing belts to tension
    return `<section class="panel" data-panel="belts"><div class="card">
      <h2>Timing belt tension</h2>
      <p class="note" style="color:var(--ink);margin-top:0">This engine uses <b>chain-driven cams</b>
      (${esc(s.engine)}) — there are no rubber timing belts to tension or replace, so there's nothing to log here.
      One less thing to snap.</p></div></section>`;
  }
  const ws = Store.worksheet(bike.id);
  const brandOpts = Object.entries(DB.beltBrands).map(([id, b]) =>
    `<option value="${id}" ${id === ws.belt.brand ? "selected" : ""}>${esc(b.label)}</option>`).join("");
  return `
  <section class="panel" data-panel="belts">
    <div class="card">
      <h2>Belt tension log</h2>
      <div class="row-inline">
        <div class="field"><label>Belt brand fitted</label>
          <select id="beltbrand" class="inp">${brandOpts}</select></div>
        <div class="field"><label>New target</label><div class="mono" id="beltTarget"></div></div>
      </div>
      <p class="note" id="beltnote" style="margin-top:6px"></p>
      <div class="scroll" style="margin-top:12px"><table>
        <tr><th>Belt</th><th>Measured (new)</th><th>Status</th><th>After 2 turns</th><th>Status</th></tr>
        <tr data-belt="h">
          <td><b>Horizontal “H”</b></td>
          <td><input type="number" step="1" data-bf="h_new" value="${esc(ws.belt.h_new)}" placeholder="Hz"></td>
          <td><span class="pill na stat" data-for="h_new">—</span></td>
          <td><input type="number" step="1" data-bf="h_after" value="${esc(ws.belt.h_after)}" placeholder="Hz"></td>
          <td><span class="pill na stat" data-for="h_after">—</span></td>
        </tr>
        <tr data-belt="v">
          <td><b>Vertical “V”</b></td>
          <td><input type="number" step="1" data-bf="v_new" value="${esc(ws.belt.v_new)}" placeholder="Hz"></td>
          <td><span class="pill na stat" data-for="v_new">—</span></td>
          <td><input type="number" step="1" data-bf="v_after" value="${esc(ws.belt.v_after)}" placeholder="Hz"></td>
          <td><span class="pill na stat" data-for="v_after">—</span></td>
        </tr>
      </table></div>
      <p class="note">Values save to this bike. Completing a <b>Timing belt</b> session snapshots them into the log.</p>
    </div>
    <div class="card">
      <h2>How to measure</h2>
      <p class="note" style="color:var(--ink)">Cold engine, quiet room. Pluck the <b>longest free span</b> like a guitar string, phone mic ≈1 inch away, pluck 3–4× until the number repeats. Read Hz. Absolute floor on any Ducati: <b class="mono">${DB.hzFloor} Hz</b>.</p>
      <div class="subhead">iPhone apps</div>
      <ul class="vendorlist" style="columns:1">${DB.tunerApps.iphone.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
      <div class="subhead">Android apps</div>
      <ul class="vendorlist" style="columns:1">${DB.tunerApps.android.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
    </div>
  </section>`;
}

function hzStatus(v, brandId) {
  if (v === null) return { cls: "na", txt: "—" };
  const b = DB.beltBrands[brandId];
  if (v < DB.hzFloor) return { cls: "crit", txt: "below " + DB.hzFloor + " Hz floor" };
  if (v < b.newLow) return { cls: "warn", txt: "loose" };
  if (v > b.newHigh) return { cls: "warn", txt: "tight" };
  return { cls: "good", txt: "in range" };
}

function wireBelts() {
  const bike = currentBike(); if (!bike) return;
  const ws = Store.worksheet(bike.id);
  const sel = $("#beltbrand");
  if (sel) sel.addEventListener("change", e => { ws.belt.brand = e.target.value; Store.save(); refreshBeltPanel(); });
  $$("input[data-bf]").forEach(inp => {
    inp.addEventListener("input", e => {
      ws.belt[e.target.dataset.bf] = e.target.value;
      Store.save(); refreshBeltPanel();
    });
  });
  refreshBeltPanel();
}

function refreshBeltPanel() {
  const bike = currentBike(); if (!bike) return;
  const ws = Store.worksheet(bike.id);
  const b = DB.beltBrands[ws.belt.brand];
  const t = $("#beltTarget"), nt = $("#beltnote");
  if (t) t.textContent = `${b.newLow}–${b.newHigh} Hz`;
  if (nt) nt.innerHTML = esc(b.note) + (b.verified ? "" : ' <span class="verify">verify</span>');
  ["h_new", "h_after", "v_new", "v_after"].forEach(key => {
    const el = document.querySelector(`.stat[data-for="${key}"]`);
    if (!el) return;
    const st = hzStatus(num(ws.belt[key]), ws.belt.brand);
    el.className = "pill " + st.cls + " stat";
    el.dataset.for = key;
    el.textContent = st.txt;
  });
}

/* =========================================================================
   VIDEO HELPERS — per-step YouTube links (search by default; the user can
   attach a specific video + timestamp that deep-links to the moment).
   ========================================================================= */
function ytSearchUrl(q) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q); }
function parseTime(s) { // "4:32" -> 272 · "90" -> 90 · "1:02:03" -> 3723
  s = String(s || "").trim(); if (!s) return 0;
  if (s.includes(":")) return s.split(":").map(Number).reduce((a, b) => a * 60 + (b || 0), 0);
  return parseInt(s, 10) || 0;
}
function videoLinkFor(saved, searchQuery) {
  if (saved && saved.url) {
    let u = saved.url.trim();
    const sec = parseTime(saved.start);
    if (sec > 0) {
      // strip an existing t=, then append
      u = u.replace(/([?&])t=[^&]*/i, "$1").replace(/[?&]$/, "");
      u += (u.includes("?") ? "&" : "?") + "t=" + sec;
    }
    return { href: u, label: saved.start ? "Watch @ " + saved.start : "Watch video", custom: true };
  }
  return { href: ytSearchUrl(searchQuery), label: "Find video", custom: false };
}

/* Pull a YouTube video id out of any common URL form; null if not YouTube. */
function youTubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* In-app player — embeds an attached YouTube video so you never leave the app. */
const VideoModal = {
  el: null,
  ensure() {
    if (this.el) return;
    const o = document.createElement("div");
    o.className = "vid-overlay";
    o.innerHTML = `<div class="vid-box">
      <div class="vid-head"><span class="t"></span>
        <a class="iconbtn" data-vid-open target="_blank" rel="noopener" title="Open on YouTube (may launch the app)">Open in YouTube</a>
        <button class="iconbtn" data-vid-close>Close ✕</button></div>
      <div class="vid-frame"></div>
      <div class="vid-foot">Playing in-app · use the ✕ to return to your checklist.</div>
    </div>`;
    document.body.appendChild(o);
    o.addEventListener("click", e => { if (e.target === o) this.close(); });
    o.querySelector("[data-vid-close]").addEventListener("click", () => this.close());
    document.addEventListener("keydown", e => { if (e.key === "Escape") this.close(); });
    this.el = o;
  },
  open(id, start, title) {
    this.ensure();
    const sec = parseTime(start);
    const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1&playsinline=1${sec ? "&start=" + sec : ""}`;
    this.el.querySelector(".vid-frame").innerHTML =
      `<iframe src="${esc(src)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    this.el.querySelector(".vid-head .t").textContent = title || "Video";
    this.el.querySelector("[data-vid-open]").href = `https://www.youtube.com/watch?v=${id}${sec ? "&t=" + sec : ""}`;
    this.el.classList.add("open");
  },
  close() {
    if (!this.el) return;
    this.el.classList.remove("open");
    this.el.querySelector(".vid-frame").innerHTML = ""; // stop playback
  },
};

/* =========================================================================
   PANEL — 3D TEARDOWN (interactive exploded-view guide)
   ========================================================================= */
function teardownDef(bike) {
  if (window.DB.composeBike) return window.DB.composeBike(bike.modelId); // archetype + slots → render shape
  return (window.DB.teardown3d || {})[bike.modelId] || null;
}

function panelTeardown() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("teardown");
  const def = teardownDef(bike);
  if (!def) {
    return `<section class="panel" data-panel="teardown">
      <div class="card"><h2>3D teardown</h2>
      <p class="empty">No 3D teardown model exists yet for this bike
      (<span class="mono">${esc(bike.modelId)}</span>). Models are defined in
      <span class="mono">data/teardown3d.js</span> — the Multistrada 950 is done; others can be added the same way.</p></div>
    </section>`;
  }
  const refs = (def.diagramRefs || []).map(r =>
    `<li><b>${esc(r[0])}</b> — ${esc(r[1])}</li>`).join("");
  return `<section class="panel" data-panel="teardown">
    <div class="card" style="padding:14px 18px">
      <div class="row-inline" style="align-items:center">
        <div style="flex:1">
          <h2 style="margin-bottom:2px">${esc(def.title)}</h2>
          <span class="note">${esc(def.phase)} · stylized guide model — positions and order are real, shapes are schematic</span>
        </div>
        ${def.video ? `<a class="iconbtn" href="${esc(ytSearchUrl(def.video.search))}" target="_blank" rel="noopener" title="Search YouTube for a full walkthrough">▶ Full walkthrough</a>` : ""}
        <div class="field"><label>Progress</label><div class="mono" id="t3d_prog">—</div></div>
      </div>
    </div>
    <div class="t3d-layout">
      <div>
        <div class="t3d-stage" id="t3d_stage">
          <div class="t3d-hud">
            <button class="iconbtn" id="t3d_view" title="Reset the camera">Reset view</button>
            <button class="iconbtn" id="t3d_ghosts" title="Toggle ghosts of removed parts">Hide removed</button>
            <button class="iconbtn danger" id="t3d_reset" title="Put every part back">Reinstall all</button>
          </div>
          <div class="t3d-msg" id="t3d_msg"></div>
          <div class="t3d-hint">Drag to orbit · wheel/pinch to zoom · shift-drag to pan · click the glowing part to remove it, click a ghost to reinstall</div>
        </div>
        <div class="t3d-legend" style="margin-top:8px">
          <span><span class="dot" style="background:#D9A036"></span>fastener (pulsing = this step)</span>
          <span><span class="dot" style="background:#3D7BD9"></span>connector / hose</span>
          <span><span class="dot" style="background:var(--muted);opacity:.3"></span>ghost = removed part</span>
        </div>
        ${refs ? `<div class="card" style="margin-top:14px"><h2>Pictures & real diagrams</h2>
          <ul class="vendorlist" style="columns:1">${refs}</ul>
          <p class="note">The OEM parts fiche exploded drawings are the authoritative fastener map — this model is a spatial guide, not factory CAD.</p></div>` : ""}
      </div>
      <div class="t3d-steps" id="t3d_steps"></div>
    </div>
  </section>`;
}

function wireTeardown() {
  const bike = currentBike(); if (!bike) return;
  const def = teardownDef(bike); if (!def) return;
  const stage = $("#t3d_stage"); if (!stage) return;
  if (!window.THREE) { stage.innerHTML = '<p class="empty" style="padding:20px">Three.js failed to load (js/vendor/three.min.js).</p>'; return; }

  const ws = Store.worksheet(bike.id);
  if (!ws.teardown) ws.teardown = { removed: [] };
  if (!ws.teardown.videos) ws.teardown.videos = {};

  const videoActionsHtml = s => {
    const saved = ws.teardown.videos[s.id];
    const search = s.videoSearch || (def.title + " " + s.title);
    const link = videoLinkFor(saved, search);
    const ytId = saved && saved.url ? youTubeId(saved.url) : null;
    // Embeddable YouTube → play in-app; otherwise fall back to opening the link.
    const primary = ytId
      ? `<button class="iconbtn primary" style="text-transform:none;letter-spacing:0" data-t3d-play="${esc(s.id)}">▶ ${esc(saved.start ? "Play @ " + saved.start : "Play here")}</button>`
      : `<a class="iconbtn" href="${esc(link.href)}" target="_blank" rel="noopener">▶ ${esc(link.label)}</a>`;
    return `${primary}
      <button class="iconbtn" data-t3d-vidlink="${esc(s.id)}" title="Attach a specific video and timestamp for this step">${saved && saved.url ? "Edit link" : "+ link"}</button>`;
  };

  let msgTimer = null;
  const toast = text => {
    const el = $("#t3d_msg"); if (!el) return;
    el.textContent = text; el.classList.add("show");
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.classList.remove("show"), 3800);
  };

  const renderSteps = () => {
    const box = $("#t3d_steps"); if (!box) return;
    if (!def.steps.length) { // model preview only (no authored teardown yet)
      const prog0 = $("#t3d_prog"); if (prog0) prog0.textContent = "preview";
      box.innerHTML = `<div class="card"><h2>Teardown steps — coming soon</h2>
        <p class="note" style="margin-top:0">An interactive step-by-step teardown for this model hasn't been
        authored yet. You can still orbit the 3D model, and the maintenance schedule, part lists, and
        checklists in the other tabs are complete.</p></div>`;
      return;
    }
    const cur = Teardown3D.currentIndex();
    const prog = $("#t3d_prog");
    if (prog) prog.textContent = `${cur} / ${def.steps.length} removed`;
    const doneAll = cur >= def.steps.length;
    box.innerHTML =
      (doneAll ? `<div class="duebanner allgood" style="margin:0"><b>✓ Plastics off.</b> ${esc(def.exposedNote)}</div>` : "") +
      def.steps.map((s, i) => {
        const state = i < cur ? "done" : (i === cur ? "current" : "locked");
        const chips = (s.fasteners || []).map(f =>
          `<span class="fchip ${f.t === "conn" ? "conn" : ""}">${esc(f.spec)}</span>`).join("");
        const remove =
          state === "current" ? `<button class="iconbtn primary" data-t3d-remove>Remove — ${esc(s.title)}</button>` :
          (state === "done" && i === cur - 1 ? `<button class="iconbtn" data-t3d-reinstall>Reinstall</button>` : "");
        const actions = (state !== "locked") ? (remove + videoActionsHtml(s)) : "";
        return `<div class="t3d-step ${state}">
          <div class="head"><span class="n">${String(i + 1).padStart(2, "0")}</span>
            <span class="t">${esc(s.title)}</span>
            ${state === "done" ? '<span class="ok">✓ off</span>' : state === "current" ? '<span class="pill crit">next</span>' : ""}
          </div>
          <div class="note" style="margin-top:2px">Tools: ${s.tools.map(esc).join(", ")}</div>
          ${state !== "locked" ? `<p class="detail">${esc(s.detail)}</p>` : ""}
          ${state === "current" && s.warning ? `<p class="warn">${esc(s.warning)}</p>` : ""}
          ${state === "current" ? `<div class="fchips">${chips}</div>` : ""}
          ${actions ? `<div class="actions">${actions}</div>` : ""}
        </div>`;
      }).join("");
    const rm = box.querySelector("[data-t3d-remove]");
    if (rm) rm.addEventListener("click", () => Teardown3D.removeNext());
    const ri = box.querySelector("[data-t3d-reinstall]");
    if (ri) ri.addEventListener("click", () => Teardown3D.reinstallLast());
    box.querySelectorAll("[data-t3d-play]").forEach(btn => btn.addEventListener("click", () => {
      const s = def.steps.find(x => x.id === btn.getAttribute("data-t3d-play"));
      const saved = ws.teardown.videos[s.id];
      const id = youTubeId(saved.url);
      if (id) VideoModal.open(id, saved.start, s.title);
    }));
    box.querySelectorAll("[data-t3d-vidlink]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-t3d-vidlink");
      const cur = ws.teardown.videos[id] || {};
      const url = prompt("Paste the video URL for this step (YouTube or any). Leave blank to clear:", cur.url || "");
      if (url === null) return;
      if (!url.trim()) { delete ws.teardown.videos[id]; Store.save(); renderSteps(); return; }
      const start = prompt("Jump to timestamp (e.g. 4:32, or blank for the start):", cur.start || "");
      ws.teardown.videos[id] = { url: url.trim(), start: (start || "").trim() };
      Store.save(); renderSteps();
    }));
  };

  try {
    Teardown3D.mount({
      container: stage,
      def,
      removed: ws.teardown.removed,
      onChange: list => { ws.teardown.removed = list; Store.save(); renderSteps(); },
      onMessage: toast,
    });
  } catch (e) {
    stage.innerHTML = `<p class="empty" style="padding:20px">3D viewer failed to start: ${esc(e.message)}</p>`;
    return;
  }
  renderSteps();

  $("#t3d_view").addEventListener("click", () => Teardown3D.resetView());
  let ghosts = true;
  $("#t3d_ghosts").addEventListener("click", e => {
    ghosts = !ghosts;
    Teardown3D.setGhosts(ghosts);
    e.target.textContent = ghosts ? "Hide removed" : "Show removed";
  });
  $("#t3d_reset").addEventListener("click", () => {
    if (Teardown3D.currentIndex() && confirm("Reinstall every part and restart the teardown guide?")) {
      Teardown3D.reinstallAll();
    }
  });
}

/* =========================================================================
   PANEL — REFERENCE (specs, torque, belts-by-brand, reset procedure)
   ========================================================================= */
function panelReference() {
  const bike = currentBike();
  if (!bike) return panelNeedBike("reference");
  const s = specFor(bike);
  if (!s) return `<section class="panel" data-panel="reference"><div class="card"><p class="empty">Model not in catalog.</p></div></section>`;

  const torqueRows = DB.torque.map(t =>
    `<tr><td>${esc(t.k)}</td><td class="mono">${esc(t.v)}</td><td>${t.verify ? '<span class="verify">verify</span>' : ""}</td></tr>`).join("");
  const brandRows = Object.values(DB.beltBrands).map(br =>
    `<tr><td>${esc(br.label)}</td><td class="mono">${br.newLow}–${br.newHigh} Hz</td>
      <td class="mono">${br.usedLow}–${br.usedHigh} Hz</td><td>${vbadge(br.verified)}</td></tr>`).join("");

  const reset = DB.resets[s.resetId];
  const resetCard = reset ? `
    <div class="card">
      <h2>Service-indicator reset ${vbadge(reset.verified)}</h2>
      <p class="note" style="color:var(--ink)">${esc(reset.summary)}</p>
      ${reset.options.map(o => `<div class="resetopt"><div class="b"></div><div><div class="t">${esc(o.label)}</div><div class="d">${esc(o.detail)}</div></div></div>`).join("")}
      <p class="note" style="margin-top:10px">${esc(reset.note)}</p>
    </div>` : "";

  return `
  <section class="panel" data-panel="reference">
    <div class="card">
      <h2>Fluids & consumables — ${esc(bike.year)} ${esc(s.name)}</h2>
      <div class="scroll"><table>
        <tr><th>Item</th><th>Spec</th><th></th></tr>
        <tr><td>Engine oil</td><td>${esc(s.oil)}${s.oilCapacityL ? ` · <span class="mono">~${s.oilCapacityL.value} L</span>` : ""}</td><td>${vbadge(true)}</td></tr>
        <tr><td>Coolant</td><td>${esc(s.coolant)}</td><td>${vbadge(true)}</td></tr>
        ${s.belt
          ? `<tr><td>Timing belts ×2</td><td class="mono">${esc(s.belt.part)} · ${s.belt.teeth}T · ${esc(s.belt.width)}</td><td>${vbadge(s.belt.verified)}</td></tr>`
          : `<tr><td>Cam drive</td><td>Chain-driven cams — no timing belts</td><td>${vbadge(true)}</td></tr>`}
        <tr><td>Spark plugs ×${s.plugs.count}</td><td class="mono">${esc(s.plugs.type)}</td><td>${vbadge(s.plugs.verified)}</td></tr>
        <tr><td>Air filter</td><td class="mono">${esc(s.airFilter.part)} <small>${s.airFilter.note ? esc(s.airFilter.note) : ""}</small></td><td>${vbadge(s.airFilter.verified)}</td></tr>
        <tr><td>Oil filter</td><td class="mono">${esc(s.oilFilter.part)} <small>${esc(s.oilFilter.note || "")}</small></td><td>${vbadge(s.oilFilter.verified)}</td></tr>
        ${s.valveCoverGasket ? `<tr><td>Valve-cover gasket</td><td class="mono">${esc(s.valveCoverGasket.part)} <small>${esc(s.valveCoverGasket.note || "")}</small></td><td>${vbadge(s.valveCoverGasket.verified)}</td></tr>` : ""}
        ${s.camPulleyNut ? `<tr><td>Cam pulley nut</td><td class="mono">${esc(s.camPulleyNut.part)} · ${esc(s.camPulleyNut.thread)} <small>${esc(s.camPulleyNut.note || "")}</small></td><td>${vbadge(s.camPulleyNut.verified)}</td></tr>` : ""}
      </table></div>
    </div>
    <div class="card">
      <h2>Torque reference</h2>
      <div class="scroll"><table><tr><th>Fastener</th><th>Torque</th><th></th></tr>${torqueRows}</table></div>
      <p class="note">All torque figures are unconfirmed — set from the official manual before final assembly.</p>
    </div>
    ${s.belt ? `<div class="card">
      <h2>Belt tension by brand <span class="note">(acoustic pluck method)</span></h2>
      <div class="scroll"><table><tr><th>Belt</th><th>New</th><th>Used</th><th></th></tr>${brandRows}</table></div>
      <p class="note">Absolute floor on any Ducati: <b class="mono">${DB.hzFloor} Hz</b>.</p>
    </div>` : ""}
    ${resetCard}
  </section>`;
}

/* =========================================================================
   RENDER + WIRE EVERYTHING
   ========================================================================= */
const PANELS = {
  garage:    { render: panelGarage,    wire: wireGarage },
  due:       { render: panelDue,       wire: wireDue },
  service:   { render: panelService,   wire: wireService },
  teardown:  { render: panelTeardown,  wire: wireTeardown },
  history:   { render: panelHistory,   wire: wireHistory },
  valves:    { render: panelValves,    wire: wireValves },
  belts:     { render: panelBelts,     wire: wireBelts },
  reference: { render: panelReference, wire: null },
};

/* =========================================================================
   BRANDING — re-skin the app around the selected bike's manufacturer.
   ========================================================================= */
function brandKeyFor(bike) {
  if (!bike) return "_neutral";
  const m = DB.catalog.models[bike.modelId];
  return (m && m.brand) || "_neutral";
}
function effectiveDark() {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function applyBrand() {
  const brands = DB.brands || {};
  const key = brandKeyFor(currentBike());
  const b = brands[key] || brands._neutral || { app: "Motorcycle", sub: "Garage & Service Log", accentLight: "#3A6EA5", accentDark: "#6EA0FF", inkOn: "#fff", vibe: null };
  const root = document.documentElement;
  root.setAttribute("data-brand", key);
  root.style.setProperty("--brand", effectiveDark() ? b.accentDark : b.accentLight);
  root.style.setProperty("--brand-ink", b.inkOn);
  const tt = $("#brandtt"); if (tt) tt.innerHTML = esc(b.app) + '<b>·</b>Companion';
  const sub = $("#brandsub"); if (sub) sub.textContent = b.sub;
  const foot = $("#brandfoot"); if (foot) foot.textContent = b.app + " Companion";
  document.title = b.app + " Companion";
  const vb = $("#brandvibe");
  if (vb) { if (b.vibe) { vb.textContent = b.vibe; vb.style.display = ""; } else { vb.style.display = "none"; } }
}

function renderAll() {
  if (window.Teardown3D) Teardown3D.unmount(); // release the old WebGL context before the DOM goes away
  applyBrand();
  renderAppbar(); renderIdCard(); renderTabs();
  $("#content").innerHTML = Object.values(PANELS).map(p => p.render()).join("");
  setTab(App.tab);
  Object.values(PANELS).forEach(p => { if (p.wire) p.wire(); });
}

/* Re-render just one panel (keeps focus churn down for wizard interactions). */
function reRenderPanel(id) {
  const holder = document.createElement("div");
  holder.innerHTML = PANELS[id].render();
  const fresh = holder.firstElementChild;
  const old = document.querySelector(`.panel[data-panel="${id}"]`);
  if (old && fresh) {
    old.replaceWith(fresh);
    if (App.tab === id) fresh.classList.add("active");
    if (PANELS[id].wire) PANELS[id].wire();
  }
}

function setTab(id) {
  App.tab = id;
  localStorage.setItem("desmo:tab", id);
  $$("nav.tabs button").forEach(btn => btn.setAttribute("aria-selected", btn.dataset.tab === id));
  $$(".panel").forEach(p => p.classList.toggle("active", p.dataset.panel === id));
}

/* ---------------- top-level events ---------------- */
function wireChrome() {
  $("#tabs").addEventListener("click", e => {
    const btn = e.target.closest("button[data-tab]"); if (!btn) return;
    if (App.completed && btn.dataset.tab !== "service") App.completed = null;
    VideoModal.close();
    setTab(btn.dataset.tab);
  });

  $("#userselect").addEventListener("change", e => {
    if (e.target.value === "__add") {
      const name = (prompt("New rider's name:") || "").trim();
      if (name) {
        const u = { id: Store.uid(), name };
        Store.data.users.push(u);
        Store.data.activeUserId = u.id;
        Store.save();
      }
    } else {
      Store.data.activeUserId = e.target.value;
      Store.save();
    }
    App.bikeId = null; App.wizard = null; App.completed = null;
    renderAll();
  });

  $("#printbtn").addEventListener("click", () => window.print());

  $("#exportbtn").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "desmo-companion-backup-" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#importfile").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!confirm("Importing replaces ALL current riders, bikes, and logs with the backup's contents. Continue?")) { e.target.value = ""; return; }
      try {
        Store.importJSON(reader.result);
        App.bikeId = null; App.wizard = null; App.completed = null;
        renderAll();
      } catch (err) { alert("Import failed: " + err.message); }
      e.target.value = "";
    };
    reader.readAsText(f);
  });
  $("#importbtn").addEventListener("click", () => $("#importfile").click());

  /* theme */
  const saved = localStorage.getItem("desmo:theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  $("#themebtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const isDark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("desmo:theme", next);
    applyBrand(); // brand accent has separate light/dark values
  });
}

/* ---------------- boot ---------------- */
Store.onStatus = setStorageChip;
window.DesmoReport = buildReportHtml; // small public hook: build a bike's report HTML
Store.init().then(() => {
  wireChrome();
  renderAll();
});

})();
