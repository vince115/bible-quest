"use client";

// The pack stage, in three.js: the packs of the kind on offer stand in a ring, seen from a little above
// so the ones at the back show over the ones in front. Turn it (arrows, drag, or tap a pack); the pack in front is the one to open.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/game/locale";
import { asset } from "@/game/assets";
import type { PackKind } from "@/game/v3/gacha";
import { foilOf, packPicture } from "./packStyle";

const W = 360; // texture size in pixels (9 : 14, like the pack art on the page)
const H = 560;

/** The front of a pack, drawn on a canvas for the 3D model: the wrapper picture filling the pack, then the names. */
function paintFront(id: string, title: string, art: HTMLImageElement | null): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const [light, mid, dark] = foilOf(id);
  const grad = g.createLinearGradient(0, 0, W * 0.4, H);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  if (art) {
    // Like object-fit: cover, so the picture fills the pack
    const k = Math.max(W / art.width, H / art.height);
    const w = art.width * k, h = art.height * k;
    g.drawImage(art, (W - w) / 2, (H - h) / 2, w, h);
  } else {
    crimp(g);
  }
  g.textAlign = "center";
  g.lineJoin = "round";
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.strokeStyle = "rgba(0,0,0,0.7)";
  g.lineWidth = 5;
  g.font = "bold 17px sans-serif";
  g.strokeText("B I B L E   Q U E S T", W / 2, H * 0.8);
  g.fillText("B I B L E   Q U E S T", W / 2, H * 0.8);
  g.fillStyle = "#fff";
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.lineWidth = 9;
  g.font = "900 54px sans-serif";
  g.strokeText(title, W / 2, H * 0.875);
  g.fillText(title, W / 2, H * 0.875);
  return c;
}

/**
 * The back of a pack carries the front's picture on: the same picture turned the other way round, so the foil seals at
 * the top and bottom are the same, the middle darkened into a starry field, and a rainbow strip down the centre.
 */
function paintBack(id: string, art: HTMLImageElement | null): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const [light, mid, dark] = foilOf(id);
  const grad = g.createLinearGradient(W, 0, 0, H);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  if (art) {
    const k = Math.max(W / art.width, H / art.height);
    const w = art.width * k, h = art.height * k;
    g.save();
    g.translate(W, 0);
    g.scale(-1, 1);
    g.drawImage(art, (W - w) / 2, (H - h) / 2, w, h);
    g.restore();
  } else {
    crimp(g);
  }
  // The middle sinks into a dark field; the foil seals above and below stay as on the front
  const wash = g.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0.07, "rgba(6,4,18,0)");
  wash.addColorStop(0.15, "rgba(6,4,18,0.72)");
  wash.addColorStop(0.85, "rgba(6,4,18,0.72)");
  wash.addColorStop(0.93, "rgba(6,4,18,0)");
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.5, H * 0.5, 10, W * 0.5, H * 0.5, W * 0.8);
  glow.addColorStop(0, `${mid}55`);
  glow.addColorStop(1, `${mid}00`);
  g.fillStyle = glow;
  g.fillRect(0, H * 0.1, W, H * 0.8);
  // Stars
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = H * (0.14 + rnd() * 0.72), r = 0.6 + rnd() * 1.6;
    g.fillStyle = `rgba(255,240,190,${0.35 + rnd() * 0.5})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // A rainbow strip down the centre (a stand-in for the type strip on a Pokémon pack's back), faded out into the
  // foil at its head and foot. It is drawn on its own layer so that the fade can be cut into it.
  const strip = document.createElement("canvas");
  strip.width = W;
  strip.height = H;
  const sg = strip.getContext("2d")!;
  const sw = W * 0.04, sx = W * 0.5 - sw / 2;
  const rainbow = sg.createLinearGradient(0, 0, 0, H);
  ["#ff4d6d", "#ff9f1c", "#ffe14d", "#4ade80", "#38bdf8", "#6366f1", "#c084fc"].forEach((col, i, all) => rainbow.addColorStop(i / (all.length - 1), col));
  sg.fillStyle = rainbow;
  sg.fillRect(sx, 0, sw, H);
  // Only a little shade at both edges of the strip, no light down its middle
  const edge = sg.createLinearGradient(sx, 0, sx + sw, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.28)");
  edge.addColorStop(0.2, "rgba(0,0,0,0)");
  edge.addColorStop(0.8, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.28)");
  sg.fillStyle = edge;
  sg.fillRect(sx, 0, sw, H);
  sg.globalCompositeOperation = "destination-in";
  const fade = sg.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.14, "rgba(0,0,0,1)");
  fade.addColorStop(0.86, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = fade;
  sg.fillRect(0, 0, W, H);
  g.drawImage(strip, 0, 0);
  return c;
}

/** The crimped seals along the top and bottom edges. */
function crimp(g: CanvasRenderingContext2D) {
  for (const [y, h] of [[0, H * 0.07], [H * 0.95, H * 0.05]] as const) {
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.fillRect(0, y, W, h);
    g.fillStyle = "rgba(255,255,255,0.28)";
    for (let x = 0; x < W; x += 8) g.fillRect(x, y, 2.5, h);
  }
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // art served from another site (R2) needs this to be used as a texture
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Every pack on the ring is of the same kind: choose any one of them. */
export function PackStage({ pack, count, canOpen = true, onPick }: { pack: PackKind; count: number; canOpen?: boolean; onPick: (pack: PackKind) => void }) {
  const t = useT();
  const title = t(`v3.pack.${pack.id}.name`);
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ go: (d: number) => void } | null>(null);
  const [failed, setFailed] = useState(false);
  // The latest callback and whether opening is allowed (the points cover a pack), read by the 3D scene's handlers
  const pick = useRef(onPick);
  const allowed = useRef(canOpen);
  useEffect(() => {
    pick.current = onPick;
    allowed.current = canOpen;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const art = await loadImage(asset(packPicture(pack)));
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "pan-y";
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
      // The camera orbits the stage at a fixed distance; the mouse's height over the stage sets how high it is
      // (low and level at the bottom of the stage, almost overhead at the top).
      const DIST = 9.5;
      const LOW = 0, HIGH = 15, REST = 8; // degrees above the floor
      let pitch = (REST - LOW) / (HIGH - LOW); // 0..1, where the camera is now
      let pitchTarget = pitch;
      const aim = () => {
        const e = ((LOW + pitch * (HIGH - LOW)) * Math.PI) / 180;
        camera.position.set(0, DIST * Math.sin(e), DIST * Math.cos(e));
        camera.lookAt(0, -0.3, 0.2);
      };
      aim();

      // Light: soft all over, a key light from above and a warm one on the pack in front
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 7, 6);
      scene.add(key);
      const warm = new THREE.PointLight(0xffd9a0, 40, 14);
      warm.position.set(0, 2.6, 5.6);
      scene.add(warm);

      // The packs
      const frontTex = new THREE.CanvasTexture(paintFront(pack.id, title, art));
      const backTex = new THREE.CanvasTexture(paintBack(pack.id, art));
      for (const tex of [frontTex, backTex]) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      const PW = 1.05, PH = (PW * 14) / 9, R = 3.15;
      // A pack is about 6.5 cm wide, so one unit is about 6 cm: the packs hover a couple of centimetres above the water
      const HOVER = 0.3;
      // An inflated foil pouch with the cards inside: flat crimped seals at the head and foot, pinched side seams, and a
      // plump body between. Each face is a plane whose points are pushed out by `bulge`; the two faces meet at the seams.
      const BULGE = 0.065;
      const smooth = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      const bulge = (x: number, y: number) => {
        const u = Math.abs(x) / (PW / 2);
        const v = (y + PH / 2) / PH;
        const across = 1 - Math.pow(u, 2.6); // full over the middle, dropping to the side seams
        const along = smooth(0.05, 0.22, v) * (1 - smooth(0.8, 0.93, v)); // flat at the seals
        const swell = 1 + 0.12 * Math.sin(v * Math.PI); // fullest around the middle
        return BULGE * across * along * swell;
      };
      const faceGeometry = (sign: 1 | -1) => {
        const geo = new THREE.PlaneGeometry(PW, PH, 30, 48);
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) pos.setZ(k, bulge(pos.getX(k), pos.getY(k)));
        geo.computeVertexNormals();
        if (sign < 0) {
          // The back face looks the other way: turn it round (its picture then reads correctly from behind)
          geo.rotateY(Math.PI);
        }
        return geo;
      };
      const geometries = [faceGeometry(1), faceGeometry(-1)];
      const ring = new THREE.Group();
      scene.add(ring);
      const step = (Math.PI * 2) / count;
      const materials: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];

      // Water: the floor is a glossy pool, so every pack has a reflection below it. The reflection is the same pack
      // upside down under the floor, rippling a little and fading out the further it goes from the floor.
      const mirrorRing = new THREE.Group();
      mirrorRing.scale.y = -1;
      scene.add(mirrorRing);
      const uTime = { value: 0 };
      const FADE = PH * 0.95;
      const mirrorMaterial = (map: InstanceType<typeof THREE.CanvasTexture>) => {
        const m = new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.1, transparent: true, depthWrite: false });
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = uTime;
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying float vH;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.x += sin(transformed.y * 16.0 + uTime * 2.2) * 0.012;\nvH = (modelMatrix * vec4(transformed, 1.0)).y;");
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vH;")
            .replace("#include <dithering_fragment>", `#include <dithering_fragment>\ngl_FragColor.a *= 0.5 * clamp(1.0 + (vH + ${HOVER.toFixed(3)}) / ${FADE.toFixed(3)}, 0.0, 1.0);`);
        };
        return m;
      };
      // A soft sheen of light on the water under the ring
      const sheen = document.createElement("canvas");
      sheen.width = sheen.height = 256;
      const sg = sheen.getContext("2d")!;
      const radial = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
      radial.addColorStop(0, "rgba(255,240,210,0.32)");
      radial.addColorStop(0.6, "rgba(255,240,210,0.1)");
      radial.addColorStop(1, "rgba(255,240,210,0)");
      sg.fillStyle = radial;
      sg.fillRect(0, 0, 256, 256);
      const sheenTex = new THREE.CanvasTexture(sheen);
      const sheenMat = new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const sheenMesh = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.2, R * 3.2), sheenMat);
      sheenMesh.rotation.x = -Math.PI / 2;
      sheenMesh.position.y = 0.002;
      scene.add(sheenMesh);
      const meshes = Array.from({ length: count }, (_, i) => {
        const front = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.46, metalness: 0.1 });
        const back = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.48, metalness: 0.1 });
        materials.push(front, back);
        const frontFace = new THREE.Mesh(geometries[0], front);
        const backFace = new THREE.Mesh(geometries[1], back);
        frontFace.userData.index = i;
        backFace.userData.index = i;
        const mesh = new THREE.Group();
        mesh.add(frontFace, backFace);
        const mirrorFront = mirrorMaterial(frontTex);
        const mirrorBack = mirrorMaterial(backTex);
        materials.push(mirrorFront, mirrorBack);
        const mirror = new THREE.Group();
        mirror.add(new THREE.Mesh(geometries[0], mirrorFront), new THREE.Mesh(geometries[1], mirrorBack));
        mirrorRing.add(mirror);
        const angle = i * step;
        mesh.position.set(Math.sin(angle) * R, HOVER + PH / 2, Math.cos(angle) * R);
        mesh.rotation.y = angle;
        ring.add(mesh);
        return { mesh, mirror, mats: [front, back, mirrorFront, mirrorBack], baseY: HOVER + PH / 2 };
      });

      // Flipping: each pack can be turned over to show its back (0 = front, 1 = back)
      const flips = meshes.map(() => ({ cur: 0, target: 0 }));

      // Turning: `target` is where the ring is going, in packs; `current` follows it smoothly
      let target = 0;
      let current = 0;
      const frontIndex = () => ((Math.round(current) % count) + count) % count;
      api.current = { go: (d) => (target = Math.round(target) + d) };

      const size = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      size();
      const observer = new ResizeObserver(size);
      observer.observe(el);

      // Pointer: drag to turn, tap a pack to bring it to the front; on the pack in front, tap its sides to turn it over or its middle to open it
      const raycaster = new THREE.Raycaster();
      let down: { x: number; target: number } | null = null;
      let moved = false;
      const canvas = renderer.domElement;
      const onDown = (e: PointerEvent) => {
        down = { x: e.clientX, target };
        moved = false;
        canvas.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "mouse") {
          const r = canvas.getBoundingClientRect();
          pitchTarget = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
        }
        if (!down) return;
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 6) moved = true;
        if (moved) {
          target = down.target - dx / 110;
          current = target; // follow the finger exactly while dragging
        }
      };
      const onUp = (e: PointerEvent) => {
        if (!down) return;
        down = null;
        if (moved) {
          target = Math.round(target);
          return;
        }
        const r = canvas.getBoundingClientRect();
        const pointer = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(meshes.map((m) => m.mesh), true)[0];
        if (!hit) return;
        const i = hit.object.userData.index as number;
        const front = frontIndex();
        if (i === front) {
          // The left and right sides of the pack turn it over; the middle opens it
          const local = hit.object.worldToLocal(hit.point.clone());
          if (Math.abs(local.x) > PW * 0.2) flips[i].target = flips[i].target ? 0 : 1;
          else if (allowed.current) pick.current(pack);
        } else {
          let d = i - front;
          if (d > count / 2) d -= count;
          if (d < -count / 2) d += count;
          target = Math.round(target) + d;
        }
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      const onLeave = (e: PointerEvent) => {
        if (e.pointerType === "mouse") pitchTarget = (REST - LOW) / (HIGH - LOW); // back to the resting view
      };
      canvas.addEventListener("pointerleave", onLeave);

      // Draw
      let raf = 0;
      const t0 = performance.now();
      let last = t0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const time = (now - t0) / 1000;
        if (!down || !moved) current += (target - current) * Math.min(1, dt * 9);
        if (Math.abs(pitchTarget - pitch) > 0.0005) {
          pitch += (pitchTarget - pitch) * Math.min(1, dt * 6);
          aim();
        }
        ring.rotation.y = -current * step;
        mirrorRing.rotation.y = ring.rotation.y;
        uTime.value = time;
        meshes.forEach(({ mesh, mirror, mats, baseY }, i) => {
          let off = (((i - current) % count) + count) % count;
          if (off > count / 2) off -= count;
          const away = Math.abs(off);
          const near = Math.max(0, 1 - away);
          const shade = Math.max(0.4, 1 - away * 0.1);
          for (const m of mats) m.color.setScalar(shade);
          const flip = flips[i];
          flip.cur += (flip.target - flip.cur) * Math.min(1, dt * 8);
          mesh.rotation.y = i * step + Math.PI * flip.cur;
          mesh.position.y = baseY + near * (0.1 + Math.sin(time * 1.6) * 0.03);
          mesh.scale.setScalar(1 + near * 0.08);
          mirror.position.copy(mesh.position);
          mirror.rotation.copy(mesh.rotation);
          mirror.scale.copy(mesh.scale);
        });
        renderer.render(scene, camera);
      };
      frame();

      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("pointerleave", onLeave);
        geometries.forEach((geo) => geo.dispose());
        sheenMesh.geometry.dispose();
        sheenMat.dispose();
        sheenTex.dispose();
        materials.forEach((m) => m.dispose());
        frontTex.dispose();
        backTex.dispose();
        renderer.dispose();
        canvas.remove();
        api.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [pack, count, title]);

  const go = useCallback((d: number) => api.current?.go(d), []);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        className="relative h-[440px] w-full max-w-3xl select-none outline-none sm:h-[520px]"
        tabIndex={0}
        role="group"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          else if (e.key === "ArrowRight") go(1);
          else if (e.key === "Enter" && canOpen) onPick(pack);
        }}
      >
        <div ref={host} className="absolute inset-0" />
        <button type="button" onClick={() => go(-1)} aria-label={t("v3.gacha.prev")} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <ChevronLeft size={24} aria-hidden />
        </button>
        <button type="button" onClick={() => go(1)} aria-label={t("v3.gacha.nextPack")} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>
      {failed && <p className="text-xs text-stone-400">{t("v3.gacha.noWebgl")}</p>}
      <button onClick={() => onPick(pack)} disabled={!canOpen} className="rounded-2xl bg-amber-500 px-8 py-3 text-lg font-bold text-stone-950 shadow-lg enabled:hover:bg-amber-400 disabled:opacity-40">
        {t("v3.gacha.pick")}
      </button>
    </div>
  );
}
