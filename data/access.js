/* =========================================================================
   ACCESS MODULES — reusable teardown/reassembly procedures.

   The problem: a valve check and a belt change and a coolant flush all share
   most of the same teardown. You don't strip the bike for valves, rebuild it,
   then strip it again for belts. So teardown is modeled ONCE, as modules, and
   each service (services.js) just declares which modules it `needs`.

   When a session runs one or more services, the composer (app.js →
   sessionSteps) unions all needed modules, orders them by dependency, and
   emits: teardown (each module once) → all the work → reassembly (reverse).

   A module = { label, needs:[moduleIds], teardown:[steps], restore:[steps] }.
   `needs` are the modules that must already be off (bodywork before tank,
   coolant drained before the radiator comes out, …).

   Modules are per model because access differs (the Monster is a naked; the
   Multistrada has fairings and a fully-removed tank). Bikes that share a
   platform can share a module set later. See ARCHITECTURE.md.
   ========================================================================= */
window.DB = window.DB || {};

window.DB.accessModules = {

  mts950: {
    bodywork: {
      label: "Seats & fairings",
      needs: [],
      teardown: [
        "Remove passenger + rider seat (key latch, 2× 4 mm rear bracket bolts)",
        "Remove tank trim ring (4× 3 mm); rag the fuel neck",
        "Remove 14× 4 mm fairing bolts; pop side fairings off the grommets",
      ],
      restore: [
        "Refit side fairings (14× 4 mm) + tank trim ring (4× 3 mm)",
        "Refit rider + passenger seats; final road test + leak check",
      ],
    },
    cooling_drain: {
      label: "Coolant drain",
      needs: [],
      teardown: ["Drain coolant (10 mm water-pump drain first, then rad cap)"],
      restore: ["New crush washer on the pump drain; torque; refill coolant + bleed air"],
    },
    tank: {
      label: "Fuel tank",
      needs: ["bodywork"],
      teardown: ["Unbolt tank (4× 5 mm); disconnect fuel QD, pump connector, 2× vent lines; lift tank away (store upright)"],
      restore: ["Lower tank; click the fuel QD; reconnect harness + 2× drains; 4× 5 mm bolts"],
    },
    radiator: {
      label: "Radiator",
      needs: ["cooling_drain", "bodywork"],
      teardown: ["Unbolt radiator (3× 10 mm); hang it forward with the hoses still attached"],
      restore: ["Rehang + bolt the radiator (3× 10 mm)"],
    },
    airbox: {
      label: "Airbox",
      needs: ["tank"],
      teardown: [
        "Disconnect 4× sensor connectors + the crankcase breather",
        "Loosen 2× airbox boot clamps (3 mm, through the frame); lift the airbox out — TAPE the intakes",
      ],
      restore: ["Refit airbox onto the boots (no wrinkles); clamps; breather + 4× connectors"],
    },
    belt_covers: {
      label: "Belt covers & coils",
      needs: ["airbox"],
      teardown: ["Remove 6× 4 mm belt covers; pull the 2× coil caps"],
      restore: ["Refit belt covers (6× 4 mm); seat the coil caps"],
    },
    valve_covers: {
      label: "Valve covers",
      needs: ["belt_covers"],
      teardown: ["Blow out the plug recesses; remove 8× T30 valve-cover bolts; lift the covers"],
      restore: [
        "Clean the head mating tracks (non-chlorinated brake cleaner)",
        "New valve-cover gaskets (78810931A); RTV on the cam-cap corners; torque 8× T30 cross-pattern",
      ],
    },
  },

  monster1200s: {
    bodywork: {
      label: "Seat & prop rod",
      needs: [],
      teardown: ["Pop the seat (key barrel); extract the steel tank prop rod"],
      restore: ["Stow the prop rod; lock the seat; final road test + leak check"],
    },
    cooling_drain: {
      label: "Coolant drain",
      needs: [],
      teardown: ["Drain coolant (10 mm right-side drain, then rad cap)"],
      restore: ["New crush washer on the drain; torque; refill + bleed"],
    },
    tank: {
      label: "Tank (pivot up)",
      needs: ["bodywork"],
      teardown: [
        "Unlatch the front tank latch pin; pivot the tank up",
        "Unplug the fuel-level sensor BEFORE 45°; prop the tank on the rod",
      ],
      restore: ["Lower the tank (no pinched lines); lock the latch pin"],
    },
    ecu: {
      label: "ECU tray",
      needs: ["tank"],
      teardown: [
        "Label + disconnect the ECU harness; move the ECU to a static-free bench",
        "Remove 4× 4 mm ECU tray bolts",
      ],
      restore: ["Refit the ECU tray (4× 4 mm); reseat the ECU; click the labeled connectors"],
    },
    airbox: {
      label: "Airbox & canister",
      needs: ["ecu"],
      teardown: [
        "Pull the ambient-temp sensor; loosen 2× 3 mm clamps; lift the airbox — TAPE the intakes",
        "Remove 2× 10 mm canister bracket bolts; zip-tie the canister aside",
      ],
      restore: [
        "Refit airbox onto the TB lips; 2× 3 mm clamps; reinsert the ambient sensor",
        "Refit the canister bracket (2× 10 mm)",
      ],
    },
    radiator: {
      label: "Radiator",
      needs: ["cooling_drain"],
      teardown: ["Remove 4× 10 mm radiator bolts; slide the core down/forward — CARDBOARD over the fins"],
      restore: ["Rehang the radiator (4× 10 mm); peel the cardboard"],
    },
    belt_covers: {
      label: "Coils & belt covers",
      needs: ["airbox"],
      teardown: [
        "Remove 4× 4 mm coil-pack screws; pull the plug leads",
        "Remove 6× 4 mm belt covers",
      ],
      restore: [
        "Refit belt covers (6× 4 mm)",
        "Refit the coil packs (4× 4 mm); reconnect leads",
      ],
    },
    valve_covers: {
      label: "Valve covers",
      needs: ["belt_covers"],
      teardown: ["Remove 8× T30 valve-cover bolts; slide the vertical cover out the right side; lift the covers"],
      restore: [
        "Clean the horizontal + vertical head faces (brake cleaner)",
        "New valve-cover gaskets (78810931A); RTV on the cam-cap grooves; torque 8× T30 cross-pattern",
      ],
    },
  },

  /* KTM 1290 Super Adventure (LC8). No belt covers — chain cam drive. Torx
     throughout. Steps are a plausible sequence for the LC8; confirm counts and
     torque against the KTM manual / a walkthrough video before relying on them. */
  ktm1290sa: {
    bodywork: {
      label: "Seats & side panels",
      needs: [],
      teardown: [
        "Lift the seat (seat lever/key); remove the pillion + rider seats",
        "Remove the side tank shrouds / fairing panels (Torx) — note the tab locations",
      ],
      restore: [
        "Refit the side panels / tank shrouds (Torx), tabs seated first",
        "Refit the seats; press until they latch; road test + leak check",
      ],
    },
    cooling_drain: {
      label: "Coolant drain",
      needs: [],
      teardown: ["Engine COLD; remove the radiator cap; drain coolant at the water-pump/drain bolt"],
      restore: ["New sealing washer; torque the drain bolt; refill with premix + bleed air"],
    },
    tank: {
      label: "Fuel tank",
      needs: ["bodywork"],
      teardown: [
        "Relieve fuel pressure; disconnect the fuel quick-connect and the pump wiring",
        "Unbolt the fuel tank (Torx); disconnect vent/overflow lines; lift the tank away",
      ],
      restore: ["Lower the tank; reconnect the fuel QC, pump wiring + vents; bolt down (Torx)"],
    },
    radiator: {
      label: "Radiator",
      needs: ["cooling_drain", "bodywork"],
      teardown: ["Unbolt the radiator (Torx); ease it forward with the hoses attached — protect the fins"],
      restore: ["Refit + bolt the radiator (Torx); check hose routing"],
    },
    airbox: {
      label: "Airbox & throttle bodies",
      needs: ["tank"],
      teardown: [
        "Disconnect the airbox sensors + breather",
        "Loosen the throttle-body clamps; lift the airbox out of the vee — TAPE the intakes",
      ],
      restore: ["Refit the airbox onto the throttle bodies; clamps; reconnect sensors + breather"],
    },
    valve_covers: {
      label: "Cam covers",
      needs: ["airbox"],
      teardown: [
        "Remove the coil sticks / plug caps from both cylinders",
        "Remove the front + rear cam-cover bolts (Torx); lift both cam covers",
      ],
      restore: [
        "Clean the cover mating faces",
        "New cam-cover gaskets; torque the covers to spec; refit the coil sticks",
      ],
    },
  },

  /* Suzuki DR-Z400 (S/SM). Carbureted single — no belt covers, no ECU tray.
     Steps are DR-Z-plausible; confirm against the service manual / a teardown video. */
  drz400: {
    bodywork: {
      label: "Seat & side panels",
      needs: [],
      teardown: [
        "Remove the 2 seat bolts; slide the seat rearward off its front tongue",
        "Remove the left + right shrouds / number panels (bolts into the tank and radiator/frame)",
      ],
      restore: [
        "Refit both shrouds / number panels — grommets seated, don't overtighten the plastic",
        "Refit the seat: front tongue first, then the 2 rear bolts; road test + leak check",
      ],
    },
    cooling_drain: {
      label: "Coolant drain",
      needs: [],
      teardown: ["Engine COLD; remove the radiator cap and drain at the water-pump drain bolt"],
      restore: ["New sealing washer; torque the drain bolt; refill with premix and burp the air out"],
    },
    tank: {
      label: "Fuel tank",
      needs: ["bodywork"],
      teardown: [
        "Turn the fuel petcock OFF; pull the fuel line and the vacuum line (fuel WILL drip — rag it)",
        "Remove the tank bolts and lift the tank up and back",
      ],
      restore: ["Refit the tank; reconnect fuel + vacuum + vent lines; bolts in; petcock ON and check for leaks"],
    },
    radiator: {
      label: "Radiators",
      needs: ["cooling_drain", "bodywork"],
      teardown: ["Unbolt the radiator(s) and ease them forward with hoses attached — protect the fins"],
      restore: ["Refit and bolt the radiator(s); check hose routing and clamps"],
    },
    carb_airbox: {
      label: "Carb & airbox",
      needs: ["tank"],
      teardown: [
        "Loosen the airbox boot and carb clamps; disconnect the throttle cables and choke",
        "Slide the carb back / out of the way — TAPE the intake and airbox openings",
      ],
      restore: [
        "Refit the carb between the boots (both clamps seated square); reconnect throttle cables + choke",
        "Check the throttle snaps shut freely with the bars at full lock both ways",
      ],
    },
    valve_covers: {
      label: "Cam cover",
      needs: ["carb_airbox"],
      teardown: [
        "Pull the plug cap and remove the spark plug (so you can turn the engine over by hand)",
        "Remove the cam-cover bolts and lift the cover off",
      ],
      restore: [
        "Clean the cover mating face",
        "New cam-cover gasket; torque the cover bolts to spec; new/refit spark plug and cap",
      ],
    },
  },
};
