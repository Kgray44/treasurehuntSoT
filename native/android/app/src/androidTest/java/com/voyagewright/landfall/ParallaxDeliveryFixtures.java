package com.voyagewright.landfall;

import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Base64;
import org.json.*;

/** Shared v2 wire and original catalog bytes, runnable on JVM or instrumentation. D0 only. */
public final class ParallaxDeliveryFixtures {
  private static int assertions;
  private static void check(boolean value, String label) {
    assertions++; if (!value) throw new AssertionError(label);
  }
  private static boolean transfer(JSONObject scene, String checksum, String instance) throws Exception {
    ParallaxSceneTransfer transfer = new ParallaxSceneTransfer("v2-fixture", 1, 2, checksum, instance);
    JSONObject commit = stage(transfer, scene);
    if (commit == null) return false;
    check(transfer.stagedMatches(commit), "committed model activation retains transaction identity");
    transfer.abort(new JSONObject(commit.toString()).put("generation", 2));
    check(transfer.stagedMatches(commit), "stale ABORT cannot cancel newer activation");
    transfer.abort(commit);
    check(!transfer.stagedMatches(commit), "matching ABORT cancels model activation");
    return true;
  }
  static JSONObject stage(ParallaxSceneTransfer transfer, JSONObject scene) throws Exception {
    byte[] bytes = scene.toString().getBytes(StandardCharsets.UTF_8);
    JSONObject identity = new JSONObject().put("sessionId", "v2-fixture").put("epoch", 1)
        .put("transactionId", "delivery").put("generation", 1);
    check(transfer.begin(new JSONObject(identity.toString()).put("sceneTransferVersion", 2)
        .put("totalBytes", bytes.length).put("chunkCount", (bytes.length + 8191) / 8192)
        .put("digest", ParallaxModelCache.digest(bytes)), 0), "v2 begin");
    for (int offset = 0, index = 0; offset < bytes.length; offset += 8192, index++)
      check(transfer.chunk(new JSONObject(identity.toString()).put("index", index).put("data",
          Base64.getEncoder().encodeToString(java.util.Arrays.copyOfRange(bytes, offset, Math.min(bytes.length, offset + 8192)))), 0), "v2 ordered chunk");
    return transfer.commitScene(identity, 0) != null ? identity : null;
  }
  public static int run(JSONObject fixtures) throws Exception {
    assertions = 0;
    JSONArray cases = fixtures.getJSONArray("sceneCases");
    JSONObject golden = cases.getJSONObject(0).getJSONObject("scene"), identity = golden.getJSONObject("identity");
    String checksum = identity.getString("versionChecksum"), instance = identity.getString("instanceId");
    check(ParallaxModelCache.allowedSoftwareFixture(true, "http://127.0.0.1:3137", true), "explicit DEBUG loopback fixture allowed");
    check(!ParallaxModelCache.allowedSoftwareFixture(false, "http://127.0.0.1:3137", true), "release cannot enable software HTTP fixture");
    check(!ParallaxModelCache.allowedSoftwareFixture(true, "http://127.0.0.1:3137", false), "launch flag is mandatory");
    for (String origin : new String[] {"https://127.0.0.1:3137", "http://localhost:3137", "http://10.0.2.2:3137", "http://127.0.0.1", "http://127.0.0.1:0", "http://127.0.0.1:65536", "http://127.0.0.1:3137/", "http://user@127.0.0.1:3137", "http://127.0.0.1:3137?flag=1", "http://example.com:3137"})
      check(!ParallaxModelCache.allowedSoftwareFixture(true, origin, true), "non-lab software origin rejected");
    for (Object invalidVersion : new Object[] {2.5, "2", true})
      check(!ParallaxSceneDelivery.valid(new JSONObject(golden.toString()).put("schemaVersion", invalidVersion), checksum, instance), "non-literal schema version rejected");
    check(!ParallaxSceneDelivery.valid(new JSONObject(golden.toString()).put("transformKind", "AUTHORED"), checksum, instance), "unresolved transform kind rejected");
    check(!ParallaxSceneDelivery.valid(new JSONObject(golden.toString()).put("coordinateFrame", "LOCAL_Z_UP"), checksum, instance), "incompatible coordinate frame rejected");
    String selected = golden.getJSONArray("entities").getJSONObject(0).getString("id");
    check(selected.equals(ParallaxSceneDelivery.retainedSelection(selected, golden.getJSONArray("entities"))), "same-scene redraw preserves chosen entity");
    check(ParallaxSceneDelivery.retainedSelection(selected, new JSONArray()) == null, "removed entity cannot retain selection");
    for (String flag : new String[] {"visible", "selectable"}) {
      JSONArray disabled = new JSONArray(golden.getJSONArray("entities").toString()); disabled.getJSONObject(0).put(flag, false);
      check(ParallaxSceneDelivery.retainedSelection(selected, disabled) == null, "hidden or disabled entity cannot retain selection");
    }
    for (int i = 0; i < cases.length(); i++) {
      JSONObject c = cases.getJSONObject(i), scene = c.getJSONObject("scene");
      check(ParallaxSceneDelivery.valid(scene, checksum, instance) == c.getBoolean("accepted"), c.getString("name"));
      check(transfer(scene, checksum, instance) == c.getBoolean("accepted"), "transaction " + c.getString("name"));
    }
    check(!ParallaxSceneDelivery.valid(golden, String.join("", java.util.Collections.nCopies(64, "b")), instance), "start revision binding");
    check(!ParallaxSceneDelivery.valid(golden, checksum, "different-instance"), "start instance binding");
    JSONObject empty = new JSONObject(golden.toString()).put("entities", new JSONArray());
    check(ParallaxSceneDelivery.valid(empty, checksum, instance), "empty atomic clear");
    JSONObject unsupported = new JSONObject(golden.toString()).put("requirements", new JSONArray().put("DEPTH_OCCLUSION"));
    check(!ParallaxSceneDelivery.valid(unsupported, checksum, instance), "unsupported capability rejected");
    JSONObject opacity = new JSONObject(golden.toString()); opacity.getJSONArray("entities").getJSONObject(0).put("opacity", 0.5);
    check(!ParallaxSceneDelivery.valid(opacity, checksum, instance), "unsupported fractional opacity rejected");
    JSONObject surface = new JSONObject(golden.toString());
    JSONObject surfaceEntity = surface.getJSONArray("entities").getJSONObject(0);
    surface.getJSONArray("anchors").getJSONObject(0).put("kind", "SURFACE_RELATIVE").put("alignment", "HORIZONTAL");
    check(!ParallaxSceneDelivery.surfaceQuadCorrection(surface, surfaceEntity), "physical model keeps +Y plane normal");
    surfaceEntity.remove("model"); surfaceEntity.remove("element");
    check(ParallaxSceneDelivery.surfaceQuadCorrection(surface, surfaceEntity), "surface quad applies child-facing correction");
    surface.getJSONArray("anchors").getJSONObject(0).put("kind", "LOCAL_WORLD").remove("alignment");
    check(!ParallaxSceneDelivery.surfaceQuadCorrection(surface, surfaceEntity), "local-world quad keeps authored orientation");
    JSONObject pinned = new JSONObject(golden.toString());
    JSONObject environment = new JSONObject().put("environmentId", "synthetic-room").put("versionId", "synthetic-room-v1")
        .put("revision", 1).put("checksum", checksum);
    pinned.getJSONObject("identity").put("environment", environment);
    check(ParallaxSceneDelivery.valid(pinned, checksum, instance), "exact environment pin retained");
    environment.put("revision", 1.5);
    check(!ParallaxSceneDelivery.valid(pinned, checksum, instance), "fractional environment revision rejected");
    environment.put("revision", 1).put("versionId", "bad/path");
    check(!ParallaxSceneDelivery.valid(pinned, checksum, instance), "malformed environment version rejected");
    JSONObject externallyReferenced = new JSONObject().put("asset", new JSONObject().put("version", "2.0"))
        .put("buffers", new JSONArray().put(new JSONObject().put("uri", "https://invalid.example/model.bin")));
    byte[] json = externallyReferenced.toString().getBytes(StandardCharsets.UTF_8);
    ByteBuffer glb = ByteBuffer.allocate(20 + json.length).order(ByteOrder.LITTLE_ENDIAN);
    glb.putInt(0x46546c67).putInt(2).putInt(glb.capacity()).putInt(json.length).putInt(0x4e4f534a).put(json);
    check(!ParallaxModelCache.selfContainedGlb(glb.array()), "external GLB resources rejected");
    return assertions;
  }
  public static void main(String[] args) throws Exception {
    run(new JSONObject(new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8)));
    for (int i = 1; i < args.length; i++) {
      byte[] bytes = Files.readAllBytes(Paths.get(args[i]));
      check(ParallaxModelCache.selfContainedGlb(bytes), "original self-contained GLB");
      System.out.println(Paths.get(args[i]).getFileName() + " " + ParallaxModelCache.digest(bytes));
    }
    System.out.println("Parallax v2 JVM delivery: " + assertions + " assertions passed (D0 contract/asset bytes only)");
  }
}
