package com.voyagewright.landfall;
import android.app.Activity;
import org.json.JSONObject;
import java.util.function.Consumer;
@androidx.annotation.RequiresApi(36)
final class LandfallRangingUwb extends SextantRangingUwb implements LandfallUwbDriver {
  LandfallRangingUwb(Activity activity,Consumer<JSONObject> emit){super(activity,emit);}
}
