/* =========================================================================
   CATALOG — the motorcycle "database".
   To add a new model: add an entry under models{} (copy an existing one).
   To add a model year: add it to years[] and, if anything differs for that
   year, add a yearOverrides["<year>"] object — its keys deep-merge over the
   base spec (e.g. a different air filter part number for 2019+).
   Fields marked verified:false render a VERIFY badge in the UI.
   ========================================================================= */
window.DB = window.DB || {};

window.DB.catalog = {
  models: {
    mts950: {
      name: "Multistrada 950",
      brand: "ducati",
      years: [2017, 2018, 2019, 2020, 2021],
      defaultYear: 2017,
      disp: "937",
      spark: "Single spark",
      engine: "Testastretta 11° L-twin · 4 valves/cyl",
      scheduleId: "testastretta_11_15k",
      valveType: "desmo",
      belt: { part: "73740251A", teeth: 88, width: "21 mm", verified: true,
              note: "Shared with the Monster 1200" },
      plugs: { count: 2, type: "NGK MAR9A-J", verified: true, note: "1 per cylinder" },
      airFilter: { part: "42610491A", verified: true },
      oilFilter: { part: "44440038A", verified: true, note: "→ superseded by 44440031C" },
      valveCoverGasket: { part: "78810931A", verified: true,
              note: "Universal external valve-cover gasket — shared across Ducati liquid-cooled Testastretta & Superquadro families" },
      camPulleyNut: { part: "70310031A", thread: "M15×1", verified: true,
              note: "Locks the timing-belt pulleys onto the camshaft tapers (or similar variant per model/year)" },
      oilCapacityL: { value: 3.7, verified: false, note: "with filter change — verify in manual" },
      oil: "Shell Advance 4T Ultra 15W-50 · JASO MA2",
      coolant: "Silicate-free OAT · ethylene-glycol",
      shim: "Later Ducati 4V (7 mm) family",
      clearance: { openMin: 0.13, openMax: 0.18, closeMin: 0.05, closeMax: 0.10, verified: false },
      resetId: "dds_generic",
      yearOverrides: {
        // Example: "2019": { airFilter: { part: "42610xxxB", verified: false } }
      },
    },

    monster1200s: {
      name: "Monster 1200S",
      brand: "ducati",
      years: [2014, 2015, 2016],
      defaultYear: 2014,
      disp: "1198",
      spark: "Dual spark",
      engine: "Testastretta 11° DS L-twin · 4 valves/cyl",
      scheduleId: "testastretta_11_15k",
      valveType: "desmo",
      belt: { part: "73740251A", teeth: 88, width: "21 mm", verified: true,
              note: "Shared with the Multistrada 950" },
      plugs: { count: 4, type: "NGK MAR9A-J", verified: true, note: "2 per cylinder (Dual Spark)" },
      airFilter: { part: "42610341A", verified: false, note: "sources show 42610341B — verify" },
      oilFilter: { part: "44440038A", verified: true, note: "→ superseded by 44440031C" },
      valveCoverGasket: { part: "78810931A", verified: true,
              note: "Universal external valve-cover gasket — shared across Ducati liquid-cooled Testastretta & Superquadro families" },
      camPulleyNut: { part: "70310031A", thread: "M15×1", verified: true,
              note: "Locks the timing-belt pulleys onto the camshaft tapers (or similar variant per model/year)" },
      oilCapacityL: { value: 3.5, verified: false, note: "with filter change — verify in manual" },
      oil: "Shell Advance 4T Ultra 15W-50 · JASO MA2",
      coolant: "Silicate-free OAT · ethylene-glycol",
      shim: "Later Ducati 4V (7 mm) family",
      clearance: { openMin: 0.13, openMax: 0.18, closeMin: 0.05, closeMax: 0.10, verified: false },
      resetId: "dds_generic",
      yearOverrides: {},
    },

    /* KTM 1290 Super Adventure — LC8 75° V-twin. The 1290 SA was unveiled at
       EICMA late 2014 and sold as a 2015 model; 2014 is kept selectable because
       early bikes were first-registered that year. Data researched from the KTM
       service plan + parts sources; most is flagged `verify` pending the owner's
       manual for your exact year. Fundamentally different from the Ducatis:
       chain-driven cams (NO timing belts) and conventional shim-under-bucket
       valves (NOT desmodromic). */
    ktm1290sa: {
      name: "1290 Super Adventure",
      brand: "ktm",
      years: [2014, 2015, 2016],
      defaultYear: 2015,
      disp: "1301",
      spark: "Twin ignition",
      engine: "LC8 75° V-twin · 8-valve DOHC · chain cam drive (no belts)",
      scheduleId: "ktm_lc8",
      valveType: "shim",   // conventional shim-under-bucket, not desmo
      finalDrive: "chain",
      plugs: { count: 4, type: "NGK LKAR9BI-10 (iridium)", verified: false,
               note: "2 per cylinder (LC8 twin ignition) · M12×1.25 · gap 1.0 mm — verify per year" },
      airFilter: { part: "verify — LC8 airbox element", verified: false },
      oilFilter: { part: "00050000068", verified: false, note: "Motorex/KTM oil-service kit (filter + O-rings)" },
      oilCapacityL: { value: 3.5, verified: false, note: "~3.5 L with filter (2015) — verify per year" },
      oil: "Motorex 10W-50 · JASO MA2 (KTM/Motorex spec)",
      coolant: "Motorex Coolant M-series · ethylene-glycol (KTM spec)",
      shim: "Shim-under-bucket (conventional) — NOT desmodromic; no closer shims",
      clearance: { openMin: 0.10, openMax: 0.15, closeMin: 0.25, closeMax: 0.30, verified: false },
      resetId: "ktm_reset",
      yearOverrides: {},
    },

    /* Suzuki DR-Z400S / SM — DOHC liquid-cooled single, carbureted, chain cam
       drive, conventional shim valves. Engine + service intervals are identical
       between the S (dual-sport, 21"/18") and SM (supermoto, 17"/17"); the wheels,
       tyres and suspension are what differ — see `tires`.
       NOTE the dry-sump quirk: the oil lives in the FRAME, and the level check has
       a specific procedure (see `serviceOverrides.oil_change`). No ECU service
       reminder on this bike, so no resetId. */
    drz400: {
      name: "DR-Z400S / SM",
      brand: "suzuki",
      years: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011,
              2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
      defaultYear: 2006,
      disp: "398",
      spark: "Single spark",
      engine: "DOHC liquid-cooled single · 4 valves · carbureted (Mikuni BSR36) · chain cam drive",
      scheduleId: "suzuki_drz400",
      valveType: "shim",
      finalDrive: "chain",
      plugs: { count: 1, type: "NGK CR8E", verified: true, note: "1 per cylinder (Denso U24ESR-N equivalent)" },
      airFilter: { part: "13780-29F00", verified: false, note: "OEM element — verify for your year; oiled-foam aftermarket (Uni/Twin Air) is the common upgrade" },
      oilFilter: { part: "16510-05240", verified: false, note: "verify against the fiche for your year" },
      oilCapacityL: { value: 1.7, verified: true,
                      note: "1.7 L / 1.8 US qt WITH filter change. Dry sump — the oil lives in the frame, not a wet sump." },
      oil: "SAE 10W-40 · API SF/SG or SH/SJ · JASO MA (wet clutch — no friction modifiers)",
      coolant: "Suzuki Super Long Life (ethylene-glycol, silicate-free)",
      shim: "Shim-under-bucket (conventional) — NOT desmodromic",
      clearance: { openMin: 0.10, openMax: 0.20, closeMin: 0.20, closeMax: 0.30, verified: true,
                   note: "COLD. Intake 0.10–0.20 mm, exhaust 0.20–0.30 mm" },

      /* ---- Tyres: the S and SM are completely different fitments ---- */
      tires: {
        note: "The DR-Z400S (dual-sport) and DR-Z400SM (supermoto) share an engine but " +
              "nothing below the axles. Confirm which wheels you actually have before ordering.",
        variants: [
          { id: "s", label: "DR-Z400S — dual-sport (21\" / 18\")",
            front: "80/100-21", rear: "120/90-18", verified: true,
            stock: "Bridgestone Trail Wing (adequate; almost everyone replaces them)" },
          { id: "sm", label: "DR-Z400SM — supermoto (17\" / 17\")",
            front: "120/70-17", rear: "140/70-17", verified: true,
            stock: "Dunlop D208" },
        ],
        /* Choice guidance is opinion/experience, not manufacturer spec. */
        choices: [
          { use: "90/10 — mostly pavement (S)", picks: "Shinko 705, Kenda K761, Michelin Anakee Street",
            note: "Long-wearing, quiet, fine on gravel. Vague in mud." },
          { use: "50/50 — real dual-sport (S)", picks: "Continental TKC80, Mitas E-07, Shinko 804/805",
            note: "The honest middle. TKC80 grips everything and wears fast." },
          { use: "20/80 — dirt-biased DOT knobby (S)", picks: "Dunlop D606, Pirelli MT21, Motoz Tractionator",
            note: "Excellent off-road, noisy and squirmy on wet tarmac; shorter life." },
          { use: "Supermoto street (SM)", picks: "Dunlop Q-series, Michelin Pilot Power, Pirelli Diablo Rosso",
            note: "Sticky and fun; the 17\" fitment is small so choice is limited." },
          { use: "Supermoto track/rain (SM)", picks: "Bridgestone Battlax rain, Michelin Power Supermoto",
            note: "Specialist compounds — overkill unless you're racing." },
        ],
        pressureNote: "Road pressures typically ~25–30 psi (verify the swingarm/manual sticker); " +
                      "air down substantially for dirt on the S, and use rim locks if you go low.",
      },

      /* ---- Bike-specific service procedure overrides ---- */
      serviceOverrides: {
        oil_change: {
          note: "DRY SUMP — the oil lives in the FRAME. There are TWO drain plugs (engine case " +
                "and frame) plus the filter, and the level check has a specific procedure that " +
                "trips up most people. Measure by volume; don't trust a cold dipstick reading.",
          steps: [
            "Warm the engine ~5 min (or a short ride), then shut off and let it sit 2–3 min so oil drains back",
            "Bike UPRIGHT and level — NOT on the side stand (this is the #1 mistake)",
            "Remove the frame drain plug AND the engine case drain plug — drain both",
            "Remove and replace the oil filter (behind the cover on the right case); note O-ring orientation",
            "Clean/refit both drain plugs with new washers; torque to spec",
            "Refill with ~1.7 L / 1.8 US qt of 10W-40 JASO MA — measure it, don't eyeball it",
            "Start, idle ~1 min to fill the frame and filter, shut off, wait 2–3 min",
            "Check level: insert the dipstick until the threads TOUCH the neck — do NOT screw it in — bike vertical",
            "Top up only to the upper mark. Overfilling pushes oil away from the dipstick tube and reads false",
            "Re-check for leaks at both plugs and the filter cover",
          ],
        },
      },

      /* ---- Recommended modifications (community consensus, not factory) ---- */
      mods: {
        note: "The DR-Z is famously under-carbureted from the factory and has one known weak " +
              "internal part. These are the mods the community does first. All are owner " +
              "opinion / community consensus — none are Suzuki-specified.",
        items: [
          { name: "3×3 airbox mod + rejet", priority: "Do first (together)", verified: false,
            detail: "Cut a 3\"×3\" opening in the airbox lid to unrestrict intake. The stock carb is " +
                    "already lean, so this MUST be paired with rejetting or it runs worse and backfires. " +
                    "Cheapest real power gain on the bike." },
          { name: "Jetting kit (JD Jetting / Dynojet)", priority: "Do first (together)", verified: false,
            detail: "Stock is roughly 142.5 main / 22.5 pilot; with the 3×3 a common setup is ~150 main / " +
                    "27.5 pilot plus the kit's needle. JD's kit is jetted for your elevation. Verify against " +
                    "your altitude and exhaust." },
          { name: "Balancer-shaft adjuster (\"doohickey\") + spring", priority: "Preventive — important", verified: false,
            detail: "The stock balancer-shaft adjuster lever is the DR-Z's known weak point; owners report " +
                    "wear/failure that can require splitting the cases. Aftermarket steel replacements are the " +
                    "standard preventive fix. Widely reported by the community — confirm condition before you " +
                    "assume yours is fine." },
          { name: "Exhaust (slip-on or full)", priority: "Optional", verified: false,
            detail: "FMF Q4/PowerCore and similar. Wakes it up, but rejet again after fitting — this is the " +
                    "third leg of the intake/jetting/exhaust stool." },
          { name: "Gearing change", priority: "Optional", verified: false,
            detail: "Stock gearing is a compromise. Taller (bigger front / smaller rear) calms highway revs; " +
                    "shorter helps technical dirt. Cheap to try — change the front sprocket first." },
          { name: "Protection: skid plate, radiator guards, hand guards", priority: "If you ride dirt", verified: false,
            detail: "The frame carries the oil, so a frame/case hit is not just cosmetic. Radiator guards " +
                    "are cheap insurance on a tip-over." },
          { name: "Suspension setup for your weight", priority: "Underrated", verified: false,
            detail: "Stock springs are set for a light rider. Correct springs/sag transform the bike more " +
                    "than any engine mod." },
        ],
      },

      yearOverrides: {},
    },
  },

  /* Resolve a model + year into a final spec (base + year overrides). */
  resolve(modelId, year) {
    const base = this.models[modelId];
    if (!base) return null;
    const ov = (base.yearOverrides || {})[String(year)] || {};
    const merged = JSON.parse(JSON.stringify(base));
    (function deepMerge(dst, src) {
      for (const k of Object.keys(src)) {
        if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) &&
            dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) {
          deepMerge(dst[k], src[k]);
        } else dst[k] = src[k];
      }
    })(merged, ov);
    delete merged.yearOverrides;
    return merged;
  },
};

/* Shim geometry — shared by the later 4V family both current bikes use. */
window.DB.shimGeometry = {
  openStep: 0.05, closeStep: 0.05,
  openRange: [1.80, 3.20],   // typical later-4V opener thickness range (mm)
  closeRange: [2.95, 3.55],  // typical later-4V closer thickness range (mm)
};

/* Belt tension targets by brand (acoustic pluck method). */
window.DB.beltBrands = {
  oem: { label: "OEM / Gates",            newLow: 105, newHigh: 115, usedLow: 85, usedHigh: 105, verified: true,
         note: "Ducati 4-valve bulletin spec." },
  ca:  { label: "CA-Cycleworks ExactFit", newLow: 97,  newHigh: 101, usedLow: 99, usedHigh: 110, verified: true,
         note: "Target 99 Hz. Stiffer belt — do NOT set to 110 Hz when new." },
  bdl: { label: "Belt Drive Ltd Tru-Fit", newLow: 105, newHigh: 115, usedLow: 85, usedHigh: 105, verified: false,
         note: "No brand-specific Hz published — defaulted to OEM range. Confirm on the package card." },
};
window.DB.hzFloor = 70;

window.DB.torque = [
  { k: "Valve cover (T30)", v: "10 N·m", verify: true },
  { k: "Spark plug",        v: "12 N·m", verify: true },
  { k: "Belt cover",        v: "5 N·m",  verify: true },
  { k: "Water-pump drain",  v: "11 N·m", verify: true },
  { k: "Oil drain plug",    v: "20 N·m", verify: true },
  { k: "Oil filter",        v: "11 N·m", verify: true },
  { k: "Tensioner nut",     v: "M8 self-locking", verify: true },
  { k: "Cam pulley nut (70310031A)", v: "M15×1 — per manual", verify: true },
];

window.DB.valvePositions = [
  { id: "h_i1", head: "Horizontal", name: "Intake 1" },
  { id: "h_i2", head: "Horizontal", name: "Intake 2" },
  { id: "h_e1", head: "Horizontal", name: "Exhaust 1" },
  { id: "h_e2", head: "Horizontal", name: "Exhaust 2" },
  { id: "v_i1", head: "Vertical",   name: "Intake 1" },
  { id: "v_i2", head: "Vertical",   name: "Intake 2" },
  { id: "v_e1", head: "Vertical",   name: "Exhaust 1" },
  { id: "v_e2", head: "Vertical",   name: "Exhaust 2" },
];

window.DB.tunerApps = {
  iphone:  ["n-Track Tuner (CA-Cycleworks & Belt Drive Ltd pick)", "Tension2Go (belt-Hz specific)", "Gates Carbon Drive (free)", "any chromatic guitar tuner"],
  android: ["gStrings (chromatic mode)", "n-Track Tuner", "Spectroid (spectrum analyzer)", "any chromatic guitar tuner"],
};

window.DB.vendors = [
  ["CA-Cycleworks", "ca-cycleworks.com — US Ducati specialist; individual shims + kits"],
  ["Desmo Times / EMS", "desmotimes.com — 34-pc assortment (16 openers + 18 closers)"],
  ["Ducati Tool Rental", "ducatitoolrental.com — kits + measuring tools"],
  ["desmo-racing.com", "EU — shims + 8mm closer measuring tool (K512A)"],
  ["officine08.com", "EU — individual 4V shims"],
  ["Ducati dealer (OEM)", "by part number once size is known"],
];
