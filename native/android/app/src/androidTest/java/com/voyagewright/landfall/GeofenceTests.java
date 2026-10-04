package com.voyagewright.landfall;

import android.Manifest;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.GrantPermissionRule;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.TaskCompletionSource;
import com.google.android.gms.tasks.Tasks;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Real Android Keystore/permissions, controlled service callback ordering; not an OS geofence entry claim. */
@RunWith(AndroidJUnit4.class)
public final class GeofenceTests {
  @Rule public GrantPermissionRule permissions=GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_BACKGROUND_LOCATION);
  private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  private JSONObject registration() throws Exception {
    return new JSONObject().put("returnHandle","SYNTHETIC_LAB_HANDLE_ONLY_0000000001").put("latitude",44.125).put("longitude",-72.375)
      .put("radiusMeters",150).put("expiresAt",System.currentTimeMillis()+60000).put("notifications",true);
  }
  @Test public void restartRegionIsEncryptedSingleBoundedAndClearable() throws Exception {
    LandfallSecureHints.clear(context);
    try {
      JSONObject row=registration();assertTrue(LandfallSecureHints.register(context,row));
      assertEquals(row.getString("returnHandle"),LandfallSecureHints.registration(context).getString("returnHandle"));
      String persisted=context.getSharedPreferences("landfall-wake-hints-v1",Context.MODE_PRIVATE).getAll().toString();
      assertFalse(persisted.contains(row.getString("returnHandle")));assertFalse(persisted.contains("44.125"));
      assertTrue(LandfallSecureHints.append(context,row.getString("returnHandle"),"ENTER"));
      assertFalse(LandfallSecureHints.append(context,row.getString("returnHandle"),"ENTER"));
      assertTrue(LandfallSecureHints.append(context,row.getString("returnHandle"),"EXIT"));
      assertEquals(2,LandfallSecureHints.read(context).length());
      JSONObject next=registration().put("returnHandle","SYNTHETIC_LAB_HANDLE_ONLY_0000000002");
      assertTrue(LandfallSecureHints.register(context,next));assertFalse(LandfallSecureHints.active(context,row.getString("returnHandle")));
      assertEquals(0,LandfallSecureHints.read(context).length());
      assertFalse(LandfallSecureHints.register(context,registration().put("expiresAt",System.currentTimeMillis()-1)));
      assertFalse(LandfallSecureHints.register(context,registration().put("radiusMeters",Double.MAX_VALUE)));
      context.getSharedPreferences("landfall-wake-hints-v1",Context.MODE_PRIVATE).edit().putString("registration","tampered").commit();
      assertNull(LandfallSecureHints.registration(context));assertEquals(0,context.getSharedPreferences("landfall-wake-hints-v1",Context.MODE_PRIVATE).getAll().size());
    }finally{LandfallSecureHints.clear(context);}
  }
  @Test public void cancelledLateServiceAddCannotRestoreConsent() throws Exception {
    LandfallSecureHints.clear(context);
    TaskCompletionSource<Void> delayed=new TaskCompletionSource<>();
    CountDownLatch replied=new CountDownLatch(1),removed=new CountDownLatch(1);
    AtomicReference<String> result=new AtomicReference<>();
    LandfallGeofences.Backend service=new LandfallGeofences.Backend(){
      public Task<Void> add(JSONObject row){return delayed.getTask();}
      public Task<Void> clear(){return Tasks.forResult(null);}
      public Task<Void> remove(String handle){removed.countDown();return Tasks.forResult(null);}
    };
    try {
      LandfallGeofences.register(context,registration(),()->true,state->{result.set(state);replied.countDown();},service);
      LandfallGeofences.clear(context,unused->{},service);
      delayed.setResult(null);
      assertTrue(replied.await(10,TimeUnit.SECONDS));assertTrue(removed.await(10,TimeUnit.SECONDS));
      assertEquals("UNAVAILABLE",result.get());assertNull(LandfallSecureHints.registration(context));
    }finally{LandfallGeofences.clear(context,unused->{},service);}
  }
}
