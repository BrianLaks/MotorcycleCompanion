/* =========================================================================
   ARCHETYPES — the default slot table for each class of bike.

   A slot = { comp: "<component name>", name: "<display name>", ...cfg }.
   The composer (data/teardown3d.js → DB.composeBike) reads the archetype's
   slots, applies the bike's overrides, and calls the component builders.

   Archetypes may `extends` another and override slots. To DROP a slot in a
   subclass or a bike, set it to null (e.g. a naked bike sets `beak: null`).
   To resize/move a part, override just its cfg fields (e.g. `windscreen:
   { size:[...], at:[...] }`). This is the "fill out a table" surface — adding
   a bike is mostly picking an archetype and typing a few overrides.

   `adventure` is fully specified (it's the Multistrada reference). The others
   are templates that demonstrate the class variations; positions get refined
   when a real bike of that class is onboarded. See ARCHITECTURE.md.
   ========================================================================= */
window.DB = window.DB || {};

window.DB.archetypes = {

  adventure: {
    label: "Adventure / ADV",
    colors: { paint: "#CC1B22", frame: "#B01C22", cam: "#7C1A1F" },
    camera: { pos: [2.9, 1.75, 3.25], target: [0, 0.9, 0] },
    slots: {
      wheelFront:  { comp: "wheel", name: "Front wheel", at: 1.02, R: 0.27, tube: 0.085 },
      wheelRear:   { comp: "wheel", name: "Rear wheel", at: -1.00, R: 0.28, tube: 0.10 },
      fork:        { comp: "fork", name: "Front fork & clamp", tubeAt: [0.83, 0.70], zOff: 0.10, angle: 0.44, len: 0.80, clampAt: [0.66, 1.03] },
      bars:        { comp: "handlebars", name: "Handlebars", at: [0.52, 1.18], width: 0.62, mirrorAt: [0.52, 1.32], mirror: true },
      frontFender: { comp: "frontFender", name: "Front fender", at: [1.02, 0.66], angle: -0.16, size: [0.46, 0.05, 0.24] },
      beak:        { comp: "beak", name: "Beak", at: [0.90, 0.93], angle: -0.52, size: [0.38, 0.08, 0.22] },
      headlight:   { comp: "headlight", name: "Headlight", at: [0.66, 1.20], size: [0.15, 0.26, 0.26], shroud: true },
      windscreen:  { comp: "windscreen", name: "Windscreen", at: [0.54, 1.46], angle: 0.42, size: [0.02, 0.30, 0.30], opacity: 0.32 },
      frame:       { comp: "frame", name: "Trellis frame" },
      subframe:    { comp: "subframe", name: "Subframe & rack", railAt: [-0.62, 0.86], railLen: 0.6, grabAt: [-1.02, 0.94], grab: true },
      engine:      { comp: "engineLtwin", name: "Engine", at: [0.03, 0.58] },
      radiator:    { comp: "radiator", name: "Radiator", at: [0.44, 0.80], size: [0.05, 0.30, 0.40] },
      exhaust:     { comp: "exhaust", name: "Exhaust", mufflerAt: [-0.74, 0.62, 0.20], mufflerSize: [0.5, 0.13, 0.14] },
      swingarm:    { comp: "swingarm", name: "Swingarm & shock" },
      finalDrive:  { comp: "chain", name: "Final drive chain", front: [-0.34, 0.45], rear: [-1.00, 0.38], z: -0.15 },
      airbox:      { comp: "airbox", name: "Airbox", at: [0.14, 0.94], size: [0.40, 0.16, 0.30] },
      electrics:   { comp: "electrics", name: "Electronics tray", at: [-0.50, 0.83], size: [0.30, 0.12, 0.24] },
      seatRider:   { comp: "seat", name: "Rider seat", at: [-0.35, 0.965], angle: -0.05, size: [0.50, 0.085, 0.34] },
      seatPillion: { comp: "seat", name: "Passenger seat", at: [-0.88, 1.00], angle: -0.03, size: [0.34, 0.08, 0.30] },
      fairingLeft:  { comp: "sideFairing", name: "Left side fairing", side: 1 },
      fairingRight: { comp: "sideFairing", name: "Right side fairing", side: -1 },
      tank:        { comp: "tank", name: "Fuel tank", at: [0.16, 1.02], size: [0.58, 0.20, 0.34] },
    },
  },

  /* Naked/standard: strip the beak, screen and side fairings; lower bars,
     expose the frame. */
  naked: {
    label: "Naked / roadster",
    extends: "adventure",
    slots: {
      beak: null, windscreen: null, fairingLeft: null, fairingRight: null,
      bars: { at: [0.55, 1.13], width: 0.66 },
      headlight: { at: [0.68, 1.10], size: [0.17, 0.20, 0.22], shroud: false },
    },
  },

  /* Sport: no beak, low bubble screen, clip-on bars, full-ish fairing,
     minimal pillion. */
  sport: {
    label: "Sport",
    extends: "adventure",
    slots: {
      beak: null,
      windscreen: { at: [0.60, 1.18], angle: 0.7, size: [0.02, 0.18, 0.32], opacity: 0.26 },
      bars: { at: [0.64, 1.00], width: 0.46, mirrorAt: [0.40, 1.02], mirror: true },
      headlight: { at: [0.70, 1.06], size: [0.16, 0.18, 0.24], shroud: true },
      fairingLeft:  { side: 1, upperAt: [0.34, 0.86], upperSize: [0.70, 0.44, 0.03] },
      fairingRight: { side: -1, upperAt: [0.34, 0.86], upperSize: [0.70, 0.44, 0.03] },
      seatRider: { at: [-0.32, 1.00], size: [0.46, 0.08, 0.32] },
      seatPillion: { at: [-0.82, 1.06], size: [0.22, 0.06, 0.22] },
    },
  },

  /* Cruiser: long + low, big solo seat (no pillion), fat rear tyre, big front
     wheel, optional big windscreen, pullback bars, belt final drive. */
  cruiser: {
    label: "Cruiser",
    extends: "adventure",
    colors: { paint: "#1B1D22", frame: "#26282D", cam: "#3A3D44" },
    slots: {
      beak: null, fairingLeft: null, fairingRight: null,
      wheelFront: { at: 1.22, R: 0.31, tube: 0.09 },
      wheelRear:  { at: -1.12, R: 0.26, tube: 0.15 },
      fork: { tubeAt: [1.00, 0.66], angle: 0.62, len: 0.86, clampAt: [0.78, 1.02] },
      windscreen: { at: [0.70, 1.32], angle: 0.18, size: [0.03, 0.44, 0.46], opacity: 0.20 },
      bars: { at: [0.52, 1.30], width: 0.72 },
      headlight: { at: [0.78, 1.02], size: [0.18, 0.20, 0.22], shroud: false },
      engine: { at: [0.06, 0.56] },
      seatRider: { name: "Solo seat", at: [-0.30, 0.78], size: [0.66, 0.10, 0.42] },
      seatPillion: null,
      subframe: { railAt: [-0.66, 0.80], railLen: 0.66, grab: true, grabAt: [-1.12, 0.88] },
      tank: { at: [0.22, 0.96], size: [0.52, 0.24, 0.30], humpAt: [0.46, 1.00, 0], rearAt: [-0.10, 0.94, 0] },
      exhaust: { mufflerAt: [-0.55, 0.44, 0.24], mufflerSize: [0.9, 0.09, 0.10], mufflerRot: 0.05 },
      finalDrive: { comp: "beltDrive", name: "Belt final drive", front: [-0.30, 0.44], rear: [-1.12, 0.34], z: -0.16 },
    },
  },

  /* Plain standard/UJM — upright, no bodywork. */
  standard: {
    label: "Standard / UJM",
    extends: "adventure",
    slots: {
      beak: null, windscreen: null, fairingLeft: null, fairingRight: null,
      bars: { at: [0.54, 1.14], width: 0.64 },
      headlight: { shroud: false },
    },
  },
};
