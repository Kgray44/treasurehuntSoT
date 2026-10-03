package com.voyagewright.landfall;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import org.json.JSONObject;

/** OS-reported state only. It never predicts battery life or grants background acquisition. */
final class LandfallPower {
  private final Activity activity;
  private final PowerManager power;
  private final Runnable changed;
  private boolean registered;
  private PowerManager.OnThermalStatusChangedListener thermal;
  private final BroadcastReceiver receiver=new BroadcastReceiver(){ @Override public void onReceive(Context context,Intent intent){changed.run();} };
  LandfallPower(Activity activity,Runnable changed){this.activity=activity;this.changed=changed;this.power=(PowerManager)activity.getSystemService(Context.POWER_SERVICE);}
  boolean lowPower(){Intent battery=activity.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));int level=battery==null?-1:battery.getIntExtra(BatteryManager.EXTRA_LEVEL,-1);int scale=battery==null?-1:battery.getIntExtra(BatteryManager.EXTRA_SCALE,-1);return (power!=null && power.isPowerSaveMode()) || (level>=0 && scale>0 && (double)level/scale<=0.15);}
  boolean constrained(){ return power==null || lowPower() || thermalPressure(); }
  boolean thermalPressure(){return power!=null && Build.VERSION.SDK_INT>=29 && power.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_SEVERE;}
  boolean critical(){return power!=null && Build.VERSION.SDK_INT>=29 && power.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_CRITICAL;}
  long interval(long requested){return constrained()?Math.max(15000,requested):requested;}
  JSONObject snapshot() throws Exception {return new JSONObject().put("state",power==null?"UNAVAILABLE":"READY").put("lowPower",lowPower()).put("thermalPressure",thermalPressure()).put("critical",critical()).put("observedAt",System.currentTimeMillis());}
  void watch(){
    if(registered || power==null)return;
    IntentFilter filter=new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED);
    filter.addAction(Intent.ACTION_BATTERY_LOW);filter.addAction(Intent.ACTION_BATTERY_OKAY);
    if(Build.VERSION.SDK_INT>=33)activity.registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);else activity.registerReceiver(receiver,filter);
    registered=true;
    if(Build.VERSION.SDK_INT>=29){thermal=status->changed.run();power.addThermalStatusListener(activity.getMainExecutor(),thermal);}
  }
  void close(){if(registered){activity.unregisterReceiver(receiver);registered=false;}if(thermal!=null && power!=null && Build.VERSION.SDK_INT>=29){power.removeThermalStatusListener(thermal);thermal=null;}}
}
