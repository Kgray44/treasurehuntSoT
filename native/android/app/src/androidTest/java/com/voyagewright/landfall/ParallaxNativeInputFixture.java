package com.voyagewright.landfall;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Gravity;
import android.view.ContextThemeWrapper;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.*;
import java.util.concurrent.atomic.*;
import java.util.function.*;
import org.json.*;
import static org.junit.Assert.*;

/** Actual owned-window input -> production controls -> actual mesh pick, without acquiring ARCore/camera. */
final class ParallaxNativeInputFixture {
  interface FramePump { void frame() throws Exception; }
  private static void onMain(Runnable action) {
    AtomicReference<Throwable> failure = new AtomicReference<>();
    InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
      try { action.run(); } catch (Throwable error) { failure.set(error); }
    });
    if (failure.get() != null) throw new AssertionError("Owned native input fixture failed", failure.get());
  }
  private static View text(View root, String label) {
    if (root instanceof TextView && ((TextView) root).getText().toString().equals(label)) return root;
    if (root instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) root).getChildCount(); i++) {
      View found = text(((ViewGroup) root).getChildAt(i), label); if (found != null) return found;
    }
    return null;
  }
  private static void tap(View view, float x, float y) {
    int[] location = new int[2]; onMain(() -> view.getLocationOnScreen(location));
    long time = SystemClock.uptimeMillis();
    for (int action : new int[] {MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP}) {
      MotionEvent event = MotionEvent.obtain(time, SystemClock.uptimeMillis(), action, location[0] + x, location[1] + y, 0);
      event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
      try { InstrumentationRegistry.getInstrumentation().sendPointerSync(event); } finally { event.recycle(); }
    }
    InstrumentationRegistry.getInstrumentation().waitForIdleSync();
  }
  private static void tap(View view) { tap(view, view.getWidth() / 2f, view.getHeight() / 2f); }
  static void verifyLargeTextEscapeLayout(Activity activity) {
    onMain(() -> {
      Configuration configuration = new Configuration(activity.getResources().getConfiguration());
      configuration.fontScale = 2;
      Context largeText = new ContextThemeWrapper(activity.createConfigurationContext(configuration), activity.getTheme());
      float density = largeText.getResources().getDisplayMetrics().density;
      for (int[] dp : new int[][] {{390, 844}, {844, 390}}) {
        // Real Android measurement/layout at two declared viewport aspect ratios;
        // this scoped context changes no device setting and claims no OS rotation.
        FrameLayout viewport = new FrameLayout(largeText);
        ParallaxInteractionView input = new ParallaxInteractionView(largeText, new View(largeText),
            (x, y, result) -> {}, id -> {}, action -> {}, () -> {});
        viewport.addView(input, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));
        input.update("NORMAL", false, false, new HashSet<>(Arrays.asList("INSPECT", "PLACE")));
        Button inspect = (Button) text(input, "Inspect selected object"); inspect.performClick();
        int width = Math.round(dp[0] * density), height = Math.round(dp[1] * density);
        viewport.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        viewport.layout(0, 0, width, height);
        Button escape = (Button) text(input, "Return to Guided View"); assertNotNull(escape);
        assertEquals(2, largeText.getResources().getConfiguration().fontScale, 0.001f);
        assertTrue("The layout uses actual enlarged text metrics", escape.getTextSize() > 16 * density);
        Rect bounds = new Rect(0, 0, escape.getWidth(), escape.getHeight());
        viewport.offsetDescendantRectToMyCoords(escape, bounds);
        assertTrue("The full Return control remains within the declared large-text viewport", new Rect(0, 0, width, height).contains(bounds));
        assertTrue("Return remains enabled while inspection is pending", escape.isEnabled());
        assertTrue("Return keeps its accessible touch height", escape.getHeight() >= Math.round(48 * density));
        assertNotNull(escape.getLayout());
        assertTrue("The entire large-text Return label is laid out without vertical clipping",
            escape.getHeight() >= escape.getLayout().getHeight() + escape.getCompoundPaddingTop() + escape.getCompoundPaddingBottom());
        for (int line = 0; line < escape.getLayout().getLineCount(); line++)
          assertEquals("The escape label is never ellipsized", 0, escape.getLayout().getEllipsisCount(line));
        ScrollView scroll = (ScrollView) input.getChildAt(0);
        Rect scrollBounds = new Rect(0, 0, scroll.getWidth(), scroll.getHeight());
        viewport.offsetDescendantRectToMyCoords(scroll, scrollBounds);
        assertTrue("Scrolling guidance cannot overlap the fixed escape", scrollBounds.bottom <= bounds.top);
        assertTrue("Guidance is constrained to the available viewport", scrollBounds.top >= 0 && scrollBounds.bottom <= height);
        input.close();
      }
    });
  }
  private static void pump(FramePump frame, BooleanSupplier done) throws Exception {
    long deadline = SystemClock.elapsedRealtime() + 10000;
    while (!done.getAsBoolean() && SystemClock.elapsedRealtime() < deadline) {
      AtomicReference<Exception> failure = new AtomicReference<>();
      onMain(() -> { try { frame.frame(); } catch (Exception error) { failure.set(error); } });
      if (failure.get() != null) throw failure.get();
      if (!done.getAsBoolean()) SystemClock.sleep(20);
    }
    assertTrue("Owned native input completed within its separate ten second budget", done.getAsBoolean());
    assertTrue("Native input budget is not extended by a slow frame", SystemClock.elapsedRealtime() <= deadline);
  }
  static JSONObject run(Activity activity, View target, ViewGroup host, ParallaxModelRenderer renderer,
      JSONObject frame, String assetId, String entityId, FramePump pump) throws Exception {
    JSONObject point = frame.getJSONArray("picks").getJSONObject(0);
    int x = point.getInt("x"), y = point.getInt("y");
    AtomicInteger requests = new AtomicInteger(), returns = new AtomicInteger(), emitted = new AtomicInteger();
    AtomicReference<String> selected = new AtomicReference<>();
    AtomicReference<ParallaxInteractionView> controls = new AtomicReference<>();
    List<JSONObject> intents = new ArrayList<>();
    ParallaxSceneTransfer identity = new ParallaxSceneTransfer("native-input-" + assetId, 1);
    Consumer<String> intent = action -> {
      try { intents.add(ParallaxLocalRuntime.interactionIntent(identity, selected.get(), action)); emitted.incrementAndGet(); }
      catch (JSONException error) { throw new AssertionError(error); }
    };
    try {
    onMain(() -> {
      ParallaxInteractionView input = new ParallaxInteractionView(activity, target,
          (px, py, result) -> { requests.incrementAndGet(); renderer.pick(px, py, result); },
          hit -> {
            selected.set(hit);
            controls.get().update("NORMAL", false, false, hit == null ? Collections.emptySet()
                : new HashSet<>(Arrays.asList("PICK", "INSPECT", "PLACE")));
            if (hit != null) intent.accept("PICK");
          }, intent, () -> { returns.incrementAndGet(); controls.get().close(); });
      controls.set(input); host.addView(input);
    });
    InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    tap(target, x, y); assertEquals("Loading cannot acquire a selection", 0, requests.get());
    onMain(() -> controls.get().update("LOST", false, false, Collections.emptySet()));
    tap(target, x, y); assertEquals("Lost tracking cannot acquire a selection", 0, requests.get());
    onMain(() -> controls.get().update("NORMAL", false, true, Collections.emptySet()));
    tap(target, x, y); assertEquals("Failed loading cannot acquire a selection", 0, requests.get());
    onMain(() -> controls.get().update("NORMAL", false, false, Collections.emptySet()));
    tap(target, x, y);
    pump(pump, () -> emitted.get() == 1);
    assertEquals("Actual MotionEvent resolves the original model owner", entityId, selected.get());
    assertEquals(1, requests.get()); assertEquals(1, intents.size());
    View inspect = text(controls.get(), "Inspect selected object"); assertNotNull(inspect);
    Set<String> selectedActions = new HashSet<>(Arrays.asList("PICK", "INSPECT", "PLACE"));
    onMain(() -> {
      controls.get().update("NORMAL", true, false, selectedActions);
      assertFalse("A pending same-scene redraw temporarily blocks actions", inspect.isEnabled());
      controls.get().update("NORMAL", false, false, selectedActions);
      assertTrue("The chosen entity can still be inspected after the PICK redraw", inspect.isEnabled());
    });
    tap(inspect);
    assertEquals("Actual Inspect button emitted the existing native intent", 2, intents.size());
    onMain(() -> {
      controls.get().update("NORMAL", true, false, selectedActions);
      controls.get().update("NORMAL", false, false, selectedActions);
      assertFalse("Repeated Inspect waits for the canonical outcome", inspect.isEnabled());
      assertNotNull("No local completed content replaces canonical recording", text(controls.get(),
          "Returning to the Player to record this inspection. Guided View remains available."));
      assertTrue("Native status remains accessible", text(controls.get(),
          "Returning to the Player to record this inspection. Guided View remains available.")
          .getAccessibilityLiveRegion() == View.ACCESSIBILITY_LIVE_REGION_POLITE);
    });
    for (int i = 0; i < intents.size(); i++) {
      JSONObject event = intents.get(i);
      assertEquals(identity.sessionId, event.getString("sessionId")); assertEquals(1, event.getInt("epoch"));
      assertEquals(entityId, event.getString("entityId")); assertEquals("parallax-interaction", event.getString("type"));
      assertEquals(i == 0 ? "PICK" : "INSPECT", event.getString("interactionType")); assertEquals(5, event.length());
    }
    View guided = text(controls.get(), "Return to Guided View"); assertNotNull(guided); tap(guided);
    assertEquals("Manual return remains available while recording is pending", 1, returns.get());
    onMain(() -> { controls.get().close(); host.removeView(controls.get()); });

    // Controlled delayed callback proves cancellation even if the backend completes after Return.
    AtomicReference<Consumer<String>> delayed = new AtomicReference<>(); AtomicInteger lateSelections = new AtomicInteger();
    onMain(() -> {
      ParallaxInteractionView input = new ParallaxInteractionView(activity, target,
          (px, py, result) -> delayed.set(result), hit -> lateSelections.incrementAndGet(), action -> {},
          () -> controls.get().close());
      controls.set(input); host.addView(input); input.update("NORMAL", false, false, Collections.emptySet());
    });
    InstrumentationRegistry.getInstrumentation().waitForIdleSync(); tap(target, x, y); assertNotNull(delayed.get());
    Consumer<String> beforeTrackingLoss = delayed.get();
    onMain(() -> {
      controls.get().update("LOST", false, false, Collections.emptySet());
      controls.get().update("NORMAL", false, false, Collections.emptySet());
      beforeTrackingLoss.accept(entityId);
    });
    assertEquals("A callback from before tracking loss cannot select after recovery", 0, lateSelections.get());
    tap(target, x, y); assertNotSame("A fresh gesture owns a new request", beforeTrackingLoss, delayed.get());
    tap(text(controls.get(), "Return to Guided View"));
    onMain(() -> { delayed.get().accept(entityId); controls.get().close(); host.removeView(controls.get()); });
    assertEquals("A completed GPU callback cannot select after Return", 0, lateSelections.get());
    return new JSONObject().put("assetId", assetId).put("entityId", entityId)
        .put("meshTapObserved", true).put("pickIntentCount", 1).put("inspectIntentCount", 1)
        .put("inspectLocalSuccessShown", false).put("inspectPendingGuidanceShown", true)
        .put("manualReturnVerified", true).put("loadingAndTrackingGatesVerified", true)
        .put("latePickAfterCloseRejected", true).put("intents", new JSONArray(intents));
    } finally {
      onMain(() -> { if (controls.get() != null) { controls.get().close(); host.removeView(controls.get()); } });
    }
  }
}
