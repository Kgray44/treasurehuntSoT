package com.voyagewright.landfall;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.HashMap;
import java.util.UUID;
import java.util.function.Consumer;

/** One foreground LocationManager subscription for canonical leases and the
 * accepted navigation projection. Geofence/custody/progression policy stays with Landfall. */
final class SextantPosition implements LocationListener {
  static final String CAPABILITY="sextant.position.observation";
  private final Context context;
  private final LocationManager manager;
  private final LocationListener navigation;
  private final Consumer<JSONObject> emit;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final HashMap<String,Lease> leases=new HashMap<>();
  private boolean legacy,legacyPrecise,constrained,registered;
  private long legacyInterval=5000;
  private long registeredInterval;
  private long legacyLast=-1;
  private int nativeCallbacks;
  private boolean injectionMode;
  private String provider="NONE";
  private static final class Lease {
    final String id,generation=UUID.randomUUID().toString();
    int interval;long last=-1,sequence,startedAt=SystemClock.elapsedRealtime();Runnable expiry;
    Lease(String id,int interval){this.id=id;this.interval=interval;}
  }
  SextantPosition(Context context,LocationManager manager,LocationListener navigation,Consumer<JSONObject> emit){
    this.context=context;this.manager=manager;this.navigation=navigation;this.emit=emit;
  }
  boolean permitted(){return context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED || precise();}
  private boolean precise(){return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
  String provider(){return provider;}
  int activeLeaseCount(){return leases.size();}
  boolean registered(){return registered;}
  int callbackCount(){return nativeCallbacks;}
  JSONObject snapshot(boolean foreground) throws Exception {
    boolean supported=manager!=null && !manager.getAllProviders().isEmpty(), enabled=supported && (android.os.Build.VERSION.SDK_INT>=28?manager.isLocationEnabled():manager.isProviderEnabled(LocationManager.GPS_PROVIDER)||manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
    return new JSONObject().put("support",supported?"SUPPORTED":"UNSUPPORTED").put("availability",enabled&&foreground&&permitted()?"AVAILABLE":"TEMPORARILY_UNAVAILABLE")
      .put("permission",permitted()?"GRANTED":"PROMPT").put("calibration","NOT_APPLICABLE").put("quality","UNKNOWN").put("freshness","UNKNOWN").put("lifecycle",foreground?"FOREGROUND_ONLY":"SUSPENDED");
  }
  boolean startLegacy(long interval,boolean precise){legacy=true;legacyLast=-1;legacyInterval=interval;legacyPrecise=precise;boolean accepted=reconcile();if(!accepted){legacy=false;reconcile();}return accepted;}
  void stopLegacy(){legacy=false;reconcile();}
  JSONObject start(JSONObject payload,boolean foreground) throws Exception {
    String id=payload.optString("leaseId");int interval=payload.optInt("intervalMs"),duration=payload.optInt("durationMs");JSONArray caps=payload.optJSONArray("capabilities");
    if(!foreground || !permitted() || !SextantSensors.uuid(id) || leases.containsKey(id) || leases.size()>=8 || interval<16 || interval>5000 || duration<1 || duration>60000 || caps==null || caps.length()!=1 || !CAPABILITY.equals(caps.optString(0)))return new JSONObject().put("accepted",false);
    Lease lease=new Lease(id,Math.max(1000,interval));leases.put(id,lease);
    if(!reconcile()){leases.remove(id);reconcile();return new JSONObject().put("accepted",false);}
    lease.expiry=()->end(id,"EXPIRED");handler.postDelayed(lease.expiry,duration);
    return new JSONObject().put("accepted",true).put("generation",lease.generation).put("nativeMonotonicMs",SystemClock.elapsedRealtime());
  }
  boolean update(String id,int interval){Lease lease=leases.get(id);if(lease==null||interval<16||interval>5000)return false;lease.interval=Math.max(1000,interval);return reconcile();}
  void stop(String id){Lease lease=leases.remove(id);if(lease==null)return;handler.removeCallbacks(lease.expiry);reconcile();}
  void stopAll(String reason){for(String id:new java.util.HashSet<>(leases.keySet()))end(id,reason);legacy=false;reconcile();}
  void setConstrained(boolean value){constrained=value;reconcile();}
  private void end(String id,String reason){Lease lease=leases.get(id);if(lease==null)return;try{emit.accept(new JSONObject().put("type","sextant-ended").put("leaseId",id).put("generation",lease.generation).put("reason",reason));}catch(Exception ignored){}stop(id);}
  private boolean reconcile(){
    if(manager==null)return false;
    if(!legacy && leases.isEmpty()){manager.removeUpdates(this);registered=false;provider="NONE";return true;}
    if(!permitted())return false;
    long interval=legacy?legacyInterval:60000;
    for(Lease lease:leases.values())interval=Math.min(interval,lease.interval);
    if(constrained)interval=Math.max(15000,interval);
    String selected=precise() && (!legacy || legacyPrecise || !leases.isEmpty())?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;
    if(!manager.isProviderEnabled(selected))selected=LocationManager.NETWORK_PROVIDER;
    if(!manager.isProviderEnabled(selected))return false;
    if(registered && provider.equals(selected) && registeredInterval==interval)return true;
    manager.removeUpdates(this);registered=false;provider="NONE";
    try{manager.requestLocationUpdates(selected,interval,0,this,Looper.getMainLooper());provider=selected;registeredInterval=interval;registered=true;return true;}catch(SecurityException|IllegalArgumentException error){return false;}
  }
  @Override public void onLocationChanged(Location location){
    nativeCallbacks=Math.min(100000,nativeCallbacks+1);
    if(injectionMode)return;
    accept(location,"OS",true);
  }
  void enableTestInjection(){if(!BuildConfig.DEBUG)throw new IllegalStateException("TEST_INJECTION_REFUSED");injectionMode=true;}
  void injectForTest(Location location){if(!BuildConfig.DEBUG || !injectionMode)throw new IllegalStateException("TEST_INJECTION_REFUSED");accept(location,"INJECTED",false);}
  private void accept(Location location,String fidelity,boolean forwardNavigation){
    if(!permitted()){stopAll("PERMISSION");return;}
    long capture=location.getElapsedRealtimeNanos()/1000000,age=SystemClock.elapsedRealtime()-capture;
    if(forwardNavigation && legacy && (legacyLast<0 || capture-legacyLast>=legacyInterval)){legacyLast=capture;navigation.onLocationChanged(location);}
    if(age<0 || age>1000 || !location.hasAccuracy() || !Float.isFinite(location.getAccuracy()) || location.getAccuracy()<=0 || !Double.isFinite(location.getLatitude()) || !Double.isFinite(location.getLongitude()) || Math.abs(location.getLatitude())>90 || Math.abs(location.getLongitude())>180)return;
    for(Lease lease:new java.util.ArrayList<>(leases.values())){
      if(capture<lease.startedAt || lease.last>=0 && capture-lease.last<Math.max(constrained?15000:1000,lease.interval))continue;
      lease.last=capture;
      try{
        JSONObject value=new JSONObject().put("latitude",location.getLatitude()).put("longitude",location.getLongitude()).put("accuracyMeters",location.getAccuracy());
        JSONObject sample=new JSONObject().put("capabilityId",CAPABILITY).put("value",value).put("units","degrees/meters").put("referenceFrame","WGS84").put("qualityClass",precise()&&!constrained&&location.getAccuracy()<=50?"MEDIUM":"LOW").put("calibrationState","NOT_APPLICABLE").put("confidence",JSONObject.NULL).put("uncertainty",location.getAccuracy()).put("warnings",new JSONArray().put("POSITION_IS_CONTEXT_NOT_ARRIVAL_PROOF"));
        emit.accept(new JSONObject().put("type","sextant-sample").put("version",1).put("leaseId",lease.id).put("generation",lease.generation).put("sequence",lease.sequence++).put("emittedAtWallMs",System.currentTimeMillis()).put("captureMonotonicMs",capture).put("captureAgeMs",age).put("fidelity",fidelity).put("sample",sample));
      }catch(Exception ignored){}
    }
  }
  @Override public void onProviderDisabled(String disabled){navigation.onProviderDisabled(disabled);stopAll("PROVIDER_ERROR");}
  @Override public void onProviderEnabled(String enabled){}
  @Override public void onStatusChanged(String provider,int status,android.os.Bundle extras){}
}
