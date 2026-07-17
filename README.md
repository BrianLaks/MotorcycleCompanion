# Desmo Service Companion

Garage, maintenance-schedule, and service-log app for Ducati motorcycles.
Successor to the single-file `Ducati_Desmo_Companion.html` — same workshop
design, now with a file-based database, multiple riders/bikes, due-service
alerts, a dynamic service wizard, and a permanent maintenance history.

## Running it

**Hosted (shared, persistent) — recommended:**

```
node server.js          # http://localhost:8710  (or: node server.js 9000)
```

The built-in zero-dependency server serves the app and persists all user
data to `userdata/db.json` on the host. Everyone who opens the site shares
the same garage database. A rolling `db.json.bak` is kept automatically.

> ⚠ No authentication is built in. Run it on a trusted LAN or put a
> reverse proxy with auth (IIS, nginx, Caddy) in front before exposing it.
> Saves are whole-document, last-write-wins — fine for a household, but two
> people editing at the same moment can overwrite each other's change.

**Standalone (no server):** just open `index.html`. The app detects the
missing API and stores user data in that browser's localStorage instead.
The storage badge in the app bar shows which mode you're in. Use
**Export / Import** to move data between machines or into hosted mode.

## The database — file layout

```
DesmoCompanion/
├── index.html            app shell
├── css/app.css           design system
├── js/store.js           data layer (server API ⇄ localStorage adapter)
├── js/app.js             UI + due-maintenance engine + service wizard
├── data/                 ← REFERENCE database (edit these to expand)
│   ├── catalog.js        bike models, years, specs, part numbers
│   ├── schedules.js      maintenance intervals per engine platform
│   ├── services.js       service types, checklists, reset procedures
│   └── teardown3d.js     3D teardown models (parts, fasteners, step order)
├── js/vendor/three.min.js  vendored Three.js r128 (WebGL 3D engine)
├── js/teardown3d.js      3D scene builder + orbit controls + animations
├── server.js             optional zero-dep Node host + JSON API
└── userdata/db.json      ← USER database (created at runtime, server mode)
```

Reference data is deliberately plain `.js` (not `.json`) so the app also
works from `file://` where `fetch()` of local JSON is blocked.

## How to expand it

**Add a model year** — in `data/catalog.js`, add the year to the model's
`years[]`. If something differs that year (a part number, clearances), add
a `yearOverrides["2019"] = {...}` object; its keys deep-merge over the base
spec.

**Add a motorcycle model** — copy an existing entry in
`catalog.models`, change the specs, and point `scheduleId` at an entry in
`schedules.js` (add a new schedule if the platform differs — e.g. DVT
engines already have a placeholder). Set `resetId` to an entry in
`DB.resets` (`data/services.js`) or add a new reset procedure.

**Add a service type** — add an entry in `data/services.js` with `name`,
`steps` (checklist), optional `partsFor(spec)`, optional `stepsByModel`
for model-specific teardown/reassembly, and `resetIndicator: true` if the
dash reminder should be cleared afterwards. Then reference it from any
schedule in `schedules.js` to give it an interval.

**Fields marked `verified:false` / `verify:true`** render a VERIFY badge —
the convention for "sourced from the community, confirm against the
official manual."

## 3D teardown guide

The **3D teardown** tab is an interactive exploded-view of the plastics
removal (Phase 1). It's a *stylized schematic* built from primitives in
`data/teardown3d.js` — positions and the removal ORDER are real, the shapes
are approximate. It is not factory CAD; matching a real photo would need an
authored `.glb` model (a much larger, licensing-sensitive project). Pair it
with the linked OEM fiche diagrams and the per-step videos for real detail.

- Drag to orbit, wheel/pinch to zoom, shift-drag to pan.
- Steps are a strict stack: click the glowing part (or its Remove button) to
  take it off; gold markers = bolts, blue = connectors/hoses. Removed parts
  become ghosts you can click to reinstall. Progress is saved per bike.
- **Videos:** every step has a **▶ Find video** button (YouTube search). Click
  **+ link** to attach a specific video URL and timestamp (e.g. `4:32`). If
  it's a YouTube link, the step then shows **▶ Play @ 4:32** which plays the
  video **inside the app** (embedded overlay, jumps to the timestamp) so you
  never lose the app to the browser — with an "Open in YouTube" escape hatch.
  Attached links are saved per bike. Service checklists also have a **▶ Video**
  search button.

To add a teardown for another model: copy the `mts950` block in
`teardown3d.js`. Each `part` has primitives + an `explode` vector; each
`step` names the part, its `tools`, `fasteners` (3D marker positions), a
`detail`/`warning`, and a `videoSearch` query. Coordinates: +X = front,
+Y = up, +Z = rider's left, ground at y = 0.

## How due-tracking works

Every schedule item can have a distance interval (`everyKm`/`everyMi`) and
a time interval (`everyMonths`); whichever elapses first makes it **due**
("due soon" = within 500 mi / 800 km / 30 days). "Last done" comes from the
newest log entry for that service on that bike — so **backfill your known
history** (History tab) when you add a bike, or every item shows
"no record".

## Maintenance reports & data export

The **History** tab has two exports per bike:
- **Maintenance report** — opens a clean, printable document (bike identity,
  VIN, odometer, live due-status, the full service history with parts/notes and
  any valve/belt measurement snapshots, plus Serviced-by / Signature / Date
  lines). Use the browser's "Save as PDF" to hand it to a buyer or shop as
  proof of completed work.
- **Export data** — downloads that bike's record (identity + full log +
  worksheets) as JSON for archiving or moving between machines.

The **Start service** wizard evaluates what's due at the date/mileage you
enter, pre-selects the due items, lets you pick the work, builds a combined
checklist (model-specific teardown for the desmo service), and on
completion writes one log entry per service — snapshotting the valve
worksheet and belt tensions into the record where relevant — advances the
bike's odometer, and shows the service-indicator reset procedure.

## Scaling to many bikes

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the plan to onboard hundreds of
bikes without hand-building each one: a layered **components → archetypes →
bikes → activities** model where everything composes down to the `{parts,
steps}` shape the renderer already consumes (so the renderer never has to
change), plus the research→author→validate onboarding process. The reusable
`wheel()` and `chain()` builders in `data/teardown3d.js` are the first
components of that library.

## Roadmap ideas

- Extract `data/components.js` + `data/archetypes.js` and grow
  `catalog.resolve` into `composeBike()` (see ARCHITECTURE.md) when adding the
  first non-adventure bike
- More 3D teardown phases (wheel/tire R&R, brake pads, chain) as their own
  scenes, linked from those services
- A properly authored low-poly `.glb` model if photo-realism is wanted
- Real multi-user auth + per-user visibility (currently riders are a
  trust-based dropdown; hosted data is shared)
- SQLite instead of db.json if the log grows large
- Photo attachments on log entries
- iCal/email reminders for time-based items
