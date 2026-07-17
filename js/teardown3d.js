/* =========================================================================
   TEARDOWN 3D — interactive teardown viewer (Three.js r128, vendored).
   Renders a model definition from data/teardown3d.js, enforces the step
   order (a stack: remove forward, reinstall in reverse), animates parts
   along their explode vector, and marks the current step's fasteners.

   API (used by app.js):
     Teardown3D.mount({container, def, removed, onChange, onMessage})
     Teardown3D.unmount()
     Teardown3D.removeNext()      — remove the current step's part
     Teardown3D.reinstallLast()   — undo the most recent removal
     Teardown3D.reinstallAll()
     Teardown3D.resetView()
     Teardown3D.setGhosts(show)   — show/hide removed parts as ghosts
     Teardown3D.currentIndex()    — index of the next step (= #removed)
   ========================================================================= */
window.Teardown3D = (function () {
  "use strict";

  let container = null, renderer = null, scene = null, camera = null;
  let def = null, removedStack = [], onChange = null, onMessage = null;
  let partGroups = {}, fastenerGroup = null, anims = [], raf = 0, ro = null;
  let showGhosts = true, disposed = true;
  let raycaster, pointer, hoverPart = null, tooltip = null;
  let camCtl = null, targetTween = null;

  const GHOST_OPACITY = 0.14;
  const BOLT_GOLD = 0xD9A036, CONN_BLUE = 0x3D7BD9;

  /* ---------------- primitive builder ---------------- */
  function buildPrim(spec) {
    let geo;
    const s = spec.s || [];
    switch (spec.t) {
      case "box": geo = new THREE.BoxGeometry(s[0], s[1], s[2]); break;
      case "cyl": geo = new THREE.CylinderGeometry(s[0], s[1] ?? s[0], s[2], s[3] || 24); break;
      case "sph": geo = new THREE.SphereGeometry(s[0], 20, 16); break;
      case "tor": geo = new THREE.TorusGeometry(s[0], s[1], 14, 32); break;
      default: geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    }
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.c || "#888"),
      roughness: spec.rough ?? 0.55, metalness: spec.metal ?? 0.25,
    });
    if (spec.o !== undefined && spec.o < 1) { mat.transparent = true; mat.opacity = spec.o; }
    if (spec.e) { mat.emissive = new THREE.Color(spec.e); mat.emissiveIntensity = 0.7; }
    const mesh = new THREE.Mesh(geo, mat);
    if (spec.p) mesh.position.set(spec.p[0], spec.p[1], spec.p[2]);
    if (spec.r) mesh.rotation.set(spec.r[0], spec.r[1], spec.r[2]);
    if (spec.sc) mesh.scale.set(spec.sc[0], spec.sc[1], spec.sc[2]);
    mesh.userData.baseOpacity = mat.transparent ? mat.opacity : 1;
    return mesh;
  }

  /* ---------------- minimal orbit controls ---------------- */
  function makeControls(cam, dom, target0) {
    const ctl = {
      target: new THREE.Vector3(...target0),
      sph: new THREE.Spherical(),
      update() {
        const pos = new THREE.Vector3().setFromSpherical(this.sph).add(this.target);
        cam.position.copy(pos);
        cam.lookAt(this.target);
      },
    };
    ctl.sph.setFromVector3(new THREE.Vector3().subVectors(cam.position, ctl.target));

    let mode = null, px = 0, py = 0, pinchD = 0;
    const clampSph = () => {
      ctl.sph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, ctl.sph.phi));
      ctl.sph.radius = Math.max(1.2, Math.min(9, ctl.sph.radius));
    };
    const rotate = (dx, dy) => { ctl.sph.theta -= dx * 0.006; ctl.sph.phi -= dy * 0.006; clampSph(); ctl.update(); };
    const pan = (dx, dy) => {
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
      const k = ctl.sph.radius * 0.0011;
      ctl.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      ctl.update();
    };
    const zoom = f => { ctl.sph.radius *= f; clampSph(); ctl.update(); };

    dom.addEventListener("pointerdown", e => {
      mode = (e.button === 2 || e.shiftKey) ? "pan" : "rot";
      px = e.clientX; py = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener("pointermove", e => {
      if (!mode) return;
      const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
      if (mode === "pan") pan(dx, dy); else rotate(dx, dy);
    });
    dom.addEventListener("pointerup", () => { mode = null; });
    dom.addEventListener("pointercancel", () => { mode = null; });
    dom.addEventListener("contextmenu", e => e.preventDefault());
    dom.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    dom.addEventListener("touchstart", e => {
      if (e.touches.length === 2) {
        pinchD = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    dom.addEventListener("touchmove", e => {
      if (e.touches.length === 2 && pinchD) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        zoom(pinchD / d); pinchD = d;
        e.preventDefault();
      }
    }, { passive: false });

    ctl.update();
    return ctl;
  }

  /* ---------------- fastener markers ---------------- */
  function buildFasteners(step) {
    const g = new THREE.Group();
    (step.fasteners || []).forEach(f => {
      let mesh;
      if (f.t === "bolt") {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.02, 6),
          new THREE.MeshStandardMaterial({ color: BOLT_GOLD, emissive: BOLT_GOLD, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6 }));
      } else {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 14, 10),
          new THREE.MeshStandardMaterial({
            color: f.t === "conn" ? CONN_BLUE : BOLT_GOLD,
            emissive: f.t === "conn" ? CONN_BLUE : BOLT_GOLD, emissiveIntensity: 0.6 }));
      }
      mesh.position.set(f.p[0], f.p[1], f.p[2]);
      mesh.userData.spec = f.spec;
      g.add(mesh);
    });
    return g;
  }

  function refreshFasteners() {
    if (fastenerGroup) { scene.remove(fastenerGroup); fastenerGroup = null; }
    const idx = removedStack.length;
    const step = def.steps[idx];
    if (step) { fastenerGroup = buildFasteners(step); scene.add(fastenerGroup); }
  }

  /* ---------------- part state ---------------- */
  function partCenter(id) {
    const box = new THREE.Box3().setFromObject(partGroups[id]);
    return box.getCenter(new THREE.Vector3());
  }

  function setPartRemovedInstant(id, removed) {
    const g = partGroups[id]; if (!g) return;
    const part = def.parts.find(p => p.id === id);
    g.position.set(...(removed ? part.explode : [0, 0, 0]));
    g.visible = removed ? showGhosts : true;
    g.traverse(o => {
      if (o.isMesh) {
        o.material.transparent = removed ? true : o.userData.baseOpacity < 1;
        o.material.opacity = removed ? GHOST_OPACITY : o.userData.baseOpacity;
      }
    });
  }

  function animatePart(id, removing, done) {
    const g = partGroups[id]; if (!g) return;
    const part = def.parts.find(p => p.id === id);
    g.visible = true;
    anims.push({
      g, start: performance.now(), dur: 750,
      from: removing ? [0, 0, 0] : part.explode,
      to: removing ? part.explode : [0, 0, 0],
      opFrom: removing ? 1 : GHOST_OPACITY,
      opTo: removing ? GHOST_OPACITY : null, // null ⇒ restore per-mesh base
      removing,
      onDone: done,
    });
    g.traverse(o => { if (o.isMesh) o.material.transparent = true; });
  }

  function tweenTarget(to) {
    targetTween = { from: camCtl.target.clone(), to: to.clone(), start: performance.now(), dur: 600 };
  }

  /* ---------------- render loop ---------------- */
  function loop(now) {
    if (disposed) return;
    raf = requestAnimationFrame(loop);

    // part animations
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      let t = Math.min(1, (now - a.start) / a.dur);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      a.g.position.set(
        a.from[0] + (a.to[0] - a.from[0]) * e,
        a.from[1] + (a.to[1] - a.from[1]) * e,
        a.from[2] + (a.to[2] - a.from[2]) * e);
      a.g.traverse(o => {
        if (o.isMesh) {
          const target = a.opTo === null ? o.userData.baseOpacity : a.opTo;
          o.material.opacity = a.opFrom + (target - a.opFrom) * e;
        }
      });
      if (t >= 1) {
        if (a.removing) { a.g.visible = showGhosts; }
        else a.g.traverse(o => { if (o.isMesh) { o.material.opacity = o.userData.baseOpacity; o.material.transparent = o.userData.baseOpacity < 1; } });
        anims.splice(i, 1);
        if (a.onDone) a.onDone();
      }
    }

    // camera target tween
    if (targetTween) {
      const t = Math.min(1, (now - targetTween.start) / targetTween.dur);
      const e = 1 - Math.pow(1 - t, 3);
      camCtl.target.lerpVectors(targetTween.from, targetTween.to, e);
      camCtl.update();
      if (t >= 1) targetTween = null;
    }

    // fastener pulse
    if (fastenerGroup) {
      const k = 1 + 0.25 * Math.sin(now / 240);
      fastenerGroup.children.forEach(m => m.scale.setScalar(k));
    }

    renderer.render(scene, camera);
  }

  /* ---------------- picking ---------------- */
  function pick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // fastener first
    if (fastenerGroup) {
      const fh = raycaster.intersectObjects(fastenerGroup.children, false);
      if (fh.length) return { type: "fastener", spec: fh[0].object.userData.spec };
    }
    const meshes = [];
    Object.values(partGroups).forEach(g => { if (g.visible) g.traverse(o => { if (o.isMesh) meshes.push(o); }); });
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.partId) o = o.parent;
    return o ? { type: "part", id: o.userData.partId } : null;
  }

  function onPointerMove(e) {
    const hit = pick(e);
    let text = null;
    if (hit) {
      if (hit.type === "fastener") text = hit.spec;
      else {
        const part = def.parts.find(p => p.id === hit.id);
        text = part ? part.name : null;
        if (part && !part.fixed) {
          const idx = def.steps.findIndex(s => s.part === part.id);
          if (idx === removedStack.length) text += " — click to remove";
          else if (removedStack.includes(part.id) && removedStack[removedStack.length - 1] === part.id) text += " — click to reinstall";
        }
      }
    }
    hoverPart = hit && hit.type === "part" ? hit.id : null;
    renderer.domElement.style.cursor = text ? "pointer" : "grab";
    if (tooltip) {
      if (text) {
        tooltip.textContent = text;
        tooltip.style.display = "block";
        const rect = container.getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 14) + "px";
        tooltip.style.top = (e.clientY - rect.top + 10) + "px";
      } else tooltip.style.display = "none";
    }
  }

  let downAt = null;
  function onPointerDown(e) { downAt = [e.clientX, e.clientY]; }
  function onPointerUp(e) {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 6) return; // was a drag, not a click
    const hit = pick(e);
    if (!hit || hit.type !== "part") return;
    const part = def.parts.find(p => p.id === hit.id);
    if (!part || part.fixed) return;
    const stepIdx = def.steps.findIndex(s => s.part === part.id);
    if (stepIdx === removedStack.length) { api.removeNext(); return; }
    if (removedStack[removedStack.length - 1] === part.id) { api.reinstallLast(); return; }
    if (removedStack.includes(part.id)) msg(`${part.name} is already off — reinstall in reverse order.`);
    else {
      const blocker = def.steps[removedStack.length];
      msg(`Not yet — remove the ${blocker ? blocker.title.toLowerCase() : "previous part"} first.`);
    }
  }

  function msg(text) { if (onMessage) onMessage(text); }
  function changed() { refreshFasteners(); if (onChange) onChange(removedStack.slice()); }

  /* ---------------- public API ---------------- */
  const api = {
    mount(opts) {
      api.unmount();
      container = opts.container; def = opts.def;
      removedStack = (opts.removed || []).slice();
      onChange = opts.onChange || null; onMessage = opts.onMessage || null;
      disposed = false;

      // validate saved stack against step order; truncate at first mismatch
      const valid = [];
      for (let i = 0; i < removedStack.length; i++) {
        if (def.steps[i] && def.steps[i].part === removedStack[i]) valid.push(removedStack[i]);
        else break;
      }
      removedStack = valid;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
      camera.position.set(...def.camera.pos);

      // preserveDrawingBuffer lets the canvas be read back (image export/screenshots)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      container.appendChild(renderer.domElement);

      tooltip = document.createElement("div");
      tooltip.className = "t3d-tooltip";
      container.appendChild(tooltip);

      // lights
      scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3d44, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(3, 5, 2); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(-3, 2, -3); scene.add(fill);

      // ground disc
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.3, 48),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.10 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = 0.005;
      scene.add(ground);

      // parts
      partGroups = {};
      def.parts.forEach(p => {
        const g = new THREE.Group();
        g.userData.partId = p.id;
        p.prims.forEach(spec => {
          const m = buildPrim(spec);
          m.userData.partId = p.id;
          g.add(m);
        });
        partGroups[p.id] = g;
        scene.add(g);
      });
      removedStack.forEach(id => setPartRemovedInstant(id, true));

      camCtl = makeControls(camera, renderer.domElement, def.camera.target);
      raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      const size = () => {
        const w = container.clientWidth || 300, h = container.clientHeight || 300;
        renderer.setSize(w, h);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      size();
      ro = new ResizeObserver(size);
      ro.observe(container);

      refreshFasteners();
      raf = requestAnimationFrame(loop);
    },

    unmount() {
      if (disposed && !renderer) return;
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) { ro.disconnect(); ro = null; }
      if (renderer) {
        renderer.domElement.remove();
        renderer.dispose();
        renderer.forceContextLoss && renderer.forceContextLoss();
        renderer = null;
      }
      if (tooltip) { tooltip.remove(); tooltip = null; }
      scene = null; camera = null; partGroups = {}; fastenerGroup = null;
      anims = []; targetTween = null; camCtl = null;
    },

    removeNext() {
      const step = def.steps[removedStack.length];
      if (!step) { msg("Teardown complete."); return; }
      removedStack.push(step.part);
      animatePart(step.part, true);
      const next = def.steps[removedStack.length];
      if (next) tweenTarget(partCenter(next.part));
      changed();
      if (!next) msg(def.exposedNote || "Teardown complete.");
    },

    reinstallLast() {
      if (!removedStack.length) return;
      const id = removedStack.pop();
      animatePart(id, false);
      tweenTarget(partCenter(id));
      changed();
    },

    reinstallAll() {
      while (removedStack.length) {
        const id = removedStack.pop();
        setPartRemovedInstant(id, false);
      }
      changed();
    },

    resetView() {
      camera.position.set(...def.camera.pos);
      camCtl.target.set(...def.camera.target);
      camCtl.sph.setFromVector3(new THREE.Vector3().subVectors(camera.position, camCtl.target));
      camCtl.update();
    },

    setGhosts(show) {
      showGhosts = show;
      removedStack.forEach(id => { partGroups[id].visible = show; });
    },

    currentIndex() { return removedStack.length; },
    getRemoved() { return removedStack.slice(); },
    _inspect(id) {
      const g = partGroups[id]; if (!g) return null;
      const mesh = g.children.find(o => o.isMesh) || {};
      return { visible: g.visible, pos: g.position.toArray(),
        opacity: mesh.material && mesh.material.opacity, transparent: mesh.material && mesh.material.transparent };
    },
  };

  return api;
})();
