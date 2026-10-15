package com.voyagewright.landfall;
import android.app.Activity;
import org.json.JSONObject;
import java.util.function.Consumer;
/** Accepted Landfall projection delegates to one version-gated Sextant ranging owner. */
interface LandfallUwbDriver extends SextantUwbDriver {
  static LandfallUwbDriver create(Activity activity,Consumer<JSONObject> emit){
    SextantUwbDriver owner=SextantUwbDriver.create(activity,emit);
    return new LandfallUwbDriver(){
      public JSONObject state(){return owner.state();}
      public void prepare(JSONObject payload,boolean foreground,Consumer<JSONObject> done){owner.prepare(payload,foreground,done);}
      public JSONObject start(JSONObject payload,boolean foreground){return owner.start(payload,foreground);}
      public void stop(){owner.stop();}
    };
  }
}
