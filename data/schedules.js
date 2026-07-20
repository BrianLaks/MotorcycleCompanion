/* =========================================================================
   SCHEDULES — maintenance interval "database".
   A schedule is a named set of interval rules; each model in catalog.js
   points at one via scheduleId. Rules reference a service type defined in
   services.js.

   Interval fields (any combination; whichever hits FIRST makes it due):
     everyKm / everyMi  — distance interval
     everyMonths        — time interval
   Optional:
     firstKm/firstMi/firstMonths — a shorter first interval (break-in svc)
     note, verify — shown in the UI
   ========================================================================= */
window.DB = window.DB || {};

window.DB.schedules = {
  testastretta_11_15k: {
    label: "Testastretta 11° — 15,000 km oil / 30,000 km desmo",
    note: "Intervals per the Ducati maintenance plan for Testastretta 11° engines. " +
          "Confirm against the owner's manual for your exact model year.",
    items: [
      { service: "oil_change",   everyKm: 15000, everyMi: 9000,  everyMonths: 12,
        firstKm: 1000, firstMi: 600, firstMonths: 6,
        note: "First service at 1,000 km / 600 mi", verify: true },
      { service: "desmo_valve",  everyKm: 30000, everyMi: 18000,
        note: "Valve clearance check/adjust — the 'Desmo service'", verify: true },
      { service: "belts",        everyKm: 30000, everyMi: 18000, everyMonths: 60,
        note: "Replace at 5 years even if mileage not reached", verify: true },
      { service: "spark_plugs",  everyKm: 30000, everyMi: 18000, verify: true },
      { service: "air_filter",   everyKm: 30000, everyMi: 18000,
        note: "Check/clean at every oil service in dusty conditions", verify: true },
      { service: "brake_fluid",  everyMonths: 24, verify: true },
      { service: "clutch_fluid", everyMonths: 24, verify: true },
      { service: "coolant",      everyKm: 45000, everyMi: 27000, everyMonths: 48, verify: true },
      { service: "chain_service", everyKm: 1000, everyMi: 600,
        note: "Clean, lube, check tension — more often in rain/dirt", verify: false },
      { service: "chain_replace", everyKm: 30000, everyMi: 18000,
        note: "Chain + both sprockets as a set — replace sooner if worn/kinked", verify: true },
      { service: "annual_check", everyMonths: 12,
        note: "General inspection: brakes, tires, bearings, fasteners, electrics", verify: false },
    ],
  },

  /* KTM LC8 big-twin (1290 Super Adventure / Super Duke, 1190 Adventure).
     Chain-driven cams — NO timing belts. Conventional shim valves. Intervals
     from the KTM service plan; confirm against the owner's manual. */
  ktm_lc8: {
    label: "KTM LC8 — 15,000 km oil / 30,000 km valve (no belts)",
    note: "KTM 1290 LC8 service plan — chain cam drive means NO timing-belt service. " +
          "Valve check is conventional shim-under-bucket. Confirm against the owner's manual.",
    items: [
      { service: "oil_change",   everyKm: 15000, everyMi: 9300, everyMonths: 12,
        firstKm: 1000, firstMi: 600, note: "First service at 1,000 km; clean oil screens each time", verify: true },
      { service: "valve_check",  everyKm: 30000, everyMi: 18600,
        note: "Shim-under-bucket clearance check — do the plugs at the same time", verify: true },
      { service: "spark_plugs",  everyKm: 30000, everyMi: 18600, verify: true },
      { service: "air_filter",   everyKm: 30000, everyMi: 18600, verify: true },
      { service: "brake_fluid",  everyMonths: 24, verify: true },
      { service: "clutch_fluid", everyMonths: 24, note: "Hydraulic clutch (DOT 4)", verify: true },
      { service: "coolant",      everyKm: 60000, everyMi: 37000, everyMonths: 48, verify: true },
      { service: "chain_service", everyKm: 1000, everyMi: 600,
        note: "Clean, lube, check tension + alignment — every service", verify: false },
      { service: "chain_replace", everyKm: 30000, everyMi: 18600,
        note: "Chain + sprockets as a set — sooner if worn", verify: true },
      { service: "annual_check", everyMonths: 12,
        note: "General inspection: brakes, tires, bearings, fasteners, electrics", verify: false },
    ],
  },

  /* Suzuki DR-Z400 (S/SM/E). Short 3,500 mi oil interval, long 15,000 mi valve
     check. Chain cam drive (no belts) and a CABLE clutch (no clutch fluid).
     From the Suzuki maintenance schedule — confirm against your owner's manual. */
  suzuki_drz400: {
    label: "Suzuki DR-Z400 — 3,500 mi oil / 15,000 mi valve",
    note: "Short oil intervals by design — it's a dry-sump single that gets ridden hard. " +
          "No timing belts (chain cam drive) and no clutch fluid (cable clutch). " +
          "Halve the dirt-related intervals if you ride it off-road in dust or water.",
    items: [
      { service: "oil_change",   everyMi: 3500, everyKm: 6000, everyMonths: 12,
        note: "Every service. Dry sump — see the bike-specific fill/check procedure", verify: true },
      { service: "valve_check",  everyMi: 15000, everyKm: 24000,
        note: "Shim-under-bucket; intake 0.10–0.20 mm, exhaust 0.20–0.30 mm (cold)", verify: true },
      { service: "spark_plugs",  everyMi: 7000, everyKm: 12000,
        note: "Every 2 services (NGK CR8E)", verify: true },
      { service: "air_filter",   everyMi: 3500, everyKm: 6000,
        note: "Clean/inspect every service — much more often in dust or after water", verify: true },
      { service: "brake_fluid",  everyMonths: 24, verify: true },
      { service: "coolant",      everyMonths: 48, verify: true },
      { service: "chain_service", everyMi: 600, everyKm: 1000,
        note: "Clean, lube, check slack — after every wet or dirty ride", verify: false },
      { service: "chain_replace", everyMi: 15000, everyKm: 24000,
        note: "Chain + both sprockets as a set — much sooner if ridden in dirt", verify: false },
      { service: "annual_check", everyMonths: 12,
        note: "Also check the balancer-shaft adjuster condition (see Mods)", verify: false },
    ],
  },

  /* Example second schedule for future bikes (DVT engines have longer
     desmo intervals). Add models pointing here as you acquire them. */
  dvt_15k: {
    label: "Testastretta DVT — 15,000 km oil / 30,000 km desmo",
    note: "Placeholder for DVT-engined models — verify before relying on it.",
    items: [
      { service: "oil_change",  everyKm: 15000, everyMi: 9000, everyMonths: 12, verify: true },
      { service: "desmo_valve", everyKm: 30000, everyMi: 18000, verify: true },
      { service: "belts",       everyKm: 30000, everyMi: 18000, everyMonths: 60, verify: true },
      { service: "brake_fluid", everyMonths: 24, verify: true },
      { service: "coolant",     everyMonths: 48, verify: true },
      { service: "annual_check", everyMonths: 12 },
    ],
  },
};
