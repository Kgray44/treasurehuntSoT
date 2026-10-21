package com.voyagewright.landfall;

import android.content.Context;
import android.webkit.CookieManager;
import java.io.*;
import java.net.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** Bounded app-private model cache. The small bridge carries references, never asset binaries. */
final class ParallaxModelCache {
  static final long MODEL_BYTES = 32L * 1024 * 1024, CACHE_BYTES = 96L * 1024 * 1024;
  private final File directory;
  private final URI origin;

  ParallaxModelCache(Context context, String configuredOrigin) {
    directory = new File(context.getCacheDir(), "parallax-models-v1");
    origin = URI.create(configuredOrigin.isEmpty() ? "https://unconfigured.invalid" : configuredOrigin);
  }

  static boolean validReference(JSONObject model) {
    if (model == null) return false;
    Object length = model.opt("byteLength");
    String asset = model.optString("assetId");
    boolean chest = asset.equals("treasure-chest"), compass = asset.equals("brass-compass");
    return model.length() == 8 && (chest || compass) && model.optString("format").equals("GLB")
        && model.optString("sha256").matches("[a-f0-9]{64}")
        && model.optString("assetId").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
        && model.opt("version") instanceof String && model.optString("version").equals("1.0.0")
        && length instanceof Number && ((Number) length).doubleValue() == ((Number) length).longValue()
        && ((Number) length).longValue() >= 20 && ((Number) length).longValue() <= MODEL_BYTES
        && ((Number) length).longValue() == (chest ? 630120 : 313396)
        && model.optString("sha256").equals(chest
            ? "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f"
            : "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb")
        && model.opt("metersPerUnit") instanceof Number && model.optDouble("metersPerUnit") == 1
        && model.opt("sourceWidthMeters") instanceof Number && model.optDouble("sourceWidthMeters") == (chest ? 0.8 : 0.16)
        && model.optString("url").matches("/api/player/playthroughs/[^/?#]+/parallax/assets/" + asset
            + "\\?block=[^&#]+&versionChecksum=[a-f0-9]{64}");
  }

  static String digest(byte[] bytes) throws Exception {
    StringBuilder result = new StringBuilder();
    for (byte value : MessageDigest.getInstance("SHA-256").digest(bytes))
      result.append(String.format(Locale.ROOT, "%02x", value & 255));
    return result.toString();
  }

  /** Reject external dependencies before gltfio can resolve an unverified image/buffer URI. */
  static boolean selfContainedGlb(byte[] bytes) {
    try {
      if (bytes.length < 20) return false;
      ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
      if (buffer.getInt() != 0x46546c67 || buffer.getInt() != 2 || buffer.getInt() != bytes.length)
        return false;
      int jsonLength = buffer.getInt(), type = buffer.getInt();
      if (type != 0x4e4f534a || jsonLength < 2 || jsonLength > buffer.remaining()) return false;
      byte[] json = new byte[jsonLength]; buffer.get(json);
      JSONObject gltf = new JSONObject(new String(json, StandardCharsets.UTF_8));
      for (String key : new String[] {"buffers", "images"}) {
        JSONArray resources = gltf.optJSONArray(key);
        if (resources == null) continue;
        for (int i = 0; i < resources.length(); i++)
          if (resources.getJSONObject(i).has("uri")) return false;
      }
      return gltf.optJSONObject("asset") != null
          && gltf.getJSONObject("asset").optString("version").equals("2.0");
    } catch (Exception invalid) { return false; }
  }

  private static byte[] verified(File file, JSONObject model) throws Exception {
    if (!file.isFile() || file.length() != model.getLong("byteLength")) return null;
    byte[] bytes = Files.readAllBytes(file.toPath());
    return digest(bytes).equals(model.getString("sha256")) && selfContainedGlb(bytes) ? bytes : null;
  }

  synchronized byte[] load(JSONObject model) throws Exception {
    if (!validReference(model) || !origin.getScheme().equals("https")
        || origin.getHost() == null || origin.getUserInfo() != null)
      throw new IOException("PARALLAX_ASSET_REFERENCE_REJECTED");
    if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("PARALLAX_CACHE_UNAVAILABLE");
    File cached = new File(directory, model.getString("sha256") + ".glb");
    byte[] bytes = verified(cached, model);
    if (bytes == null && cached.exists() && !cached.delete()) throw new IOException("PARALLAX_CACHE_CORRUPT");
    URI resource = origin.resolve(model.getString("url"));
    // Resolve only the configured application's path. Redirects and caller supplied hosts are forbidden.
    if (!Objects.equals(resource.getHost(), origin.getHost()) || resource.getPort() != origin.getPort()
        || !resource.getScheme().equals("https")) throw new IOException("PARALLAX_ASSET_ORIGIN_REJECTED");
    HttpURLConnection connection = (HttpURLConnection) resource.toURL().openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
    connection.setRequestProperty("Accept", "model/gltf-binary");
    connection.setRequestProperty("Cache-Control", "no-store");
    String cookies = CookieManager.getInstance().getCookie(resource.toString());
    if (cookies != null) connection.setRequestProperty("Cookie", cookies);
    File partial = new File(directory, model.getString("sha256") + ".partial");
    try {
      if (connection.getResponseCode() != 200) throw new IOException("PARALLAX_ASSET_FETCH_REJECTED");
      // Authorization is refreshed for each new scene activation even when content bytes are cached.
      if (bytes != null) { cached.setLastModified(System.currentTimeMillis()); return bytes; }
      long expected = model.getLong("byteLength"), reported = connection.getContentLengthLong();
      if (reported >= 0 && reported != expected) throw new IOException("PARALLAX_ASSET_LENGTH_MISMATCH");
      ByteArrayOutputStream output = new ByteArrayOutputStream((int) expected);
      try (InputStream stream = connection.getInputStream()) {
        byte[] block = new byte[16384]; int count;
        while ((count = stream.read(block)) != -1) {
          if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
          if ((long) output.size() + count > expected) throw new IOException("PARALLAX_ASSET_TOO_LARGE");
          output.write(block, 0, count);
        }
      }
      bytes = output.toByteArray();
      if (bytes.length != expected || !digest(bytes).equals(model.getString("sha256")) || !selfContainedGlb(bytes))
        throw new IOException("PARALLAX_ASSET_INTEGRITY_FAILED");
      prune(expected, cached);
      Files.write(partial.toPath(), bytes);
      if (!partial.renameTo(cached)) throw new IOException("PARALLAX_CACHE_COMMIT_FAILED");
      return bytes;
    } finally {
      connection.disconnect();
      if (partial.exists()) partial.delete();
    }
  }

  private void prune(long incoming, File keep) throws IOException {
    File[] files = directory.listFiles();
    if (files == null) throw new IOException("PARALLAX_CACHE_UNAVAILABLE");
    Arrays.sort(files, Comparator.comparingLong(File::lastModified));
    long total = incoming;
    for (File file : files) total += file.length();
    for (File file : files) {
      if (total <= CACHE_BYTES) break;
      if (!file.equals(keep)) { long size = file.length(); if (file.delete()) total -= size; }
    }
    if (total > CACHE_BYTES) throw new IOException("PARALLAX_CACHE_BUDGET_EXCEEDED");
  }
}
