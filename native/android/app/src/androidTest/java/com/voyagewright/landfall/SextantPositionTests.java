package com.voyagewright.landfall;
import android.Manifest;
import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.location.LocationListener;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.rule.GrantPermissionRule;
import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.Rule;
import org.junit.runner.RunWith;
import java.util.ArrayList;
import java.util.UUID;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class SextantPositionTests {
  @Rule public GrantPermissionRule permissions=GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION);
  @Test public void canonicalPositionSharesRegistrationPreservesInjectedProvenanceAndStopsEveryOwner() {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      scenario.onActivity(activity->{try{
        ArrayList<JSONObject> events=new ArrayList<>();
        SextantPosition position=new SextantPosition(activity,(LocationManager)activity.getSystemService(Context.LOCATION_SERVICE),new LocationListener(){public void onLocationChanged(Location value){throw new AssertionError("Injected canonical data must not enter navigation");}},event->{if("INJECTED".equals(event.optString("fidelity")))events.add(event);});
        position.enableTestInjection();assertFalse(position.registered());String a=UUID.randomUUID().toString(),b=UUID.randomUUID().toString();
        JSONObject request=new JSONObject().put("leaseId",a).put("capabilities",new JSONArray().put(SextantPosition.CAPABILITY)).put("intervalMs",200).put("durationMs",60000);
        assertFalse(position.start(request,false).getBoolean("accepted"));assertTrue(position.start(request,true).getBoolean("accepted"));
        assertTrue(position.start(new JSONObject(request.toString()).put("leaseId",b),true).getBoolean("accepted"));assertEquals(2,position.activeLeaseCount());assertTrue(position.registered());
        Location fix=new Location("synthetic-test");fix.setLatitude(1);fix.setLongitude(2);fix.setAccuracy(5);fix.setTime(System.currentTimeMillis());fix.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        position.injectForTest(fix);assertEquals(2,events.size());assertEquals("WGS84",events.get(0).getJSONObject("sample").getString("referenceFrame"));
        position.injectForTest(fix);assertEquals(2,events.size());position.stop(a);assertTrue(position.registered());
        assertTrue(position.startLegacy(5000,true));position.stop(b);assertTrue(position.registered());position.stopLegacy();assertFalse(position.registered());
        position.stopAll("BACKGROUND");assertEquals(0,position.activeLeaseCount());assertFalse(position.registered());
      }catch(Exception error){throw new AssertionError(error);}});
    }
  }
}
