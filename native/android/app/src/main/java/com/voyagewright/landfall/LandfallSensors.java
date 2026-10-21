package com.voyagewright.landfall;

import android.app.Activity;
import org.json.JSONObject;
import java.util.function.Consumer;

/** Accepted Landfall API delegates to the canonical generic Sextant owner. */
final class LandfallSensors {
  private final SextantSensors sextant;
  LandfallSensors(Activity activity,Consumer<JSONObject> emit){this(new SextantSensors(activity,emit));}
  LandfallSensors(SextantSensors sextant){this.sextant=sextant;}
  boolean start(boolean foreground){return sextant.startLegacy(foreground);}
  void stop(){sextant.stopLegacy();}
}
