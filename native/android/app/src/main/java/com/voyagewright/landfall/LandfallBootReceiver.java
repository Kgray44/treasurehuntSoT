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
  private static void diagnostic(Context context,String state){
    if(!BuildConfig.DEBUG)return;
    try(java.io.FileOutputStream output=context.openFileOutput("landfall-boot-region-debug.json",Context.MODE_PRIVATE)){
      output.write(new JSONObject().put("state",state).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }catch(Exception ignored){}
  }
  @Override public void onReceive(Context context, Intent intent) {
    if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    diagnostic(context,"BOOT_RECEIVED");
    if (!LandfallGeofences.permitted(context)) { LandfallSecureHints.clear(context); diagnostic(context,"PERMISSION_REQUIRED"); return; }
    JSONObject registration = LandfallSecureHints.registration(context);
    if (registration == null) {diagnostic(context,"NO_ACTIVE_REGION");return;}
    PendingResult pending = goAsync();
    AtomicBoolean active = new AtomicBoolean(true);
    Handler handler = new Handler(Looper.getMainLooper());
    Runnable timeout = () -> { if (active.getAndSet(false)) {diagnostic(context,"TIMED_OUT");pending.finish();} };
    handler.postDelayed(timeout, 8000);
    LandfallGeofences.register(context.getApplicationContext(), registration, active::get, state -> {
      if (active.getAndSet(false)) { diagnostic(context,state);handler.removeCallbacks(timeout); pending.finish(); }
    });
  }
}
