package com.voyagewright.landfall;

import android.os.Build;
import android.os.ParcelFileDescriptor;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class PowerTests {
  private void shell(String command) throws Exception {
    try(ParcelFileDescriptor descriptor=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);java.io.InputStream input=new ParcelFileDescriptor.AutoCloseInputStream(descriptor)){while(input.read()!=-1){} }
  }
  @Test public void actualEmulatorLowBatteryConstrainsSamplingAndRestoresFixture() throws Exception {
    // These controlled OS changes are legal only on the Device Lab virtual fixture.
    Assume.assumeTrue(Build.HARDWARE.equals("ranchu") || Build.HARDWARE.equals("goldfish"));
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      try {
        shell("dumpsys battery set ac 0");shell("dumpsys battery set usb 0");shell("dumpsys battery set level 10");
        scenario.onActivity(activity->{LandfallPower power=new LandfallPower(activity,()->{});assertTrue(power.lowPower());assertTrue(power.constrained());assertEquals(15000,power.interval(1000));try{assertEquals("READY",power.snapshot().getString("state"));}catch(Exception error){throw new AssertionError(error);}});
      } finally {shell("dumpsys battery reset");}
    }
  }
}
