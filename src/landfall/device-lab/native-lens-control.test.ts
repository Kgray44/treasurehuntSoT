import { describe, expect, it } from "vitest";
import { nativeLensControl, type NativeLensControl } from "./native-lens-control";

const labels: Record<NativeLensControl, string> = {
  OPEN: "Open camera-free Lens",
  START: "Open camera-free Device Lab",
  INSPECT: "Inspect selected object",
  RETURN: "Return to Guided View",
  CLOSE: "Close Chronicle Lens",
  SCENE: "Camera-free 3D scene",
  ERROR: "Camera-free simulation cannot record a real native observation. Your Voyage progress has not changed.",
  VOYAGE: "Synthetic Device Lab Voyage",
  WEBVIEW: "",
};
function node(attributes: Record<string, string> = {}) {
  return `<node ${Object.entries({
    package: "com.voyagewright.landfall",
    class: "android.widget.Button",
    clickable: "true",
    enabled: "true",
    bounds: "[100,200][301,401]",
    text: labels.OPEN,
    ...attributes,
  })
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ")}/>`;
}
function hierarchy(...children: string[]) {
  return `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${children.join("")}</hierarchy>`;
}

describe("owned Android Lens UI observations (synthetic parser tests only)", () => {
  it("locates each exact control and returns its observed bounds and integer center", () => {
    for (const control of Object.keys(labels) as NativeLensControl[]) {
      const attributes: Record<string, string> =
        control === "WEBVIEW"
          ? { class: "android.webkit.WebView", text: "" }
          : control === "SCENE"
            ? { class: "android.view.TextureView", text: "", "content-desc": labels.SCENE }
            : { text: labels[control] };
      expect(nativeLensControl(hierarchy(node(attributes)), control)).toEqual({
        x: 200,
        y: 300,
        bounds: { left: 100, top: 200, right: 301, bottom: 401 },
      });
    }
  });
  it("decodes named/numeric attribute entities once without creating attributes or nodes", () => {
    expect(nativeLensControl(hierarchy(node({ text: "Open camera&#45;free L&#x65;ns" })), "OPEN").x).toBe(200);
    expect(nativeLensControl(hierarchy(node({ text: "", "content-desc": "Open camera-free Lens" })), "OPEN").x).toBe(
      200,
    );
    for (const text of [
      "Open camera-free Lens&quot; package=&quot;com.voyagewright.landfall",
      "Open camera&amp;#45;free Lens",
      "Open camera-free Lens &lt;node package=&quot;com.voyagewright.landfall&quot;/&gt;",
      "prefix Open camera-free Lens",
      "Open camera-free Lens suffix",
    ])
      expect(() => nativeLensControl(hierarchy(node({ text })), "OPEN")).toThrow(
        "NATIVE_LENS_CONTROL_UNOBSERVED_OR_AMBIGUOUS",
      );
  });
  it("requires owned package, enabled/visible target and actual button semantics before touches", () => {
    const rejected: Record<string, string>[] = [
      { package: "foreign.app" },
      { package: "com.voyagewright.landfall.extra" },
      { enabled: "false" },
      { "visible-to-user": "false" },
      { class: "android.widget.TextView" },
      { clickable: "false" },
      { text: "Open camera-free Lens " },
    ];
    for (const attributes of rejected)
      expect(() => nativeLensControl(hierarchy(node(attributes)), "OPEN")).toThrow(
        "NATIVE_LENS_CONTROL_UNOBSERVED_OR_AMBIGUOUS",
      );
    // Authored text is not a substitute for the real button's role.
    expect(nativeLensControl(hierarchy(node(), node({ class: "android.widget.TextView" })), "OPEN").x).toBe(200);
  });
  it("fails closed on missing or ambiguous owned targets, including nested duplicates", () => {
    expect(() => nativeLensControl(hierarchy(), "OPEN")).toThrow("NATIVE_LENS_CONTROL_UNOBSERVED_OR_AMBIGUOUS");
    expect(() => nativeLensControl(hierarchy(node(), node()), "OPEN")).toThrow(
      "NATIVE_LENS_CONTROL_UNOBSERVED_OR_AMBIGUOUS",
    );
    const nested = node().replace("/>", `>${node()}</node>`);
    expect(() => nativeLensControl(hierarchy(nested), "OPEN")).toThrow("NATIVE_LENS_CONTROL_UNOBSERVED_OR_AMBIGUOUS");
    expect(nativeLensControl(hierarchy(node({ package: "foreign.app" }), node()), "OPEN").x).toBe(200);
  });
  it("requires strictly positive bounded integer geometry", () => {
    for (const bounds of [
      "",
      "[0,0][0,1]",
      "[3,4][2,6]",
      "[-1,0][2,3]",
      "[0,0][4097,3]",
      "[0,0][2,4097]",
      "[1.5,0][2,3]",
      "[0,0][999999999999999999999,3]",
      " [0,0][2,3]",
    ])
      expect(() => nativeLensControl(hierarchy(node({ bounds })), "OPEN")).toThrow("NATIVE_LENS_BOUNDS_INVALID");
    expect(nativeLensControl(hierarchy(node({ bounds: "[0,0][4096,4096]" })), "OPEN").bounds.right).toBe(4096);
  });
  it("requires the exact scene description and actual WebView class", () => {
    expect(() => nativeLensControl(hierarchy(node({ text: labels.SCENE, "content-desc": "" })), "SCENE")).toThrow();
    expect(() => nativeLensControl(hierarchy(node({ text: "android.webkit.WebView" })), "WEBVIEW")).toThrow();
    expect(() =>
      nativeLensControl(
        hierarchy(node({ class: "android.webkit.WebView" }), node({ class: "android.webkit.WebView" })),
        "WEBVIEW",
      ),
    ).toThrow();
    expect(() => nativeLensControl(hierarchy(node({ text: labels.ERROR + " Extra" })), "ERROR")).toThrow();
  });
  it("rejects malformed XML, external/unknown entities and duplicate attributes", () => {
    for (const xml of [
      hierarchy(node()).replace("</hierarchy>", ""),
      hierarchy(node()).replace("</hierarchy>", "</node>"),
      hierarchy(node()).replace('enabled="true"', 'enabled="false" enabled="true"'),
      hierarchy(node({ text: "&external;" })),
      hierarchy(node({ text: "&#xD800;" })),
      hierarchy(node({ text: "&#0;" })),
      `<!DOCTYPE hierarchy [<!ENTITY external SYSTEM "file:///private">]>${hierarchy(node())}`,
      hierarchy(`<!--${node()}-->`),
      hierarchy(node({ text: "bad < literal" })),
      `junk${hierarchy(node())}`,
    ])
      expect(() => nativeLensControl(xml, "OPEN")).toThrow("NATIVE_LENS_XML_INVALID");
  });
  it("caps UTF-8 hierarchy bytes and validates the control at runtime", () => {
    expect(() => nativeLensControl("x".repeat(262145), "OPEN")).toThrow("NATIVE_LENS_HIERARCHY_TOO_LARGE");
    expect(() => nativeLensControl("é".repeat(131073), "OPEN")).toThrow("NATIVE_LENS_HIERARCHY_TOO_LARGE");
    for (const control of ["UNKNOWN", "__proto__", "toString", undefined])
      expect(() => nativeLensControl(hierarchy(node()), control as NativeLensControl)).toThrow(
        "NATIVE_LENS_CONTROL_INVALID",
      );
    let coerced = false;
    const objectControl = {
      toString: () => {
        coerced = true;
        return "OPEN";
      },
    };
    expect(() => nativeLensControl(hierarchy(node()), objectControl as unknown as NativeLensControl)).toThrow(
      "NATIVE_LENS_CONTROL_INVALID",
    );
    expect(coerced).toBe(false);
  });
});
