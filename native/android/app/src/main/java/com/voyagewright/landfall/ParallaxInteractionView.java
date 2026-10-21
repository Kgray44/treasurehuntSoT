package com.voyagewright.landfall;

import android.content.Context;
import android.graphics.Color;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.*;
import java.util.function.Consumer;

/** Foreground presentation controls only. The canonical Player records every interaction outcome. */
final class ParallaxInteractionView extends LinearLayout {
  interface Picker { void pick(float x, float y, Consumer<String> result); }
  private final View target;
  private final TextView status;
  private final LinearLayout content;
  private final Button inspect, place, guided;
  private final Picker picker;
  private final Consumer<String> selected, action;
  private final Runnable returned;
  private Set<String> actions = Collections.emptySet();
  private String tracking = "INITIALIZING";
  private boolean loading = true, failed, awaiting, closed, down;
  private float downX, downY;
  private final int touchSlop;
  private long pickGeneration;

  ParallaxInteractionView(Context context, View target, Picker picker, Consumer<String> selected,
      Consumer<String> action, Runnable returned) {
    super(context);
    this.target = target; this.picker = picker; this.selected = selected;
    this.action = action; this.returned = returned;
    touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
    setOrientation(VERTICAL); setClickable(true);
    int padding = Math.round(16 * getResources().getDisplayMetrics().density);
    setPadding(padding, padding, padding, padding); setBackgroundColor(0xf20c202b);
    content = new LinearLayout(context); content.setOrientation(VERTICAL);
    ScrollView scroll = new ScrollView(context); scroll.addView(content);
    addView(scroll, new LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, 0, 1));
    status = new TextView(context); status.setTextColor(Color.WHITE); status.setTextSize(16);
    status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); content.addView(status);
    inspect = button(context, "Inspect selected object", "INSPECT");
    place = button(context, "Place selected object", "PLACE");
    guided = button(context, "Return to Guided View", "GUIDED");
    target.setContentDescription("Spatial objects. Tap a visible object to select it. Guided View is also available.");
    target.setOnTouchListener((view, event) -> touch(view, event));
    refresh();
  }

  private Button button(Context context, String label, String kind) {
    Button button = new Button(context); button.setText(label); button.setTextColor(Color.WHITE);
    button.setSingleLine(false); button.setHorizontallyScrolling(false); button.setTextSize(16);
    button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff16303b));
    button.setMinHeight(Math.round(48 * getResources().getDisplayMetrics().density));
    button.setOnClickListener(view -> {
      if (closed) return;
      if (kind.equals("GUIDED")) { returned.run(); return; }
      if (!ready() || !actions.contains(kind)) return;
      if (kind.equals("INSPECT")) { awaiting = true; pickGeneration++; refresh(); }
      action.accept(kind);
    });
    // The escape is outside the scrolling content and cannot be pushed below it.
    (kind.equals("GUIDED") ? this : content).addView(button,
        new LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
    return button;
  }

  @Override protected void onMeasure(int widthSpec, int heightSpec) {
    int available = MeasureSpec.getMode(heightSpec) == MeasureSpec.UNSPECIFIED
        ? getResources().getDisplayMetrics().heightPixels : MeasureSpec.getSize(heightSpec);
    int contentWidth = Math.max(0, MeasureSpec.getSize(widthSpec) - getPaddingLeft() - getPaddingRight());
    guided.measure(MeasureSpec.makeMeasureSpec(contentWidth, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED));
    int escapeHeight = guided.getMeasuredHeight() + getPaddingTop() + getPaddingBottom();
    int maximum = Math.min(available, Math.max(escapeHeight, Math.round(available * 0.65f)));
    super.onMeasure(widthSpec, MeasureSpec.makeMeasureSpec(maximum, MeasureSpec.AT_MOST));
  }

  private boolean ready() { return !closed && !loading && !failed && !awaiting && tracking.equals("NORMAL"); }

  private boolean touch(View view, MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
      down = ready(); downX = event.getX(); downY = event.getY(); return true;
    }
    if (event.getActionMasked() == MotionEvent.ACTION_CANCEL || event.getPointerCount() != 1) {
      down = false; return true;
    }
    if (event.getActionMasked() != MotionEvent.ACTION_UP) return true;
    float x = event.getX(), y = event.getY();
    boolean tap = down; down = false;
    if (!tap || !ready() || !Float.isFinite(x) || !Float.isFinite(y)
        || x < 0 || y < 0 || x >= target.getWidth() || y >= target.getHeight()
        || Math.hypot(x - downX, y - downY) > touchSlop) return true;
    long generation = ++pickGeneration;
    picker.pick(x, y, hit -> {
      if (generation == pickGeneration && ready()) selected.accept(hit);
    });
    view.performClick(); return true;
  }

  void update(String tracking, boolean loading, boolean failed, Set<String> actions) {
    if (closed) return;
    if (!tracking.equals(this.tracking) || loading != this.loading || failed != this.failed) {
      pickGeneration++; down = false;
    }
    this.tracking = tracking; this.loading = loading; this.failed = failed;
    this.actions = new HashSet<>(actions); refresh();
  }

  private void refresh() {
    inspect.setEnabled(ready() && actions.contains("INSPECT"));
    place.setEnabled(ready() && actions.contains("PLACE")); guided.setEnabled(!closed);
    status.setText(closed ? "Camera View closed."
        : awaiting ? "Returning to the Player to record this inspection. Guided View remains available."
        : failed ? "The object could not be loaded. Return to Guided View to continue with the same clue."
        : loading ? "Loading the released scene. Return to Guided View at any time."
        : tracking.equals("LIMITED_LOW_LIGHT") ? "More light is needed. Move slowly or return to Guided View."
        : !tracking.equals("NORMAL") ? "Finding the space again. Move slowly or return to Guided View."
        : actions.isEmpty() ? "Tap a visible object to select it. Guided View has the same clue."
        : "Object selected. Inspect it, or point at a suitable surface before choosing Place.");
  }

  void close() {
    if (closed) return;
    closed = true; down = false; pickGeneration++; target.setOnTouchListener(null); refresh();
  }
}
