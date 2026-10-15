package com.voyagewright.landfall;
import android.app.Activity;
import org.json.JSONObject;
import java.util.function.Consumer;
/** Accepted Landfall API; all generic acquisition belongs to the inherited Sextant owner. */
final class LandfallHardware extends SextantHardware {
  LandfallHardware(Activity activity,Consumer<JSONObject> emit){super(activity,emit);}
}
