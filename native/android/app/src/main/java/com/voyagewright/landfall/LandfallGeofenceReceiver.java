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
  @Override public void onReceive(Context context,Intent intent){
    GeofencingEvent event=GeofencingEvent.fromIntent(intent);
    if(event==null||event.hasError()||event.getTriggeringGeofences()==null)return;
    String transition=event.getGeofenceTransition()==Geofence.GEOFENCE_TRANSITION_ENTER?"ENTER":event.getGeofenceTransition()==Geofence.GEOFENCE_TRANSITION_EXIT?"EXIT":null;
    if(transition==null)return;
    for(Geofence fence:event.getTriggeringGeofences())if(fence.getRequestId().matches("[A-Za-z0-9_-]{32,2048}")&&LandfallSecureHints.active(context,fence.getRequestId())){
      LandfallSecureHints.append(context,fence.getRequestId(),transition);
      if(transition.equals("ENTER")&&LandfallSecureHints.notices(context,fence.getRequestId())&&(android.os.Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)){
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel("landfall-nearby","Optional journey reminders",NotificationManager.IMPORTANCE_DEFAULT));
        Intent open=new Intent(context,LandfallActivity.class).putExtra("returnHandle",fence.getRequestId()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent returnIntent=PendingIntent.getActivity(context,fence.getRequestId().hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.notify(fence.getRequestId().hashCode(),new Notification.Builder(context,"landfall-nearby").setSmallIcon(android.R.drawable.ic_dialog_map).setContentTitle("Your journey may be nearby").setContentText("Open your current Chart for a fresh check. No visit has been confirmed.").setContentIntent(returnIntent).setAutoCancel(true).build());
      }
    }
  }
}
