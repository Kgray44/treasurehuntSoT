import { anchorPoints, attachments, membrane } from "./adhesion";

const ns = "http://www.w3.org/2000/svg";
let serial = 0;
/** Deform the actual live DOM paint, including text and live crew updates.
 * The displacement map is the projection of the same anchored membrane used
 * by outgoing GPU surfaces; it is never a captured replacement interface. */
export class LiveMembrane {
  readonly id = `embarkation-membrane-${serial++}`;
  private svg: SVGSVGElement;
  private image: SVGFEImageElement;
  private displacement: SVGFEDisplacementMapElement;
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private pixels: ImageData;
  private lastFrame = -1;
  constructor(readonly index: number) {
    this.canvas.width = 49;
    this.canvas.height = 33;
    this.ctx = this.canvas.getContext("2d")!;
    this.pixels = this.ctx.createImageData(49, 33);
    this.svg = document.createElementNS(ns, "svg");
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.style.cssText = "position:fixed;width:0;height:0;pointer-events:none;overflow:hidden";
    this.svg.innerHTML = `<defs><filter id="${this.id}" x="-35%" y="-35%" width="170%" height="170%" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="field"/>
      <feFlood flood-color="rgb(50%,50%,100%)" result="neutral"/>
      <feComposite in="field" in2="neutral" operator="over" result="completeField"/>
      <feDisplacementMap in="SourceGraphic" in2="completeField" xChannelSelector="R" yChannelSelector="G" scale="0" result="flex"/>
      <feColorMatrix in="completeField" type="matrix" values="0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1 0" result="light"/>
      <feComposite in="flex" in2="light" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
    </filter></defs>`;
    this.image = this.svg.querySelector("feImage")!;
    this.displacement = this.svg.querySelector("feDisplacementMap")!;
    document.body.append(this.svg);
  }
  update(time: number, width: number, height: number, pressure: number, catchProgress: number) {
    const frame = Math.floor(time * 45);
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    const points = anchorPoints(attachments[this.index % 4]),
      holds = [1, 0.84, 0.64, 0.93].map((x, i) => Math.min(1, Math.max(0, (catchProgress - i * 0.12) * 4)) * x);
    const span = 0.82 * Math.max(0.015, pressure),
      phase = this.index * 1.71;
    for (let y = 0; y < 33; y++)
      for (let x = 0; x < 49; x++) {
        const u = x / 48,
          v = y / 32,
          m = membrane(u, v, time, phase, pressure, holds, points);
        const perspective = 1150 / (1150 - m.z * width);
        const dx = (u - 0.5 + m.x) * width * perspective - (u - 0.5) * width;
        const dy = (v - 0.5 + m.y) * height * perspective - (v - 0.5) * height;
        const next = membrane(Math.min(1, u + 0.01), v, time, phase, pressure, holds, points);
        const slope = (next.z - m.z) / 0.01;
        const light = 1 - Math.min(0.32, Math.abs(slope) * 0.095 + pressure * 0.018);
        const offset = (y * 49 + x) * 4;
        this.pixels.data[offset] = Math.round(Math.max(0, Math.min(255, 128 - (dx / (width * span)) * 255)));
        this.pixels.data[offset + 1] = Math.round(Math.max(0, Math.min(255, 128 - (dy / (height * span)) * 255)));
        this.pixels.data[offset + 2] = Math.round(light * 255);
        this.pixels.data[offset + 3] = 255;
      }
    this.ctx.putImageData(this.pixels, 0, 0);
    this.image.setAttribute("href", this.canvas.toDataURL());
    this.displacement.setAttribute("scale", String(span));
  }
  dispose() {
    this.svg.remove();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
