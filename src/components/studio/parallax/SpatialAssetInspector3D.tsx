"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ModelId } from "@/parallax/asset-catalog";
import styles from "./SpatialContentLibrary.module.css";

/** One on-demand renderer for the selected Library model; cards remain image-only. */
export function SpatialAssetInspector3D({ id, name, thumbnail }: { id: ModelId; name: string; thumbnail?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element || !window.WebGLRenderingContext) return;
    let cancelled = false;
    let dispose = () => {};
    setReady(false);
    void Promise.all([import("three"), import("@/parallax/assets/models")])
      .then(([T, models]) => {
        if (cancelled || !host.current) return;
        let renderer: import("three").WebGLRenderer;
        try {
          renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        } catch {
          return;
        }
        const scene = new T.Scene();
        const model = models.createPremiumModel(id, false);
        const bounds = new T.Box3().setFromObject(model);
        const size = bounds.getSize(new T.Vector3());
        const radius = Math.max(size.length() * 1.12, 0.9);
        model.position.sub(bounds.getCenter(new T.Vector3()));
        scene.add(model);
        scene.add(new T.HemisphereLight(0xffffff, 0x445568, 2.2));
        const keyLight = new T.DirectionalLight(0xffedcf, 2.5);
        keyLight.position.set(3, 5, 6);
        scene.add(keyLight);
        const camera = new T.PerspectiveCamera(40, 1, 0.01, radius * 10);
        let azimuth = Math.PI / 4;
        const elevation = 0.34;
        let dragX: number | null = null;
        const render = () => {
          camera.position.set(
            radius * Math.cos(elevation) * Math.sin(azimuth),
            radius * Math.sin(elevation),
            radius * Math.cos(elevation) * Math.cos(azimuth),
          );
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        };
        const resize = () => {
          const width = Math.min(element.clientWidth, 640);
          const height = Math.min(element.clientHeight, 320);
          if (!width || !height) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.setSize(width, height, false);
          render();
        };
        const canvas = renderer.domElement;
        canvas.setAttribute("aria-hidden", "true");
        element.appendChild(canvas);
        const pointerDown = (event: PointerEvent) => {
          dragX = event.clientX;
          canvas.setPointerCapture(event.pointerId);
        };
        const pointerMove = (event: PointerEvent) => {
          if (dragX === null) return;
          azimuth += (event.clientX - dragX) * 0.01;
          dragX = event.clientX;
          render();
        };
        const pointerUp = () => {
          dragX = null;
        };
        const keyDown = (event: KeyboardEvent) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          azimuth += event.key === "ArrowLeft" ? -0.2 : 0.2;
          render();
        };
        canvas.addEventListener("pointerdown", pointerDown);
        canvas.addEventListener("pointermove", pointerMove);
        canvas.addEventListener("pointerup", pointerUp);
        canvas.addEventListener("pointercancel", pointerUp);
        element.addEventListener("keydown", keyDown);
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        setReady(true);
        dispose = () => {
          observer.disconnect();
          canvas.removeEventListener("pointerdown", pointerDown);
          canvas.removeEventListener("pointermove", pointerMove);
          canvas.removeEventListener("pointerup", pointerUp);
          canvas.removeEventListener("pointercancel", pointerUp);
          element.removeEventListener("keydown", keyDown);
          const materials = new Set<import("three").Material>();
          model.traverse((object) => {
            if (!(object instanceof T.Mesh)) return;
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material])
              materials.add(material);
          });
          materials.forEach((material) => material.dispose());
          renderer.dispose();
          canvas.remove();
        };
      })
      .catch(() => {
        // The selected item's verified thumbnail remains available when WebGL is unavailable.
      });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [id]);
  return (
    <div
      className={styles.modelInspector}
      ref={host}
      tabIndex={0}
      aria-label={`3D preview of ${name}. Use left and right arrow keys to rotate.`}
    >
      {!ready && thumbnail && <Image src={thumbnail} width={480} height={290} alt="" unoptimized />}
      {!ready && !thumbnail && <span>3D preview unavailable</span>}
      {ready && <span className={styles.modelHint}>Drag or use ← → to inspect</span>}
    </div>
  );
}
