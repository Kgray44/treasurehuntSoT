package com.voyagewright.landfall;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.UUID;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class HardwareTests {
  @Test public void inactiveMalformedAndStoppedOptionalScansAcquireNothing() {
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      scenario.onActivity(activity -> {
        LandfallHardware hardware=new LandfallHardware(activity,event -> {throw new AssertionError("No unsolicited radio or camera callback");});
        String scanId=UUID.randomUUID().toString();
        try {
          assertEquals("UNAVAILABLE",hardware.startBle(false,scanId));
          assertEquals("UNAVAILABLE",hardware.startBle(true,"invalid"));
          assertEquals("UNAVAILABLE",hardware.startNfc(false,scanId));
          assertEquals("UNAVAILABLE",hardware.startQr(false,scanId,null));
          hardware.stopBle(scanId);hardware.stopInteractions();hardware.stop();hardware.stop();
        }finally{hardware.stop();}
      });
    }
  }
}
