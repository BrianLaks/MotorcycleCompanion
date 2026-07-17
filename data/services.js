/* =========================================================================
   SERVICES — the service-type "database".
   Every maintenance activity the app can track is defined here. The Start
   Service wizard builds its checklist from these definitions, and every
   completed service is logged against its id.

   Fields:
     name, short     — display names
     partsFor(spec)  — returns [{label, part}] given a resolved bike spec
                       (spec may be null for models not in the catalog)
     steps           — generic checklist (array of strings), and/or
     stepsByModel    — { modelId: { pre:[], post:[] } } model-specific
                       teardown/reassembly (used by desmo_valve)
     resetIndicator  — true if the dash service reminder should be reset
                       after this service
     tools           — notable tools/consumables
   ========================================================================= */
window.DB = window.DB || {};

window.DB.services = {
  oil_change: {
    name: "Oil & filter change",
    short: "Oil",
    resetIndicator: true,
    partsFor: spec => spec ? [
      { label: "Engine oil", part: spec.oil + (spec.oilCapacityL ? ` · ~${spec.oilCapacityL.value} L` : "") },
      { label: "Oil filter", part: spec.oilFilter.part + (spec.oilFilter.note ? " " + spec.oilFilter.note : "") },
      { label: "Drain-plug crush washer", part: "check size on removal" },
    ] : [],
    tools: ["Oil filter wrench/socket", "Torque wrench", "Drain pan"],
    steps: [
      "Warm the engine 5 minutes (oil flows, contaminants suspend); shut off",
      "Bike level (rear stand or held upright — NOT side stand) for draining and sighting",
      "Remove filler cap; remove drain plug; drain fully into pan",
      "Remove old filter (filter wrench); wipe seat clean",
      "Smear fresh oil on new filter O-ring; spin on; torque to spec",
      "New crush washer on drain plug; torque to spec",
      "Fill with fresh oil to mid-sight-glass (bike upright)",
      "Start engine 30–60 s; check for leaks at plug + filter; shut off",
      "Wait 2–3 min; re-check level in sight glass; top up to upper mark",
      "Record oil + filter used; dispose of old oil properly",
    ],
  },

  desmo_valve: {
    name: "Desmo service — valve clearance check/adjust",
    short: "Desmo",
    resetIndicator: true,
    applies: spec => spec.valveType === "desmo",   // desmodromic engines only
    partsFor: spec => spec ? [
      { label: "Valve-cover gasket", part: spec.valveCoverGasket ? spec.valveCoverGasket.part + " (universal Testastretta/Superquadro)" : "per head — check fiche" },
      { label: "Spark plugs ×" + spec.plugs.count, part: spec.plugs.type },
      { label: "Coolant (drained for access)", part: spec.coolant },
      { label: "Shims as measured", part: spec.shim },
    ] : [],
    tools: ["Feeler gauges", "Micrometer", "T30 Torx", "RTV sealant", "Shim kit or per-size order"],
    note: "Use the Valves & shims tab to record measurements — completing this " +
          "service snapshots the worksheet into the log entry.",
    // shared teardown handled by access modules; `work` is only the at-access job
    needs: ["bodywork", "tank", "cooling_drain", "radiator", "airbox", "belt_covers", "valve_covers"],
    work: [
      "Measure every opener + closer clearance (Valves & shims tab)",
      "Swap shims as calculated; re-measure after every change",
      "Fit new spark plugs while the tops are open (torque; seat coil caps/leads)",
    ],
    steps: [ // fallback if no access modules for the model
      "Gain access to both cam covers per your model's teardown procedure",
      "Measure all clearances (Valves & shims tab); swap shims; re-measure",
      "Reassemble with new gaskets; torque covers to spec",
    ],
  },

  belts: {
    name: "Timing belt replacement",
    short: "Belts",
    resetIndicator: false,
    applies: spec => !!spec.belt,   // only engines with rubber timing belts
    partsFor: spec => spec ? [
      { label: "Timing belts ×2", part: `${spec.belt.part} · ${spec.belt.teeth}T · ${spec.belt.width}` },
      ...(spec.camPulleyNut ? [{ label: "Cam pulley nut (if pulleys disturbed)", part: `${spec.camPulleyNut.part} · ${spec.camPulleyNut.thread}` }] : []),
    ] : [],
    tools: ["Belt tension app (see Belt tension tab)", "5mm/4mm hex", "Torque wrench"],
    note: "Interference engine — a skipped tooth or loose belt bends valves. " +
          "Log tensions in the Belt tension tab; completing this service snapshots them.",
    needs: ["bodywork", "tank", "airbox", "belt_covers"],
    work: [
      "Engine COLD; set to horizontal-cylinder TDC (locking pins if available)",
      "Mark old belt rotation direction if reusing; note tensioner positions",
      "Slack tensioners; remove old belts",
      "Fit new belts without rotating cams/crank; confirm timing marks aligned",
      "Set tension by frequency (Belt tension tab — brand matters)",
      "Rotate engine 2 full revolutions by hand; re-check timing marks + tension",
      "Re-tension if needed; torque tensioner nuts",
    ],
    steps: [
      "Engine COLD; remove belt covers (6× 4mm)",
      "Set engine to horizontal-cylinder TDC; slack tensioners; remove old belts",
      "Fit new belts; align timing marks; set tension by frequency",
      "Rotate 2 revolutions; re-check timing + tension; torque tensioner nuts; refit covers",
    ],
  },

  spark_plugs: {
    name: "Spark plug replacement",
    short: "Plugs",
    resetIndicator: false,
    partsFor: spec => spec ? [
      { label: `Spark plugs ×${spec.plugs.count}`, part: `${spec.plugs.type} (${spec.plugs.note})` },
    ] : [],
    tools: ["Plug socket (thin wall)", "Torque wrench", "Compressed air"],
    needs: ["bodywork", "tank", "airbox", "belt_covers"],
    work: [
      "Blow out plug recesses BEFORE removal (nothing falls in the bore)",
      "Remove old plugs; inspect colour (tan = good)",
      "Fit new plugs DRY (no anti-seize), thread by hand first; torque to spec",
    ],
    steps: [
      "Gain access per model (tank up / airbox off as needed)",
      "Blow out recesses; remove coils/caps; swap plugs (torque, thread by hand)",
      "Refit coils/caps until they click",
    ],
  },

  air_filter: {
    name: "Air filter replacement",
    short: "Air filter",
    resetIndicator: false,
    partsFor: spec => spec ? [
      { label: "Air filter", part: spec.airFilter.part + (spec.airFilter.note ? " — " + spec.airFilter.note : "") },
    ] : [],
    needs: ["bodywork", "tank"],
    work: [
      "Open the airbox lid; note filter orientation; remove the old filter",
      "Wipe the airbox interior — nothing loose left inside",
      "Seat the new filter fully; close the airbox lid",
    ],
    steps: [
      "Access the airbox per model (tank up/off)",
      "Swap filter (note orientation); wipe airbox; close up",
    ],
  },

  brake_fluid: {
    name: "Brake fluid flush",
    short: "Brake fluid",
    resetIndicator: false,
    partsFor: () => [{ label: "Brake fluid", part: "DOT 4 (fresh, sealed bottle)" }],
    tools: ["Bleed kit or vacuum bleeder", "Clear tubing", "Rag + fender protection"],
    steps: [
      "Protect paint — brake fluid strips it; rags everywhere",
      "Front: reservoir top off; draw old fluid; refill with fresh",
      "Bleed at each caliper until fluid runs clear (never let reservoir empty)",
      "Rear: same procedure at rear master + caliper",
      "Firm lever + pedal; top reservoirs to mark; caps on",
      "Pump lever/pedal before ANY movement of the bike",
    ],
  },

  clutch_fluid: {
    name: "Clutch fluid flush",
    short: "Clutch fluid",
    resetIndicator: false,
    partsFor: () => [{ label: "Clutch fluid", part: "DOT 4 (fresh, sealed bottle)" }],
    steps: [
      "Protect paint; open clutch reservoir",
      "Bleed at slave cylinder until clear, keeping reservoir topped",
      "Check lever engagement point; top to mark; cap on",
    ],
  },

  coolant: {
    name: "Coolant replacement",
    short: "Coolant",
    resetIndicator: false,
    partsFor: spec => spec ? [
      { label: "Coolant", part: spec.coolant },
      { label: "Drain crush washer", part: "check size on removal" },
    ] : [],
    needs: ["cooling_drain", "radiator"],
    work: [
      "Flush the system with distilled water until it runs clear",
      "Run to temp with the cap off until the thermostat opens; top up; cap on",
      "Check the expansion-tank level after the next ride (cold)",
    ],
    steps: [
      "Engine COLD; remove rad cap; drain at water-pump drain bolt",
      "Flush with distilled water; new crush washer; torque drain bolt",
      "Fill slowly with premix; burp air; run to temp; top up; cap on",
    ],
  },

  chain_service: {
    name: "Chain clean, lube & adjust",
    short: "Chain",
    resetIndicator: false,
    partsFor: () => [{ label: "Chain lube + cleaner", part: "O-ring-safe" }],
    steps: [
      "Rear stand; clean chain (O-ring-safe cleaner + grunge brush)",
      "Check slack at tightest spot (rotate wheel); compare to swingarm sticker spec",
      "Adjust: loosen axle, turn adjusters EVENLY (count flats), check alignment marks",
      "Torque axle nut to spec; re-check slack",
      "Lube inner run of warm chain; wipe excess",
    ],
  },

  annual_check: {
    name: "Annual inspection",
    short: "Annual",
    resetIndicator: false,
    partsFor: () => [],
    steps: [
      "Tires: tread depth, age (DOT date), pressure",
      "Brakes: pad thickness, disc wear, hose condition",
      "Steering head + wheel bearings: no play, smooth rotation",
      "Suspension: fork seals dry, rear shock leak-free",
      "Lights, horn, kill switch, side-stand switch all function",
      "Fasteners: spot-check per torque reference",
      "Battery: voltage ≥12.5 V rested; terminals tight + clean",
    ],
  },

  tire_front: {
    name: "Front tire replacement",
    short: "Front tire",
    resetIndicator: false,
    videoSearch: "Ducati Multistrada 950 front wheel removal",
    partsFor: () => [
      { label: "Front tire", part: "120/70 ZR17 (verify size on your swingarm/manual)" },
      { label: "Valve stem", part: "replace with the tire" },
    ],
    tools: ["Front/headstock stand", "Axle tools", "Torque wrench", "Tire machine (or a shop)"],
    note: "Mounting/balancing a tire needs a machine — most people pull the wheel here and hand it to a shop, then refit. This checklist covers the wheel R&R.",
    steps: [
      "Support the bike on a headstock/front stand; front wheel off the ground",
      "Loosen the axle pinch bolts on the fork legs",
      "Remove the axle bolt; slide the axle out, catching the spacers (note their order/side)",
      "Drop the wheel out; don't let the brake calipers hang by the lines — support them",
      "Have the new tire mounted + balanced (respect the rotation-direction arrow)",
      "Refit: spacers in correct order, axle through, snug axle bolt",
      "Torque axle to spec; pump forks a few times; then torque pinch bolts",
      "Spin the wheel, check disc runout/rub; pump the brake lever before riding",
    ],
  },

  tire_rear: {
    name: "Rear tire replacement",
    short: "Rear tire",
    resetIndicator: false,
    videoSearch: "Ducati Multistrada 950 rear wheel removal",
    partsFor: () => [
      { label: "Rear tire", part: "170/60 ZR17 (verify size on your swingarm/manual)" },
      { label: "Valve stem", part: "replace with the tire" },
    ],
    tools: ["Rear/paddock stand", "Axle tools", "Torque wrench", "Tire machine (or a shop)"],
    note: "Same idea as the front — pull the wheel, shop mounts/balances, refit. Watch chain slack + alignment on reassembly.",
    steps: [
      "Rear paddock stand; wheel off the ground",
      "Loosen the axle nut; back off the chain adjusters evenly (count the flats)",
      "Slide the axle out; catch spacers; drop the chain off the sprocket",
      "Roll the wheel out; support the caliper",
      "New tire mounted + balanced (rotation arrow)",
      "Refit wheel, chain onto sprocket, axle + spacers",
      "Set chain slack to spec using the alignment marks; keep both sides equal",
      "Torque the axle nut to spec; recheck slack; pump the brake pedal before riding",
    ],
  },

  brake_pads: {
    name: "Brake pad replacement",
    short: "Brake pads",
    resetIndicator: false,
    videoSearch: "Ducati Multistrada 950 front brake pad replacement",
    partsFor: () => [
      { label: "Front pads", part: "2 sets (twin front calipers) — verify compound/part" },
      { label: "Rear pads", part: "1 set" },
      { label: "Pad pins / clips", part: "reuse if good; have spares" },
    ],
    tools: ["Hex/Torx for pad pins", "Caliper piston tool or clean pry", "Brake cleaner", "Torque wrench"],
    note: "Condition-based — inspect at every service. Replace before the friction material reaches the wear line (~1.5 mm).",
    steps: [
      "Inspect thickness — replace if near the wear groove or unevenly worn",
      "Remove the pad retaining pin(s)/clip; slide the old pads out",
      "Push the pistons back gently (open the reservoir cap first; watch the level so it doesn't overflow)",
      "Clean the caliper; check pistons move freely and boots aren't torn",
      "Fit new pads + anti-rattle clip; reinstall the pin; torque if specified",
      "Pump the lever/pedal until firm BEFORE moving the bike",
      "Bed the pads in: several progressive stops from moderate speed, no hard grabbing when new",
    ],
  },

  chain_replace: {
    name: "Chain & sprocket replacement",
    short: "Chain+sprkt",
    resetIndicator: false,
    videoSearch: "Ducati Multistrada 950 chain and sprocket replacement",
    partsFor: () => [
      { label: "Drive chain", part: "525 pitch, correct link count — verify on your bike" },
      { label: "Front sprocket", part: "match tooth count (or change gearing deliberately)" },
      { label: "Rear sprocket", part: "match tooth count" },
      { label: "Master link", part: "rivet-type recommended for this power level" },
    ],
    tools: ["Chain breaker/riveter", "Rear stand", "Front sprocket socket", "Torque wrench", "Threadlocker"],
    note: "Replace chain and both sprockets together — a new chain on worn sprockets wears out fast. Interference isn't a concern here, but a thrown chain can lock the rear wheel.",
    steps: [
      "Rear stand; remove the front sprocket cover; note routing",
      "Break the old chain (grind/press the master or a pin); remove it",
      "Front sprocket: hold the wheel/brake, remove the retaining nut/clip, swap sprocket",
      "Rear sprocket: remove the wheel or carrier bolts; swap; torque with threadlocker",
      "Fit the new chain; set to correct length; install and rivet the master link",
      "Set chain slack to spec with the adjusters; keep alignment marks equal side-to-side",
      "Torque axle + front sprocket nut; spin and recheck slack at the tightest spot",
      "Lube the chain; short test ride; recheck slack (new chains seat and loosen)",
    ],
  },

  valve_check: {
    name: "Valve clearance check/adjust (shim)",
    short: "Valves",
    resetIndicator: true,
    applies: spec => spec.valveType === "shim",   // conventional shim engines only
    videoSearch: "KTM 1290 Super Adventure valve clearance check adjustment",
    partsFor: spec => spec ? [
      { label: "Valve-cover gasket(s)", part: "per head — check fiche" },
      { label: `Spark plugs ×${spec.plugs.count}`, part: spec.plugs.type },
      { label: "Coolant (if drained for access)", part: spec.coolant },
      { label: "Shims as measured", part: spec.shim },
    ] : [],
    tools: ["Feeler gauges", "Micrometer", "Torx set", "Shim assortment"],
    note: "Conventional shim-under-bucket — measure intake + exhaust and replace shims to bring " +
          "clearance into spec (thicker shim = LESS clearance). Not desmodromic; there are no closer shims.",
    needs: ["bodywork", "tank", "airbox", "valve_covers"],
    work: [
      "Engine COLD; rotate each cylinder to TDC compression",
      "Measure intake + exhaust clearance with feeler gauges; record every valve",
      "For any out-of-spec valve: measure the fitted shim, calculate the new size (thicker = less clearance)",
      "Swap shims; re-measure everything after changes",
      "Fit new spark plugs while the covers are off",
    ],
    steps: [ // fallback if no access modules for the model
      "Engine COLD; remove tank / bodywork; remove the valve covers",
      "Measure intake + exhaust clearance; swap shims (thicker = less clearance); re-measure",
      "New cam-cover gaskets; torque covers; fit new plugs; reassemble",
    ],
  },

  go_ride: {
    name: "Go for a ride (strongly recommended)",
    short: "Ride",
    resetIndicator: false,
    // the ▶ Video button searches for great rides on THIS specific bike
    videoSearchFor: (spec, bike) =>
      `${spec ? spec.name : "motorcycle"} best roads POV ride scenic route`,
    partsFor: () => [
      { label: "Fuel", part: "a full tank — you'll want it" },
      { label: "A great road", part: "BYO — see the ride videos" },
      { label: "Time", part: "an afternoon with nowhere to be" },
    ],
    tools: ["Helmet + full gear (ATGATT)", "Charged phone / GPS", "Sense of adventure"],
    note: "Good news: this bike doesn't need wrenching right now. The best thing for it " +
          "(seals, battery, your soul) is miles. So this 'service' is the fun kind — go ride, " +
          "then log the odometer so the app knows when something's ACTUALLY due… a long time from now.",
    steps: [
      "Plan a great ride near you — hit ▶ Video above for POV routes on this exact bike",
      "Pre-ride check: tyre pressures, chain, brakes, lights, fuel",
      "Gear up (ATGATT); zero the trip meter",
      "Ride it the way it was built to be ridden — enjoy every mile",
      "Home safe? Log the new odometer below so due-tracking stays honest",
      "Repeat until something on the schedule finally turns up. Take your time.",
    ],
  },

  custom: {
    name: "Custom / other work",
    short: "Custom",
    resetIndicator: false,
    partsFor: () => [],
    steps: ["Describe the work performed in the notes field"],
  },
};

/* =========================================================================
   RESET PROCEDURES — how to reset the bike's built-in service reminder.
   Models reference these via resetId in catalog.js.
   ========================================================================= */
window.DB.resets = {
  dds_generic: {
    title: "Service-indicator reset — Testastretta 11° era dash",
    verified: false,
    summary:
      "The wrench/SERV reminder on these dashes counts down to the next oil " +
      "service interval and CANNOT be reset from the handlebar controls. It is " +
      "designed to be cleared over the diagnostic port.",
    options: [
      { label: "Ducati dealer (DDS 2.0)",
        detail: "The official route — the dealer clears it with the Ducati Diagnosis System in minutes. Some dealers do it free with a parts purchase." },
      { label: "Melcodiag / JPdiag (DIY)",
        detail: "Community diagnostic software for Ducati ECUs. Needs a compatible OBD adapter (e.g. Lonelec Ducati cable or a generic FTDI-based K-line/CAN cable per the tool's docs). Can read/clear service reminders and error codes. VERIFY compatibility with your exact model year before buying a cable." },
      { label: "Handheld OBD service tools",
        detail: "Some multi-brand motorcycle scan tools (e.g. OBDstar-class units) list Ducati service-reset support. Check the tool's coverage list for your model + year first." },
    ],
    note: "The reminder is cosmetic — it does not change engine behavior. Many " +
          "owners log services here (or in the booklet) and let the dash icon " +
          "ride until the next dealer visit. Ignoring it has no mechanical effect.",
  },

  ktm_reset: {
    title: "Service-reminder reset — KTM LC8 dash",
    verified: false,
    summary:
      "KTM's service counter counts down to the next scheduled service. On the " +
      "1290 it's cleared over the diagnostic port (or, on some model years, from " +
      "the dash menu after a completed service).",
    options: [
      { label: "KTM dealer (KTM diagnostic tool)",
        detail: "The official route — the dealer clears the service counter with the KTM dealer tool in minutes." },
      { label: "Dash menu (some model years)",
        detail: "Some 1290 dashes expose a service-reset in the settings/menu after service — check your owner's manual for your exact year." },
      { label: "TuneECU / Healtech (DIY)",
        detail: "Community tools like TuneECU with a compatible cable can read/clear KTM service reminders and codes on many LC8s. VERIFY compatibility with your model year before buying a cable." },
    ],
    note: "The reminder is cosmetic — it doesn't affect running. Verify the exact " +
          "method for your model year before relying on it.",
  },
};
