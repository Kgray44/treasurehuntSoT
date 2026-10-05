package com.voyagewright.landfall;

import android.webkit.CookieManager;
import java.util.concurrent.atomic.AtomicBoolean;

/** Persist the existing WebView cookie jar without reading or extending credentials. */
final class LandfallCookiePersistence {
  private static final AtomicBoolean flushing = new AtomicBoolean();

  static void request() {
    if (!flushing.compareAndSet(false, true)) return;
    Thread worker = new Thread(() -> {
      try {
        // Android documents flush as blocking I/O. Keep it off the activity thread.
        CookieManager.getInstance().flush();
      } catch (RuntimeException ignored) {
        // A storage failure never grants a session or bypasses server authorization.
      } finally {
        flushing.set(false);
      }
    }, "landfall-cookie-persistence");
    worker.setDaemon(true);
    worker.start();
  }

  private LandfallCookiePersistence() {}
}
