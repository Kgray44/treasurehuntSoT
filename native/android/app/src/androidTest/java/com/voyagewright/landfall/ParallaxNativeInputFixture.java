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
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.view.Gravity;
import android.view.ContextThemeWrapper;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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
  private static final class ReadyPoint {
    float x, y, screenX, screenY;
  }
  private static boolean pendingLayout(View view) {
    for (View current = view; current != null;
        current = current.getParent() instanceof View ? (View) current.getParent() : null)
      if (current.isLayoutRequested()) return true;
    return false;
  }
  /** Passive event observation: the same TextureView dispatch and production listener run exactly once. */
  private static final class ObservedTarget extends android.view.TextureView {
    View owner; int generation; String phase = "UNBOUND";
    ObservedTarget(Context context) { super(context); }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
      boolean handled = super.dispatchTouchEvent(event);
      if (event.getActionMasked() == MotionEvent.ACTION_DOWN || event.getActionMasked() == MotionEvent.ACTION_UP
          || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
        try {
          android.util.Log.i("NCL01Filament", "NATIVE_FIXTURE_TARGET_EVENT:" + new JSONObject()
              .put("phase", phase).put("ownerGeneration", generation).put("ownerAttached", owner != null && owner.isAttachedToWindow())
              .put("action", event.getActionMasked()).put("pointerCount", event.getPointerCount())
              .put("localX", event.getX()).put("localY", event.getY()).put("screenX", event.getRawX()).put("screenY", event.getRawY())
              .put("width", getWidth()).put("height", getHeight()).put("layoutPending", pendingLayout(this) || (owner != null && pendingLayout(owner)))
              .put("handled", handled));
        } catch (JSONException ignored) { /* Diagnostics cannot change event handling. */ }
      }
      return handled;
    }
  }
  static android.view.TextureView observedTarget(Context context) { return new ObservedTarget(context); }
  private static int nextOwnerGeneration(View target) { return ((ObservedTarget) target).generation + 1; }
  private static void observeOwner(View target, View owner, String phase, int generation) {
    assertTrue("The owned fixture observes its actual TextureView dispatch", target instanceof ObservedTarget);
    ObservedTarget observed = (ObservedTarget) target;
    assertEquals("Each replacement owns the next fixture generation", observed.generation + 1, generation);
    observed.owner = owner; observed.phase = phase; observed.generation = generation;
  }
  private static View inputOwner(View view) {
    if (view instanceof ObservedTarget) return ((ObservedTarget) view).owner;
    for (View current = view; current != null;
        current = current.getParent() instanceof View ? (View) current.getParent() : null)
      if (current instanceof ParallaxInteractionView) return current;
    return null;
  }
  private static void observePickRequest(View target, String expectedPhase, int expectedGeneration, float x, float y) {
    ObservedTarget observed = (ObservedTarget) target;
    try {
      android.util.Log.i("NCL01Filament", "NATIVE_FIXTURE_PICK_REQUEST:" + new JSONObject()
          .put("expectedPhase", expectedPhase).put("activePhase", observed.phase)
          .put("expectedOwnerGeneration", expectedGeneration).put("activeOwnerGeneration", observed.generation)
          .put("ownerAttached", observed.owner != null && observed.owner.isAttachedToWindow()).put("localX", x).put("localY", y));
    } catch (JSONException ignored) { /* This observes the existing synchronous production picker boundary. */ }
  }
  private static JSONObject inputReadiness(View view, boolean center, float x, float y,
      boolean preDrawObserved, long elapsedMs, ReadyPoint point) {
    View root = view.getRootView(), owner = inputOwner(view);
    Rect visible = new Rect(), display = new Rect(); int[] location = new int[2], rootLocation = new int[2];
    boolean shown = view.getLocalVisibleRect(visible);
    view.getLocationOnScreen(location); root.getLocationOnScreen(rootLocation); root.getWindowVisibleDisplayFrame(display);
    Rect window = new Rect(rootLocation[0], rootLocation[1], rootLocation[0] + root.getWidth(), rootLocation[1] + root.getHeight());
    point.x = center ? view.getWidth() / 2f : x; point.y = center ? view.getHeight() / 2f : y;
    point.screenX = location[0] + point.x; point.screenY = location[1] + point.y;
    boolean localPointInside = Float.isFinite(point.x) && Float.isFinite(point.y) && point.x >= 0 && point.y >= 0
        && point.x < view.getWidth() && point.y < view.getHeight() && visible.contains((int) point.x, (int) point.y);
    boolean fullyVisible = shown && visible.left == 0 && visible.top == 0
        && visible.width() == view.getWidth() && visible.height() == view.getHeight();
    boolean attached = view.isAttachedToWindow(), laidOut = view.isLaidOut(), focused = view.hasWindowFocus();
    boolean layoutPending = pendingLayout(view) || (owner != null && pendingLayout(owner));
    boolean ownerAttached = owner != null && owner.isAttachedToWindow() && owner.isLaidOut() && owner.isShown()
        && owner.getParent() != null && owner.getRootView() == root;
    boolean pointInsideWindow = window.contains((int) point.screenX, (int) point.screenY);
    boolean pointInsideDisplay = display.contains((int) point.screenX, (int) point.screenY);
    boolean actionable = !(view instanceof Button) || view.isClickable();
    boolean ready = preDrawObserved && attached && laidOut && focused && !layoutPending && view.isShown()
        && view.isEnabled() && actionable && ownerAttached && view.getWidth() > 0 && view.getHeight() > 0
        && fullyVisible && localPointInside && pointInsideWindow && pointInsideDisplay;
    try {
      return new JSONObject().put("ready", ready).put("elapsedMs", elapsedMs).put("preDrawObserved", preDrawObserved)
          .put("attached", attached).put("laidOut", laidOut).put("windowFocused", focused)
          .put("activityWindowFocused", view.getContext() instanceof Activity
              && ((Activity) view.getContext()).getWindow().getDecorView().hasWindowFocus())
          .put("windowFlags", root.getLayoutParams() instanceof WindowManager.LayoutParams
              ? ((WindowManager.LayoutParams) root.getLayoutParams()).flags : -1)
          .put("layoutPending", layoutPending)
          .put("shown", view.isShown()).put("enabled", view.isEnabled()).put("clickable", view.isClickable()).put("ownerAttached", ownerAttached)
          .put("ownerGeneration", view instanceof ObservedTarget ? ((ObservedTarget) view).generation : 0)
          .put("ownerPhase", view instanceof ObservedTarget ? ((ObservedTarget) view).phase : "CONTROL")
          .put("width", view.getWidth()).put("height", view.getHeight()).put("localX", point.x).put("localY", point.y)
          .put("screenX", point.screenX).put("screenY", point.screenY).put("visibleLeft", visible.left).put("visibleTop", visible.top)
          .put("visibleWidth", visible.width()).put("visibleHeight", visible.height()).put("windowLeft", window.left).put("windowTop", window.top)
          .put("windowWidth", window.width()).put("windowHeight", window.height()).put("displayLeft", display.left).put("displayTop", display.top)
          .put("displayWidth", display.width()).put("displayHeight", display.height()).put("fullyVisible", fullyVisible)
          .put("localPointInside", localPointInside).put("pointInsideWindow", pointInsideWindow).put("pointInsideDisplay", pointInsideDisplay);
    } catch (JSONException failure) { throw new AssertionError(failure); }
  }
  private static ReadyPoint awaitInputReadiness(View view, boolean center, float x, float y, long startedAt, String phase) {
    // New setup-only bounds observe layout/focus after hierarchy or status changes; no gesture is retried.
    // The existing GPU/input callback deadlines and the outer 180s instrumentation bound remain unchanged.
    long deadline = startedAt + 10000;
    CountDownLatch ready = new CountDownLatch(1); AtomicLong completedAt = new AtomicLong();
    AtomicBoolean preDrawObserved = new AtomicBoolean(); ReadyPoint point = new ReadyPoint();
    AtomicReference<JSONObject> initial = new AtomicReference<>(), observed = new AtomicReference<>();
    AtomicReference<ViewTreeObserver> observer = new AtomicReference<>();
    Runnable check = () -> {
      JSONObject sample = inputReadiness(view, center, x, y, preDrawObserved.get(), SystemClock.elapsedRealtime() - startedAt, point);
      observed.set(sample);
      if (sample.optBoolean("ready") && completedAt.compareAndSet(0, SystemClock.elapsedRealtime())) ready.countDown();
    };
    ViewTreeObserver.OnPreDrawListener draw = () -> { preDrawObserved.set(true); check.run(); return true; };
    ViewTreeObserver.OnWindowFocusChangeListener focus = hasFocus -> check.run();
    boolean signaled = false;
    try {
      onMain(() -> {
        initial.set(inputReadiness(view, center, x, y, false, SystemClock.elapsedRealtime() - startedAt, point));
        ViewTreeObserver owned = view.getRootView().getViewTreeObserver(); observer.set(owned);
        owned.addOnPreDrawListener(draw); owned.addOnWindowFocusChangeListener(focus);
        view.getRootView().postInvalidateOnAnimation();
      });
      long remaining = deadline - SystemClock.elapsedRealtime();
      if (remaining > 0) signaled = ready.await(remaining, TimeUnit.MILLISECONDS);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt(); throw new AssertionError("Input readiness interrupted", interrupted);
    } finally {
      onMain(() -> {
        ViewTreeObserver owned = observer.get();
        if (owned != null && !owned.isAlive()) owned = view.getRootView().getViewTreeObserver();
        if (owned != null && owned.isAlive()) { owned.removeOnPreDrawListener(draw); owned.removeOnWindowFocusChangeListener(focus); }
        observed.set(inputReadiness(view, center, x, y, preDrawObserved.get(), SystemClock.elapsedRealtime() - startedAt, point));
        try {
          String prefix = phase.equals("SOFTWARE_PROVIDER_RETURN") ? "SOFTWARE_PROVIDER_RETURN_READINESS:" : "NATIVE_FIXTURE_INPUT_READINESS:";
          android.util.Log.i("NCL01Filament", prefix + new JSONObject().put("schemaVersion", 1).put("phase", phase)
              .put("readinessBudgetMs", 10000).put("initial", initial.get()).put("final", observed.get())
              .put("completionElapsedMs", completedAt.get() == 0 ? -1 : completedAt.get() - startedAt));
        } catch (JSONException failure) { throw new AssertionError(failure); }
      });
    }
    if (phase.equals("SOFTWARE_PROVIDER_RETURN")) {
      assertTrue("Actual Return is laid out, focused and fully visible within its setup deadline", signaled);
      assertTrue("Return readiness completed before the single setup deadline", completedAt.get() <= deadline);
      assertTrue("Return is still touchable immediately before the one gesture", observed.get().optBoolean("ready"));
    } else {
      assertTrue("Actual input target and replacement owner became ready within the setup deadline", signaled);
      assertTrue("Input readiness completed before the single setup deadline", completedAt.get() <= deadline);
      assertTrue("The exact original input point remains visible immediately before the one action", observed.get().optBoolean("ready"));
    }
    return point;
  }
  private static void tap(View view, boolean center, float x, float y, long startedAt, String phase) {
    ReadyPoint point = awaitInputReadiness(view, center, x, y, startedAt, phase);
    long time = SystemClock.uptimeMillis();
    for (int action : new int[] {MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP}) {
      MotionEvent event = MotionEvent.obtain(time, SystemClock.uptimeMillis(), action, point.screenX, point.screenY, 0);
      event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
      try { InstrumentationRegistry.getInstrumentation().sendPointerSync(event); } finally { event.recycle(); }
    }
    InstrumentationRegistry.getInstrumentation().waitForIdleSync();
  }
  private static void tap(View view, float x, float y) { tap(view, false, x, y, SystemClock.elapsedRealtime(), "MOTION_EVENT"); }
  private static void tap(View view) { tap(view, true, 0, 0, SystemClock.elapsedRealtime(), "MOTION_EVENT"); }
  static void verifySoftwareProvider(Activity activity) {
    AtomicReference<ParallaxLocalRuntime> owner = new AtomicReference<>();
    AtomicReference<android.app.Dialog> dialog = new AtomicReference<>();
    AtomicInteger terminated = new AtomicInteger(); List<JSONObject> events = new ArrayList<>();
    long readinessStartedAt = SystemClock.elapsedRealtime();
    try {
      onMain(() -> {
        try {
          ParallaxLocalRuntime runtime = new ParallaxLocalRuntime(activity, events::add, "camera-free-controller", 1,
              terminated::incrementAndGet, 2, String.join("", Collections.nCopies(64, "a")), "fixture-instance",
              "http://127.0.0.1:3137", true);
          owner.set(runtime); assertTrue(runtime.softwareFixture); assertTrue(runtime.start());
          for (String name : new String[] {"session", "surface"}) {
            java.lang.reflect.Field field = ParallaxLocalRuntime.class.getDeclaredField(name); field.setAccessible(true);
            assertNull("Software fixture cannot acquire an ARCore session or camera surface", field.get(runtime));
          }
          java.lang.reflect.Field field = ParallaxLocalRuntime.class.getDeclaredField("dialog"); field.setAccessible(true);
          dialog.set((android.app.Dialog) field.get(runtime)); assertTrue(dialog.get().isShowing());
          assertTrue(runtime.placement("HORIZONTAL").isNull("pose"));
        } catch (Exception error) { throw new AssertionError(error); }
      });
      InstrumentationRegistry.getInstrumentation().waitForIdleSync();
      View root = dialog.get().getWindow().getDecorView();
      assertNotNull(text(root, "Device Lab: camera-free software fixture. No AR tracking or physical proof."));
      View escape = text(root, "Return to Guided View"); assertNotNull(escape);
      tap(escape, true, 0, 0, readinessStartedAt, "SOFTWARE_PROVIDER_RETURN");
      assertFalse("Actual Return dismisses the camera-free controller", dialog.get().isShowing());
      assertEquals(1, terminated.get());
      assertTrue("Software frames never publish world tracking or measured capabilities", events.stream().allMatch(event ->
          event.optString("type").equals("parallax-tracking") && event.optString("state").equals("INTERRUPTED")));
    } finally { onMain(() -> { if (owner.get() != null) owner.get().stop(); }); }
  }
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
        Button center = (Button) text(input, "Select object at center"); assertNotNull(center);
        assertEquals(2, largeText.getResources().getConfiguration().fontScale, 0.001f);
        assertTrue("The layout uses actual enlarged text metrics", escape.getTextSize() > 16 * density);
        Rect bounds = new Rect(0, 0, escape.getWidth(), escape.getHeight());
        viewport.offsetDescendantRectToMyCoords(escape, bounds);
        assertTrue("The full Return control remains within the declared large-text viewport", new Rect(0, 0, width, height).contains(bounds));
        assertTrue("Return remains enabled while inspection is pending", escape.isEnabled());
        assertFalse("Center selection remains blocked while inspection is pending", center.isEnabled());
        assertTrue("The center selection alternative keeps its accessible touch height", center.getHeight() >= Math.round(48 * density));
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
  private static void accessibilityClick(View view) {
    assertNotNull(view);
    awaitInputReadiness(view, true, 0, 0, SystemClock.elapsedRealtime(), "ACCESSIBILITY_ACTION_CLICK");
    onMain(() -> {
      AccessibilityNodeInfo node = view.createAccessibilityNodeInfo();
      assertTrue("The standard button exposes an enabled accessibility click", node.isEnabled() && node.isClickable()
          && node.getActionList().contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK));
      assertTrue("The Android accessibility action reaches the real control",
          view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null));
    });
    InstrumentationRegistry.getInstrumentation().waitForIdleSync();
  }

  static JSONObject accessibilityCenter(Activity activity, View target, ViewGroup host,
      ParallaxModelRenderer renderer, String assetId, String entityId, FramePump visible, FramePump hidden) throws Exception {
    AtomicReference<ParallaxInteractionView> controls = new AtomicReference<>();
    AtomicReference<String> selected = new AtomicReference<>();
    AtomicInteger requests = new AtomicInteger(), callbacks = new AtomicInteger(), emitted = new AtomicInteger(), returns = new AtomicInteger();
    List<JSONObject> intents = new ArrayList<>();
    ParallaxSceneTransfer identity = new ParallaxSceneTransfer("native-accessible-" + assetId, 1);
    Consumer<String> intent = action -> {
      try { intents.add(ParallaxLocalRuntime.interactionIntent(identity, selected.get(), action)); emitted.incrementAndGet(); }
      catch (JSONException error) { throw new AssertionError(error); }
    };
    try {
      onMain(() -> {
        int ownerGeneration = nextOwnerGeneration(target);
        ParallaxInteractionView input = new ParallaxInteractionView(activity, target,
            (x, y, result) -> {
              assertEquals(target.getWidth() / 2f, x, 0); assertEquals(target.getHeight() / 2f, y, 0);
              observePickRequest(target, "ACCESSIBLE_INPUT", ownerGeneration, x, y);
              requests.incrementAndGet(); renderer.pick(x, y, result);
            }, hit -> {
              selected.set(hit);
              controls.get().update("NORMAL", false, false, hit == null ? Collections.emptySet()
                  : new HashSet<>(Arrays.asList("PICK", "INSPECT", "PLACE")));
              if (hit != null) intent.accept("PICK");
              callbacks.incrementAndGet();
            }, intent, () -> { returns.incrementAndGet(); controls.get().close(); });
        controls.set(input); host.addView(input); observeOwner(target, input, "ACCESSIBLE_INPUT", ownerGeneration);
      });
      InstrumentationRegistry.getInstrumentation().waitForIdleSync();
      View center = text(controls.get(), "Select object at center"); assertNotNull(center);
      onMain(() -> {
        assertFalse("Loading blocks accessible selection", center.isEnabled());
        center.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null);
        controls.get().update("LOST", false, false, Collections.emptySet());
        assertFalse("Lost tracking blocks accessible selection", center.isEnabled());
        center.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null);
        controls.get().update("NORMAL", false, true, Collections.emptySet());
        assertFalse("Failed loading blocks accessible selection", center.isEnabled());
        center.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null);
        assertEquals("Blocked accessibility actions never request a GPU pick", 0, requests.get());
        controls.get().update("NORMAL", false, false, Collections.emptySet());
        try { hidden.frame(); } catch (Exception failure) { throw new AssertionError(failure); }
      });
      accessibilityClick(center);
      pump(hidden, () -> callbacks.get() == 1);
      assertNull("A hidden original model is a genuine background miss", selected.get());
      assertEquals("A miss cannot choose the first entity or emit PICK", 0, emitted.get());
      View inspect = text(controls.get(), "Inspect selected object"); assertNotNull(inspect);
      onMain(() -> {
        assertFalse("A hidden/background model cannot enable Inspect", inspect.isEnabled());
        inspect.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null);
        try { visible.frame(); } catch (Exception failure) { throw new AssertionError(failure); }
      });
      accessibilityClick(center);
      pump(visible, () -> callbacks.get() == 2);
      assertEquals("Accessible center selection resolves the actual original mesh owner", entityId, selected.get());
      assertEquals("Each enabled center action requests exactly one real GPU pick", 2, requests.get());
      assertEquals("Only the genuine hit emits one PICK", 1, emitted.get());
      accessibilityClick(inspect);
      assertEquals("Accessible Inspect emits one existing intent, with no duplicate PICK", 2, emitted.get());
      for (int i = 0; i < intents.size(); i++) {
        JSONObject event = intents.get(i);
        assertEquals(identity.sessionId, event.getString("sessionId")); assertEquals(1, event.getInt("epoch"));
        assertEquals(entityId, event.getString("entityId")); assertEquals("parallax-interaction", event.getString("type"));
        assertEquals(i == 0 ? "PICK" : "INSPECT", event.getString("interactionType")); assertEquals(5, event.length());
      }
      onMain(() -> assertFalse("Pending canonical recording blocks another center selection", center.isEnabled()));
      accessibilityClick(text(controls.get(), "Return to Guided View"));
      assertEquals("The standard accessible Return remains available", 1, returns.get());
      onMain(() -> center.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null));
      assertEquals("Closed controls cannot acquire another selection", 2, requests.get());
      assertEquals(2, intents.size());
      return new JSONObject().put("inputMethod", "ACCESSIBILITY_ACTION_CLICK").put("meshSelected", true)
          .put("hiddenBackgroundMissVerified", true).put("loadingAndTrackingGatesVerified", true)
          .put("manualReturnVerified", true).put("closedGuardVerified", true)
          .put("pickIntentCount", 1).put("inspectIntentCount", 1).put("intents", new JSONArray(intents));
    } finally {
      onMain(() -> { if (controls.get() != null) { controls.get().close(); host.removeView(controls.get()); } });
    }
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
      int ownerGeneration = nextOwnerGeneration(target);
      ParallaxInteractionView input = new ParallaxInteractionView(activity, target,
          (px, py, result) -> { observePickRequest(target, "MODEL_INPUT", ownerGeneration, px, py); requests.incrementAndGet(); renderer.pick(px, py, result); },
          hit -> {
            selected.set(hit);
            controls.get().update("NORMAL", false, false, hit == null ? Collections.emptySet()
                : new HashSet<>(Arrays.asList("PICK", "INSPECT", "PLACE")));
            if (hit != null) intent.accept("PICK");
          }, intent, () -> { returns.incrementAndGet(); controls.get().close(); });
      controls.set(input); host.addView(input); observeOwner(target, input, "MODEL_INPUT", ownerGeneration);
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
      int ownerGeneration = nextOwnerGeneration(target);
      ParallaxInteractionView input = new ParallaxInteractionView(activity, target,
          (px, py, result) -> { observePickRequest(target, "DELAYED_INPUT", ownerGeneration, px, py); delayed.set(result); }, hit -> lateSelections.incrementAndGet(), action -> {},
          () -> controls.get().close());
      controls.set(input); host.addView(input); observeOwner(target, input, "DELAYED_INPUT", ownerGeneration); input.update("NORMAL", false, false, Collections.emptySet());
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
