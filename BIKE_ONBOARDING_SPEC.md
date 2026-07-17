# Bike Onboarding Spec — research contract for an LLM/agent

This is the complete list of everything that must be **researched and produced**
to add one motorcycle to Motorcycle Companion. An agent workflow reads this,
researches a given `make / model / year-range`, and emits a **single JSON object**
(see [Output template](#output-template)) that a converter turns into entries in
the `data/*.js` files. Every claim carries a source and a `verified` flag.

> **Golden rules**
> 1. **Reuse first.** Before inventing a schedule / archetype / brand / reset /
>    access-module set, check if this bike shares a *platform* with one already
>    in the app and reference the existing id. Most of a manufacturer's range
>    shares an engine, schedule, and teardown.
> 2. **Never guess silently.** Anything not confirmed from an official manual or
>    OEM parts fiche gets `verified: false` (renders a VERIFY badge). A wrong part
>    number that *looks* confirmed is worse than an honest "verify".
> 3. **Cite everything.** Each researched value gets a `source` URL in the
>    `sources` array so a human can re-check.

---

## How this maps to the codebase

| Section | Data file | What it is |
|---|---|---|
| Identity & spec | `data/catalog.js` → `DB.catalog.models` | specs, part numbers, fluids, clearances |
| Maintenance schedule | `data/schedules.js` → `DB.schedules` | service intervals per engine platform |
| Service applicability | `data/services.js` (`applies()`) + schedule | which jobs this bike can receive |
| Reset procedure | `data/services.js` → `DB.resets` | how to clear the dash service reminder |
| Brand identity | `data/brands.js` → `DB.brands` | name, theme colour, "vibe" (new mfr only) |
| 3D model + teardown | `data/teardown3d.js` → `DB.bikes3d` (+ `archetypes.js`) | archetype + overrides + teardown scene |
| Teardown/reassembly | `data/access.js` → `DB.accessModules` | shared strip-down modules per model |
| Videos | fields throughout | YouTube search strings + optional exact links |

Renders/geometry are **not** researched — the agent only picks an **archetype**
and a few size/colour overrides; the component library draws it. See
`ARCHITECTURE.md`.

---

## Research sources (in priority order)
1. **Official owner's / workshop manual** for the exact model-year (fluids,
   capacities, torque, valve clearances, intervals). Highest authority.
2. **OEM parts fiche** — part numbers + exploded diagrams: manufacturer sites,
   Partzilla, RevZilla, AF1 Racing (Ducati), KTM PowerParts, Louis, Webike.
3. **Model-specific forums** — teardown photos, real-world interval notes.
4. **YouTube** — teardown / valve-check / service walkthroughs on the exact
   platform (for step order and video links).

---

## The `verified` convention
- `verified: true` → taken directly from an official manual or OEM fiche.
- `verified: false` → community-sourced, cross-model-inferred, or uncertain.
  Add a `note` saying why (e.g. "sources show 42610341B — confirm for your year").
- Schedule items and torque figures use `verify: true/false` with the same meaning.

---

## 1. Identity & classification  *(required)*

| Field | Type | Research | Example |
|---|---|---|---|
| `modelId` | string (slug) | lowercase, no spaces; `<mfr><model>` | `ktm1290sa` |
| `name` | string | marketing model name | `1290 Super Adventure` |
| `brand` | string key | must exist in `DB.brands`, else define a new brand (§6) | `ktm` |
| `years` | int[] | model years this entry covers | `[2014,2015,2016]` |
| `defaultYear` | int | the first/most-common year | `2015` |
| `disp` | string | displacement, cc | `1301` |
| `spark` | string | ignition style | `Twin ignition` |
| `engine` | string | one-line engine description (layout, valves, cam drive) | `LC8 75° V-twin · 8-valve DOHC · chain cam drive (no belts)` |
| `valveType` | enum | **`desmo`** (Ducati desmodromic) or **`shim`** (conventional shim/bucket) — gates which valve service applies | `shim` |
| `finalDrive` | enum | `chain` \| `belt` \| `shaft` | `chain` |

**Branching rules that flow from `valveType` / cam drive / final drive:**
- **Timing belts?** Only rubber-belt cam drives (most Ducati desmo) get a `belt`
  object + `camPulleyNut` + `belts` service in the schedule. Chain/gear cam drives
  (KTM LC8, most Japanese) **omit** `belt`/`camPulleyNut` and have **no** belt service.
- **Valve service:** `valveType:"desmo"` → schedule uses `desmo_valve`;
  `valveType:"shim"` → uses `valve_check`.
- **Final drive:** `chain` → include `chain_service` + `chain_replace`;
  `belt`/`shaft` → replace those with the appropriate service (belt drive
  inspection / final-drive oil) and note it.

---

## 2. Catalog spec  *(required — the `data/catalog.js` model)*

Every object below is `{ part/value, verified, note? }` unless noted.

| Field | Shape | Research |
|---|---|---|
| `scheduleId` | string | reuse an existing `DB.schedules` id if the platform matches, else define one (§3) |
| `resetId` | string | reuse a `DB.resets` id for the same dash/brand, else define one (§5) |
| `oil` | string | grade + spec, e.g. `Motorex 10W-50 · JASO MA2` |
| `oilCapacityL` | `{value:number, verified, note}` | litres **with filter change** |
| `coolant` | string | type/spec |
| `plugs` | `{count:int, type, verified, note}` | plug count (mind twin-plug engines), NGK/other p/n, gap, thread |
| `airFilter` | `{part, verified, note}` | OEM element p/n |
| `oilFilter` | `{part, verified, note}` | OEM filter p/n (or service-kit p/n) |
| `shim` | string | shim family / size description |
| `clearance` | `{openMin,openMax,closeMin,closeMax, verified}` | **desmo:** opener min/max + closer min/max. **shim:** put intake in open*, exhaust in close* (mm, cold) |
| `belt` *(belt engines only)* | `{part, teeth:int, width, verified, note}` | timing belt p/n, tooth count, width |
| `camPulleyNut` *(belt engines only)* | `{part, thread, verified, note}` | cam-pulley lock nut p/n + thread |
| `valveCoverGasket` *(optional)* | `{part, verified, note}` | valve/cam-cover gasket p/n |
| `yearOverrides` | `{ "<year>": { …partial spec… } }` | only the fields that differ for a given year (deep-merged) |

---

## 3. Maintenance schedule  *(reuse or define — `data/schedules.js`)*

If a matching `scheduleId` exists (same engine family + intervals), **reuse it**.
Otherwise produce:

```
{ id, label, note, items: [ { service, everyKm?, everyMi?, everyMonths?,
                              firstKm?, firstMi?, firstMonths?, note?, verify } ] }
```
Research each interval from the manual's maintenance plan. `service` must be a
valid service id (§4). Rules:
- Include a distance (`everyKm`+`everyMi`) and/or a time (`everyMonths`) interval —
  whichever elapses first makes it due. `first*` for a shorter break-in interval.
- **Belt engines** include a `belts` item; **chain-cam** engines do NOT.
- Valve item is `desmo_valve` or `valve_check` per `valveType`.
- Typical items: oil_change, (desmo_valve|valve_check), (belts?), spark_plugs,
  air_filter, brake_fluid, clutch_fluid, coolant, chain_service, chain_replace,
  annual_check.

---

## 4. Service applicability  *(no data to write — just verify the set)*

Most services are generic and already exist; the agent just confirms which apply:
`oil_change, spark_plugs, air_filter, brake_fluid, clutch_fluid, coolant,
chain_service, chain_replace, tire_front, tire_rear, brake_pads, annual_check`.
Conditional ones (already gated by `applies(spec)` in code):
- `desmo_valve` — only if `valveType==="desmo"`
- `valve_check` — only if `valveType==="shim"`
- `belts` — only if a `belt` object exists

If the bike needs a **service that doesn't exist yet** (e.g. shaft-drive final-oil,
belt final-drive), flag it in `newServices[]` with name/short/steps/parts so a
human can add it.

---

## 5. Service-reminder reset  *(reuse or define — `DB.resets`)*

How to clear the dash "service due" indicator. Reuse `dds_generic` (Ducati DDS),
`ktm_reset` (KTM), etc. if the brand/dash matches. Else:
```
{ id, title, verified, summary,
  options: [ { label, detail } ],   // dealer tool, DIY OBD tool, dash menu…
  note }
```

---

## 6. Brand identity  *(only when adding a NEW manufacturer — `data/brands.js`)*

| Field | Research |
|---|---|
| `key` | lowercase slug, e.g. `honda` |
| `app` | short app-name word shown as `<app>·Companion` (e.g. Ducati→`Desmo`, KTM→`KTM`) |
| `sub` | tagline under the name |
| `accentLight` / `accentDark` | brand colour hex for light/dark themes |
| `inkOn` | text colour that reads on the accent (`#fff` or near-black) |
| `vibe` | a deliberately **passive-aggressive** one-line hot-take about the brand (opinionated banter, not a spec sheet). Keep it playful; **do not state false facts** — frame digs as clearly subjective. |

---

## 7. 3D model + teardown scene  *(`data/teardown3d.js` → `DB.bikes3d`)*

The agent does **not** model geometry. It picks an **archetype** and a few
overrides; the component library draws the bike.

| Field | Research |
|---|---|
| `archetype` | one of `adventure, naked, sport, cruiser, standard` (tourer TBD) — pick by body style |
| `colors` | `{ paint, frame, cam }` hex — the bike's main paint + frame + cam-cover colour |
| `slots` *(optional)* | override component size/position only where it visibly differs (e.g. `windscreen:{size,at}`, `wheelFront:{at,R}`, `seatPillion:null` to drop a pillion). Defaults come from the archetype. |
| `scene` | the teardown activity (usually plastics/tank access). See below. |

`scene` shape:
```
{ title, phase, camera:{pos,target}, video:{search},
  diagramRefs: [ [sourceName, whatItIs], … ],
  removable: { <slotId>: { explode:[x,y,z] }, … },   // which parts come off
  steps: [ { id, part:<slotId>, title, tools:[…], videoSearch,
             fasteners:[ {t:"bolt|latch|conn", p:[x,y,z], spec} ],
             detail, warning? } ] }
```
Removable slot ids come from the archetype (`seatRider, seatPillion, fairingLeft,
fairingRight, tank`, …). Fastener `p` positions are approximate (spatial guide,
not CAD). Coordinates: **+X front, +Y up, +Z rider's left, ground y=0.**

---

## 8. Access modules (shared teardown)  *(`data/access.js`)*

Reusable teardown/reassembly steps that services declare they `need`, so combined
jobs (e.g. valve + plugs + coolant) strip the bike down **once**. Reuse a model's
module set if the teardown is the same; else produce per module:
```
{ <moduleId>: { label, needs:[<moduleId>…], teardown:[steps], restore:[steps] } }
```
Typical modules: `bodywork, tank, airbox, valve_covers, cooling_drain, radiator`
(+ `belt_covers` for belt engines, `ecu` where relevant). `needs` encodes order
(bodywork before tank; coolant drained before radiator). Services reference these
ids in their `needs` (already wired for the generic services). Steps should be
plausible + `verify`-flagged against a manual/teardown video.

---

## 9. Videos  *(YouTube)*

- **Per teardown step:** `videoSearch` = a specific query, e.g.
  `"<year> <model> tank removal"`.
- **Per service:** most reuse a generic search; a bike-specific one can be given.
- **Model walkthrough:** `scene.video.search` = a full-service walkthrough query.
- **Exact links (bonus):** if the agent finds a genuinely good video, include
  `{ url, start:"m:ss" }` so it deep-links; otherwise leave the search and the
  user attaches one in-app. **Do not fabricate video URLs or timestamps.**

---

## Output template

The agent emits **one** object per bike (JSON). `null`/omit sections that reuse an
existing id or don't apply. Everything with a researched value should also appear
in `sources`.

```jsonc
{
  "modelId": "hondaAfricaTwin1100",
  "reuse": {                      // ids reused from existing data (don't redefine)
    "brand": null,                //   e.g. "honda" once it exists
    "scheduleId": null,           //   e.g. reuse if platform matches
    "resetId": null,
    "archetype": "adventure",
    "accessModules": null         //   or a model id whose teardown matches
  },
  "catalog": {
    "name": "", "brand": "", "years": [], "defaultYear": 0,
    "disp": "", "spark": "", "engine": "",
    "valveType": "shim", "finalDrive": "chain",
    "scheduleId": "", "resetId": "",
    "oil": "", "oilCapacityL": {"value":0,"verified":false,"note":""},
    "coolant": "",
    "plugs": {"count":0,"type":"","verified":false,"note":""},
    "airFilter": {"part":"","verified":false,"note":""},
    "oilFilter": {"part":"","verified":false,"note":""},
    "shim": "",
    "clearance": {"openMin":0,"openMax":0,"closeMin":0,"closeMax":0,"verified":false},
    "belt": null,                 // {part,teeth,width,verified,note} for belt engines
    "camPulleyNut": null,         // {part,thread,verified,note} for belt engines
    "valveCoverGasket": null,     // {part,verified,note} optional
    "yearOverrides": {}
  },
  "schedule": null,               // {id,label,note,items:[…]} if a NEW platform
  "newServices": [],              // only if a needed service doesn't exist yet
  "reset": null,                  // {id,title,verified,summary,options,note} if NEW
  "brand": null,                  // {key,app,sub,accentLight,accentDark,inkOn,vibe} if NEW mfr
  "model3d": {
    "archetype": "adventure",
    "colors": {"paint":"","frame":"","cam":""},
    "slots": {},
    "scene": {
      "title": "", "phase": "",
      "camera": {"pos":[2.9,1.75,3.25],"target":[0,0.9,0]},
      "video": {"search":""},
      "diagramRefs": [],
      "removable": {},
      "steps": []
    }
  },
  "accessModules": null,          // {moduleId:{label,needs,teardown,restore}} if NEW teardown
  "sources": [
    {"field":"catalog.oilCapacityL","url":""},
    {"field":"schedule.valve","url":""}
  ]
}
```

---

## Validation checklist (before a bike is accepted)
- [ ] `modelId` unique; `brand`, `scheduleId`, `resetId`, `archetype` all resolve
      (reused id exists, or the new definition is included).
- [ ] `valveType` / `finalDrive` consistent with cam drive: belt fields present iff
      belt engine; valve service id matches `valveType`.
- [ ] Every schedule `service` is a real (or newly-defined) service id.
- [ ] All part numbers/clearances have `verified` set honestly, with `note` on any
      `false`, and a matching entry in `sources`.
- [ ] 3D `scene.steps[].part` ids exist in the archetype's slots; `removable` keys
      match; access-module `needs` reference real module ids.
- [ ] No fabricated video URLs/timestamps — searches only unless a real link was found.
