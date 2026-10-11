package com.voyagewright.landfall;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

/** Canonical Sextant acquisition; one registration per physical sensor. Landfall
 * receives an unchanged compatibility wire projection from the same owner. */
final class SextantSensors implements SensorEventListener {
  static final Map<String,Integer> TYPES=new HashMap<>();
  static {
    TYPES.put("motion.acceleration-including-gravity",Sensor.TYPE_ACCELEROMETER);
    TYPES.put("motion.linear-acceleration",Sensor.TYPE_LINEAR_ACCELERATION);
    TYPES.put("motion.gravity",Sensor.TYPE_GRAVITY);
    TYPES.put("motion.angular-velocity",Sensor.TYPE_GYROSCOPE);
    TYPES.put("motion.stability",Sensor.TYPE_LINEAR_ACCELERATION);
    TYPES.put("motion.moving",Sensor.TYPE_LINEAR_ACCELERATION);
    TYPES.put("orientation.relative",Sensor.TYPE_GAME_ROTATION_VECTOR);
    TYPES.put("orientation.attitude",Sensor.TYPE_GAME_ROTATION_VECTOR);
    TYPES.put("orientation.absolute",Sensor.TYPE_ROTATION_VECTOR);
    TYPES.put("heading.estimate",Sensor.TYPE_ROTATION_VECTOR);
    TYPES.put("magnetic.field",Sensor.TYPE_MAGNETIC_FIELD);
    TYPES.put("magnetic.uncalibrated-field",Sensor.TYPE_MAGNETIC_FIELD_UNCALIBRATED);
    TYPES.put("magnetic.bias",Sensor.TYPE_MAGNETIC_FIELD_UNCALIBRATED);
    TYPES.put("pressure.observation",Sensor.TYPE_PRESSURE);
    TYPES.put("motion.pedometer",Sensor.TYPE_STEP_COUNTER);
  }
  private static final String PREFIX="sextant.";
  private final Context context;
  private final SensorManager manager;
  private final Consumer<JSONObject> emit;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final Map<String,Lease> leases=new HashMap<>();
  private final Map<Integer,Integer> registered=new HashMap<>();
  private final Map<Integer,Long> legacyLast=new HashMap<>();
  private final ArrayDeque<double[]> stability=new ArrayDeque<>();
  private String legacyId;
  private boolean injectionMode;
  private int powerFloorMs=16;
  private static final class Lease {
    final String id,generation=UUID.randomUUID().toString(); final Set<String> capabilities;
    final Map<String,Long> last=new HashMap<>();
    int interval;long sequence;double steps=-1;long stepAt;Runnable expiry;double[] reference;
    Lease(String id,Set<String> capabilities,int interval){this.id=id;this.capabilities=capabilities;this.interval=interval;}
  }
  SextantSensors(Context context,Consumer<JSONObject> emit){this.context=context;this.emit=emit;manager=(SensorManager)context.getSystemService(Context.SENSOR_SERVICE);}
  static boolean uuid(String value){try{return UUID.fromString(value).toString().equalsIgnoreCase(value);}catch(Exception error){return false;}}
  private int type(String id){Integer type=TYPES.get(id.startsWith(PREFIX)?id.substring(PREFIX.length()):"");return type==null?-1:type;}
  private Sensor sensor(int type){return manager==null || type<0?null:manager.getDefaultSensor(type);}
  private boolean permission(int type){return type!=Sensor.TYPE_STEP_COUNTER || Build.VERSION.SDK_INT<29 || context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)==PackageManager.PERMISSION_GRANTED;}
  String permissionState(String capability){int sensorType=type(capability);if(sensorType<0)return "RESTRICTED";if(sensorType==Sensor.TYPE_STEP_COUNTER && Build.VERSION.SDK_INT>=29)return permission(sensorType)?"GRANTED":"PROMPT";return "NOT_REQUIRED";}
  JSONObject snapshot(boolean foreground) throws Exception {
    JSONObject states=new JSONObject();
    for(String suffix:TYPES.keySet()) {
      int type=TYPES.get(suffix);boolean available=sensor(type)!=null;
      states.put(PREFIX+suffix,new JSONObject().put("support",available?"SUPPORTED":"UNSUPPORTED")
        .put("availability",available && foreground && permission(type)?"AVAILABLE":"TEMPORARILY_UNAVAILABLE")
        .put("permission",permissionState(PREFIX+suffix)).put("calibration","UNKNOWN").put("quality","UNKNOWN").put("freshness","UNKNOWN")
        .put("lifecycle",foreground?"FOREGROUND_ONLY":"SUSPENDED"));
    }
    return new JSONObject().put("version",1).put("states",states).put("background","FOREGROUND_ONLY");
  }
  JSONObject start(JSONObject payload,boolean foreground) throws Exception {
    String id=payload.optString("leaseId");int interval=payload.optInt("intervalMs",0),duration=payload.optInt("durationMs",0);JSONArray requested=payload.optJSONArray("capabilities");
    if(!foreground || !uuid(id) || leases.containsKey(id) || leases.size()>=8 || requested==null || requested.length()<1 || requested.length()>16 || interval<16 || interval>5000 || duration<1 || duration>60000)return new JSONObject().put("accepted",false);
    Set<String> caps=new HashSet<>();for(int i=0;i<requested.length();i++){String cap=requested.optString(i);if(type(cap)<0 || !caps.add(cap))return new JSONObject().put("accepted",false);}
    if(caps.stream().noneMatch(cap->sensor(type(cap))!=null && permission(type(cap))))return new JSONObject().put("accepted",false);
    Lease lease=new Lease(id,caps,interval);leases.put(id,lease);lease.expiry=()->end(id,"EXPIRED");handler.postDelayed(lease.expiry,duration);reconcile();
    if(caps.stream().noneMatch(cap->registered.containsKey(type(cap)))){stop(id);return new JSONObject().put("accepted",false);}
    return new JSONObject().put("accepted",true).put("generation",lease.generation).put("nativeMonotonicMs",SystemClock.elapsedRealtimeNanos()/1000000.0);
  }
  boolean update(String id,int interval){Lease lease=leases.get(id);if(lease==null || interval<16 || interval>5000)return false;lease.interval=interval;reconcile();return true;}
  void setConstrained(boolean constrained){powerFloorMs=constrained?1000:16;reconcile();}
  void stop(String id){Lease lease=leases.remove(id);if(lease!=null)handler.removeCallbacks(lease.expiry);if(id.equals(legacyId)){legacyId=null;legacyLast.clear();}reconcile();}
  void end(String id,String reason){Lease lease=leases.get(id);if(lease==null)return;try{emit.accept(new JSONObject().put("type","sextant-ended").put("leaseId",id).put("generation",lease.generation).put("reason",reason));}catch(Exception ignored){}stop(id);}
  void stopAll(String reason){for(String id:new HashSet<>(leases.keySet()))end(id,reason);stability.clear();legacyLast.clear();}
  boolean startLegacy(boolean foreground){
    stopLegacy();try {String id=UUID.randomUUID().toString();JSONArray caps=new JSONArray().put(PREFIX+"orientation.absolute").put(PREFIX+"motion.acceleration-including-gravity").put(PREFIX+"pressure.observation").put(PREFIX+"motion.pedometer");
      if(start(new JSONObject().put("leaseId",id).put("capabilities",caps).put("intervalMs",250).put("durationMs",60000),foreground).optBoolean("accepted")){
        legacyId=id;Lease lease=leases.get(id);handler.removeCallbacks(lease.expiry);
        // Accepted Landfall foreground context lasts until its explicit stop or
        // OS lifecycle termination. It has no consumer-independent TTL change.
        lease.expiry=()->{if(id.equals(legacyId))handler.postDelayed(lease.expiry,60000);};handler.postDelayed(lease.expiry,60000);return true;
      }
    }catch(Exception ignored){}return false;
  }
  void stopLegacy(){if(legacyId!=null)stop(legacyId);}
  private void reconcile(){
    if(manager==null)return;Map<Integer,Integer> needed=new HashMap<>();
    for(Lease lease:leases.values())for(String cap:lease.capabilities){int type=type(cap);if(sensor(type)!=null && permission(type))needed.merge(type,Math.max(powerFloorMs,lease.interval),Math::min);}
    for(int type:new HashSet<>(registered.keySet()))if(!needed.containsKey(type)){manager.unregisterListener(this,sensor(type));registered.remove(type);}
    for(Map.Entry<Integer,Integer> entry:needed.entrySet())if(!entry.getValue().equals(registered.get(entry.getKey()))) {
      Sensor sensor=sensor(entry.getKey());manager.unregisterListener(this,sensor);
      try{if(manager.registerListener(this,sensor,entry.getValue()*1000,handler))registered.put(entry.getKey(),entry.getValue());else registered.remove(entry.getKey());}catch(SecurityException error){registered.remove(entry.getKey());}
    }
    if(leases.isEmpty()){manager.unregisterListener(this);registered.clear();stability.clear();}
  }
  int activeLeaseCount(){return leases.size();} int registeredSensorCount(){return registered.size();}
  @Override public void onSensorChanged(SensorEvent input){accept(input.sensor.getType(),input.values,input.accuracy,input.timestamp,"OS");}
  // Native test seam cannot be reached through the WebView bridge; injected
  // samples retain their explicit fidelity even inside actual instrumentation.
  void enableTestInjection(){if(!BuildConfig.DEBUG)throw new IllegalStateException("TEST_INJECTION_REFUSED");injectionMode=true;}
  void injectForTest(int type,float[] values,int accuracy,long captureNs){if(!BuildConfig.DEBUG || !injectionMode)throw new IllegalStateException("TEST_INJECTION_REFUSED");accept(type,values,accuracy,captureNs,"INJECTED");}
  private void accept(int type,float[] values,int accuracy,long captureNs,String fidelity){
    if(!registered.containsKey(type) || values==null || values.length==0)return;long age=SystemClock.elapsedRealtimeNanos()-captureNs;if(age<0 || age>1000000000L)return;
    for(float value:values)if(!Float.isFinite(value))return;
    if(type==Sensor.TYPE_LINEAR_ACCELERATION && values.length>=3){stability.addLast(new double[]{captureNs/1000000.0,Math.sqrt(values[0]*values[0]+values[1]*values[1]+values[2]*values[2])});while(stability.size()>64 || (!stability.isEmpty() && captureNs/1000000.0-stability.peekFirst()[0]>1200))stability.removeFirst();}
    for(Lease lease:new HashSet<>(leases.values())) {
      if(lease.capabilities.stream().noneMatch(cap->type(cap)==type))continue;
      if(!permission(type)){end(lease.id,"PERMISSION");continue;}
      for(String cap:lease.capabilities){if(type(cap)!=type)continue;Long last=lease.last.get(cap);long at=captureNs/1000000;if(last!=null && (at<=last || at-last<Math.max(powerFloorMs,lease.interval)))continue;
        try{JSONObject sample=sample(cap,type,values,accuracy,lease,at);if(sample==null)continue;lease.last.put(cap,at);
          emit.accept(new JSONObject().put("type","sextant-sample").put("version",1).put("leaseId",lease.id).put("generation",lease.generation).put("sequence",lease.sequence++)
            .put("emittedAtWallMs",System.currentTimeMillis()).put("captureMonotonicMs",captureNs/1000000.0).put("captureAgeMs",age/1000000.0).put("fidelity",fidelity).put("sample",sample));
        }catch(Exception error){end(lease.id,"PROVIDER_ERROR");break;}
      }
    }
    if(legacyId!=null && accuracy!=SensorManager.SENSOR_STATUS_UNRELIABLE && fidelity.equals("OS"))legacy(type,values,captureNs);
  }
  private JSONObject sample(String cap,int type,float[] values,int accuracy,Lease lease,long at) throws Exception {
    String frame="DEVICE",units="m/s^2",calibration=accuracy>=SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM?"GOOD":"UNKNOWN",quality=accuracy>=SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM?"MEDIUM":"LOW";
    JSONArray warnings=new JSONArray().put("PLATFORM_ACCURACY_UNQUALIFIED");Object value;
    if(type==Sensor.TYPE_ROTATION_VECTOR || type==Sensor.TYPE_GAME_ROTATION_VECTOR){
      if(values.length<3)return null;float[] q=new float[4];SensorManager.getQuaternionFromVector(q,values);double norm=Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]);if(norm<0.000001)return null;
      frame=type==Sensor.TYPE_GAME_ROTATION_VECTOR?"LOCAL_ARBITRARY":"EARTH_MAGNETIC";units="quaternion";
      if(cap.endsWith("heading.estimate")){float[] matrix=new float[9],angles=new float[3];SensorManager.getRotationMatrixFromVector(matrix,values);SensorManager.getOrientation(matrix,angles);value=(Math.toDegrees(angles[0])+360)%360;units="degrees";}
      else {double x=q[1]/norm,y=q[2]/norm,z=q[3]/norm,w=q[0]/norm;
        if(cap.endsWith("orientation.relative")){if(lease.reference==null)lease.reference=new double[]{x,y,z,w};double[] a=lease.reference;double bx=x,by=y,bz=z,bw=w;x=a[3]*bx-a[0]*bw-a[1]*bz+a[2]*by;y=a[3]*by+a[0]*bz-a[1]*bw-a[2]*bx;z=a[3]*bz-a[0]*by+a[1]*bx-a[2]*bw;w=a[3]*bw+a[0]*bx+a[1]*by+a[2]*bz;}
        value=new JSONObject().put("x",x).put("y",y).put("z",z).put("w",w);
      }
    }else if(type==Sensor.TYPE_MAGNETIC_FIELD_UNCALIBRATED){
      int offset=cap.endsWith("magnetic.bias")?3:0;if(values.length<offset+3)return null;
      value=new JSONObject().put("x",values[offset]).put("y",values[offset+1]).put("z",values[offset+2]);units="microtesla";calibration="UNKNOWN";quality="LOW";warnings.put(cap.endsWith("magnetic.bias")?"PLATFORM_BIAS_ESTIMATE_UNQUALIFIED":"UNCALIBRATED_MAGNETIC_FIELD");
    }else if(type==Sensor.TYPE_PRESSURE){if(values[0]<300 || values[0]>1100)return null;value=(double)values[0];frame="NONE";units="hPa";calibration="GOOD";quality="MEDIUM";warnings.put("ENVIRONMENTAL_DRIFT_POSSIBLE");}
    else if(type==Sensor.TYPE_STEP_COUNTER){double count=values[0];if(count<0 || count!=Math.floor(count))return null;long delta=lease.steps<0 || count<lease.steps?0:(long)(count-lease.steps);
      if(delta>10000 || (lease.steps>=0 && delta>Math.max(10,(at-lease.stepAt)*0.006)))return null;lease.steps=count;lease.stepAt=at;value=new JSONObject().put("stepDelta",delta).put("cadenceClass","UNKNOWN").put("method","OS_PEDOMETER");units="step-evidence";warnings.put("STEP_DISTANCE_UNQUALIFIED");
    }else{if(values.length<3)return null;double magnitude=Math.sqrt(values[0]*values[0]+values[1]*values[1]+values[2]*values[2]);
      if(cap.endsWith("motion.moving")){value=magnitude>1.5;units="boolean";}
      else if(cap.endsWith("motion.stability")){boolean enough=stability.size()>=5 && at-stability.peekFirst()[0]>=800;value=enough?(stability.stream().allMatch(s->s[1]<0.5)?"STABLE":"MOVING"):"UNKNOWN";units="classification";}
      else{value=new JSONObject().put("x",values[0]).put("y",values[1]).put("z",values[2]);if(type==Sensor.TYPE_GYROSCOPE)units="rad/s";if(type==Sensor.TYPE_MAGNETIC_FIELD){units="microtesla";if(magnitude<5 || magnitude>200){calibration="DISTURBED";quality="LOW";warnings.put("MAGNETIC_DISTURBANCE");}}}
    }
    if(powerFloorMs>=1000){quality="LOW";warnings.put("POWER_CADENCE_THROTTLED");}
    JSONObject result=new JSONObject().put("capabilityId",cap).put("value",value).put("units",units).put("referenceFrame",frame).put("calibrationState",calibration).put("qualityClass",quality).put("confidence",JSONObject.NULL).put("warnings",warnings);
    if(cap.endsWith("heading.estimate"))result.put("uncertainty",values.length>=5 && values[4]>=0?Math.min(180,Math.toDegrees(values[4])):180);return result;
  }
  private void legacy(int type,float[] values,long captureNs){
    long at=captureNs/1000000;if(at-legacyLast.getOrDefault(type,Long.MIN_VALUE/2)<250)return;legacyLast.put(type,at);
    try{String kind;JSONArray output=new JSONArray();double accuracy;
      if(type==Sensor.TYPE_ROTATION_VECTOR){float[] matrix=new float[9],angles=new float[3];SensorManager.getRotationMatrixFromVector(matrix,values);SensorManager.getOrientation(matrix,angles);kind="ORIENTATION";output.put((Math.toDegrees(angles[0])+360)%360).put(Math.toDegrees(angles[1])).put(Math.toDegrees(angles[2]));accuracy=45;}
      else if(type==Sensor.TYPE_ACCELEROMETER){kind="ACCELEROMETER";for(int i=0;i<3;i++)output.put(values[i]);accuracy=1;}
      else if(type==Sensor.TYPE_PRESSURE){kind="PRESSURE";output.put(values[0]);accuracy=1;}
      else if(type==Sensor.TYPE_STEP_COUNTER){kind="STEPS";output.put(values[0]);accuracy=1;}else return;
      emit.accept(new JSONObject().put("type","sensor").put("frame",new JSONObject().put("id",UUID.randomUUID().toString()).put("observedAt",System.currentTimeMillis()).put("kind",kind).put("values",output).put("accuracy",accuracy)));
    }catch(Exception ignored){}
  }
  @Override public void onAccuracyChanged(Sensor sensor,int accuracy){if(accuracy==SensorManager.SENSOR_STATUS_UNRELIABLE)stability.clear();}
}
