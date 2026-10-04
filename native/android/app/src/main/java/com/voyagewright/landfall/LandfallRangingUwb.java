package com.voyagewright.landfall;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.ranging.*;
import android.ranging.raw.*;
import android.ranging.uwb.*;
import android.util.Base64;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.UUID;
import java.util.function.Consumer;

/** API-36 public backend; no Play services dependency and no canonical progression authority. */
@androidx.annotation.RequiresApi(36)
final class LandfallRangingUwb implements LandfallUwbDriver {
  private final Activity activity;
  private final Consumer<JSONObject> emit;
  private final RangingManager manager;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private RangingManager.RangingCapabilitiesCallback capabilitiesCallback;
  private UwbRangingCapabilities capabilities;
  private UwbAddress localAddress;
  private RangingDevice peer;
  private RangingSession session;
  private byte[] key;
  private int generation;
  private int channel;
  private int preamble;
  private boolean controller;
  private String status="UNAVAILABLE";
  private long expiresAt;
  private long lastReport;
  private final Runnable expire=()->{stop();stateEvent("EXPIRED");};

  LandfallRangingUwb(Activity activity,Consumer<JSONObject> emit){this.activity=activity;this.emit=emit;manager=activity.getSystemService(RangingManager.class);}
  private boolean supported(){return manager!=null && activity.getPackageManager().hasSystemFeature("android.hardware.uwb");}
  private JSONObject reply(String state){try{return new JSONObject().put("state",state);}catch(Exception ignored){return new JSONObject();}}
  public JSONObject state(){try{return reply(status).put("supported",supported()).put("sessionProtected",key!=null).put("peerVerified",false);}catch(Exception ignored){return reply("UNAVAILABLE");}}
  private void stateEvent(String state){status=state;try{emit.accept(new JSONObject().put("type","nearby-state").put("family","UWB").put("state",state));}catch(Exception ignored){}}
  private void diagnostic(String category){
    if(!BuildConfig.DEBUG)return;
    try(java.io.FileOutputStream output=activity.openFileOutput("landfall-ranging-prepare-debug.json",android.content.Context.MODE_PRIVATE)){
      output.write(new JSONObject().put("category",category).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }catch(Exception ignored){}
  }
  public void prepare(JSONObject payload,boolean foreground,Consumer<JSONObject> done){
    if(!foreground){diagnostic("NOT_FOREGROUND");done.accept(reply("UNAVAILABLE"));return;}
    if(!supported()){diagnostic("UNSUPPORTED");done.accept(reply("UNSUPPORTED"));return;}
    String role=payload.optString("role");
    if(!role.equals("CONTROLLER")&&!role.equals("CONTROLEE")){diagnostic("INVALID_ROLE");done.accept(reply("UNAVAILABLE"));return;}
    if(activity.checkSelfPermission("android.permission.RANGING")!=PackageManager.PERMISSION_GRANTED){diagnostic("PROMPTABLE");activity.requestPermissions(new String[]{"android.permission.RANGING"},45);done.accept(reply("PROMPTABLE"));return;}
    stop();controller=role.equals("CONTROLLER");status="INITIALIZING";
    final int attempt=generation;
    final boolean[] answered={false};
    diagnostic("CAPABILITIES_PENDING");
    Runnable timeout=()->{if(attempt==generation&&!answered[0]){diagnostic("CAPABILITIES_TIMEOUT");answered[0]=true;stop();done.accept(reply("UNAVAILABLE"));}};
    capabilitiesCallback=value->{
      if(attempt!=generation)return;
      if(answered[0]){
        if(value.getTechnologyAvailability().getOrDefault(RangingManager.UWB,RangingCapabilities.NOT_SUPPORTED)!=RangingCapabilities.ENABLED){stop();stateEvent("UNAVAILABLE");}
        return;
      }
      answered[0]=true;handler.removeCallbacks(timeout);
      UwbRangingCapabilities uwb=value.getUwbCapabilities();
      if(uwb==null || !uwb.isDistanceMeasurementSupported() || !uwb.getSupportedConfigIds().contains(UwbRangingParams.CONFIG_PROVISIONED_UNICAST_DS_TWR)){
        diagnostic(uwb==null?"CAPABILITIES_ABSENT":!uwb.isDistanceMeasurementSupported()?"DISTANCE_UNSUPPORTED":"PROVISIONED_CONFIG_UNSUPPORTED");stop();status="UNSUPPORTED";done.accept(reply(status));return;
      }
      if(value.getTechnologyAvailability().getOrDefault(RangingManager.UWB,RangingCapabilities.NOT_SUPPORTED)!=RangingCapabilities.ENABLED){diagnostic("TECHNOLOGY_DISABLED");stop();done.accept(reply("UNAVAILABLE"));return;}
      capabilities=uwb;
      channel=uwb.getSupportedChannels().contains(9)?9:uwb.getSupportedChannels().contains(5)?5:0;
      preamble=uwb.getSupportedPreambleIndexes().stream().filter(index->index>=9&&index<=12).findFirst().orElse(0);
      if(channel==0||preamble==0||!uwb.getSupportedRangingUpdateRates().contains(RawRangingDevice.UPDATE_RATE_INFREQUENT)){diagnostic(channel==0?"CHANNEL_UNSUPPORTED":preamble==0?"PREAMBLE_UNSUPPORTED":"INFREQUENT_RATE_UNSUPPORTED");stop();status="UNSUPPORTED";done.accept(reply(status));return;}
      localAddress=UwbAddress.createRandomShortAddress();status="READY";expiresAt=System.currentTimeMillis()+60000;handler.postDelayed(expire,60000);
      try{
        JSONObject result=reply("READY").put("role",role).put("address",Base64.encodeToString(localAddress.getAddressBytes(),Base64.NO_WRAP)).put("security","PROVISIONED_STS");
        if(controller)result.put("channel",channel).put("preamble",preamble);
        diagnostic("CAPABILITIES_READY");done.accept(result);
      }catch(Exception ignored){diagnostic("RESULT_FAILED");stop();done.accept(reply("UNAVAILABLE"));}
    };
    handler.postDelayed(timeout,10000);
    try{manager.registerCapabilitiesCallback(activity.getMainExecutor(),capabilitiesCallback);}catch(Exception ignored){diagnostic("CAPABILITIES_THROWN");handler.removeCallbacks(timeout);stop();done.accept(reply("UNAVAILABLE"));}
  }
  public JSONObject start(JSONObject payload,boolean foreground){
    if(!foreground||!status.equals("READY")||capabilities==null||localAddress==null||System.currentTimeMillis()>=expiresAt)return reply("UNAVAILABLE");
    byte[] parsedKey=null;
    try{
      LandfallUwbParameters.shape(payload);
      String identity=payload.getString("peerId");if(!identity.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")||!payload.getString("security").equals("PROVISIONED_STS"))throw new IllegalArgumentException();
      long sessionId=LandfallUwbParameters.integer(payload,"sessionId",1,Integer.MAX_VALUE),end=LandfallUwbParameters.integer(payload,"expiresAt",1,9007199254740991L),now=System.currentTimeMillis();
      if(sessionId<1||sessionId>Integer.MAX_VALUE||end<=now||end-now>300000)throw new IllegalArgumentException();
      int requestedChannel=(int)LandfallUwbParameters.integer(payload,"channel",5,9),requestedPreamble=(int)LandfallUwbParameters.integer(payload,"preamble",9,12);
      if(requestedChannel!=5&&requestedChannel!=9)throw new IllegalArgumentException();
      if(!capabilities.getSupportedChannels().contains(requestedChannel)||!capabilities.getSupportedPreambleIndexes().contains(requestedPreamble)||(controller&&(requestedChannel!=channel||requestedPreamble!=preamble)))throw new IllegalArgumentException();
      String keyText=payload.getString("sessionKey"),addressText=payload.getString("peerAddress");
      if(!keyText.matches("[A-Za-z0-9+/]{22}==")||!addressText.matches("[A-Za-z0-9+/]{3}="))throw new IllegalArgumentException();
      parsedKey=Base64.decode(keyText,Base64.NO_WRAP);byte[] address=Base64.decode(addressText,Base64.NO_WRAP);
      if(parsedKey.length!=16||address.length!=2||!Base64.encodeToString(parsedKey,Base64.NO_WRAP).equals(keyText)||!Base64.encodeToString(address,Base64.NO_WRAP).equals(addressText)||Arrays.equals(address,localAddress.getAddressBytes()))throw new IllegalArgumentException();
      key=parsedKey;expiresAt=end;peer=new RangingDevice.Builder().setUuid(UUID.randomUUID()).build();
      UwbRangingParams params=new UwbRangingParams.Builder((int)sessionId,UwbRangingParams.CONFIG_PROVISIONED_UNICAST_DS_TWR,localAddress,UwbAddress.fromBytes(address))
        .setSessionKeyInfo(key).setComplexChannel(new UwbComplexChannel.Builder().setChannel(requestedChannel).setPreambleIndex(requestedPreamble).build())
        .setRangingUpdateRate(RawRangingDevice.UPDATE_RATE_INFREQUENT).build();
      RawRangingDevice device=new RawRangingDevice.Builder().setRangingDevice(peer).setUwbRangingParams(params).build();
      RangingConfig config=controller?new RawInitiatorRangingConfig.Builder().addRawRangingDevice(device).build():new RawResponderRangingConfig.Builder().setRawRangingDevice(device).build();
      RangingPreference preference=new RangingPreference.Builder(controller?RangingPreference.DEVICE_ROLE_INITIATOR:RangingPreference.DEVICE_ROLE_RESPONDER,config)
        .setSessionConfig(new SessionConfig.Builder().setAngleOfArrivalNeeded(false).setRangingMeasurementsLimit(500)
          .setDataNotificationConfig(new DataNotificationConfig.Builder().setNotificationConfigType(DataNotificationConfig.NOTIFICATION_CONFIG_ENABLE).build()).build()).build();
      final int attempt=generation;
      session=manager.createRangingSession(activity.getMainExecutor(),new RangingSession.Callback(){
        private boolean current(){return attempt==generation&&session!=null;}
        public void onOpened(){}
        public void onStarted(RangingDevice device,int technology){if(current()&&device.equals(peer)&&technology==RangingManager.UWB)stateEvent("READY");}
        public void onOpenFailed(int reason){if(current()){stop();stateEvent("UNAVAILABLE");}}
        public void onClosed(int reason){if(current()){stop();stateEvent("UNAVAILABLE");}}
        public void onStopped(RangingDevice device,int technology){if(current()){stop();stateEvent("UNAVAILABLE");}}
        public void onResults(RangingDevice device,RangingData data){
          if(!current()||!device.equals(peer)||data.getRangingTechnology()!=RangingManager.UWB||System.currentTimeMillis()>=expiresAt)return;
          long age=SystemClock.elapsedRealtime()-data.getTimestampMillis(),now=System.currentTimeMillis();
          RangingMeasurement measurement=data.getDistance();if(age<0||age>10000||now-lastReport<1000||measurement==null)return;
          double distance=measurement.getMeasurement();if(!Double.isFinite(distance)||distance<0||distance>1000)return;
          lastReport=now;
          try{emit.accept(new JSONObject().put("type","nearby").put("family","UWB").put("id",UUID.randomUUID().toString()).put("peerId",identity).put("observedAt",now-age).put("distanceMeters",distance).put("uncertaintyMeters",JSONObject.NULL).put("authenticated",false).put("sessionProtected",true));}catch(Exception ignored){}
        }
      });
      status="INITIALIZING";session.start(preference);handler.removeCallbacks(expire);handler.postDelayed(expire,end-now);return reply("INITIALIZING");
    }catch(Exception ignored){if(parsedKey!=null)Arrays.fill(parsedKey,(byte)0);stop();return reply("UNAVAILABLE");}
  }
  public void stop(){
    generation++;handler.removeCallbacksAndMessages(null);
    RangingSession old=session;session=null;peer=null;localAddress=null;capabilities=null;expiresAt=0;lastReport=0;status="UNAVAILABLE";
    if(capabilitiesCallback!=null){try{manager.unregisterCapabilitiesCallback(capabilitiesCallback);}catch(Exception ignored){}capabilitiesCallback=null;}
    if(old!=null){try{old.stop();}catch(Exception ignored){}try{old.close();}catch(Exception ignored){}}
    if(key!=null){Arrays.fill(key,(byte)0);key=null;}
  }
}
