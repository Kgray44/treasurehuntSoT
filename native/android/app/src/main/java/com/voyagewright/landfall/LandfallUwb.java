package com.voyagewright.landfall;
import android.app.Activity;
import org.json.JSONObject;
import java.util.function.Consumer;
@androidx.annotation.RequiresApi(34)
final class LandfallUwb extends SextantUwb implements LandfallUwbDriver {
  LandfallUwb(Activity activity,Consumer<JSONObject> emit){super(activity,emit);}
}
