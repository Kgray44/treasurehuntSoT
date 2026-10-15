package com.voyagewright.landfall;

import android.content.Context;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.os.VibrationEffect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bounded semantic output. API acceptance is never physical sensation proof. */
final class SextantHaptics {
  private final Context context;
  private final Vibrator vibrator;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private String owner;
  private long last=-1000,windowStart,totalOn;
  private Runnable expiry;
  SextantHaptics(Context context){this.context=context;VibratorManager manager=Build.VERSION.SDK_INT>=31?(VibratorManager)context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE):null;vibrator=manager==null?(Vibrator)context.getSystemService(Context.VIBRATOR_SERVICE):manager.getDefaultVibrator();}
  String tier(){return vibrator==null || !vibrator.hasVibrator()?"NONE":vibrator.hasAmplitudeControl()?"RICH":"BASIC";}
  JSONObject execute(JSONObject payload,boolean foreground,boolean critical)throws Exception {
    String id=payload.optString("leaseId");JSONArray pattern=payload.optJSONArray("pattern");long now=SystemClock.elapsedRealtime();
    if(!foreground || critical || !payload.optBoolean("enabled",false) || payload.optBoolean("reducedSensory",true) || !SextantSensors.uuid(id) || owner!=null || tier().equals("NONE") || pattern==null || pattern.length()<1 || pattern.length()>15 || now-last<500 || Settings.System.getInt(context.getContentResolver(),Settings.System.HAPTIC_FEEDBACK_ENABLED,1)==0)return result(false);
    long[] timings=new long[pattern.length()+1];long duration=0,on=0;
    for(int i=0;i<pattern.length();i++){double raw=pattern.optDouble(i,-1);if(raw<0 || raw>200 || raw!=Math.floor(raw))return result(false);timings[i+1]=(long)raw;duration+=(long)raw;if(i%2==0)on+=(long)raw;}
    if(duration>1500 || on==0 || on>600)return result(false);if(now-windowStart>=60000){windowStart=now;totalOn=0;}if(totalOn+on>3000)return result(false);
    try{vibrator.vibrate(VibrationEffect.createWaveform(timings,-1));owner=id;last=now;totalOn+=on;expiry=()->stop(id);handler.postDelayed(expiry,duration);return result(true);}catch(SecurityException|IllegalArgumentException error){return result(false);}
  }
  private JSONObject result(boolean accepted)throws Exception{return new JSONObject().put("accepted",accepted).put("tier",tier()).put("physicalOutputConfirmed",false);}
  void stop(String id){if(id.equals(owner)){if(vibrator!=null)vibrator.cancel();owner=null;if(expiry!=null)handler.removeCallbacks(expiry);expiry=null;}}
  void stopAll(){if(owner!=null)stop(owner);}
}
