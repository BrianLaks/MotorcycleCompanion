/* =========================================================================
   COMPONENT LIBRARY — reusable, config-driven part builders.

   Each component is a function (cfg, colors) => prim[] that draws one part
   given a few numbers (position/size/etc.). Bikes never hand-place primitives;
   they fill in a slot table (see archetypes.js) and the composer calls these.

   Coordinate system: +X = front, +Y = up, +Z = rider's left. Ground at y = 0.
   `cfg.at` is usually [x,y] (z handled by the component). `colors` carries the
   bike's paint/frame/cam colors so one red builder serves every colour.

   To support a new kind of bike, add a builder here (springer fork, clip-ons,
   belt drive, boxer engine, teardrop tank…) and every archetype/bike can use
   it. See ARCHITECTURE.md.
   ========================================================================= */
window.DB = window.DB || {};

(function () {
  const P = {
    RED: "#CC1B22", DRED: "#7C1A1F", FRED: "#B01C22",
    BLACK: "#31343B", MATTE: "#3D4048",
    CAST: "#7A808B", LCAST: "#A6ADB8", DKMET: "#4C515B",
    TIRE: "#16171A", RIM: "#33363D", DISC: "#B7BCC4", GOLD: "#C9A227", SEAT: "#34373E",
  };
  window.DB.palette = P;

  const paint = (col, extra) => Object.assign({ c: col || P.RED, rough: 0.28, metal: 0.12 }, extra);
  const metal = (c, extra) => Object.assign({ c: c || P.CAST, rough: 0.45, metal: 0.8 }, extra);
  const xy = (a, dflt) => a || dflt;

  const C = {};

  /* ---- rolling chassis ---- */
  C.wheel = (c) => {
    const cx = c.at, R = c.R, tube = c.tube, y = R + tube;
    return [
      { t: "tor", p: [cx, y, 0], s: [R, tube, 18, 34], c: P.TIRE, rough: 0.85, metal: 0 },
      { t: "cyl", p: [cx, y, 0], r: [1.5708, 0, 0], s: [R * 0.72, R * 0.72, tube * 1.4], c: P.RIM, rough: 0.4, metal: 0.7 },
      { t: "cyl", p: [cx, y, tube * 1.15], r: [1.5708, 0, 0], s: [R * 0.55, R * 0.55, 0.008], c: P.DISC, rough: 0.35, metal: 0.85 },
      { t: "cyl", p: [cx, y, -tube * 1.15], r: [1.5708, 0, 0], s: [R * 0.55, R * 0.55, 0.008], c: P.DISC, rough: 0.35, metal: 0.85 },
      { t: "cyl", p: [cx, y, 0], r: [1.5708, 0, 0], s: [0.06, 0.06, tube * 2.6], c: P.LCAST, rough: 0.5, metal: 0.7 },
    ];
  };

  C.fork = (c) => {
    const a = c.tubeAt, z = c.zOff ?? 0.10, ang = c.angle ?? 0.44, len = c.len ?? 0.80, R = c.tubeR ?? 0.03, cl = c.clampAt, cs = c.clampSize || [0.13, 0.11, 0.26];
    return [
      { t: "cyl", p: [a[0], a[1], z], r: [0, 0, ang], s: [R, R, len], ...metal(P.LCAST) },
      { t: "cyl", p: [a[0], a[1], -z], r: [0, 0, ang], s: [R, R, len], ...metal(P.LCAST) },
      { t: "box", p: [cl[0], cl[1], 0], s: cs, c: P.MATTE },
    ];
  };

  C.handlebars = (c) => {
    const a = c.at, w = c.width ?? 0.62, gz = c.gripZ ?? 0.31, out = [
      { t: "box", p: [a[0], a[1], 0], s: [0.05, 0.045, w], c: P.MATTE },
      { t: "cyl", p: [a[0] - 0.02, a[1], gz], r: [1.5708, 0, 0], s: [0.022, 0.022, 0.12], c: P.BLACK },
      { t: "cyl", p: [a[0] - 0.02, a[1], -gz], r: [1.5708, 0, 0], s: [0.022, 0.022, 0.12], c: P.BLACK },
    ];
    if (c.mirror !== false && c.mirrorAt) {
      const m = c.mirrorAt, mz = c.mirrorZ ?? 0.33;
      out.push({ t: "box", p: [m[0], m[1], mz], s: [0.10, 0.05, 0.03], c: P.BLACK });
      out.push({ t: "box", p: [m[0], m[1], -mz], s: [0.10, 0.05, 0.03], c: P.BLACK });
    }
    return out;
  };

  C.swingarm = (c) => {
    const a = c.at || [-0.56, 0.46], sh = c.shockAt || [-0.40, 0.62];
    return [
      { t: "box", p: [a[0], a[1], 0.11], r: [0, 0, 0.09], s: [0.52, 0.06, 0.05], ...metal(P.CAST) },
      { t: "box", p: [a[0], a[1], -0.11], r: [0, 0, 0.09], s: [0.52, 0.06, 0.05], ...metal(P.CAST) },
      { t: "cyl", p: [sh[0], sh[1], 0], r: [0, 0, 0.32], s: [0.032, 0.032, 0.32], c: P.GOLD, metal: 0.6 },
    ];
  };

  /* Final-drive chain: front (countershaft) → rear sprocket, top + bottom run. */
  C.chain = (c) => {
    const z = c.z ?? 0.15, rf = c.rf || 0.055, rr = c.rr || 0.14, front = c.front, rear = c.rear;
    const teeth = "#2E3136", link = "#3C4046";
    const run = (ax, ay, bx, by) => {
      const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
      return { t: "box", p: [(ax + bx) / 2, (ay + by) / 2, z], r: [0, 0, ang], s: [len, 0.028, 0.05], c: link, rough: 0.6, metal: 0.5 };
    };
    return [
      { t: "cyl", p: [rear[0], rear[1], z], r: [1.5708, 0, 0], s: [rr, rr, 0.016], c: teeth, rough: 0.5, metal: 0.6 },
      { t: "cyl", p: [front[0], front[1], z], r: [1.5708, 0, 0], s: [rf, rf, 0.02], c: teeth, rough: 0.5, metal: 0.6 },
      run(front[0], front[1] + rf, rear[0], rear[1] + rr),
      run(front[0], front[1] - rf, rear[0], rear[1] - rr),
    ];
  };

  /* Belt final drive (cruisers/some standards) — one wide toothed belt run. */
  C.beltDrive = (c) => {
    const z = c.z ?? 0.15, rf = c.rf || 0.06, rr = c.rr || 0.16, front = c.front, rear = c.rear;
    const run = (ax, ay, bx, by) => {
      const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
      return { t: "box", p: [(ax + bx) / 2, (ay + by) / 2, z], r: [0, 0, ang], s: [len, 0.05, 0.07], c: "#1E1F23", rough: 0.8 };
    };
    return [
      { t: "cyl", p: [rear[0], rear[1], z], r: [1.5708, 0, 0], s: [rr, rr, 0.02], c: P.BLACK, rough: 0.6 },
      { t: "cyl", p: [front[0], front[1], z], r: [1.5708, 0, 0], s: [rf, rf, 0.03], c: P.BLACK, rough: 0.6 },
      run(front[0], front[1] + rf, rear[0], rear[1] + rr),
      run(front[0], front[1] - rf, rear[0], rear[1] - rr),
    ];
  };

  /* ---- engine ---- */
  C.engineLtwin = (c, col) => {
    const a = c.at || [0.03, 0.58], cam = (col && col.cam) || P.DRED;
    const o = (dx, dy, dz) => [a[0] + dx, a[1] + dy, dz || 0];
    return [
      { t: "box", p: o(0, 0, 0), s: [0.44, 0.30, 0.30], ...metal(P.CAST) },
      { t: "box", p: o(0, -0.16, 0), s: [0.34, 0.09, 0.24], ...metal(P.DKMET) },
      { t: "cyl", p: o(0, 0, -0.16), r: [1.5708, 0, 0], s: [0.135, 0.135, 0.05], ...metal(P.LCAST) },
      { t: "cyl", p: o(0, 0, 0.16), r: [1.5708, 0, 0], s: [0.12, 0.12, 0.05], ...metal(P.LCAST) },
      { t: "cyl", p: o(0.31, 0.10, 0), r: [0, 0, -1.05], s: [0.10, 0.11, 0.26], ...metal(P.CAST) },
      { t: "box", p: o(0.46, 0.18, 0), r: [0, 0, -1.05], s: [0.14, 0.10, 0.19], c: cam, rough: 0.4, metal: 0.5 },
      { t: "cyl", p: o(-0.08, 0.30, 0), r: [0, 0, 0.30], s: [0.10, 0.11, 0.26], ...metal(P.CAST) },
      { t: "box", p: o(-0.16, 0.44, 0), r: [0, 0, 0.30], s: [0.14, 0.10, 0.19], c: cam, rough: 0.4, metal: 0.5 },
    ];
  };

  /* Generic transverse block (inline-4 / parallel-twin) — a jug of cylinders. */
  C.engineBlock = (c) => {
    const a = c.at || [0.06, 0.56], w = c.width || 0.5;
    return [
      { t: "box", p: [a[0], a[1] - 0.06, 0], s: [w, 0.26, 0.34], ...metal(P.CAST) },
      { t: "box", p: [a[0] + 0.02, a[1] + 0.14, 0], r: [0, 0, 0.15], s: [w * 0.7, 0.16, 0.32], ...metal(P.DKMET) },
      { t: "box", p: [a[0], a[1] - 0.20, 0], s: [w * 0.75, 0.08, 0.26], ...metal(P.DKMET) },
    ];
  };

  /* ---- frame & bodywork ---- */
  C.frame = (c, col) => {
    const fc = (col && col.frame) || P.FRED;
    return [
      { t: "box", p: [0.26, 0.86, 0.13], r: [0, 0, 0.26], s: [0.72, 0.03, 0.028], c: fc, rough: 0.4 },
      { t: "box", p: [0.26, 0.86, -0.13], r: [0, 0, 0.26], s: [0.72, 0.03, 0.028], c: fc, rough: 0.4 },
      { t: "box", p: [0.42, 0.70, 0.13], r: [0, 0, -0.7], s: [0.30, 0.025, 0.025], c: fc, rough: 0.4 },
      { t: "box", p: [0.42, 0.70, -0.13], r: [0, 0, -0.7], s: [0.30, 0.025, 0.025], c: fc, rough: 0.4 },
      { t: "box", p: [0.05, 0.66, 0.13], r: [0, 0, 0.5], s: [0.26, 0.025, 0.025], c: fc, rough: 0.4 },
      { t: "box", p: [0.05, 0.66, -0.13], r: [0, 0, 0.5], s: [0.26, 0.025, 0.025], c: fc, rough: 0.4 },
    ];
  };

  C.subframe = (c) => {
    const rl = c.railAt || [-0.62, 0.86], len = c.railLen || 0.6, grab = c.grabAt || [-1.02, 0.94];
    const out = [
      { t: "box", p: [rl[0], rl[1], 0.11], r: [0, 0, -0.16], s: [len, 0.035, 0.03], c: P.MATTE },
      { t: "box", p: [rl[0], rl[1], -0.11], r: [0, 0, -0.16], s: [len, 0.035, 0.03], c: P.MATTE },
    ];
    if (c.grab !== false) out.push({ t: "box", p: [grab[0], grab[1], 0], s: [0.26, 0.035, 0.28], c: P.MATTE });
    return out;
  };

  C.frontFender = (c) => [{ t: "box", p: [c.at[0], c.at[1], 0], r: [0, 0, c.angle ?? -0.16], s: c.size || [0.46, 0.05, 0.24], c: P.MATTE }];

  C.beak = (c, col) => [{ t: "box", p: [c.at[0], c.at[1], 0], r: [0, 0, c.angle ?? -0.52], s: c.size || [0.38, 0.08, 0.22], ...paint(col && col.paint) }];

  C.headlight = (c, col) => {
    const a = c.at, s = c.size || [0.15, 0.26, 0.26];
    const out = [
      { t: "box", p: [a[0], a[1], 0], s: s, c: P.BLACK },
      { t: "box", p: [a[0] + 0.085, a[1] - 0.03, 0], s: [0.03, 0.15, 0.19], c: "#C9D4DE", e: "#495663" },
    ];
    if (c.shroud) out.push({ t: "box", p: [a[0] - 0.06, a[1] + 0.10, 0], r: [0, 0, 0.32], s: [0.10, 0.20, 0.27], ...paint(col && col.paint) });
    return out;
  };

  C.windscreen = (c) => [{ t: "box", p: [c.at[0], c.at[1], 0], r: [0, 0, c.angle ?? 0.42], s: c.size || [0.02, 0.30, 0.30], c: "#AEB9C6", o: c.opacity ?? 0.32, rough: 0.1, metal: 0.1 }];

  C.radiator = (c) => {
    const a = c.at || [0.44, 0.80], s = c.size || [0.05, 0.30, 0.40];
    return [
      { t: "box", p: [a[0], a[1], 0], s: s, c: "#1B1D21", rough: 0.6 },
      { t: "box", p: [a[0], a[1], 0], s: [s[0] + 0.005, s[1], 0.02], c: P.LCAST, metal: 0.7 },
    ];
  };

  C.exhaust = (c) => {
    const m = c.mufflerAt || [-0.74, 0.62, 0.20], ms = c.mufflerSize || [0.5, 0.13, 0.14], mr = c.mufflerRot ?? 0.14;
    return [
      { t: "cyl", p: c.headerAt || [0.42, 0.46, 0.07], r: [0, 0, 1.0], s: [0.03, 0.03, 0.42], ...metal(P.LCAST) },
      { t: "box", p: c.collectorAt || [-0.12, 0.34, 0.06], s: [0.5, 0.09, 0.10], ...metal(P.DKMET) },
      { t: "box", p: m, r: [0, 0, mr], s: ms, c: P.BLACK, rough: 0.5 },
    ];
  };

  C.airbox = (c) => { const a = xy(c.at, [0.14, 0.94]); return [{ t: "box", p: [a[0], a[1], 0], s: c.size || [0.40, 0.16, 0.30], c: P.MATTE }]; };
  C.electrics = (c) => { const a = xy(c.at, [-0.50, 0.83]); return [{ t: "box", p: [a[0], a[1], 0], s: c.size || [0.30, 0.12, 0.24], c: P.BLACK }]; };

  C.seat = (c) => [{ t: "box", p: [c.at[0], c.at[1], 0], r: [0, 0, c.angle ?? -0.04], s: c.size || [0.50, 0.085, 0.34], c: c.color || P.SEAT, rough: 0.7 }];

  C.trimRing = (c) => [{ t: "tor", p: [c.at[0], c.at[1], 0], r: [1.5708, 0, 0], s: [c.r || 0.10, c.tube || 0.022, 12, 30], c: "#3B3E45", metal: 0.5, rough: 0.4 }];

  /* Side fairing panel — upper (painted) + lower (matte), mirrored by `side`. */
  C.sideFairing = (c, col) => {
    const side = c.side || 1;
    const ua = c.upperAt || [0.28, 0.92], la = c.lowerAt || [0.36, 0.66];
    return [
      { t: "box", p: [ua[0], ua[1], (c.upperZ ?? 0.25) * side], r: [0, (c.upperYaw ?? 0.16) * side, (c.upperRoll ?? -0.05) * side], s: c.upperSize || [0.52, 0.30, 0.025], ...paint(col && col.paint) },
      { t: "box", p: [la[0], la[1], (c.lowerZ ?? 0.235) * side], r: [0, (c.lowerYaw ?? 0.13) * side, (c.lowerRoll ?? 0.02) * side], s: c.lowerSize || [0.42, 0.17, 0.025], c: P.MATTE, rough: 0.5 },
    ];
  };

  C.tank = (c, col) => {
    const a = c.at || [0.16, 1.02], pc = col && col.paint;
    const out = [{ t: "box", p: [a[0], a[1], 0], r: [0, 0, c.roll ?? -0.03], s: c.size || [0.58, 0.20, 0.34], ...paint(pc) }];
    if (c.hump !== false) out.push({ t: "box", p: c.humpAt || [0.42, 1.06, 0], r: [0, 0, 0.18], s: c.humpSize || [0.24, 0.15, 0.30], ...paint(pc) });
    if (c.rear !== false) out.push({ t: "box", p: c.rearAt || [-0.16, 0.99, 0], s: c.rearSize || [0.26, 0.15, 0.22], ...paint(pc) });
    out.push({ t: "cyl", p: c.fillerAt || [0.34, 1.16, 0], s: [0.05, 0.05, 0.06], ...metal(P.LCAST) });
    return out;
  };

  window.DB.components = C;
})();
