import { projectionGLSL, type CameraFrame, type Point3, worldViewport } from "./projection";
import { bindFilmLens } from "./exposure";
import type { DecodedPaint } from "./dom-paint";
import type { MaterialBackdrop } from "./material-backdrop";
import { surfaceDepthGLSL, type DepthPass } from "./depth-compositor";

const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec2 uv;
layout(location=1) in vec3 point;
uniform vec3 position,cameraPosition;
uniform vec4 orientation;
uniform float roll;
uniform vec2 viewport;
out vec2 textureUV;
${projectionGLSL}
vec3 rotate(vec3 p,vec4 q){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
void main(){textureUV=uv;gl_Position=filmClip(position+rotate(point,orientation),cameraPosition,roll,viewport);}`;
const fragment = `#version 300 es
precision highp float;
uniform sampler2D paint;
uniform sampler2D backdrop;
uniform bool hasBackdrop;
uniform vec2 framebuffer,paintSize,rasterSize,gutter;
uniform vec4 radii;
in vec2 textureUV;
out vec4 color;
${surfaceDepthGLSL}
void main(){vec4 c=texture(paint,textureUV);color=c;
 if(hasBackdrop){
  vec2 p=textureUV*rasterSize-gutter-paintSize*.5;
  float r=p.y>0.?(p.x<0.?radii.x:radii.y):(p.x<0.?radii.w:radii.z);
  vec2 q=abs(p)-paintSize*.5+r;
  float d=length(max(q,0.))+min(max(q.x,q.y),0.)-r;
  float coverage=1.-smoothstep(-fwidth(d)*.5,fwidth(d)*.5,d);
  vec4 b=texture(backdrop,gl_FragCoord.xy/framebuffer)*coverage;
  color+=b*(1.-c.a);
 }
 surfaceCoverage(color.a);
}`;

/** Reusable geometry/texture adapter. Canonical DOM owns all content and state;
 * this object owns presentation resources only. A content revision uploads once.
 * Animation changes only the vertex buffer and the common camera uniforms.
 * Color is an explicit encoded-sRGB identity pass inside SurfaceQueue's CSS
 * group, preserving native alpha/filter behavior at canonical DOM handoff. */
export class PaintSurface {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private points: WebGLBuffer;
  private coordinates: WebGLBuffer;
  private indices: WebGLBuffer;
  private texture: WebGLTexture;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private count = 0;
  private capacity = 0;
  private paint: DecodedPaint | null = null;
  uploads = 0;
  constructor(private gl: WebGL2RenderingContext) {
    const g = gl;
    this.program = g.createProgram()!;
    for (const [type, source] of [
      [g.VERTEX_SHADER, vertex],
      [g.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = g.createShader(type)!;
      g.shaderSource(shader, source);
      g.compileShader(shader);
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS))
        throw new Error(g.getShaderInfoLog(shader) ?? "Paint shader failed");
      g.attachShader(this.program, shader);
      g.deleteShader(shader);
    }
    g.linkProgram(this.program);
    if (!g.getProgramParameter(this.program, g.LINK_STATUS))
      throw new Error(g.getProgramInfoLog(this.program) ?? "Paint program failed");
    this.vao = g.createVertexArray()!;
    this.points = g.createBuffer()!;
    this.coordinates = g.createBuffer()!;
    this.indices = g.createBuffer()!;
    this.texture = g.createTexture()!;
    g.bindVertexArray(this.vao);
    g.bindBuffer(g.ARRAY_BUFFER, this.coordinates);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.bindBuffer(g.ARRAY_BUFFER, this.points);
    g.enableVertexAttribArray(1);
    g.vertexAttribPointer(1, 3, g.FLOAT, false, 0, 0);
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, this.indices);
    g.bindTexture(g.TEXTURE_2D, this.texture);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  }
  topology(uv: Float32Array, indices: Uint16Array) {
    const g = this.gl;
    g.bindVertexArray(this.vao);
    g.bindBuffer(g.ARRAY_BUFFER, this.coordinates);
    g.bufferData(g.ARRAY_BUFFER, uv, g.STATIC_DRAW);
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, this.indices);
    g.bufferData(g.ELEMENT_ARRAY_BUFFER, indices, g.STATIC_DRAW);
    this.count = indices.length;
  }
  updatePaint(paint: DecodedPaint) {
    if (this.paint === paint) return;
    const g = this.gl;
    g.bindTexture(g.TEXTURE_2D, this.texture);
    // SVG paint has already resolved canonical CSS colors. Keep browser decode
    // explicit. Store premultiplied pixels so bilinear filtering of soft type
    // and transparent gutters cannot blend black RGB into their silhouettes.
    // Uploads may finish between other preparation jobs on this same context.
    const parameters = [g.UNPACK_FLIP_Y_WEBGL, g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, g.UNPACK_COLORSPACE_CONVERSION_WEBGL];
    const previous = parameters.map((parameter) => g.getParameter(parameter));
    try {
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL, g.NONE);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, paint.image);
    } finally {
      parameters.forEach((parameter, index) => g.pixelStorei(parameter, previous[index]));
    }
    this.paint = paint;
    this.uploads++;
  }
  draw(
    points: Float32Array,
    position: Point3,
    orientation: [number, number, number, number],
    camera: CameraFrame,
    width: number,
    height: number,
    backdrop?: MaterialBackdrop,
    pass: DepthPass = 0,
  ) {
    const g = this.gl;
    const glass = this.paint?.backdrop;
    const blurred = glass ? backdrop?.blurred(glass.sigma, width) : null;
    g.useProgram(this.program);
    bindFilmLens(g, this.program);
    g.enable(g.DEPTH_TEST);
    g.depthFunc(g.LEQUAL);
    g.bindVertexArray(this.vao);
    const u = (name: string) => {
      if (!this.uniforms.has(name)) this.uniforms.set(name, g.getUniformLocation(this.program, name));
      return this.uniforms.get(name)!;
    };
    g.bindBuffer(g.ARRAY_BUFFER, this.points);
    if (this.capacity !== points.byteLength) {
      g.bufferData(g.ARRAY_BUFFER, points.byteLength, g.DYNAMIC_DRAW);
      this.capacity = points.byteLength;
    }
    g.bufferSubData(g.ARRAY_BUFFER, 0, points);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.texture);
    g.uniform1i(u("paint"), 0);
    g.uniform1f(u("depthPass"), pass);
    g.uniform1i(u("hasBackdrop"), blurred ? 1 : 0);
    if (blurred && glass && this.paint) {
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, blurred);
      g.uniform1i(u("backdrop"), 1);
      g.uniform2f(u("framebuffer"), g.drawingBufferWidth, g.drawingBufferHeight);
      const paint = this.paint,
        pad = paint.insets;
      g.uniform2f(u("paintSize"), paint.width, paint.height);
      g.uniform2f(u("rasterSize"), paint.width + pad.left + pad.right, paint.height + pad.top + pad.bottom);
      g.uniform2f(u("gutter"), pad.left, pad.bottom);
      g.uniform4fv(u("radii"), glass.radii);
    }
    g.uniform3fv(u("position"), position);
    g.uniform4fv(u("orientation"), orientation);
    g.uniform3fv(u("cameraPosition"), camera.position);
    g.uniform1f(u("roll"), camera.roll);
    g.uniform2fv(u("viewport"), worldViewport({ width, height }));
    g.drawElements(g.TRIANGLES, this.count, g.UNSIGNED_SHORT, 0);
  }
  dispose() {
    const g = this.gl;
    g.deleteBuffer(this.points);
    g.deleteBuffer(this.coordinates);
    g.deleteBuffer(this.indices);
    g.deleteVertexArray(this.vao);
    g.deleteTexture(this.texture);
    g.deleteProgram(this.program);
    this.paint = null;
  }
}
