package com.voyagewright.landfall;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
import androidx.test.rule.ActivityTestRule;
import org.junit.Rule;
import android.app.Dialog;
import java.util.concurrent.atomic.AtomicInteger;
@RunWith(AndroidJUnit4.class)
public final class ParallaxTests {
  @Rule public ActivityTestRule<LandfallActivity> activity = new ActivityTestRule<>(LandfallActivity.class);
  @Test public void actualDialogBackAndProgrammaticDismissAreIdempotent() throws Exception {
    AtomicInteger events=new AtomicInteger(), owners=new AtomicInteger();
    for(int epoch=1;epoch<=2;epoch++) {
      final int run=epoch;
      java.util.concurrent.atomic.AtomicReference<ParallaxLocalRuntime> provider=new java.util.concurrent.atomic.AtomicReference<>();
      java.util.concurrent.atomic.AtomicReference<Dialog> ownedDialog=new java.util.concurrent.atomic.AtomicReference<>();
      InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
        try {
          LandfallActivity a=activity.getActivity();
          ParallaxLocalRuntime runtime=new ParallaxLocalRuntime(a,event->{assertEquals("INTERRUPTED",event.optString("state"));events.incrementAndGet();},"dialog-session-"+run,run,owners::incrementAndGet);
          Dialog dialog=new Dialog(a);runtime.bindDismissal(dialog);
          java.lang.reflect.Field active=ParallaxLocalRuntime.class.getDeclaredField("active"),owned=ParallaxLocalRuntime.class.getDeclaredField("dialog");active.setAccessible(true);owned.setAccessible(true);active.setBoolean(runtime,true);owned.set(runtime,dialog);
          provider.set(runtime);ownedDialog.set(dialog);dialog.show();assertTrue(dialog.isShowing());
          if(run==1)dialog.onBackPressed();else runtime.stop();
        } catch(Exception e) {throw new AssertionError(e);}
      });
      InstrumentationRegistry.getInstrumentation().waitForIdleSync();
      // This assertion precedes duplicate stop, proving the actual Dialog callback terminated Back.
      assertEquals(epoch,events.get());assertEquals(epoch,owners.get());assertFalse(ownedDialog.get().isShowing());
      InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{provider.get().stop();provider.get().stop();ownedDialog.get().dismiss();});
      InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    assertEquals(2,events.get());assertEquals(2,owners.get());
  }
  @Test public void sharedBoundaryFixtures() throws Exception {
    try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("native-boundary-v1.json")) {
      assertTrue(ParallaxBoundaryFixtures.run(new JSONObject(new String(stream.readAllBytes(),StandardCharsets.UTF_8)))>100);
    }
  }
}
