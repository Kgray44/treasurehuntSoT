package com.voyagewright.landfall;

import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** OS callbacks and explicit native injection are asserted separately. These
 * tests qualify software on the actual runtime, not magnetic or RF physics. */
@RunWith(AndroidJUnit4.class)
public final class SextantSensorTests {
  @Test public void hapticLifecycleAndPreferenceGatesDoNotClaimPhysicalOutput() throws Exception {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      scenario.onActivity(activity->{try{SextantHaptics haptics=new SextantHaptics(activity);JSONObject valid=new JSONObject().put("leaseId",UUID.randomUUID().toString()).put("enabled",true).put("reducedSensory",false).put("pattern",new JSONArray().put(15));
        assertFalse(haptics.execute(valid,false,false).getBoolean("accepted"));assertFalse(haptics.execute(valid,true,true).getBoolean("accepted"));valid.put("enabled",false);JSONObject denied=haptics.execute(valid,true,false);assertFalse(denied.getBoolean("accepted"));assertFalse(denied.getBoolean("physicalOutputConfirmed"));haptics.stopAll();
      }catch(Exception error){throw new AssertionError(error);}});
    }
  }
  private JSONObject request(String id,int duration) throws Exception {return new JSONObject().put("leaseId",id).put("capabilities",new JSONArray().put("sextant.motion.acceleration-including-gravity")).put("intervalMs",16).put("durationMs",duration);}
  @Test public void actualFrameworkDiscoveryLeaseSharingAndScopedRelease() throws Exception {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      AtomicReference<SextantSensors> owned=new AtomicReference<>();CountDownLatch sample=new CountDownLatch(1);String a=UUID.randomUUID().toString(),b=UUID.randomUUID().toString();
      scenario.onActivity(activity->{try{SextantSensors sensors=new SextantSensors(activity,event->{if("sextant-sample".equals(event.optString("type")) && "OS".equals(event.optString("fidelity")))sample.countDown();});owned.set(sensors);
        assertEquals(0,sensors.registeredSensorCount());assertEquals("SUPPORTED",sensors.snapshot(true).getJSONObject("states").getJSONObject("sextant.motion.acceleration-including-gravity").getString("support"));
        assertFalse(sensors.start(request(a,60000),false).getBoolean("accepted"));assertTrue(sensors.start(request(a,60000),true).getBoolean("accepted"));assertTrue(sensors.start(request(b,60000),true).getBoolean("accepted"));assertEquals(2,sensors.activeLeaseCount());assertEquals(1,sensors.registeredSensorCount());
      }catch(Exception e){throw new AssertionError(e);}});
      assertTrue("Actual Android SensorManager callback required",sample.await(5,TimeUnit.SECONDS));
      scenario.onActivity(activity->{owned.get().stop(a);assertEquals(1,owned.get().activeLeaseCount());assertEquals(1,owned.get().registeredSensorCount());owned.get().stop(b);assertEquals(0,owned.get().registeredSensorCount());});
    }
  }
  @Test public void explicitNativeInjectionPreservesUnitsProvenanceAndRejectsBadCapture() throws Exception {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      scenario.onActivity(activity->{try{
        List<JSONObject> values=new ArrayList<>();SextantSensors owned=new SextantSensors(activity,event->{if("INJECTED".equals(event.optString("fidelity")))values.add(event);});String id=UUID.randomUUID().toString();
        assertTrue(owned.start(request(id,60000),true).getBoolean("accepted"));owned.enableTestInjection();long capture=SystemClock.elapsedRealtimeNanos();
        owned.injectForTest(Sensor.TYPE_ACCELEROMETER,new float[]{1,2,9.80665f},SensorManager.SENSOR_STATUS_ACCURACY_HIGH,capture);
        assertEquals(1,values.size());JSONObject sample=values.get(0).getJSONObject("sample");assertEquals("m/s^2",sample.getString("units"));assertEquals("DEVICE",sample.getString("referenceFrame"));assertEquals(1,sample.getJSONObject("value").getDouble("x"),0);
        assertEquals(id,values.get(0).getString("leaseId"));assertTrue(values.get(0).has("captureMonotonicMs"));
        owned.injectForTest(Sensor.TYPE_ACCELEROMETER,new float[]{1,2,3},3,capture); // Duplicate timestamp.
        owned.injectForTest(Sensor.TYPE_ACCELEROMETER,new float[]{Float.NaN,0,0},3,capture+20000000);
        owned.injectForTest(Sensor.TYPE_ACCELEROMETER,new float[]{1,2,3},3,capture-2000000000L);
        assertEquals(1,values.size());owned.stopAll("BACKGROUND");owned.injectForTest(Sensor.TYPE_ACCELEROMETER,new float[]{1,2,3},3,capture);assertEquals(1,values.size());assertEquals(0,owned.activeLeaseCount());
      }catch(Exception e){throw new AssertionError(e);}});
    }
  }
  @Test public void nativeExpiryReleasesItsRegistrationAndReportsTheExactLease() throws Exception {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      String id=UUID.randomUUID().toString();CountDownLatch expiry=new CountDownLatch(1);AtomicReference<SextantSensors> owned=new AtomicReference<>();
      scenario.onActivity(activity->{try{SextantSensors sensors=new SextantSensors(activity,event->{if("sextant-ended".equals(event.optString("type")) && id.equals(event.optString("leaseId")) && "EXPIRED".equals(event.optString("reason")))expiry.countDown();});owned.set(sensors);assertTrue(sensors.start(request(id,50),true).getBoolean("accepted"));}catch(Exception e){throw new AssertionError(e);}});
      assertTrue(expiry.await(3,TimeUnit.SECONDS));scenario.onActivity(activity->{assertEquals(0,owned.get().activeLeaseCount());assertEquals(0,owned.get().registeredSensorCount());});
    }
  }
}
