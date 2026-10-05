package com.voyagewright.landfall;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import org.json.JSONObject;
import java.util.Collections;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Wake registration only. Cancelled asynchronous adds cannot restore cleared consent. */
final class LandfallGeofences {
  interface Backend {
    Task<Void> add(JSONObject registration);
    Task<Void> remove(String handle);
    Task<Void> clear();
  }
  private static long generation;
  private static void diagnostic(Context context,String stage,Exception error){
    if(!BuildConfig.DEBUG)return;
    String category=error==null?"NONE":"OTHER";
    if(error instanceof ApiException){
      switch(((ApiException)error).getStatusCode()){
        case GeofenceStatusCodes.GEOFENCE_NOT_AVAILABLE: category="NOT_AVAILABLE";break;
        case GeofenceStatusCodes.GEOFENCE_TOO_MANY_GEOFENCES: category="TOO_MANY_REGIONS";break;
        case GeofenceStatusCodes.GEOFENCE_TOO_MANY_PENDING_INTENTS: category="TOO_MANY_INTENTS";break;
        case GeofenceStatusCodes.GEOFENCE_INSUFFICIENT_LOCATION_PERMISSION: category="INSUFFICIENT_LOCATION_PERMISSION";break;
        default: category="OTHER_API_FAILURE";
      }
    }
    try{
      JSONObject value=new JSONObject().put("stage",stage).put("failure",category);
      try(java.io.FileOutputStream output=context.openFileOutput("landfall-geofence-debug.json",Context.MODE_PRIVATE)){
        output.write(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      }
    }catch(Exception ignored){}
  }
  private static synchronized long next() { return ++generation; }
  private static synchronized boolean current(long attempt) { return generation == attempt; }
  private static synchronized boolean accept(Context context,long attempt,JSONObject row,BooleanSupplier consented,boolean successful) {
    if(!current(attempt))return false;
    if(successful && consented.getAsBoolean() && permitted(context) && valid(row,System.currentTimeMillis()) && LandfallSecureHints.register(context,row))return true;
    LandfallSecureHints.clear(context);return false;
  }
  static boolean permitted(Context context) {
    return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED &&
      (android.os.Build.VERSION.SDK_INT < 29 || context.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED);
  }
  static boolean valid(JSONObject row, long now) {
    if (row == null) return false;
    double latitude = row.optDouble("latitude"), longitude = row.optDouble("longitude"), radius = row.optDouble("radiusMeters");
    long expiry = row.optLong("expiresAt", -1);
    return row.optString("returnHandle").matches("[A-Za-z0-9_-]{32,2048}") && Double.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      Double.isFinite(longitude) && Math.abs(longitude) <= 180 && Double.isFinite(radius) && radius >= 100 && radius <= 10000 &&
      expiry > now && expiry-now <= 86400000;
  }
  /** Play services limits request IDs to 100 characters. Keep the full
   * authenticated claim only in encrypted app storage, never in the OS ID. */
  static String requestId(String handle) {
    if(handle==null || !handle.matches("[A-Za-z0-9_-]{32,2048}"))throw new IllegalArgumentException("Invalid region handle");
    try {
      byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(handle.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      StringBuilder value=new StringBuilder(64);
      for(byte item:digest)value.append(String.format(java.util.Locale.ROOT,"%02x",item));
      return value.toString();
    }catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException("Region digest unavailable");}
  }
  static Geofence region(JSONObject row) {
    return new Geofence.Builder().setRequestId(requestId(row.optString("returnHandle")))
      .setCircularRegion(row.optDouble("latitude"),row.optDouble("longitude"),(float)row.optDouble("radiusMeters"))
      .setExpirationDuration(row.optLong("expiresAt")-System.currentTimeMillis()).setNotificationResponsiveness(120000)
      .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER|Geofence.GEOFENCE_TRANSITION_EXIT).build();
  }
  static Backend backend(Context input) {
    Context context = input.getApplicationContext();
    PendingIntent intent = PendingIntent.getBroadcast(context, 0, new Intent(context, LandfallGeofenceReceiver.class),
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
    return new Backend() {
      public Task<Void> add(JSONObject row) {
        Geofence fence = region(row);
        return LocationServices.getGeofencingClient(context).addGeofences(new GeofencingRequest.Builder().setInitialTrigger(0).addGeofence(fence).build(), intent);
      }
      public Task<Void> remove(String handle) { return LocationServices.getGeofencingClient(context).removeGeofences(Collections.singletonList(requestId(handle))); }
      public Task<Void> clear() { return LocationServices.getGeofencingClient(context).removeGeofences(intent); }
    };
  }
  static void register(Context context, JSONObject input, BooleanSupplier stillConsented, Consumer<String> reply) {
    register(context, input, stillConsented, reply, backend(context));
  }
  static void register(Context context, JSONObject input, BooleanSupplier stillConsented, Consumer<String> reply, Backend backend) {
    if (!valid(input, System.currentTimeMillis()) || !permitted(context) || !stillConsented.getAsBoolean()) { diagnostic(context,"PRECONDITION_FAILED",null);reply.accept("PERMISSION_REQUIRED"); return; }
    final JSONObject row;
    try {
      row = new JSONObject().put("returnHandle", input.getString("returnHandle")).put("latitude", input.getDouble("latitude"))
        .put("longitude", input.getDouble("longitude")).put("radiusMeters", input.getDouble("radiusMeters"))
        .put("expiresAt", input.getLong("expiresAt")).put("notifications", input.optBoolean("notifications", false));
    } catch (Exception ignored) { reply.accept("UNAVAILABLE"); return; }
    final long attempt;
    synchronized(LandfallGeofences.class){attempt=next();LandfallSecureHints.clear(context);}
    try {
      // Different handles otherwise accumulate in Play services even though the
      // encrypted journal holds only one region. Confirm removal before replacing.
      backend.clear().addOnCompleteListener(cleared -> {
        if(!cleared.isSuccessful() || !current(attempt) || !stillConsented.getAsBoolean() || !permitted(context) || !valid(row,System.currentTimeMillis())){
          diagnostic(context,cleared.isSuccessful()?"CONSENT_OR_GENERATION_CHANGED":"REMOVE_FAILED",cleared.getException());
          reply.accept("UNAVAILABLE");return;
        }
        try {
          backend.add(row).addOnCompleteListener(task -> {
            boolean accepted = accept(context,attempt,row,stillConsented,task.isSuccessful());
            diagnostic(context,accepted?"REGISTERED":task.isSuccessful()?"CONSENT_OR_GENERATION_CHANGED":"ADD_FAILED",task.getException());
            if (!accepted) { try { backend.remove(row.optString("returnHandle")); } catch (Exception ignored) {} }
            reply.accept(accepted ? "GRANTED" : "UNAVAILABLE");
          });
        }catch(Exception error){diagnostic(context,"ADD_THROWN",error);reply.accept("UNAVAILABLE");}
      });
    } catch (Exception error) { diagnostic(context,"REMOVE_THROWN",error);reply.accept("UNAVAILABLE"); }
  }
  static void clear(Context context, Consumer<Boolean> reply) { clear(context, reply, backend(context)); }
  static void clear(Context context, Consumer<Boolean> reply, Backend backend) {
    synchronized(LandfallGeofences.class){next(); LandfallSecureHints.clear(context);}
    android.app.NotificationManager notices=(android.app.NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
    if(notices!=null)notices.cancelAll();
    try { backend.clear().addOnCompleteListener(task -> reply.accept(task.isSuccessful())); }
    catch (Exception ignored) { reply.accept(false); }
  }
}
