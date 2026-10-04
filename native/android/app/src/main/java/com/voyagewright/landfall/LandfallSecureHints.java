package com.voyagewright.landfall;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** One encrypted consented region for reboot recovery and bounded wake hints; no location trail. */
final class LandfallSecureHints {
  private static final String ALIAS="landfall-wake-hints-v1";
  static synchronized boolean register(Context context,JSONObject row){try{
    if(!LandfallGeofences.valid(row,System.currentTimeMillis()))return false;
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    JSONObject envelope=new JSONObject().put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).put("bytes",Base64.encodeToString(cipher.doFinal(row.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP));
    return context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).edit().clear().putString("registration",envelope.toString()).commit();
  }catch(Exception ignored){return false;}}
  static synchronized JSONObject registration(Context context){try{
    String encoded=context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).getString("registration",null);if(encoded==null)return null;if(encoded.length()>16384)throw new IllegalArgumentException();
    JSONObject envelope=new JSONObject(encoded);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(envelope.getString("iv"),Base64.NO_WRAP)));cipher.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    JSONObject row=new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("bytes"),Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));
    if(!LandfallGeofences.valid(row,System.currentTimeMillis()))throw new IllegalArgumentException();return row;
  }catch(Exception ignored){clear(context);return null;}}
  static synchronized boolean active(Context context,String handle){JSONObject row=registration(context);return row!=null && handle!=null && handle.equals(row.optString("returnHandle"));}
  static synchronized boolean notices(Context context,String handle){JSONObject row=registration(context);return row!=null && handle!=null && handle.equals(row.optString("returnHandle")) && row.optBoolean("notifications",false);}
  private static SecretKey key() throws Exception {
    KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
    if(!store.containsAlias(ALIAS)){KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}
    return (SecretKey)store.getKey(ALIAS,null);
  }
  static synchronized JSONArray read(Context context){
    try {JSONObject current=registration(context);if(current==null)return new JSONArray();String encoded=context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).getString("journal",null);if(encoded==null)return new JSONArray();if(encoded.length()>131072)throw new IllegalArgumentException();JSONObject envelope=new JSONObject(encoded);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(envelope.getString("iv"),Base64.NO_WRAP)));cipher.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));JSONArray rows=new JSONArray(new String(cipher.doFinal(Base64.decode(envelope.getString("bytes"),Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));if(rows.length()>32)throw new IllegalArgumentException();JSONArray fresh=new JSONArray();long now=System.currentTimeMillis();for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);long at=row.getLong("receivedAt");if(at<=now && now-at<300000 && current.optString("returnHandle").equals(row.optString("returnHandle")))fresh.put(row);}return fresh;}catch(Exception ignored){clear(context);return new JSONArray();}
  }
  static synchronized boolean append(Context context,String handle,String transition){
    if(!active(context,handle)||!("ENTER".equals(transition)||"EXIT".equals(transition)))return false;
    try{JSONArray rows=read(context);if(rows.length()>=32)return false;long now=System.currentTimeMillis();JSONObject previous=rows.optJSONObject(rows.length()-1);if(previous!=null&&transition.equals(previous.optString("event"))&&now-previous.optLong("receivedAt")<60000)return false;
    rows.put(new JSONObject().put("id",java.util.UUID.randomUUID().toString()).put("returnHandle",handle).put("event",transition).put("receivedAt",now));Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));JSONObject envelope=new JSONObject().put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).put("bytes",Base64.encodeToString(cipher.doFinal(rows.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP));return context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).edit().putString("journal",envelope.toString()).commit();}catch(Exception ignored){return false;}
  }
  static synchronized void clear(Context context){context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).edit().clear().commit();try{KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);store.deleteEntry(ALIAS);}catch(Exception ignored){}}
}
