package com.voyagewright.landfall.lab;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Separate debug lab APK process, synthetic FLP input only. It never calls a Landfall
 * receiver, bridge, hint journal or progression writer. Actual Play services must
 * derive and deliver any geofence transition. Never installed on a real device. */
public final class LandfallLocationLabService extends Service {
  private final Handler handler=new Handler(Looper.getMainLooper());
  private FusedLocationProviderClient client;
  private String session,phase;
  private int generation,delivered;
  private boolean mocking,stopping;
  private long expiresAt;
  @Override public IBinder onBind(Intent intent){return null;}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent==null || !("ranchu".equals(Build.HARDWARE) || "goldfish".equals(Build.HARDWARE))){stopSelf();return START_NOT_STICKY;}
    String next=intent.getStringExtra("labSession"),requested=intent.getStringExtra("labPhase");
    try{if(next==null || !UUID.fromString(next).toString().equalsIgnoreCase(next))throw new IllegalArgumentException();}
    catch(IllegalArgumentException ignored){stopSelf();return START_NOT_STICKY;}
    if(!"OUTSIDE_BASELINE".equals(requested) && !"INSIDE_TRANSITION".equals(requested) && !"STOP".equals(requested)){stopSelf();return START_NOT_STICKY;}
    if(session!=null && !session.equals(next)){stopMock();return START_NOT_STICKY;}
    session=next;phase=requested;
    NotificationManager manager=getSystemService(NotificationManager.class);
    manager.createNotificationChannel(new NotificationChannel("landfall-lab-input", "Synthetic Device Lab input", NotificationManager.IMPORTANCE_LOW));
    startForeground(7,new Notification.Builder(this,"landfall-lab-input").setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("Synthetic location input").setContentText("Debug lab APK only. No navigation authority.").build());
    if(client==null)client=LocationServices.getFusedLocationProviderClient(this);
    if("STOP".equals(phase)){stopMock();return START_NOT_STICKY;}
    generation++;handler.removeCallbacksAndMessages(null);delivered=0;expiresAt=SystemClock.elapsedRealtime()+200000;
    final int attempt=generation;
    if(mocking)inject(attempt);
    else client.setMockMode(true).addOnCompleteListener(task->{
      if(task.isSuccessful()){mocking=true;if(attempt==generation && !stopping)inject(attempt);else stopMock();}
      else{record("MOCK_MODE_FAILED");stopMock();}
    });
    return START_NOT_STICKY;
  }
  private void inject(int attempt){
    if(attempt!=generation || stopping)return;
    if(SystemClock.elapsedRealtime()>=expiresAt){stopMock();return;}
    Location location=new Location("landfall-public-synthetic");
    location.setLatitude("OUTSIDE_BASELINE".equals(phase)?44.02:44);location.setLongitude(-72);
    location.setAccuracy(8);location.setTime(System.currentTimeMillis());location.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
    client.setMockLocation(location).addOnCompleteListener(task->{
      if(attempt!=generation || stopping)return;
      if(!task.isSuccessful()){record("LOCATION_FAILED");stopMock();return;}
      delivered++;record("DELIVERED");handler.postDelayed(()->inject(attempt),5000);
    });
  }
  private void stopMock(){
    if(stopping)return;stopping=true;generation++;handler.removeCallbacksAndMessages(null);
    if(client==null){record("STOPPED");stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();return;}
    client.setMockMode(false).addOnCompleteListener(task->{
      mocking=!task.isSuccessful();record(task.isSuccessful()?"STOPPED":"STOP_FAILED");
      stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
    });
  }
  private void record(String state){
    try{
      JSONObject value=new JSONObject().put("sessionId",session).put("phase",phase).put("state",state)
        .put("delivered",delivered).put("mocking",mocking).put("synthetic",true).put("canComplete",false);
      try(java.io.FileOutputStream output=openFileOutput("landfall-location-lab.json",MODE_PRIVATE)){
        output.write(value.toString().getBytes(StandardCharsets.UTF_8));
      }
    }catch(Exception ignored){}
  }
  @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);if(client!=null && !stopping)client.setMockMode(false);super.onDestroy();}
}
