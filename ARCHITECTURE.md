# Architecture — scaling to hundreds of bikes

Goal: onboard **hundreds of motorcycles**, each with **~5 core maintenance
activities**, without hand-building every bike or rewriting the app. The way
we avoid boxing ourselves in is a **layered, composition-based data model**
with one hard rule:

> **The renderer only ever consumes a resolved `{ parts, steps }` shape.**
> Everything above that line (archetypes, components, overrides, research)
> is data that *composes down* to that shape. So we can add the entire
> archetype/component system **without touching `js/teardown3d.js`.**

That seam is the whole game. Today `data/teardown3d.js` hand-writes the
resolved shape for one bike. The plan below inserts layers *above* it that
generate that same shape for any bike.

---

## The four layers

```
  COMPONENTS         reusable primitive builders — wheel(), chain(), fork(), tank()…
      │                (a parts BIN: draw a thing given a few numbers)
      ▼
  ARCHETYPES         bike classes — adventure, naked, sport, cruiser, standard, tourer
      │                (WHERE the components go + which ones exist, as defaults)
      ▼
  BIKES              instance = archetype + overrides (dims, colors, part numbers, specs)
      │                (the 95%-done bike; you only state what differs)
      ▼
  ACTIVITIES         reusable maintenance procedures bound to a bike's components
                       (oil, final-drive, brakes, tires, valve/belt, plastics…)
```

### 1. Components (`data/teardown3d.js` → will move to `data/components.js`)
Small builder functions that return positioned primitives. `wheel(cx,R,tube)`
and `chain(front,rear,z)` already exist and are the template. Each new one is
written **once** and reused across the whole catalog:

| Need | Builders to add |
|------|-----------------|
| Suspension | `forkTelescopic`, `forkUSD`, `springer`, `monoShock`, `twinShock` |
| Controls | `barsUpright`, `clipOns`, `apeHangers` |
| Engine | `engineLtwin` (have it inline), `engineInline4`, `engineBoxer`, `engineSingle`, `engineVtwinCruiser` |
| Body | `fuelTank`, `seatDual`, `seatSolo`, `sideFairing`, `fullFairing`, `beak`, `windscreen`, `subframeTail` |
| Final drive | `chain` (done), `beltDrive`, `shaftDrive` |
| Exhaust | `exhaustLow`, `exhaustHigh`, `exhaustUndertail`, `exhaustShotgun` (cruiser) |

A component is pure geometry — no bike knowledge. That's why it reuses.

### 2. Archetypes (`data/archetypes.js`, new)
An archetype is the **default skeleton** for a class of bike: overall
proportions plus which component slots are filled and roughly where. Example
shape:

```js
adventure: {                     // Multistrada, Tiger, GS, V-Strom…
  wheelbase: 1.90, seatHeight: 0.95, rake: 0.46,
  wheels: { front:{R:0.27,tube:0.085}, rear:{R:0.28,tube:0.10} },
  slots: {
    fork: "forkUSD", bars: "barsUpright", engine: "engineLtwin",
    tank: { at:[0.16,1.02], size:"L" }, seat: "seatDual",
    body: ["beak","windscreen","sideFairing"],   // present for this class
    finalDrive: "chain", exhaust: "exhaustHigh",
  },
}
```

Other classes flip the obvious knobs: `naked` drops `body` to `[]` and lowers
the bars; `sport` uses `clipOns` + `fullFairing` + steeper rake; `cruiser`
stretches `wheelbase`, drops `seatHeight`, uses `apeHangers`/`forwardControls`,
`beltDrive`, `exhaustShotgun`, a teardrop tank and big front fender.

### 3. Bikes (`data/catalog.js` + `data/teardown3d.js`)
A bike says only what differs from its archetype:

```js
mts950: {
  archetype: "adventure",
  overrides: { wheelbase: 1.90, colors:{ paint:"#CC1B22" } },
  spec: { belt, plugs, airFilter, oilFilter, oil, coolant, clearance… },  // catalog
  scheduleId: "testastretta_11_15k",
  activities: ["oil_change","desmo_valve","belts","brake_pads","tire_front","tire_rear","chain_service"],
}
```

A **resolver** (`catalog.resolve` grows into a `composeBike()`) merges
archetype defaults + overrides + component builders → the `{ parts, steps }`
the renderer already eats. New bike on an existing archetype+platform =
**minutes**, mostly data entry, zero new 3D code.

### 3b. Access modules (`data/access.js`) — shared teardown
Real services overlap physically: a valve check, a belt change and a coolant
flush share almost all the same strip-down. So teardown is NOT part of each
service. It lives in **access modules** — reusable teardown/reassembly
procedures with dependencies (`bodywork` before `tank`; `cooling_drain` before
`radiator`; …). A service just declares `needs: [moduleIds]` plus its own
`work: [steps]` (the job once you're at access).

When a session runs one or more services, `sessionSteps()` (app.js) unions all
needed modules, pulls in transitive deps, topo-sorts them, and emits:

```
① Teardown  — every needed module ONCE, in dependency order
② Work      — each service's at-access steps
③ Reassembly— the modules again in REVERSE
```

So selecting Desmo + Belts + Coolant at 18k produces ONE teardown (tank off
once, belt covers off once…), all the work, then ONE reassembly — never
strip-and-rebuild per service. This is the "18k major service": it falls out of
the module union automatically, no separate composite to author. Access modules
are to steps what components are to geometry — the same reuse pattern.

### 4. Activities (`data/services.js` — already the seed)
Maintenance procedures are **bike-agnostic templates** parameterized by the
bike's components. `services.js` already has this shape (`partsFor(spec)`,
`stepsByModel`, `steps`). The evolution: an activity declares which components
it touches and a fastener/step template; the bike supplies the specifics.

- Engine-driven activities (oil, valve/desmo) key off engine type.
- `final_drive_service` has chain / belt / shaft variants — the bike's
  `finalDrive` slot selects the right one.
- `plastics_removal` only exists when the archetype has `body` panels.

This is where "~5 activities per bike" comes from: **most are defaults of the
archetype + engine + final drive**, with a thin per-bike fastener/step layer.

---

## Coordinate + primitive conventions (stable contract)
- **+X = front, +Y = up, +Z = rider's left. Ground at y = 0.** Units ≈ meters.
- Primitives: `box|cyl|sph|tor` with `p`(pos) `r`(rot) `s`(size) `sc`(scale)
  `c`(color) `o`(opacity) `e`(emissive) `rough` `metal`. See the header of
  `data/teardown3d.js`.
- Painted bodywork `rough≈0.28 metal≈0.12`; cast metal `rough≈0.45 metal≈0.8`.

These don't change as we scale — components and archetypes emit primitives in
this contract, so the renderer is frozen.

---

## Onboarding process — research → author → validate

> The exhaustive field-by-field contract an LLM/agent must fill to add a bike —
> every spec, part, interval, teardown step and video — lives in
> **[BIKE_ONBOARDING_SPEC.md](BIKE_ONBOARDING_SPEC.md)**, with a JSON output
> template. That's the input to the agent workflow below.


A repeatable per-bike pipeline. Steps 1–2 decide how little work is left.

**1. Classify.** Make / model / year-range → archetype, engine type, final
drive. (adventure/naked/sport/cruiser/standard/tourer.)

**2. Reuse first.** Does it share a **platform** with a bike we already have
(same engine, schedule, or geometry)? If yes → clone that bike, change the
deltas. Most of a manufacturer's lineup shares engines and intervals.

**3. Specs** → `catalog.js`. Sources: OEM parts fiche (AF1 Racing, Ducati
Omaha, Partzilla, RevZilla, BikeBandit), owner's/service manual (fluids,
capacities, torque, valve clearances, plug/filter part #s). Anything not
from an official manual gets a `verify` flag.

**4. Schedule** → `schedules.js`. From the manual's maintenance plan. Reuse an
existing platform schedule if the engine matches (e.g. `testastretta_11_15k`).

**5. Compose the model** → archetype + overrides. Pick the archetype, set
wheelbase/colors, toggle components (beak? fairing? chain vs belt vs shaft?).
No new geometry unless the bike needs a component we don't have yet — then add
one builder to the library and it's available to every future bike.

**6. Author the ~5 activities** → `services.js` (+ `teardown3d.js` steps for
any that get a 3D guide). Start from the activity templates; fill in the
bike-specific fasteners, torque, and a `videoSearch` per step.

**7. Validate.** Render sanity-check (does it look like the class?), due-
tracking sanity (last-done → next-due math), and a `verify`-flag audit so
unconfirmed data is visibly flagged, never silently trusted.

### Automating the research at scale
Steps 3–4–6 are research-heavy and parallelizable. This is a natural fit for
an **agent research pipeline**: per bike, fan out agents (a specs agent, a
schedule agent, a fastener/torque agent) that draft the data files from the
sources above, then a verification pass that flags anything unconfirmed. Built
as a batch job, a run could onboard a whole model range at once. (This is an
opt-in, cost-bearing step — worth doing once the component library and
archetype templates are stable, so the agents fill a fixed contract.)

---

## Status — the composition system is BUILT
The layered model above is now live:
- **`data/components.js`** — the component library (wheel, fork, handlebars,
  engineLtwin, engineBlock, frame, subframe, tank, seat, sideFairing, beak,
  headlight, windscreen, radiator, exhaust, swingarm, chain, beltDrive,
  airbox, electrics, frontFender, trimRing). Each is `(cfg, colors) => prim[]`.
- **`data/archetypes.js`** — `adventure` (fully specified, the Multistrada
  reference) plus `naked`, `sport`, `cruiser`, `standard` as `extends`
  variations (drop beak/screen/fairing, solo vs dual seat, belt vs chain, etc).
- **`data/teardown3d.js`** — `DB.bikes3d` (bikes as data: archetype + overrides
  + scene) and `DB.composeBike(modelId)`, which resolves everything into the
  `{parts, steps}` the renderer eats. **The renderer was not touched.**

The Multistrada is now the first `adventure` instance — it composes to the same
23 parts and renders identically. Verified: naked composition drops
beak/windscreen/fairing; cruiser drops the pillion (solo seat) and switches to
belt drive — purely from archetype data.

### Adding a bike now (the "fill out the table" surface)
```js
// data/teardown3d.js → DB.bikes3d
monster937: {
  archetype: "naked",                       // inherits: no beak/screen/fairing
  colors: { paint: "#B81D24", frame: "#2A2C31" },
  slots: {                                   // only what differs
    tank: { at: [0.18, 1.00], size: [0.56, 0.22, 0.36] },
    seatRider: { at: [-0.34, 0.94] },
  },
  scene: { title: "…", removable: { tank: { explode:[0,0.85,0] }, … }, steps: [ … ] },
}
```
Most of the geometry is inherited; you type the deltas. Next: a scene picker so
one bike can carry several activity scenes (plastics, wheel R&R, brakes…).
