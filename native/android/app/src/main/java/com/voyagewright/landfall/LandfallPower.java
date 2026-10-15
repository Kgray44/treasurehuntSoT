package com.voyagewright.landfall;
import android.app.Activity;
import org.json.JSONObject;
import java.util.function.Consumer;
/** Accepted Landfall API; all generic acquisition belongs to the inherited Sextant owner. */
final class LandfallPower extends SextantPower {
  LandfallPower(Activity activity,Runnable changed){super(activity,changed);}
}
