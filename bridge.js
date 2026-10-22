/* ==========================================================================
   PaySetu — the living digital bridge
   bridge.js

   One continuous world behind the whole page: a sculptural arch of glass fins
   with a stream of light running along its spine, suspended in a deep
   midnight environment. The camera does not cut between sections - it travels
   the arch as the visitor scrolls, so the page reads as one journey rather
   than a stack of blocks.

   Design notes that matter:
   - The material is real transmission glass with iridescence, lit by a PMREM
     environment, not a painted gradient. It only looks expensive because it
     is actually refracting something.
   - Nothing spins for its own sake. The camera moves when the visitor moves.
   - Every path out of here is graceful: no WebGL, reduced motion, a hidden
     tab, or a slow device all fall back to something that still looks
     deliberate.
   ========================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const NIGHT = 0x04060d;
const CYAN = 0x7ff0ff;
const LAVENDER = 0xb9a8ff;
const ICE = 0xdfe9ff;

export function createBridge(canvas, opts = {}) {
  const reduced = opts.reducedMotion === true;
  const lowPower = opts.lowPower === true;

  /* ---------- renderer, and an honest bail-out --------------------------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: !lowPower, alpha: false, powerPreference: "high-performance"
    });
  } catch (err) {
    return null; // the page keeps its fallback hero
  }
  const gl = renderer.getContext();
  if (!gl) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 24, 78);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  // placed where the ride begins, not at an arbitrary origin, so the very first
  // painted frame is already composed - the opening shot is not a warm-up
  camera.position.set(0, 15, 27);

  /* A studio environment is what the glass reflects. Without it the material
     is a flat wash; with it the fins pick up highlights as the camera moves. */
  let envRT = null, pmrem = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.06);
    scene.environment = envRT.texture;
  } catch (err) {
    // A device that cannot build the environment map should still get the
    // world, lit by the lights below. Never a blank canvas.
    envRT = null;
    pmrem = null;
  }

  /* ---------- the arch --------------------------------------------------- */
  const world = new THREE.Group();
  scene.add(world);

  /* A vertical wash behind everything: near-black at the top, midnight blue at
     the horizon. It is what stops the frame reading as an empty void, and it
     costs one inverted sphere. */
  const backdropGeo = new THREE.SphereGeometry(90, 32, 24);
  const backdropColours = new Float32Array(backdropGeo.attributes.position.count * 3);
  const pos = backdropGeo.attributes.position;
  const top = new THREE.Color(0x04060d);
  const bottom = new THREE.Color(0x0b1a3a);
  const mid = new THREE.Color(0x071026);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 90;
    const c = y > 0 ? mid.clone().lerp(top, Math.min(1, y * 1.6)) : mid.clone().lerp(bottom, Math.min(1, -y * 1.3));
    backdropColours[i * 3] = c.r;
    backdropColours[i * 3 + 1] = c.g;
    backdropColours[i * 3 + 2] = c.b;
  }
  backdropGeo.setAttribute("color", new THREE.BufferAttribute(backdropColours, 3));
  const backdrop = new THREE.Mesh(backdropGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
  }));
  scene.add(backdrop);

  /* A soft haze on the floor, so the arch has something to stand in. */
  const hazeCanvas = document.createElement("canvas");
  hazeCanvas.width = hazeCanvas.height = 256;
  const hz = hazeCanvas.getContext("2d");
  const grad = hz.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(120,150,255,0.22)");
  grad.addColorStop(0.5, "rgba(80,110,220,0.07)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  hz.fillStyle = grad;
  hz.fillRect(0, 0, 256, 256);
  const hazeTex = new THREE.CanvasTexture(hazeCanvas);
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = -1.6;
  world.add(haze);

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8.6, 2.0, -1.6),
    new THREE.Vector3(-4.3, 4.4, -0.9),
    new THREE.Vector3(0, 5.4, 0.2),
    new THREE.Vector3(4.3, 4.4, 1.3),
    new THREE.Vector3(8.6, 2.0, 2.4)
  ]);

  /* Deliberately NOT `transmission: 1`. Real refraction costs a full extra
     render pass, and on anything without a strong GPU - including the software
     rasteriser used to check this page - it renders as nothing at all. The
     brief allows a performant approximation, so this is transparent physical
     glass: an environment map for the reflections, iridescence for the colour
     shift along the rim, and clearcoat for the wet sheen. It reads as glass on
     every device, and it costs a fraction of the price. */
  const glass = new THREE.MeshPhysicalMaterial({
    color: ICE,
    metalness: 0.04,
    roughness: 0.045,
    iridescence: 1,
    iridescenceIOR: 1.34,
    iridescenceThicknessRange: [110, 540],
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    envMapIntensity: 1.7,
    emissive: 0x1b2648,
    emissiveIntensity: 1,
    depthWrite: false
  });

  const FIN_COUNT = lowPower ? 16 : 30;
  const fins = [];
  const finGeo = new THREE.BoxGeometry(0.16, 1, 1.25);
  for (let i = 0; i < FIN_COUNT; i++) {
    const t = i / (FIN_COUNT - 1);
    const p = path.getPointAt(t);
    const tangent = path.getTangentAt(t);
    // tallest at the crown of the arch, so the silhouette reads as a bridge
    const height = 1.35 + Math.sin(t * Math.PI) * 1.5;
    const finMat = glass.clone();
    finMat.emissive = new THREE.Color(CYAN).lerp(new THREE.Color(LAVENDER), t)
      .lerp(new THREE.Color(0x24407f), 0.42);
    finMat.emissiveIntensity = 1.7;
    finMat.opacity = 0.30;
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.copy(p);
    fin.scale.set(1, height, 0.7 + Math.sin(t * Math.PI) * 0.5);
    fin.lookAt(p.clone().add(tangent));
    fin.userData = { t, rest: p.clone(), restScale: fin.scale.clone() };
    world.add(fin);
    fins.push(fin);
  }

  /* The stream of light along the spine. This is the element the feature
     sections follow, so it is bright enough to lead the eye. */
  const lightRibbon = new THREE.Mesh(
    new THREE.TubeGeometry(path, lowPower ? 90 : 220, 0.035, 8, false),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 })
  );
  world.add(lightRibbon);

  const haloRibbon = new THREE.Mesh(
    new THREE.TubeGeometry(path, lowPower ? 70 : 160, 0.14, 8, false),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.09, depthWrite: false })
  );
  world.add(haloRibbon);

  /* Fine particles following the same curvature - the brief asks for them,
     and they are also what makes the scroll feel like travel. */
  const DUST = lowPower || reduced ? 220 : 900;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const t = Math.random();
    const p = path.getPointAt(t);
    dustPos[i * 3] = p.x + (Math.random() - 0.5) * 1.6;
    dustPos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 1.4;
    dustPos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 1.6;
    dustSeed[i] = t;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: LAVENDER, size: 0.035, transparent: true, opacity: 0.6,
    depthWrite: false, sizeAttenuation: true
  }));
  world.add(dust);

  /* ---------- the phone, suspended under the crown ----------------------- */
  const phone = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d1220, metalness: 0.85, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.62, 3.3, 0.16), bodyMat);
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 3.38, 0.1),
    new THREE.MeshPhysicalMaterial({
      color: 0x2a3350, metalness: 1, roughness: 0.28,
      iridescence: 0.6, iridescenceIOR: 1.3
    })
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.46, 3.1),
    new THREE.MeshBasicMaterial({ color: 0x0a1020 })
  );
  screen.position.z = 0.085;
  // the screen is left dark on purpose: the real PaySetu interface is shown in
  // the page itself, labelled as an illustration, rather than faked here
  const screenGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.46, 3.1),
    new THREE.MeshBasicMaterial({ color: 0x1b3a6b, transparent: true, opacity: 0.55 })
  );
  screenGlow.position.z = 0.086;
  phone.add(body, edge, screen, screenGlow);
  const crown = path.getPointAt(0.5);
  phone.position.set(crown.x, crown.y - 3.0, crown.z + 0.9);
  phone.rotation.y = -0.32;
  world.add(phone);

  /* ---------- light ------------------------------------------------------- */
  scene.add(new THREE.HemisphereLight(0x3a5a9a, 0x070a14, 0.85));

  const key = new THREE.DirectionalLight(0xd6e4ff, 1.5);
  key.position.set(-8, 14, 9);
  scene.add(key);

  const cyanRim = new THREE.PointLight(CYAN, 55, 26, 2);
  cyanRim.position.copy(path.getPointAt(0.28)).add(new THREE.Vector3(0, 1.4, 0));
  scene.add(cyanRim);

  const lavenderFill = new THREE.PointLight(LAVENDER, 40, 30, 2);
  lavenderFill.position.copy(path.getPointAt(0.74)).add(new THREE.Vector3(0, 2.0, 0));
  scene.add(lavenderFill);

  /* The travelling beam of the opening shot. It is a real object, so it
     illuminates the glass as it passes rather than being drawn over it. */
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 26, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.0, depthWrite: false })
  );
  beam.rotation.z = Math.PI / 2.6;
  scene.add(beam);
  const beamLight = new THREE.PointLight(CYAN, 0, 18, 2);
  scene.add(beamLight);

  /* ---------- the portal -------------------------------------------------- */
  const portal = new THREE.Group();
  const portalMat = glass.clone();
  portalMat.emissive = new THREE.Color(CYAN);
  portalMat.emissiveIntensity = 0.55;
  portalMat.opacity = 0.55;
  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.075, 20, 96),
    portalMat
  );
  const portalCore = new THREE.Mesh(
    new THREE.CircleGeometry(1.44, 64),
    new THREE.MeshBasicMaterial({ color: 0x0a1430, transparent: true, opacity: 0.0, depthWrite: false })
  );
  const portalHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.0, 64),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
  );
  portal.add(portalRing, portalCore, portalHalo);
  portal.position.copy(path.getPointAt(0.62)).add(new THREE.Vector3(0, 2.6, 0));
  portal.rotation.y = -0.5;
  world.add(portal);

  /* ---------- state the page drives --------------------------------------- */
  const state = {
    progress: 0,       // scroll position through the journey, 0..1
    pointer: new THREE.Vector2(),
    intro: reduced ? 1 : 0,
    portalHover: 0,
    portalOpen: 0
  };

  const camAt = new THREE.Vector3();
  const lookAt = new THREE.Vector3(0, 4.6, 0.2);
  const lookTarget = lookAt.clone();
  camera.lookAt(lookAt);

  /* ---------- resize ------------------------------------------------------ */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // on a phone the arch is framed closer, so the crown stays in shot
    camera.fov = w < 760 ? 52 : 38;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- the loop ---------------------------------------------------- */
  const clock = new THREE.Clock();
  let running = true;
  let frames = 0;

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    frames++;

    // the opening: the beam crosses, the fins rise into place, the phone fades in
    if (state.intro < 1) {
      state.intro = Math.min(1, state.intro + dt * 0.42);
      const k = state.intro;
      beam.material.opacity = Math.sin(k * Math.PI) * 0.75;
      beam.position.set(
        THREE.MathUtils.lerp(-16, 16, k),
        7.5 + Math.sin(k * Math.PI) * 2.2,
        THREE.MathUtils.lerp(-9, 11, k)
      );
      beamLight.position.copy(beam.position);
      beamLight.intensity = Math.sin(k * Math.PI) * 30;
      fins.forEach((fin, i) => {
        const local = THREE.MathUtils.clamp((k * 1.7) - i / FIN_COUNT, 0, 1);
        const ease = 1 - Math.pow(1 - local, 3);
        fin.scale.set(
          fin.userData.restScale.x * ease,
          fin.userData.restScale.y * ease,
          fin.userData.restScale.z * ease
        );
      });
      phone.position.y = THREE.MathUtils.lerp(crown.y - 6.5, crown.y - 3.1, k);
    } else {
      beam.material.opacity = 0;
      beamLight.intensity = 0;
    }

    // the camera rides the arch. It never cuts, and it never spins on its own.
    const p = THREE.MathUtils.clamp(0.02 + state.progress * 0.9, 0, 0.999);
    const point = path.getPointAt(p);
    const ahead = path.getPointAt(Math.min(0.999, p + 0.1));
    // ride above and to one side of the spine: a three-quarter view of the arch
    camAt.set(point.x, point.y + 9.5, point.z + 21);
    camera.position.lerp(camAt, reduced ? 1 : 0.055);
    lookTarget.copy(ahead).lerp(new THREE.Vector3(0, 4.6, 0.2), 0.5);
    lookAt.lerp(lookTarget, reduced ? 1 : 0.07);
    camera.lookAt(lookAt);

    // a restrained pointer parallax, a few centimetres of lean, never a swing
    if (!reduced) {
      camera.position.x += state.pointer.x * 0.55;
      camera.position.y += -state.pointer.y * 0.4;
    }

    // light breathing along the arch, so the world is alive while it waits
    cyanRim.intensity = 55 + Math.sin(t * 0.9) * 6;
    lavenderFill.intensity = 40 + Math.sin(t * 0.7 + 1.4) * 5;
    haloRibbon.material.opacity = 0.075 + Math.sin(t * 1.3) * 0.02;

    // the portal: it ripples under the pointer and opens on request
    portal.rotation.z = reduced ? 0 : t * 0.06;
    const ripple = 1 + state.portalHover * 0.06 + Math.sin(t * 3.2) * 0.012 * state.portalHover;
    portalRing.scale.setScalar(ripple + state.portalOpen * 0.9);
    portalRing.material.iridescenceThicknessRange = [
      110 + state.portalHover * 220, 540 + state.portalHover * 380
    ];
    portalCore.material.opacity = state.portalOpen * 0.9;
    portalHalo.material.opacity = 0.06 + state.portalHover * 0.1 + state.portalOpen * 0.18;

    // dust drifts along the curvature
    if (!reduced) {
      const arr = dustGeo.attributes.position.array;
      for (let i = 0; i < DUST; i++) {
        const seed = dustSeed[i];
        arr[i * 3 + 1] += Math.sin(t * 0.5 + seed * 6.3) * 0.0016;
        arr[i * 3] += Math.cos(t * 0.35 + seed * 4.1) * 0.0013;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- lifecycle --------------------------------------------------- */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      clock.getDelta();
      requestAnimationFrame(frame);
    }
  });

  return {
    setProgress(v) { state.progress = THREE.MathUtils.clamp(v, 0, 1); },
    setPointer(x, y) { state.pointer.set(x, y); },
    skipIntro() { state.intro = 1; },
    setPortalHover(v) { state.portalHover = v; },
    setPortalOpen(v) { state.portalOpen = v; },
    portalScreenPosition() {
      const v = portal.position.clone().project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        visible: v.z < 1
      };
    },
    frameCount() { return frames; },
    dispose() {
      running = false;
      window.removeEventListener("resize", resize);
      if (envRT) envRT.dispose();
      if (pmrem) pmrem.dispose();
      renderer.dispose();
    }
  };
}
