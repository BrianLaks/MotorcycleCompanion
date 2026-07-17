/* =========================================================================
   STORE — user-data layer with two persistence adapters.

   1. "server" — when the app is served by server.js, user data lives in a
      JSON file on the host (userdata/db.json) via GET/PUT /api/userdata.
      Everyone who opens the site shares the same garage database.
   2. "local" — when opened as a plain file (or on a static host with no
      API), user data lives in this browser's localStorage. Export/Import
      buttons move it between machines.

   The rest of the app only ever calls Store.data / Store.save().
   ========================================================================= */
window.Store = (function () {
  const LS_KEY = "desmo:userdata:v2";
  const API = "api/userdata";

  function blank() {
    return {
      version: 2,
      activeUserId: null,
      users: [],     // {id, name}
      bikes: [],     // {id, userId, modelId, year, nickname, vin, unit:"mi"|"km", odometer, addedAt}
      log: [],       // {id, bikeId, serviceId, date:"YYYY-MM-DD", odometer, notes, parts, source, snapshot?}
      sessions: [],  // {id, bikeId, startedAt, date, odometer, services:[], checks:{}, notes:{}, status:"active"}
      worksheets: {},// bikeId -> { targets:{open,close}, valves:{}, belt:{} }
    };
  }

  const store = {
    mode: "local",
    data: blank(),
    dirty: false,
    saveTimer: null,
    onStatus: null, // callback(mode, ok)

    async init() {
      // Try the server API first; fall back to localStorage.
      try {
        const res = await fetch(API, { cache: "no-store" });
        if (res.ok) {
          const remote = await res.json();
          this.mode = "server";
          this.data = Object.assign(blank(), remote);
          this._migrateLegacy();
          this._status(true);
          return;
        }
      } catch (e) { /* not served, or API absent — use local */ }

      this.mode = "local";
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) this.data = Object.assign(blank(), JSON.parse(raw));
      } catch (e) { this.data = blank(); }
      this._migrateLegacy();
      this._status(true);
    },

    /* Pull worksheet data saved by the old single-file app (v1) into the
       first matching garage bike, once one exists. Harmless if absent. */
    _migrateLegacy() {
      this.data.version = 2;
    },

    save() {
      // Debounced — many keystrokes collapse to one write.
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.flush(), 400);
    },

    async flush() {
      clearTimeout(this.saveTimer);
      if (this.mode === "server") {
        try {
          const res = await fetch(API, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(this.data),
          });
          this._status(res.ok);
        } catch (e) { this._status(false); }
      } else {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(this.data));
          this._status(true);
        } catch (e) { this._status(false); }
      }
    },

    _status(ok) { if (this.onStatus) this.onStatus(this.mode, ok); },

    /* ---------- convenience accessors ---------- */
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

    activeUser() { return this.data.users.find(u => u.id === this.data.activeUserId) || null; },

    bikesForActiveUser() {
      return this.data.bikes.filter(b => b.userId === this.data.activeUserId);
    },

    bike(id) { return this.data.bikes.find(b => b.id === id) || null; },

    logForBike(bikeId, serviceId) {
      return this.data.log
        .filter(e => e.bikeId === bikeId && (!serviceId || e.serviceId === serviceId))
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.odometer || 0) - (a.odometer || 0));
    },

    activeSession(bikeId) {
      return this.data.sessions.find(s => s.bikeId === bikeId && s.status === "active") || null;
    },

    worksheet(bikeId) {
      if (!this.data.worksheets[bikeId]) {
        const valves = {};
        (window.DB.valvePositions || []).forEach(v => valves[v.id] = { mo: "", mc: "", so: "", sc: "" });
        this.data.worksheets[bikeId] = {
          targets: { open: 0.15, close: 0.07 },
          valves,
          belt: { brand: "oem", h_new: "", h_after: "", v_new: "", v_after: "" },
        };
      }
      return this.data.worksheets[bikeId];
    },

    exportJSON() {
      return JSON.stringify(this.data, null, 2);
    },

    importJSON(text) {
      const obj = JSON.parse(text); // throws on bad input — caller handles
      if (!obj || typeof obj !== "object" || !Array.isArray(obj.bikes)) {
        throw new Error("Not a Desmo Companion backup file");
      }
      this.data = Object.assign(blank(), obj);
      this.flush();
    },
  };

  return store;
})();
