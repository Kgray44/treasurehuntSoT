package com.voyagewright.landfall;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
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
  static Backend backend(Context input) {
    Context context = input.getApplicationContext();
    PendingIntent intent = PendingIntent.getBroadcast(context, 0, new Intent(context, LandfallGeofenceReceiver.class),
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
    return new Backend() {
      public Task<Void> add(JSONObject row) {
        Geofence fence = new Geofence.Builder().setRequestId(row.optString("returnHandle"))
          .setCircularRegion(row.optDouble("latitude"), row.optDouble("longitude"), (float)row.optDouble("radiusMeters"))
          .setExpirationDuration(row.optLong("expiresAt")-System.currentTimeMillis()).setNotificationResponsiveness(120000)
          .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT).build();
        return LocationServices.getGeofencingClient(context).addGeofences(new GeofencingRequest.Builder().setInitialTrigger(0).addGeofence(fence).build(), intent);
      }
      public Task<Void> remove(String handle) { return LocationServices.getGeofencingClient(context).removeGeofences(Collections.singletonList(handle)); }
      public Task<Void> clear() { return LocationServices.getGeofencingClient(context).removeGeofences(intent); }
    };
  }
  static void register(Context context, JSONObject input, BooleanSupplier stillConsented, Consumer<String> reply) {
    register(context, input, stillConsented, reply, backend(context));
  }
  static void register(Context context, JSONObject input, BooleanSupplier stillConsented, Consumer<String> reply, Backend backend) {
    if (!valid(input, System.currentTimeMillis()) || !permitted(context) || !stillConsented.getAsBoolean()) { reply.accept("PERMISSION_REQUIRED"); return; }
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
          reply.accept("UNAVAILABLE");return;
        }
        try {
          backend.add(row).addOnCompleteListener(task -> {
            boolean accepted = accept(context,attempt,row,stillConsented,task.isSuccessful());
            if (!accepted) { try { backend.remove(row.optString("returnHandle")); } catch (Exception ignored) {} }
            reply.accept(accepted ? "GRANTED" : "UNAVAILABLE");
          });
        }catch(Exception ignored){reply.accept("UNAVAILABLE");}
      });
    } catch (Exception ignored) { reply.accept("UNAVAILABLE"); }
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
