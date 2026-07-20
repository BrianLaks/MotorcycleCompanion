/* =========================================================================
   BRANDS — per-manufacturer identity: name, theme accent, and attitude.

   The app re-skins itself around the selected bike's manufacturer: the title,
   the accent colour (Ducati red → KTM orange → neutral steel), and a
   deliberately opinionated one-liner "vibe". No bike selected → neutral.

   Each catalog model carries a `brand` key that points here.

   The `vibe` copy is intentionally cheeky brand banter — hot takes, not spec
   sheets. Keep it playful and clearly subjective.
   ========================================================================= */
window.DB = window.DB || {};

window.DB.brands = {
  _neutral: {
    key: "_neutral",
    app: "Motorcycle",                 // → "Motorcycle·Companion"
    sub: "Garage & Service Log",
    accentLight: "#3A6EA5",            // steel blue — no allegiance
    accentDark: "#6EA0FF",
    inkOn: "#ffffff",
    vibe: null,
  },

  ducati: {
    key: "ducati",
    app: "Desmo",                      // → "Desmo·Companion"
    sub: "Ducati · Testastretta",
    accentLight: "#B81D24",            // Rosso Corsa
    accentDark: "#E23440",
    inkOn: "#ffffff",
    vibe: "Fast, flawlessly engineered, and pretty enough to forgive the bill. " +
          "You'll call the valve service 'character' and mean it. Interference engine — " +
          "respect the belts or it bites.",
  },

  suzuki: {
    key: "suzuki",
    app: "Suzuki",                     // → "Suzuki·Companion"
    sub: "Team Suzuki · DR-Z",
    accentLight: "#0B4EA2",            // Team Suzuki blue
    accentDark: "#4C8FE0",
    inkOn: "#ffffff",
    vibe: "Unkillable, dirt-cheap, and technologically frozen somewhere around 2004 — " +
          "the DR-Z shipped with a carburetor until the day they discontinued it. " +
          "Nobody buys a Suzuki for the spec sheet; they buy one because it still fires up " +
          "after a winter of neglect and a river crossing.",
  },

  ktm: {
    key: "ktm",
    app: "KTM",                        // → "KTM·Companion"
    sub: "Ready to Race · LC8",
    accentLight: "#FF6A00",            // KTM orange
    accentDark: "#FF7F1F",
    inkOn: "#1a1205",                  // near-black ink reads best on orange
    vibe: "Yes — faster than the Ducati, and it will not let you forget it. " +
          "Also built to a price: the fit-and-finish is skin-deep, half the range is " +
          "assembled under licence in India and China these days, and the parent company " +
          "nearly went under in 2025. But hey, no timing belt to snap.",
  },
};
