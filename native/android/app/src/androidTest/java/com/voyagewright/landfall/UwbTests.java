package com.voyagewright.landfall;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class UwbTests {
  @Test public void pairingRejectsCoercionAndAdditionalIdentityClaims() throws Exception {
    JSONObject payload=new JSONObject().put("peerId","peer-1").put("sessionId",1).put("security","PROVISIONED_STS").put("sessionKey","AAAAAAAAAAAAAAAAAAAAAA==").put("peerAddress","AQI=").put("channel",9).put("preamble",10).put("expiresAt",System.currentTimeMillis()+30000);
    LandfallUwbParameters.shape(payload);
    assertEquals(1,LandfallUwbParameters.integer(payload,"sessionId",1,Integer.MAX_VALUE));
    for(Object bad:new Object[]{"1",true,0,-1,1.5,2147483648L,JSONObject.NULL}){
      payload.put("sessionId",bad);
      try{LandfallUwbParameters.integer(payload,"sessionId",1,Integer.MAX_VALUE);fail("Hostile numeric coercion accepted");}catch(IllegalArgumentException expected){}
    }
    payload.put("sessionId",1).put("authenticated",true);
    try{LandfallUwbParameters.shape(payload);fail("Identity claim accepted");}catch(IllegalArgumentException expected){}
  }
  @Test public void optionalRadioHasNoSessionWithoutForegroundPreparation() {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      scenario.onActivity(activity -> {
        LandfallUwbDriver driver=LandfallUwbDriver.create(activity,event -> {throw new AssertionError("No unrequested radio observation");});
        try {
          assertFalse(driver.state().optBoolean("sessionProtected"));
          assertFalse(driver.state().optBoolean("peerVerified"));
          AtomicReference<JSONObject> reply=new AtomicReference<>();
          driver.prepare(new JSONObject().put("role","CONTROLLER"),false,reply::set);
          assertNotNull(reply.get());
          assertTrue(reply.get().getString("state").equals("UNAVAILABLE") || reply.get().getString("state").equals("UNSUPPORTED"));
          assertFalse(driver.start(new JSONObject(),true).getString("state").equals("READY"));
          driver.stop();driver.stop();
          assertFalse(driver.state().optBoolean("sessionProtected"));
        }catch(Exception error){throw new AssertionError(error);}finally{driver.stop();}
      });
    }
  }
}
