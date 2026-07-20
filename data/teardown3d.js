/* =========================================================================
   BIKES (3D) + COMPOSER.

   A bike is DATA: it names an archetype (data/archetypes.js), overrides a few
   slot cfgs / colours, and defines its maintenance scene(s) — which parts come
   off, in what order, with which fasteners. It hand-places NO primitives; the
   components (data/components.js) do the drawing.

   DB.composeBike(modelId) resolves archetype + overrides + scene into the
   { title, phase, camera, parts, steps } shape the renderer consumes, so the
   whole composition layer sits ABOVE the renderer and never touches it.
   See ARCHITECTURE.md.

   Coordinates: +X = front, +Y = up, +Z = rider's left. Ground at y = 0.

   ------ adding a bike ------
   1. Pick an archetype. 2. Set colours. 3. Override only the slots that differ
   (size/location) or add bike-specific ones (e.g. a tank trim ring).
   4. Define the scene: `removable` (slot → explode vector) + `steps`.
   ========================================================================= */
window.DB = window.DB || {};

window.DB.bikes3d = {

  mts950: {
    archetype: "adventure",
    colors: { paint: "#CC1B22", frame: "#B01C22" },

    // bike-specific extras / tweaks on top of the adventure archetype
    slots: {
      trimRing: { comp: "trimRing", name: "Tank trim ring", at: [0.34, 1.18] },
    },

    // one maintenance scene for now: the plastics/fairing teardown
    scene: {
      title: "Multistrada 950 — plastics & fairings",
      phase: "Phase 1 · Plastics & fairing teardown",
      camera: { pos: [2.9, 1.75, 3.25], target: [0, 0.9, 0] },
      exposedNote: "Airbox, throttle bodies, and the top of the Testastretta are now accessible — " +
                   "this is the starting state for the belt/valve service checklists.",
      video: { search: "Ducati Multistrada 950 valve service tank fairing removal" },
      diagramRefs: [
        ["AF1 Racing (af1racing.com)", "OEM Ducati parts fiche with exploded diagrams — pick your year, the 'Fairing' and 'Tank' tables show every fastener part number"],
        ["Ducati Omaha (ducatiomaha.com)", "Alternate OEM fiche viewer with the same exploded drawings"],
        ["multistrada.net forum", "Owner photo threads of this exact teardown — search 'valve check teardown'"],
        ["YouTube", "Use the ▶ button on each step to search — attach the exact video + timestamp once you find a good one"],
      ],

      // which archetype slots come off in this scene, and where they float to
      removable: {
        seatPillion: { explode: [-0.40, 0.55, 0] },
        seatRider:   { explode: [-0.10, 0.62, 0] },
        trimRing:    { explode: [0, 0.55, 0] },
        fairingLeft: { explode: [0, 0.10, 0.85] },
        fairingRight:{ explode: [0, 0.10, -0.85] },
        tank:        { explode: [0, 0.85, 0] },
      },

      steps: [
        { id: "s1", part: "seatPillion", title: "Passenger seat",
          tools: ["Ignition key"],
          videoSearch: "Ducati Multistrada 950 seat removal",
          fasteners: [{ t: "latch", p: [-1.02, 0.98, 0.13], spec: "Key latch under the tail — turn and lift" }],
          detail: "Insert the ignition key in the latch under the tail, turn, and lift the rear of the seat. Slide rearward to free the front tabs.",
        },
        { id: "s2", part: "seatRider", title: "Rider seat",
          tools: ["4 mm hex"],
          videoSearch: "Ducati Multistrada 950 rider seat removal",
          fasteners: [
            { t: "bolt", p: [-0.58, 0.93, 0.10],  spec: "4 mm hex — rear bracket, left" },
            { t: "bolt", p: [-0.58, 0.93, -0.10], spec: "4 mm hex — rear bracket, right" },
          ],
          detail: "Two 4 mm bolts hold the rear seat bracket now exposed by the passenger seat. Remove both, slide the seat rearward off its front tongue, lift away.",
        },
        { id: "s3", part: "trimRing", title: "Tank trim ring",
          tools: ["3 mm hex", "Clean rag"],
          videoSearch: "Ducati Multistrada tank trim ring removal",
          fasteners: [
            { t: "bolt", p: [0.45, 1.20, 0],  spec: "3 mm hex ×4 around the fuel neck" },
            { t: "bolt", p: [0.23, 1.20, 0],  spec: "3 mm hex" },
            { t: "bolt", p: [0.34, 1.20, 0.10],  spec: "3 mm hex" },
            { t: "bolt", p: [0.34, 1.20, -0.10], spec: "3 mm hex" },
          ],
          warning: "Stuff a clean rag around the open fuel neck — a dropped 3 mm bolt goes straight into the tank.",
          detail: "Four 3 mm bolts around the filler neck hold the cosmetic trim ring. Lift it off over the cap.",
        },
        { id: "s4", part: "fairingLeft", title: "Left side fairing",
          tools: ["4 mm hex"],
          videoSearch: "Ducati Multistrada 950 side fairing panel removal",
          fasteners: [
            { t: "bolt", p: [0.05, 1.05, 0.27], spec: "4 mm hex ×7 on this side" },
            { t: "bolt", p: [0.30, 1.07, 0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.52, 1.00, 0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.54, 0.82, 0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.44, 0.66, 0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.20, 0.63, 0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.05, 0.80, 0.27], spec: "4 mm hex" },
          ],
          detail: "Seven 4 mm bolts per side (14 total across both). After the bolts, the panel is still held by push-fit rubber grommets — pull straight out with both hands, don't lever.",
          warning: "The grommet posts snap if you twist. Pull perpendicular to the bike.",
        },
        { id: "s5", part: "fairingRight", title: "Right side fairing",
          tools: ["4 mm hex"],
          videoSearch: "Ducati Multistrada 950 side fairing panel removal",
          fasteners: [
            { t: "bolt", p: [0.05, 1.05, -0.27], spec: "4 mm hex ×7 on this side" },
            { t: "bolt", p: [0.30, 1.07, -0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.52, 1.00, -0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.54, 0.82, -0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.44, 0.66, -0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.20, 0.63, -0.27], spec: "4 mm hex" },
            { t: "bolt", p: [0.05, 0.80, -0.27], spec: "4 mm hex" },
          ],
          detail: "Mirror of the left side — seven 4 mm bolts, then pop the grommets. (Left/right order doesn't matter in practice; the guide tracks them one at a time.)",
        },
        { id: "s6", part: "tank", title: "Fuel tank",
          tools: ["5 mm hex", "Rag", "Hose-clamp pliers (optional)"],
          videoSearch: "Ducati Multistrada 950 fuel tank removal",
          fasteners: [
            { t: "bolt", p: [0.44, 0.98, 0.13],  spec: "5 mm hex — front left" },
            { t: "bolt", p: [0.44, 0.98, -0.13], spec: "5 mm hex — front right" },
            { t: "bolt", p: [-0.08, 0.97, 0.13],  spec: "5 mm hex — rear left" },
            { t: "bolt", p: [-0.08, 0.97, -0.13], spec: "5 mm hex — rear right" },
            { t: "conn", p: [0.12, 0.92, -0.16], spec: "Fuel quick-disconnect — press collar, expect a small spill" },
            { t: "conn", p: [-0.04, 0.92, -0.16], spec: "Fuel-pump electrical connector — squeeze tab" },
            { t: "conn", p: [0.06, 0.90, 0.16],  spec: "2× vent/drain lines — note which nipple each goes to" },
          ],
          warning: "Run the tank low on fuel first. Fuel QD will weep a little — rag underneath, no ignition sources.",
          detail: "Four 5 mm bolts at the tank base. Lift the rear slightly, reach under to pop the fuel quick-disconnect, the pump connector, and the two vent lines, then lift the tank away. Store it upright on a towel.",
        },
      ],
    },
  },

  /* KTM 1290 Super Adventure — orange adventure. Composes from the `adventure`
     archetype recoloured KTM orange with a black frame, and reuses the same
     removable geometry (seats, side panels, tank) for a plastics teardown.
     Steps are LC8-plausible; confirm counts/torque against the KTM manual. */
  ktm1290sa: {
    archetype: "adventure",
    colors: { paint: "#FF6A00", frame: "#26282D", cam: "#3A3D44" },
    slots: {
      windscreen: { size: [0.02, 0.36, 0.34], at: [0.54, 1.50] }, // taller touring screen
    },
    scene: {
      title: "1290 Super Adventure — plastics & tank",
      phase: "Phase 1 · Seats, side panels & fuel tank",
      camera: { pos: [2.9, 1.75, 3.25], target: [0, 0.9, 0] },
      video: { search: "KTM 1290 Super Adventure tank removal valve check teardown" },
      diagramRefs: [
        ["KTM PowerParts / dealer fiche", "Official KTM exploded parts diagrams — the authoritative fastener map for the 1290"],
        ["ktmtwins.com · KTM Twins", "US KTM specialist — parts, oil-service kits, and teardown reference"],
        ["'Back in the Garage' (YouTube)", "1090/1190/1290 valve-clearance + teardown walkthroughs on this exact platform"],
      ],
      removable: {
        seatPillion: { explode: [-0.40, 0.55, 0] },
        seatRider:   { explode: [-0.10, 0.62, 0] },
        fairingLeft: { explode: [0, 0.10, 0.85] },
        fairingRight:{ explode: [0, 0.10, -0.85] },
        tank:        { explode: [0, 0.85, 0] },
      },
      steps: [
        { id: "s1", part: "seatPillion", title: "Passenger seat",
          tools: ["Seat key / lever"],
          videoSearch: "KTM 1290 Super Adventure seat removal",
          fasteners: [{ t: "latch", p: [-1.02, 0.98, 0.13], spec: "Seat latch — turn the key/lever and lift" }],
          detail: "Turn the seat lock and lift the pillion seat off its catches.",
        },
        { id: "s2", part: "seatRider", title: "Rider seat",
          tools: ["Seat key / lever", "T-handle Torx"],
          videoSearch: "KTM 1290 Super Adventure rider seat removal",
          fasteners: [
            { t: "bolt", p: [-0.58, 0.93, 0.10],  spec: "Torx — rider seat catch (per side)" },
            { t: "bolt", p: [-0.58, 0.93, -0.10], spec: "Torx" },
          ],
          detail: "Release the rider seat catch and lift it away. KTM seat height can be in the low/high position — note which.",
        },
        { id: "s3", part: "fairingLeft", title: "Left side panel / tank shroud",
          tools: ["Torx set"],
          videoSearch: "KTM 1290 Super Adventure side panel fairing removal",
          fasteners: [
            { t: "bolt", p: [0.30, 1.07, 0.27], spec: "Torx — upper" },
            { t: "bolt", p: [0.52, 1.00, 0.27], spec: "Torx" },
            { t: "bolt", p: [0.44, 0.66, 0.27], spec: "Torx — lower" },
            { t: "bolt", p: [0.20, 0.63, 0.27], spec: "Torx" },
          ],
          detail: "Remove the Torx fasteners, then release the push-tabs and pull the panel straight off. Don't twist the tabs.",
          warning: "KTM panel tabs are brittle — pull perpendicular, don't lever.",
        },
        { id: "s4", part: "fairingRight", title: "Right side panel / tank shroud",
          tools: ["Torx set"],
          videoSearch: "KTM 1290 Super Adventure side panel fairing removal",
          fasteners: [
            { t: "bolt", p: [0.30, 1.07, -0.27], spec: "Torx — upper" },
            { t: "bolt", p: [0.52, 1.00, -0.27], spec: "Torx" },
            { t: "bolt", p: [0.44, 0.66, -0.27], spec: "Torx — lower" },
            { t: "bolt", p: [0.20, 0.63, -0.27], spec: "Torx" },
          ],
          detail: "Mirror of the left side.",
        },
        { id: "s5", part: "tank", title: "Fuel tank",
          tools: ["Torx set", "Rag"],
          videoSearch: "KTM 1290 Super Adventure fuel tank removal",
          fasteners: [
            { t: "bolt", p: [0.44, 0.98, 0.13],  spec: "Torx — tank mount" },
            { t: "bolt", p: [-0.08, 0.97, -0.13], spec: "Torx — tank mount" },
            { t: "conn", p: [0.12, 0.92, -0.16], spec: "Fuel quick-connect — relieve pressure first, expect a little spill" },
            { t: "conn", p: [-0.04, 0.92, -0.16], spec: "Fuel-pump wiring connector" },
            { t: "conn", p: [0.06, 0.90, 0.16],  spec: "Vent / overflow lines" },
          ],
          warning: "Relieve fuel-system pressure before opening the quick-connect. No ignition sources; rag underneath.",
          detail: "Undo the tank mounts, pop the fuel quick-connect, pump wiring and vent lines, then lift the tank away. The airbox and cam covers are underneath — that's the start of the valve-check job.",
        },
      ],
    },
  },

  /* Suzuki DR-Z400S — the dual-sport. Uses the `dualsport` archetype: single seat,
     no windscreen, tall 21"/18" spoked wheels, high front fender, and small
     shroud/number panels up by the tank instead of low fairings. Suzuki yellow. */
  drz400s: {
    archetype: "dualsport",
    colors: { paint: "#F5C518", frame: "#2A2C31", cam: "#3A3D44" },
    scene: {
      title: "DR-Z400 — seat, shrouds & tank",
      phase: "Phase 1 · Access for the valve check / carb work",
      camera: { pos: [2.8, 1.8, 3.2], target: [0, 0.95, 0] },
      video: { search: "DRZ400 tank removal seat side panels valve check teardown" },
      diagramRefs: [
        ["Suzuki OEM parts fiche (Partzilla / BikeBandit)", "Exploded diagrams — the authoritative fastener map for the DR-Z"],
        ["ThumperTalk · DRZ400 forum", "The definitive DR-Z community — teardown threads, jetting, the balancer-shaft issue"],
        ["soloracer.com DRZ tyre guides", "Dual-sport and supermoto tyre comparisons for the S and SM"],
      ],
      removable: {
        seatRider:   { explode: [-0.30, 0.55, 0] },
        fairingLeft: { explode: [0, 0.15, 0.75] },
        fairingRight:{ explode: [0, 0.15, -0.75] },
        tank:        { explode: [0, 0.80, 0] },
      },
      steps: [
        { id: "s1", part: "seatRider", title: "Seat (single)",
          tools: ["8 mm socket / T-handle"],
          videoSearch: "DRZ400 seat removal",
          fasteners: [
            { t: "bolt", p: [-0.74, 1.00, 0.11],  spec: "Seat bolt — left rear" },
            { t: "bolt", p: [-0.74, 1.00, -0.11], spec: "Seat bolt — right rear" },
          ],
          detail: "Two bolts at the rear of the seat, then slide it back off the front tongue. One long seat — there's no pillion section to remove first.",
        },
        { id: "s2", part: "fairingLeft", title: "Left shroud / number panel",
          tools: ["Phillips / 8 mm"],
          videoSearch: "DRZ400 side panel shroud removal",
          fasteners: [
            { t: "bolt", p: [0.46, 1.20, 0.21], spec: "Shroud bolt — top (into tank)" },
            { t: "bolt", p: [0.40, 0.94, 0.21], spec: "Shroud bolt — lower/radiator" },
            { t: "bolt", p: [-0.28, 0.98, 0.18], spec: "Number-panel bolt — rear" },
          ],
          detail: "The shroud bolts into the tank at the top and the radiator/frame lower down — the panel comes off with the tank on. Watch for the grommets.",
          warning: "Plastic gets brittle with age and sun. Support the panel as the last bolt comes out.",
        },
        { id: "s3", part: "fairingRight", title: "Right shroud / number panel",
          tools: ["Phillips / 8 mm"],
          videoSearch: "DRZ400 side panel shroud removal",
          fasteners: [
            { t: "bolt", p: [0.46, 1.20, -0.21], spec: "Shroud bolt — top (into tank)" },
            { t: "bolt", p: [0.40, 0.94, -0.21], spec: "Shroud bolt — lower/radiator" },
            { t: "bolt", p: [-0.28, 0.98, -0.18], spec: "Number-panel bolt — rear" },
          ],
          detail: "Mirror of the left side.",
        },
        { id: "s4", part: "tank", title: "Fuel tank",
          tools: ["8 mm socket", "Fuel line pliers", "Rag"],
          videoSearch: "DRZ400 fuel tank removal petcock fuel line",
          fasteners: [
            { t: "bolt", p: [0.44, 1.16, 0.10],  spec: "Tank bolt — front" },
            { t: "bolt", p: [0.04, 1.10, -0.10], spec: "Tank bolt — rear" },
            { t: "conn", p: [0.16, 0.98, -0.14], spec: "Turn the petcock OFF, then pull the fuel line" },
            { t: "conn", p: [0.10, 1.00, 0.14],  spec: "Vacuum line + tank vent hose" },
          ],
          warning: "Carbureted bike — turn the petcock OFF first and expect fuel in the line. No ignition sources; rag underneath.",
          detail: "Petcock off, fuel + vacuum lines off, two bolts, lift the tank straight up and back. That exposes the carb and the cam cover — the start of the valve check.",
        },
      ],
    },
  },
};

/* Suzuki DR-Z400SM — same bike from the frame up, completely different rolling
   chassis: fat 17" wheels both ends, shorter fork, low street fender. Bodywork
   and therefore the teardown are identical, so it reuses the S's scene. */
window.DB.bikes3d.drz400sm = {
  archetype: "dualsport",
  colors: { paint: "#1B4FA0", frame: "#2A2C31", cam: "#3A3D44" },  // SM in Suzuki blue
  slots: {
    wheelFront: { at: 1.00, R: 0.24, tube: 0.085 },   // 17" street, wide
    wheelRear:  { at: -0.95, R: 0.23, tube: 0.105 },
    fork:       { tubeAt: [0.84, 0.70], zOff: 0.09, angle: 0.42, len: 0.86, clampAt: [0.68, 1.06] },
    frontFender:{ at: [0.98, 0.56], angle: -0.12, size: [0.40, 0.04, 0.22] }, // low, hugs the wheel
    finalDrive: { comp: "chain", front: [-0.30, 0.55], rear: [-0.95, 0.23], z: -0.14 },
  },
  scene: window.DB.bikes3d.drz400s.scene,   // identical bodywork teardown
};

/* =========================================================================
   COMPOSER — resolve (archetype + bike overrides + scene) → render shape.
   ========================================================================= */
(function () {
  const clone = o => JSON.parse(JSON.stringify(o));
  function deepMerge(dst, src) {
    for (const k in src) {
      const v = src[k];
      if (v === null || v === undefined) { delete dst[k]; }
      else if (v && typeof v === "object" && !Array.isArray(v) &&
               dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) deepMerge(dst[k], v);
      else dst[k] = Array.isArray(v) ? v.slice() : v;
    }
    return dst;
  }
  function resolveArchetype(name, seen) {
    seen = seen || {};
    if (seen[name]) return { slots: {}, colors: {} }; // guard against cycles
    seen[name] = true;
    const a = (window.DB.archetypes || {})[name];
    if (!a) return { slots: {}, colors: {} };
    const base = a.extends ? resolveArchetype(a.extends, seen) : { slots: {}, colors: {} };
    return {
      label: a.label,
      camera: a.camera || base.camera,
      colors: Object.assign({}, base.colors, a.colors),
      slots: deepMerge(clone(base.slots), clone(a.slots || {})),
    };
  }

  const cache = {};
  window.DB.composeBike = function (modelId) {
    if (cache[modelId]) return cache[modelId];
    const bike = (window.DB.bikes3d || {})[modelId];
    if (!bike || !window.DB.components) return null;
    const arch = resolveArchetype(bike.archetype);
    const colors = Object.assign({}, arch.colors, bike.colors);
    const slots = deepMerge(clone(arch.slots), clone(bike.slots || {}));
    const scene = bike.scene || {};
    const removable = scene.removable || {};

    const parts = [];
    for (const id in slots) {
      const slot = slots[id];
      if (!slot || !slot.comp) continue;
      const builder = window.DB.components[slot.comp];
      if (!builder) { console.warn("Unknown component:", slot.comp, "for slot", id); continue; }
      const prims = builder(slot, colors);
      const rem = removable[id];
      const part = { id, name: slot.name || id, prims, fixed: !rem };
      if (rem) part.explode = rem.explode;
      parts.push(part);
    }

    const def = {
      title: scene.title, phase: scene.phase,
      camera: scene.camera || bike.camera || arch.camera || { pos: [2.9, 1.75, 3.25], target: [0, 0.9, 0] },
      exposedNote: scene.exposedNote, video: scene.video, diagramRefs: scene.diagramRefs,
      parts, steps: scene.steps || [],
    };
    cache[modelId] = def;
    return def;
  };
})();
