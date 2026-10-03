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

/** Small app-private encrypted wake journal. No coordinates or continuous location history. */
final class LandfallSecureHints {
  private static final String ALIAS="landfall-wake-hints-v1";
  private static String handleKey(String handle)throws Exception{byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(handle.getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder result=new StringBuilder();for(byte value:bytes)result.append(String.format("%02x",value));return result.toString();}
  static void register(Context context,String handle,long expiresAt,boolean notifications){try{String hash=handleKey(handle);context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).edit().putLong("expiry:"+hash,expiresAt).putBoolean("notice:"+hash,notifications).apply();}catch(Exception ignored){}}
  static boolean active(Context context,String handle){try{return context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).getLong("expiry:"+handleKey(handle),0)>System.currentTimeMillis();}catch(Exception ignored){return false;}}
  static boolean notices(Context context,String handle){try{return active(context,handle)&&context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).getBoolean("notice:"+handleKey(handle),false);}catch(Exception ignored){return false;}}
  private static SecretKey key() throws Exception {
    KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
    if(!store.containsAlias(ALIAS)){KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}
    return (SecretKey)store.getKey(ALIAS,null);
  }
  static synchronized JSONArray read(Context context){
    try {String encoded=context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).getString("journal",null);if(encoded==null)return new JSONArray();JSONObject envelope=new JSONObject(encoded);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(envelope.getString("iv"),Base64.NO_WRAP)));cipher.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));JSONArray rows=new JSONArray(new String(cipher.doFinal(Base64.decode(envelope.getString("bytes"),Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));JSONArray fresh=new JSONArray();for(int i=0;i<rows.length()&&fresh.length()<32;i++){JSONObject row=rows.getJSONObject(i);if(System.currentTimeMillis()-row.getLong("receivedAt")<300000)fresh.put(row);}return fresh;}catch(Exception ignored){clear(context);return new JSONArray();}
  }
  static synchronized void append(Context context,String handle,String transition){
    try{JSONArray rows=read(context);if(rows.length()>=32)return;rows.put(new JSONObject().put("id",java.util.UUID.randomUUID().toString()).put("returnHandle",handle).put("event",transition).put("receivedAt",System.currentTimeMillis()));Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));JSONObject envelope=new JSONObject().put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).put("bytes",Base64.encodeToString(cipher.doFinal(rows.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP));context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).edit().putString("journal",envelope.toString()).apply();}catch(Exception ignored){}
  }
  static synchronized void clear(Context context){context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE).edit().clear().apply();try{KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);store.deleteEntry(ALIAS);}catch(Exception ignored){}}
}
