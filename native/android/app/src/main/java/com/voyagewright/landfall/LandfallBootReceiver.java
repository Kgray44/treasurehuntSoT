package com.voyagewright.landfall;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicBoolean;

/** Re-register only encrypted, consented, unexpired wake regions after credential storage unlock. */
public final class LandfallBootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    if (!LandfallGeofences.permitted(context)) { LandfallSecureHints.clear(context); return; }
    JSONObject registration = LandfallSecureHints.registration(context);
    if (registration == null) return;
    PendingResult pending = goAsync();
    AtomicBoolean active = new AtomicBoolean(true);
    Handler handler = new Handler(Looper.getMainLooper());
    Runnable timeout = () -> { if (active.getAndSet(false)) pending.finish(); };
    handler.postDelayed(timeout, 8000);
    LandfallGeofences.register(context.getApplicationContext(), registration, active::get, state -> {
      if (active.getAndSet(false)) { handler.removeCallbacks(timeout); pending.finish(); }
    });
  }
}
