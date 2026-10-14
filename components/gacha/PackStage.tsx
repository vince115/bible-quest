"use client";

// The pack stage, in three.js: the packs of the kind on offer stand in a ring on a round stage, seen from a little above
// so the ones at the back show over the ones in front. Turn it (arrows, drag, or tap a pack); the pack in front is the one to open.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/game/locale";
import { asset } from "@/game/assets";
import type { PackKind } from "@/game/v3/gacha";
import { foilOf } from "./packStyle";

const W = 360; // texture size in pixels (9 : 14, like the pack art on the page)
const H = 560;

/** The front of a pack, drawn on a canvas for the 3D model: foil, crimped seals, the featured card, the name. */
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
  crimp(g);
  // The window with the featured card
  const x = W * 0.09, y = H * 0.14, w = W * 0.82, h = H * 0.52;
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 4);
  g.clip();
  if (art) {
    const scale = w / art.width; // fit the width, keep the top of the picture
    const sh = Math.min(art.height, h / scale);
    g.drawImage(art, 0, 0, art.width, sh, x, y, w, sh * scale);
  } else {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(x, y, w, h);
  }
  const fade = g.createLinearGradient(0, y, 0, y + h);
  fade.addColorStop(0.6, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = fade;
  g.fillRect(x, y, w, h);
  g.restore();
  g.lineWidth = 4;
  g.strokeStyle = "rgba(255,255,255,0.75)";
  g.strokeRect(x, y, w, h);
  // Names
  g.textAlign = "center";
  g.shadowColor = "rgba(0,0,0,0.8)";
  g.shadowBlur = 6;
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "bold 18px sans-serif";
  g.fillText("B I B L E   Q U E S T", W / 2, H * 0.78);
  g.fillStyle = "#fff";
  g.font = "900 46px sans-serif";
  g.fillText(title, W / 2, H * 0.87);
  return c;
}

/** The plain back of a pack. */
function paintBack(id: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const [light, mid, dark] = foilOf(id);
  const grad = g.createLinearGradient(W, 0, 0, H);
  grad.addColorStop(0, light);
  grad.addColorStop(0.5, mid);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  crimp(g);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.font = "300 120px sans-serif";
  g.textAlign = "center";
  g.fillText("✝", W / 2, H * 0.55);
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
export function PackStage({ pack, count, onPick }: { pack: PackKind; count: number; onPick: (pack: PackKind) => void }) {
  const t = useT();
  const title = t(`v3.pack.${pack.id}.name`);
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ go: (d: number) => void } | null>(null);
  const [failed, setFailed] = useState(false);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const art = await loadImage(asset(`/cards/${pack.featured}.jpg`));
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
      const DIST = 10.3;
      const LOW = 0, HIGH = 45, REST = 24; // degrees above the floor
      let pitch = (REST - LOW) / (HIGH - LOW); // 0..1, where the camera is now
      let pitchTarget = pitch;
      const aim = () => {
        const e = ((LOW + pitch * (HIGH - LOW)) * Math.PI) / 180;
        camera.position.set(0, DIST * Math.sin(e), DIST * Math.cos(e));
        camera.lookAt(0, 0.3, 0.2);
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

      // The stage: a round floor with a rim of light
      const floor = new THREE.Mesh(new THREE.CircleGeometry(4.35, 64), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.55, metalness: 0.25 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
      const rim = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.35, 64), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.8 }));
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.005;
      scene.add(rim);

      // The packs
      const frontTex = new THREE.CanvasTexture(paintFront(pack.id, title, art));
      const backTex = new THREE.CanvasTexture(paintBack(pack.id));
      for (const tex of [frontTex, backTex]) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      const [, mid] = foilOf(pack.id);
      const PW = 1.05, PH = (PW * 14) / 9, PD = 0.06, R = 3.15;
      const geometry = new THREE.BoxGeometry(PW, PH, PD);
      const ring = new THREE.Group();
      scene.add(ring);
      const step = (Math.PI * 2) / count;
      const materials: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];
      const meshes = Array.from({ length: count }, (_, i) => {
        const edge = new THREE.MeshStandardMaterial({ color: mid, roughness: 0.5, metalness: 0.2 });
        const front = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.38, metalness: 0.15 });
        const back = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.4, metalness: 0.15 });
        materials.push(edge, front, back);
        const mesh = new THREE.Mesh(geometry, [edge, edge, edge, edge, front, back]);
        mesh.userData.index = i;
        const angle = i * step;
        mesh.position.set(Math.sin(angle) * R, PH / 2 + 0.03, Math.cos(angle) * R);
        mesh.rotation.y = angle;
        ring.add(mesh);
        return { mesh, mats: [edge, front, back], baseY: PH / 2 + 0.03 };
      });

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

      // Pointer: drag to turn, tap a pack to bring it to the front (or open the one already there)
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
        const hit = raycaster.intersectObjects(meshes.map((m) => m.mesh))[0];
        if (!hit) return;
        const i = hit.object.userData.index as number;
        const front = frontIndex();
        if (i === front) pick.current(pack);
        else {
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
        meshes.forEach(({ mesh, mats, baseY }, i) => {
          let off = (((i - current) % count) + count) % count;
          if (off > count / 2) off -= count;
          const away = Math.abs(off);
          const near = Math.max(0, 1 - away);
          const shade = Math.max(0.4, 1 - away * 0.1);
          for (const m of mats) m.color.setScalar(m === mats[0] ? 1 : shade);
          mats[0].color.set(mid).multiplyScalar(shade);
          mesh.position.y = baseY + near * (0.1 + Math.sin(time * 1.6) * 0.03);
          mesh.scale.setScalar(1 + near * 0.08);
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
        geometry.dispose();
        floor.geometry.dispose();
        (floor.material as InstanceType<typeof THREE.Material>).dispose();
        rim.geometry.dispose();
        (rim.material as InstanceType<typeof THREE.Material>).dispose();
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
        className="relative h-[360px] w-full max-w-3xl select-none outline-none sm:h-[420px]"
        tabIndex={0}
        role="group"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          else if (e.key === "ArrowRight") go(1);
          else if (e.key === "Enter") onPick(pack);
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
      <button onClick={() => onPick(pack)} className="rounded-2xl bg-amber-500 px-8 py-3 text-lg font-bold text-stone-950 shadow-lg hover:bg-amber-400">
        {t("v3.gacha.pick")}
      </button>
    </div>
  );
}
