package com.voyagewright.landfall;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Bounded restart leases only; encrypted no-backup app storage, never a progression engine. */
final class LandfallPrivateStore {
  private final String ALIAS;
  LandfallPrivateStore(String origin) { try { byte[] bytes = MessageDigest.getInstance("SHA-256").digest(origin.getBytes(StandardCharsets.UTF_8)); StringBuilder hash = new StringBuilder(); for (byte value : bytes) hash.append(String.format("%02x", value)); ALIAS = "landfall-private-leases-v1-" + hash; } catch (Exception error) { throw new IllegalStateException("PRIVATE_ORIGIN_INVALID"); } }
  private static final int MAX_RECORDS = 128;
  private File directory(Context context) { return new File(context.getNoBackupFilesDir(), ALIAS); }
  static boolean validKey(String key) { return key != null && (key.matches("landfall-offline-identity-v2(:chunk:[0-9]{1,3})?") || key.matches("landfall-(offline-lease-v2|region-lease-v1):[A-Za-z0-9._:-]{1,160}")); }
  private File file(Context context, String key) throws Exception {
    if (!validKey(key)) throw new IllegalArgumentException("PRIVATE_KEY_INVALID");
    byte[] hash = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
    StringBuilder name = new StringBuilder(); for (byte value : hash) name.append(String.format("%02x", value));
    return new File(directory(context), name + ".enc");
  }
  private SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
    if (!store.containsAlias(ALIAS)) { KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"); generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); generator.generateKey(); }
    return (SecretKey)store.getKey(ALIAS, null);
  }
  private JSONObject readFile(File file) {
    try {
      if (!file.isFile() || file.length() > 32768) return null;
      JSONObject envelope = new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP))); cipher.updateAAD(ALIAS.getBytes(StandardCharsets.UTF_8));
      JSONObject value = new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("bytes"), Base64.NO_WRAP)), StandardCharsets.UTF_8));
      if (!validKey(value.getString("key")) || value.getLong("expiresAt") <= System.currentTimeMillis() || value.getLong("expiresAt") > System.currentTimeMillis() + 86400000L) { Files.deleteIfExists(file.toPath()); return null; }
      return value;
    } catch (Exception ignored) { try { Files.deleteIfExists(file.toPath()); } catch (Exception ignoredAgain) {} return null; }
  }
  synchronized JSONArray list(Context context) {
    JSONArray keys = new JSONArray(); File[] files = directory(context).listFiles();
    if (files == null) return keys;
    if (files.length > MAX_RECORDS) { clear(context); return keys; }
    for (File item : files) { JSONObject row = readFile(item); if (row != null) keys.put(row.optString("key")); }
    return keys;
  }
  synchronized String get(Context context, String name) {
    try { JSONObject row = readFile(file(context, name)); return row != null && name.equals(row.getString("key")) ? row.getString("value") : null; } catch (Exception ignored) { return null; }
  }
  synchronized boolean put(Context context, String name, String value, long expiresAt) {
    try {
      if (!validKey(name) || value == null || value.getBytes(StandardCharsets.UTF_8).length > 8192 || expiresAt <= System.currentTimeMillis() || expiresAt > System.currentTimeMillis() + 86400000L) return false;
      JSONArray rows = list(context); File target = file(context, name);
      if (rows.length() >= MAX_RECORDS && !target.exists()) return false;
      if (!directory(context).isDirectory() && !directory(context).mkdirs()) return false;
      byte[] plain = new JSONObject().put("key", name).put("value", value).put("expiresAt", expiresAt).toString().getBytes(StandardCharsets.UTF_8);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key()); cipher.updateAAD(ALIAS.getBytes(StandardCharsets.UTF_8));
      String encoded = new JSONObject().put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).put("bytes", Base64.encodeToString(cipher.doFinal(plain), Base64.NO_WRAP)).toString();
      android.util.AtomicFile atomic = new android.util.AtomicFile(target); java.io.FileOutputStream stream = atomic.startWrite();
      try { stream.write(encoded.getBytes(StandardCharsets.UTF_8)); atomic.finishWrite(stream); } catch (Exception error) { atomic.failWrite(stream); throw error; }
      return true;
    } catch (Exception ignored) { return false; }
  }
  synchronized void remove(Context context, String name) { try { Files.deleteIfExists(file(context, name).toPath()); } catch (Exception ignored) {} }
  synchronized void clear(Context context) {
    File[] files = directory(context).listFiles(); if (files != null) for (File file : files) if (file.isFile()) file.delete();
    try { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); store.deleteEntry(ALIAS); } catch (Exception ignored) {}
  }
  synchronized String lastJourney(Context context) {
    JSONArray keys = list(context); long latest = 0; String session = null;
    for (int index = 0; index < keys.length(); index++) try {
      String name = keys.getString(index); if (!name.startsWith("landfall-offline-lease-v2:")) continue;
      JSONObject metadata = new JSONObject(get(context, name)); int chunks = metadata.getInt("chunks"); if(metadata.optInt("version") != 1 || chunks < 1 || chunks > 4) continue;
      StringBuilder encoded = new StringBuilder(); for(int chunk=0;chunk<chunks;chunk++){String part=get(context,name+":chunk:"+chunk);if(part==null || part.length()>5000)throw new IllegalArgumentException();encoded.append(part);}
      byte[] bytes = Base64.decode(encoded.toString(), Base64.NO_WRAP); StringBuilder digest=new StringBuilder();for(byte value:MessageDigest.getInstance("SHA-256").digest(bytes))digest.append(String.format("%02x",value));if(!digest.toString().equals(metadata.getString("sha256")))continue;
      JSONObject lease = new JSONObject(new String(bytes,StandardCharsets.UTF_8)); String candidate = lease.getString("sessionId"); long expiry = lease.getLong("expiresAt");
      if (candidate.matches("[A-Za-z0-9._:-]{1,128}") && name.equals("landfall-offline-lease-v2:" + candidate) && expiry > latest && expiry > System.currentTimeMillis()) { session = candidate; latest = expiry; }
    } catch (Exception ignored) {}
    return session;
  }
}
