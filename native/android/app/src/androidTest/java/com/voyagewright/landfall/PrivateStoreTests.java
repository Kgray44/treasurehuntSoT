package com.voyagewright.landfall;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Context;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class PrivateStoreTests {
  private String hash(String input) throws Exception { StringBuilder result=new StringBuilder(); for(byte value: java.security.MessageDigest.getInstance("SHA-256").digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8)))result.append(String.format("%02x",value)); return result.toString(); }
  @Test public void encryptedRestartLeaseIsOriginBoundAndClearable() throws Exception {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    String origin = "https://synthetic-lease.example.test";
    LandfallPrivateStore store = new LandfallPrivateStore(origin); store.clear(context);
    try {
      String key = "landfall-offline-lease-v2:synthetic-session";
      assertTrue(store.put(context, key, "SYNTHETIC_PRIVATE_LEASE_ONLY", System.currentTimeMillis()+60000));
      assertEquals("SYNTHETIC_PRIVATE_LEASE_ONLY", new LandfallPrivateStore(origin).get(context, key));
      assertNull(new LandfallPrivateStore("https://other-origin.example.test").get(context,key));
      java.io.File file = new java.io.File(new java.io.File(context.getNoBackupFilesDir(),"landfall-private-leases-v1-"+hash(origin)),hash(key)+".enc");
      byte[] ciphertext=java.nio.file.Files.readAllBytes(file.toPath()); assertFalse(new String(ciphertext,java.nio.charset.StandardCharsets.UTF_8).contains("SYNTHETIC_PRIVATE_LEASE_ONLY"));
      ciphertext[0]^=1; java.nio.file.Files.write(file.toPath(),ciphertext); assertNull(store.get(context,key));
      store.remove(context,key); assertNull(store.get(context,key)); assertEquals(0,store.list(context).length());
    } finally { store.clear(context); }
  }
  @Test public void invalidKeysExpiryAndOversizedValuesFailClosed() {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    LandfallPrivateStore store = new LandfallPrivateStore("https://synthetic-bounds.example.test"); store.clear(context);
    try {
      long now = System.currentTimeMillis();
      assertFalse(store.put(context,"../../private","synthetic",now+60000));
      assertFalse(store.put(context,"landfall-offline-identity-v2","synthetic",now-1));
      assertFalse(store.put(context,"landfall-offline-identity-v2","synthetic",now+86401000));
      assertFalse(store.put(context,"landfall-offline-identity-v2",new String(new char[8193]).replace('\0','x'),now+60000));
      assertEquals(0,store.list(context).length());
      assertTrue(store.put(context,"landfall-offline-identity-v2:chunk:0","synthetic-identity-chunk",now+60000));
      assertEquals("synthetic-identity-chunk",store.get(context,"landfall-offline-identity-v2:chunk:0"));
    } finally { store.clear(context); }
  }
  @Test public void completeLeaseReturnsOnlyItsBoundJourney() throws Exception {
    Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    LandfallPrivateStore store=new LandfallPrivateStore("https://synthetic-journey.example.test");store.clear(context);
    try {
      long expiry=System.currentTimeMillis()+60000;String name="landfall-offline-lease-v2:synthetic-session";
      String lease=new org.json.JSONObject().put("sessionId","synthetic-session").put("versionId","synthetic-version").put("csrfToken","synthetic-csrf").put("expiresAt",expiry).toString();
      String chunk=android.util.Base64.encodeToString(lease.getBytes(java.nio.charset.StandardCharsets.UTF_8),android.util.Base64.NO_WRAP);
      assertTrue(store.put(context,name+":chunk:0",chunk,expiry));
      assertNull(store.lastJourney(context));
      assertTrue(store.put(context,name,new org.json.JSONObject().put("version",1).put("chunks",1).put("sha256",hash(lease)).put("expiresAt",expiry).toString(),expiry));
      assertEquals("synthetic-session",store.lastJourney(context));
      store.remove(context,name+":chunk:0");assertNull(store.lastJourney(context));
    } finally {store.clear(context);}
  }
}
