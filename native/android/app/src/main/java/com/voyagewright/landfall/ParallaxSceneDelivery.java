package com.voyagewright.landfall;

import java.util.*;
import org.json.*;

/** Supported v2 presentation subset. Unknown provider requirements fail into canonical Guided View. */
final class ParallaxSceneDelivery {
  private static Set<String> set(String... values) { return new HashSet<>(Arrays.asList(values)); }
  static final Set<String> CAPABILITIES = set("WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB");
  private static boolean id(Object value) {
    return value instanceof String && ((String) value).matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
  }
  private static boolean keys(JSONObject object, Set<String> required, Set<String> optional) {
    Set<String> actual = new HashSet<>();
    Iterator<String> keys = object.keys(); while (keys.hasNext()) actual.add(keys.next());
    return actual.containsAll(required) && actual.stream().allMatch(k -> required.contains(k) || optional.contains(k));
  }
  static String retainedSelection(String selected, JSONArray entities) {
    if (selected == null) return null;
    for (int i = 0; i < entities.length(); i++) {
      JSONObject entity = entities.optJSONObject(i);
      if (entity != null && selected.equals(entity.optString("id"))
          && entity.optBoolean("visible", true) && entity.optBoolean("selectable", true)) return selected;
    }
    return null;
  }
  static boolean surfaceQuadCorrection(JSONObject scene, JSONObject entity) {
    if (scene.optInt("schemaVersion") != 2 || entity.has("model")) return false;
    JSONArray anchors = scene.optJSONArray("anchors");
    if (anchors == null) return false;
    for (int i = 0; i < anchors.length(); i++) {
      JSONObject anchor = anchors.optJSONObject(i);
      if (anchor != null && anchor.optString("id").equals(entity.optString("anchorId")))
        return anchor.optString("kind").equals("SURFACE_RELATIVE");
    }
    return false;
  }
  static boolean valid(JSONObject scene, String expectedChecksum, String expectedInstance) {
    try {
      if (!keys(scene, set("schemaVersion", "transformKind", "coordinateFrame", "identity", "units",
          "entities", "anchors", "requirements", "presentation", "fallback"), set())
          || !(scene.opt("schemaVersion") instanceof Number)
          || scene.getDouble("schemaVersion") != 2
          || !scene.optString("transformKind").equals("RESOLVED_LOCAL_V1")
          || !scene.optString("coordinateFrame").equals("LOCAL_Y_UP_NEGATIVE_Z")
          || !scene.getString("units").equals("METERS")) return false;
      JSONObject identity = scene.getJSONObject("identity");
      if (!keys(identity, set("definitionId", "versionId", "versionChecksum", "instanceId"), set("environment"))
          || !id(identity.opt("definitionId")) || !id(identity.opt("versionId"))
          || !(identity.opt("versionChecksum") instanceof String) || !(identity.opt("instanceId") instanceof String)
          || !identity.optString("versionChecksum").matches("[a-f0-9]{64}")
          || !identity.optString("instanceId").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,299}")
          || (expectedChecksum != null && !identity.getString("versionChecksum").equals(expectedChecksum))
          || (expectedInstance != null && !identity.getString("instanceId").equals(expectedInstance))) return false;
      if (identity.has("environment")) {
        JSONObject environment = identity.getJSONObject("environment");
        Object revision = environment.opt("revision");
        if (!keys(environment, set("environmentId", "versionId", "revision", "checksum"), set())
            || !id(environment.opt("environmentId"))
            || !(environment.opt("versionId") instanceof String)
            || !environment.getString("versionId").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,159}")
            || !(revision instanceof Number) || !Double.isFinite(((Number) revision).doubleValue())
            || ((Number) revision).doubleValue() != ((Number) revision).longValue() || ((Number) revision).longValue() < 1
            || ((Number) revision).doubleValue() > 9007199254740991d
            || !(environment.opt("checksum") instanceof String) || !environment.getString("checksum").matches("[a-f0-9]{64}")) return false;
      }
      JSONArray requirements = scene.getJSONArray("requirements");
      Set<String> seen = new HashSet<>();
      if (requirements.length() > 32) return false;
      for (int i = 0; i < requirements.length(); i++)
        if (!(requirements.get(i) instanceof String) || !CAPABILITIES.contains(requirements.getString(i))
            || !seen.add(requirements.getString(i))) return false;
      JSONObject presentation = scene.getJSONObject("presentation"), fallback = scene.getJSONObject("fallback");
      if (!keys(presentation, set("elapsedMs", "reducedMotion"), set("studio", "adaptive"))
          || !(presentation.opt("elapsedMs") instanceof Number)
          || !Double.isFinite(presentation.getDouble("elapsedMs")) || presentation.getDouble("elapsedMs") < 0
          || presentation.getDouble("elapsedMs") > 9007199254740991d
          || !(presentation.opt("reducedMotion") instanceof Boolean)
          || !keys(fallback, set("mode", "narrative", "preservesMeaning"), set())
          || !fallback.optString("mode").equals("GUIDED") || !Boolean.TRUE.equals(fallback.opt("preservesMeaning"))
          || !(fallback.opt("narrative") instanceof String) || fallback.getString("narrative").isEmpty()
          || fallback.getString("narrative").length() > 4000) return false;
      JSONArray anchors = scene.getJSONArray("anchors"), entities = scene.getJSONArray("entities");
      if (anchors.length() < 1 || anchors.length() > 16 || entities.length() > 32) return false;
      Set<String> anchorIds = new HashSet<>(); Map<String, JSONObject> entityIds = new HashMap<>();
      for (int i = 0; i < anchors.length(); i++) {
        JSONObject anchor = anchors.getJSONObject(i);
        if (!id(anchor.opt("id")) || !id(anchor.opt("frameId")) || !anchorIds.add(anchor.getString("id"))) return false;
        String kind = anchor.optString("kind");
        if (!set("LOCAL_WORLD", "SURFACE_RELATIVE", "FIXED_WORLDSPACE").contains(kind)) return false;
        Set<String> extra = kind.equals("SURFACE_RELATIVE") ? set("alignment")
            : kind.equals("FIXED_WORLDSPACE") ? set("worldspaceId") : set();
        Set<String> required = new HashSet<>(set("id", "kind", "frameId", "transform")); required.addAll(extra);
        if (!keys(anchor, required, set()) || !authoredTransform(anchor.getJSONObject("transform"))) return false;
        if (kind.equals("SURFACE_RELATIVE") && !set("HORIZONTAL", "VERTICAL").contains(anchor.optString("alignment"))) return false;
        if (kind.equals("FIXED_WORLDSPACE") && !id(anchor.opt("worldspaceId"))) return false;
      }
      for (int i = 0; i < entities.length(); i++) {
        JSONObject entity = entities.getJSONObject(i);
        if (!keys(entity, set("id", "kind", "content", "widthMeters", "transform", "anchorId", "authoredTransform",
            "interactions", "visible", "selectable", "opacity"), set("parentEntityId", "element", "model"))) return false;
        JSONObject legacy = new JSONObject();
        for (String key : new String[] {"id", "kind", "content", "widthMeters", "transform"}) legacy.put(key, entity.get(key));
        if (!ParallaxSceneTransfer.validEntities(new JSONArray().put(legacy))
            || !anchorIds.contains(entity.optString("anchorId")) || entityIds.put(entity.getString("id"), entity) != null
            || !authoredTransform(entity.getJSONObject("authoredTransform"))
            || !(entity.opt("visible") instanceof Boolean) || !(entity.opt("selectable") instanceof Boolean)
            || !(entity.opt("opacity") instanceof Number) || entity.getDouble("opacity") != 1) return false;
        JSONArray actions = entity.getJSONArray("interactions"); Set<String> actionSet = new HashSet<>();
        if (actions.length() < 1 || actions.length() > 3) return false;
        for (int a = 0; a < actions.length(); a++)
          if (!(actions.get(a) instanceof String) || !set("PICK", "INSPECT", "PLACE").contains(actions.getString(a))
              || !actionSet.add(actions.getString(a))) return false;
        JSONObject model = entity.optJSONObject("model"), element = entity.optJSONObject("element");
        if (entity.has("model")) {
          if (!ParallaxModelCache.validReference(model) || !seen.contains("MODEL_GLB") || element == null
              || !element.optString("kind").equals("PHYSICAL_ASSET")
              || !element.optString("modelId").equals(model.optString("assetId"))
              || !element.optString("packageVersion").equals(model.optString("version"))
              || !model.getString("url").endsWith("&versionChecksum=" + identity.getString("versionChecksum"))) return false;
        }
        if (element != null && element.optBoolean("enabled")) {
          if (!element.optString("kind").equals("PHYSICAL_ASSET") || model == null
              || element.optDouble("articulation", -1) != 0 || element.has("playback")) return false;
        }
      }
      for (JSONObject entity : entityIds.values()) {
        Set<String> visited = new HashSet<>(set(entity.getString("id"))); JSONObject child = entity;
        while (child.has("parentEntityId")) {
          if (!id(child.opt("parentEntityId"))) return false;
          String parent = child.getString("parentEntityId"); child = entityIds.get(parent);
          if (child == null || !visited.add(parent) || !child.getString("anchorId").equals(entity.getString("anchorId"))) return false;
        }
      }
      return true;
    } catch (Exception invalid) { return false; }
  }
  private static boolean authoredTransform(JSONObject transform) {
    try {
      double scale = transform.getDouble("scale");
      JSONObject entity = new JSONObject().put("id", "authored-check").put("kind", "MARKER")
          .put("content", "check").put("widthMeters", 0.1).put("transform", transform);
      if (scale < 0.01 || scale > 10 || !ParallaxSceneTransfer.validEntities(new JSONArray().put(entity))) return false;
      for (String axis : new String[] {"x", "y", "z"})
        if (Math.abs(transform.getJSONObject("position").getDouble(axis)) > 10000) return false;
      return true;
    } catch (JSONException invalid) { return false; }
  }
}
