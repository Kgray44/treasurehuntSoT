package com.voyagewright.landfall;

import android.os.Build;
import android.os.Debug;
import android.os.Process;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Native adapter cost only; no sensor values, identities, locations or physical energy inference. */
@RunWith(AndroidJUnit4.class)
public final class SensorPerformanceTests {
  @Test public void actualSensorRegistrationFitsPreliminaryCpuAndMemoryBudgetsAndStops() throws Exception {
    Assume.assumeTrue(Build.HARDWARE.equals("ranchu") || Build.HARDWARE.equals("goldfish"));
    assertEquals("Performance fixtures refuse a configured deployment origin","",BuildConfig.LANDFALL_ORIGIN);
    // The ordinary unconfigured Activity displays readable setup text. No remote
    // origin, private Journal, location provider or first-party service is opened.
    try(ActivityScenario<LandfallActivity> scenario=ActivityScenario.launch(LandfallActivity.class)) {
      AtomicInteger callbacks=new AtomicInteger();
      AtomicReference<LandfallSensors> owned=new AtomicReference<>();
      scenario.onActivity(activity->owned.set(new LandfallSensors(activity,event->callbacks.incrementAndGet())));
      JSONArray samples=new JSONArray();
      try {
        Thread.sleep(1000);
        for(int index=0;index<3;index++) {
          long baselineStart=SystemClock.elapsedRealtime(),baselineCpu=Process.getElapsedCpuTime();
          Thread.sleep(1000);
          long baselineElapsed=SystemClock.elapsedRealtime()-baselineStart,baselineCpuMs=Process.getElapsedCpuTime()-baselineCpu;
          long baselinePss=Debug.getPss();
          scenario.onActivity(activity->assertTrue("The owned emulator must expose a real native sensor subscription",owned.get().start(true)));
          long started=SystemClock.elapsedRealtime(),cpuStarted=Process.getElapsedCpuTime();
          int callbacksBefore=callbacks.get();
          Thread.sleep(2000);
          long elapsed=SystemClock.elapsedRealtime()-started,cpuMs=Process.getElapsedCpuTime()-cpuStarted;
          long activePss=Debug.getPss();
          scenario.onActivity(activity->owned.get().stop());
          int stopped=callbacks.get();
          Thread.sleep(350);
          assertEquals("A stopped native subscription must emit no late observations",stopped,callbacks.get());
          assertTrue(baselineElapsed>=1000 && elapsed>=2000);
          assertTrue("Preliminary whole-process sensor interval CPU budget",cpuMs<=1000);
          assertTrue("Preliminary instrumentation-process PSS budget",activePss>0 && activePss<=262144);
          assertTrue("Preliminary incremental PSS budget",activePss-baselinePss<=32768);
          samples.put(new JSONObject().put("baselineElapsedMs",baselineElapsed).put("baselineCpuMs",baselineCpuMs)
            .put("baselinePssKiB",baselinePss).put("activeElapsedMs",elapsed).put("activeCpuMs",cpuMs)
            .put("activePssKiB",activePss).put("pssDeltaKiB",activePss-baselinePss)
            .put("callbacks",stopped-callbacksBefore).put("stopVerified",true));
        }
        JSONObject result=new JSONObject().put("version",1).put("measurementClass","NATIVE_SENSOR_ADAPTER_INSTRUMENTATION")
          .put("api",Build.VERSION.SDK_INT).put("sampleCount",3).put("physicalEnergyProven",false)
          .put("budgets",new JSONObject().put("activeCpuMsPerTwoSecondInterval",1000).put("processPssKiB",262144).put("incrementalPssKiB",32768))
          .put("samples",samples);
        try(java.io.FileOutputStream output=InstrumentationRegistry.getInstrumentation().getTargetContext()
            .openFileOutput("landfall-sensor-performance.json",android.content.Context.MODE_PRIVATE)) {
          output.write(result.toString().getBytes(StandardCharsets.UTF_8));
        }
      } finally { scenario.onActivity(activity->owned.get().stop()); }
    }
  }
}
