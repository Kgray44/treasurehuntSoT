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
  @Test public void originalCatalogLoadsAndRendersThroughFilament() throws Exception {
    ParallaxModelRenderingFixture.run(activity.getActivity());
  }
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
  @Test public void sharedDeliveryFixturesAndOriginalCatalog() throws Exception {
    android.content.res.AssetManager assets = InstrumentationRegistry.getInstrumentation().getContext().getAssets();
    JSONObject fixture;
    try(java.io.InputStream stream=assets.open("native-delivery-v2.json")) {
      fixture = new JSONObject(new String(stream.readAllBytes(),StandardCharsets.UTF_8));
      assertTrue(ParallaxDeliveryFixtures.run(fixture)>=13);
    }
    for(String asset : new String[]{"brass-compass", "treasure-chest"}) {
      try(java.io.InputStream stream=assets.open(asset+".glb")) {
        byte[] bytes=stream.readAllBytes(); assertTrue(ParallaxModelCache.selfContainedGlb(bytes));
        assertEquals(asset.equals("brass-compass") ? "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb" : "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f", ParallaxModelCache.digest(bytes));
      }
    }
    JSONObject golden = fixture.getJSONArray("sceneCases").getJSONObject(0).getJSONObject("scene");
    AtomicInteger interrupted = new AtomicInteger();
    InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
      try {
        ParallaxLocalRuntime runtime = new ParallaxLocalRuntime(activity.getActivity(), e -> interrupted.incrementAndGet(),
            "v2-fixture", 1, () -> {}, 2, golden.getJSONObject("identity").getString("versionChecksum"),
            golden.getJSONObject("identity").getString("instanceId"), "https://unconfigured.invalid");
        JSONObject commit = ParallaxDeliveryFixtures.stage(runtime.transfer, golden); assertNotNull(commit);
        java.lang.reflect.Field active = ParallaxLocalRuntime.class.getDeclaredField("active"); active.setAccessible(true); active.setBoolean(runtime, true);
        assertTrue(runtime.abortScene(new JSONObject(commit.toString()).put("generation", 2)));
        assertTrue(active.getBoolean(runtime)); assertEquals(0, interrupted.get());
        assertTrue(runtime.abortScene(commit)); assertFalse(active.getBoolean(runtime)); assertEquals(1, interrupted.get());
        assertTrue(runtime.abortScene(commit)); assertEquals(1, interrupted.get());
      } catch (Exception failure) { throw new AssertionError(failure); }
    });
  }
}
