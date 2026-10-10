package com.voyagewright.landfall;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.charset.CodingErrorAction;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashSet;
import org.json.*;

/** Version 1 bounded local scene transaction. No camera/geometry acquisition or durable storage. */
final class ParallaxSceneTransfer {
  static final int SCENE_BYTES = 393216, CHUNK_BYTES = 8192, MAX_CHUNKS = 48, TIMEOUT_MS = 15000;
  final String sessionId;
  final int epoch;
  private int generation, currentGeneration, count, total, next;
  private long deadline;
  private String transaction, digest;
  private ByteArrayOutputStream buffer;
  ParallaxSceneTransfer(String sessionId, int epoch) { this.sessionId = sessionId; this.epoch = epoch; }
  private static boolean integer(JSONObject p, String key) { Object value=p.opt(key); return value instanceof Number && Double.isFinite(((Number)value).doubleValue()) && ((Number)value).doubleValue() == ((Number)value).intValue(); }
  private static boolean number(JSONObject p, String key) { return p.opt(key) instanceof Number; }
  boolean matches(JSONObject p) { return p.opt("sessionId") instanceof String && sessionId.equals(p.optString("sessionId")) && integer(p,"epoch") && epoch == p.optInt("epoch", -1); }
  void clear() { buffer = null; transaction = null; }
  void expire(long now) { if (buffer != null && now >= deadline) clear(); }
  private boolean current(JSONObject p, long now) {
    expire(now);
    return matches(p) && buffer != null && p.opt("transactionId") instanceof String && transaction.equals(p.optString("transactionId")) && integer(p,"generation") && currentGeneration == p.optInt("generation", -1);
  }
  boolean begin(JSONObject p, long now) {
    expire(now);
    int g = p.optInt("generation", -1), n = p.optInt("totalBytes", -1), c = p.optInt("chunkCount", -1);
    String t = p.optString("transactionId"), d = p.optString("digest");
    if (p.length()!=8 || !integer(p,"generation") || !integer(p,"totalBytes") || !integer(p,"chunkCount") || !integer(p,"sceneTransferVersion") || !(p.opt("transactionId") instanceof String) || !(p.opt("digest") instanceof String) || !matches(p) || buffer != null || p.optInt("sceneTransferVersion") != 1 || g <= generation || g <= 0 || n < 1 || n > SCENE_BYTES || c != (n + CHUNK_BYTES - 1) / CHUNK_BYTES || c > MAX_CHUNKS || !t.matches("[A-Za-z0-9-]{1,64}") || !d.matches("[a-f0-9]{64}")) return false;
    generation = currentGeneration = g; count = c; total = n; next = 0; deadline = now + TIMEOUT_MS;
    transaction = t; digest = d; buffer = new ByteArrayOutputStream(n); return true;
  }
  boolean chunk(JSONObject p, long now) {
    if (!current(p, now)) return false;
    try {
      String data = p.getString("data");
      if (p.length()!=6 || !integer(p,"index") || !(p.opt("data") instanceof String) || p.getInt("index") != next || next >= count || data.length() > 10924 || !data.matches("[A-Za-z0-9+/]*={0,2}")) { clear(); return false; }
      byte[] bytes = Base64.getDecoder().decode(data);
      if (!Base64.getEncoder().encodeToString(bytes).equals(data) || bytes.length != Math.min(CHUNK_BYTES, total - next * CHUNK_BYTES)) { clear(); return false; }
      buffer.write(bytes, 0, bytes.length); next++; return true;
    } catch (Exception e) { clear(); return false; }
  }
  boolean abort(JSONObject p) { if (matches(p) && transaction != null && transaction.equals(p.optString("transactionId")) && integer(p,"generation") && currentGeneration == p.optInt("generation", -1)) clear(); return matches(p); }
  JSONArray commit(JSONObject p, long now) {
    if (!current(p, now)) return null;
    try {
      if (p.length()!=4 || next != count || buffer.size() != total) return null;
      byte[] bytes = buffer.toByteArray();
      StringBuilder hash = new StringBuilder();
      for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) hash.append(String.format("%02x", b & 255));
      if (!hash.toString().equals(digest)) return null;
      String json = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
      JSONTokener tokener=new JSONTokener(json); JSONObject scene = new JSONObject(tokener);
      if (tokener.nextClean()!=0 || scene.length() != 4 || !integer(scene,"schemaVersion") || scene.optInt("schemaVersion") != 1 || !scene.optString("transformKind").equals("RESOLVED_LOCAL_V1") || !scene.optString("coordinateFrame").equals("LOCAL_Y_UP_NEGATIVE_Z")) return null;
      JSONArray entities = scene.getJSONArray("entities");
      return validEntities(entities) ? entities : null;
    } catch (Exception e) { return null; } finally { clear(); }
  }
  static boolean validEntities(JSONArray input) {
    if (input.length() < 1 || input.length() > 32) return false;
    HashSet<String> ids = new HashSet<>();
    try {
      for (int i = 0; i < input.length(); i++) {
        JSONObject j = input.getJSONObject(i), t = j.getJSONObject("transform"), p = t.getJSONObject("position"), q = t.getJSONObject("rotation");
        String id = j.getString("id"), content = j.getString("content"), kind = j.getString("kind");
        if (!(j.opt("id") instanceof String) || !(j.opt("content") instanceof String) || !(j.opt("kind") instanceof String) || !number(j,"widthMeters") || !number(t,"scale") || j.length() != 5 || t.length() != 3 || p.length() != 3 || q.length() != 4 || !id.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}") || !ids.add(id) || content.length() < 1 || content.length() > 2000 || !(kind.equals("TEXT") || kind.equals("PARCHMENT") || kind.equals("MARKER"))) return false;
        double width = j.getDouble("widthMeters"), scale = t.getDouble("scale"), effective = width * scale, norm = 0;
        if (!Double.isFinite(width) || width < 0.01 || width > 5 || !Double.isFinite(scale) || scale <= 0 || scale > 100000000 || !Double.isFinite(effective) || effective < 0.000001 || effective > 100) return false;
        for (String axis : new String[]{"x", "y", "z"}) { double v = p.getDouble(axis); if (!number(p,axis) || !Double.isFinite(v) || Math.abs(v) > 1000000) return false; }
        for (String axis : new String[]{"x", "y", "z", "w"}) { double v = q.getDouble(axis); if (!number(q,axis) || !Double.isFinite(v)) return false; norm += v * v; }
        if (Math.abs(Math.sqrt(norm) - 1) >= 0.00001) return false;
      }
      return true;
    } catch (Exception e) { return false; }
  }
}
