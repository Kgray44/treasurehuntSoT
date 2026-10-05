package com.voyagewright.landfall;

import android.app.Activity;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.UUID;
import java.util.function.Consumer;

final class LandfallSensors implements SensorEventListener {
  private final SensorManager manager;
  private final Consumer<JSONObject> emit;
  private final HashMap<Integer, Long> last = new HashMap<>();
  private boolean active;
  LandfallSensors(Activity activity, Consumer<JSONObject> emit) { manager=(SensorManager)activity.getSystemService(Activity.SENSOR_SERVICE); this.emit=emit; }
  boolean start(boolean foreground) {
    stop(); if(!foreground || manager==null)return false;
    boolean registered=false;
    for(int type:new int[]{Sensor.TYPE_ROTATION_VECTOR,Sensor.TYPE_ACCELEROMETER,Sensor.TYPE_PRESSURE,Sensor.TYPE_STEP_COUNTER}) {
      Sensor sensor=manager.getDefaultSensor(type);
      if(sensor!=null) try { registered=manager.registerListener(this,sensor,250000)||registered; } catch(SecurityException ignored){}
    }
    active=registered; return registered;
  }
  void stop(){ active=false; if(manager!=null)manager.unregisterListener(this); last.clear(); }
  @Override public void onSensorChanged(SensorEvent input) {
    int type=input.sensor.getType(); long now=System.currentTimeMillis();
    if(!active || now-last.getOrDefault(type,0L)<250 || input.accuracy==SensorManager.SENSOR_STATUS_UNRELIABLE)return;
    last.put(type,now);
    try {
      String kind; JSONArray values=new JSONArray(); double accuracy;
      if(type==Sensor.TYPE_ROTATION_VECTOR){ float[] matrix=new float[9]; float[] angles=new float[3]; SensorManager.getRotationMatrixFromVector(matrix,input.values); SensorManager.getOrientation(matrix,angles); kind="ORIENTATION"; values.put((Math.toDegrees(angles[0])+360)%360); values.put(Math.toDegrees(angles[1])); values.put(Math.toDegrees(angles[2])); accuracy=45; }
      else if(type==Sensor.TYPE_ACCELEROMETER){kind="ACCELEROMETER"; for(int index=0;index<3;index++)values.put(input.values[index]); accuracy=1;}
      else if(type==Sensor.TYPE_PRESSURE){kind="PRESSURE";values.put(input.values[0]);accuracy=1;}
      else if(type==Sensor.TYPE_STEP_COUNTER){kind="STEPS";values.put(input.values[0]);accuracy=1;}
      else return;
      JSONObject frame=new JSONObject().put("id",UUID.randomUUID().toString()).put("observedAt",now).put("kind",kind).put("values",values).put("accuracy",accuracy);
      emit.accept(new JSONObject().put("type","sensor").put("frame",frame));
    } catch(Exception ignored){}
  }
  @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
}
