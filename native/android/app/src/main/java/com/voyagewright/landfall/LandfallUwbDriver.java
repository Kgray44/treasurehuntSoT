package com.voyagewright.landfall;

import android.app.Activity;
import android.os.Build;
import androidx.annotation.RequiresApi;
import org.json.JSONObject;
import java.util.function.Consumer;

/** Keep optional API-34 radio classes out of the older companion's initialization path. */
interface LandfallUwbDriver {
  JSONObject state();
  void prepare(JSONObject payload, boolean foreground, Consumer<JSONObject> done);
  JSONObject start(JSONObject payload, boolean foreground);
  void stop();

  static LandfallUwbDriver create(Activity activity, Consumer<JSONObject> emit) {
    if(Build.VERSION.SDK_INT>=34 && activity.getPackageManager().hasSystemFeature("android.hardware.uwb"))
      return Api34.create(activity,emit);
    return new LandfallUwbDriver() {
      private JSONObject unsupported() {
        try{return new JSONObject().put("state","UNSUPPORTED").put("supported",false).put("sessionProtected",false).put("peerVerified",false);}catch(Exception ignored){return new JSONObject();}
      }
      public JSONObject state(){return unsupported();}
      public void prepare(JSONObject payload,boolean foreground,Consumer<JSONObject> done){done.accept(unsupported());}
      public JSONObject start(JSONObject payload,boolean foreground){return unsupported();}
      public void stop(){}
    };
  }
  @RequiresApi(34)
  final class Api34 {
    private Api34(){}
    static LandfallUwbDriver create(Activity activity,Consumer<JSONObject> emit){return new LandfallUwb(activity,emit);}
  }
}
