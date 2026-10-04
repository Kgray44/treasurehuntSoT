package com.voyagewright.landfall;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.pm.PackageManager;
import android.Manifest;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

/** A wake hint cannot call the server, open an Activity, or complete a waypoint. */
public final class LandfallGeofenceReceiver extends BroadcastReceiver {
  private static synchronized void diagnostic(Context context,String counter){
    if(!BuildConfig.DEBUG)return;
    try{
      String[] keys={"received","permissionDenied","malformedOrError","unsupportedTransition","inactive","appendRejected","appended","notices"};
      org.json.JSONObject previous=new org.json.JSONObject();
      java.io.File file=new java.io.File(context.getFilesDir(),"landfall-geofence-receiver-debug.json");
      if(file.exists()&&file.length()<=1024)previous=new org.json.JSONObject(new String(java.nio.file.Files.readAllBytes(file.toPath()),java.nio.charset.StandardCharsets.UTF_8));
      org.json.JSONObject value=new org.json.JSONObject();
      for(String key:keys)value.put(key,Math.min(100000,Math.max(0,previous.optInt(key))+(key.equals(counter)?1:0)));
      try(java.io.FileOutputStream output=context.openFileOutput(file.getName(),Context.MODE_PRIVATE)){output.write(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    }catch(Exception ignored){}
  }
  @Override public void onReceive(Context context,Intent intent){
    diagnostic(context,"received");
    if(context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED ||
       (android.os.Build.VERSION.SDK_INT>=29 && context.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED)){diagnostic(context,"permissionDenied");LandfallSecureHints.clear(context);return;}
    GeofencingEvent event=GeofencingEvent.fromIntent(intent);
    if(event==null||event.hasError()||event.getTriggeringGeofences()==null){diagnostic(context,"malformedOrError");return;}
    String transition=event.getGeofenceTransition()==Geofence.GEOFENCE_TRANSITION_ENTER?"ENTER":event.getGeofenceTransition()==Geofence.GEOFENCE_TRANSITION_EXIT?"EXIT":null;
    if(transition==null){diagnostic(context,"unsupportedTransition");return;}
    for(Geofence fence:event.getTriggeringGeofences()){
      if(!fence.getRequestId().matches("[A-Za-z0-9_-]{32,2048}")||!LandfallSecureHints.active(context,fence.getRequestId())){diagnostic(context,"inactive");continue;}
      if(!LandfallSecureHints.append(context,fence.getRequestId(),transition)){diagnostic(context,"appendRejected");continue;}
      diagnostic(context,"appended");
      if(transition.equals("ENTER")&&LandfallSecureHints.notices(context,fence.getRequestId())&&(android.os.Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)){
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel("landfall-nearby","Optional journey reminders",NotificationManager.IMPORTANCE_DEFAULT));
        Intent open=new Intent(context,LandfallActivity.class).putExtra("returnHandle",fence.getRequestId()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent returnIntent=PendingIntent.getActivity(context,fence.getRequestId().hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.notify(fence.getRequestId().hashCode(),new Notification.Builder(context,"landfall-nearby").setSmallIcon(android.R.drawable.ic_dialog_map).setContentTitle("Your journey may be nearby").setContentText("Open your current Chart for a fresh check. No visit has been confirmed.").setContentIntent(returnIntent).setOnlyAlertOnce(true).setAutoCancel(true).build());
        diagnostic(context,"notices");
      }
    }
  }
}
