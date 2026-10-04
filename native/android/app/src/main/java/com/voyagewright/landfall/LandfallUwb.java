package com.voyagewright.landfall;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import androidx.core.uwb.*;
import androidx.core.uwb.rxjava3.UwbManagerRx;
import androidx.core.uwb.rxjava3.UwbClientSessionScopeRx;
import io.reactivex.rxjava3.disposables.Disposable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/** Optional bounded foreground ranging. STS protects a session, not Chronicle peer identity. */
@androidx.annotation.RequiresApi(34)
final class LandfallUwb implements LandfallUwbDriver {
  private final Activity activity;
  private final Consumer<JSONObject> emit;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private UwbManager manager;
  private UwbClientSessionScope scope;
  private Disposable operation;
  private byte[] key;
  private int generation;
  private boolean controller;
  private String status = "UNAVAILABLE";
  private long lastReport;
  private final Runnable expire = () -> { stop(); stateEvent("EXPIRED"); };

  LandfallUwb(Activity activity, Consumer<JSONObject> emit) { this.activity=activity;this.emit=emit; }
  public JSONObject state() {
    try { return new JSONObject().put("state",status).put("supported",supported()).put("sessionProtected",key!=null).put("peerVerified",false); }
    catch(Exception ignored) { return new JSONObject(); }
  }
  private boolean supported() { return Build.VERSION.SDK_INT>=34 && activity.getPackageManager().hasSystemFeature("android.hardware.uwb"); }
  private JSONObject reply(String value) { try{return new JSONObject().put("state",value);}catch(Exception ignored){return new JSONObject();} }
  private void stateEvent(String value) {
    status=value;
    try { emit.accept(new JSONObject().put("type","nearby-state").put("family","UWB").put("state",value)); }catch(Exception ignored){}
  }
  public void prepare(JSONObject payload, boolean foreground, Consumer<JSONObject> done) {
    if(!foreground){done.accept(reply("UNAVAILABLE"));return;}
    if(!supported()){done.accept(reply("UNSUPPORTED"));return;}
    String role=payload.optString("role");
    if(!role.equals("CONTROLLER")&&!role.equals("CONTROLEE")){done.accept(reply("UNAVAILABLE"));return;}
    if(activity.checkSelfPermission("android.permission.UWB_RANGING")!=PackageManager.PERMISSION_GRANTED){
      activity.requestPermissions(new String[]{"android.permission.UWB_RANGING"},44);
      done.accept(reply("PROMPTABLE"));return;
    }
    stop(); controller=role.equals("CONTROLLER"); status="INITIALIZING";
    int attempt=generation;
    try {
      if(manager==null)manager=UwbManager.createInstance(activity.getApplicationContext());
      io.reactivex.rxjava3.core.Single<? extends UwbClientSessionScope> acquire=controller
        ? UwbManagerRx.controllerSessionScopeSingle(manager) : UwbManagerRx.controleeSessionScopeSingle(manager);
      operation=acquire.subscribeOn(Schedulers.io()).timeout(10,TimeUnit.SECONDS).subscribe(value -> activity.runOnUiThread(() -> {
        if(attempt!=generation)return;
        RangingCapabilities capabilities=value.getRangingCapabilities();
        if(!capabilities.isDistanceSupported() || !capabilities.getSupportedConfigIds().contains(RangingParameters.CONFIG_PROVISIONED_UNICAST_DS_TWR)){
          stop();status="UNSUPPORTED";done.accept(reply(status));return;
        }
        scope=value;status="READY";handler.postDelayed(expire,60000);
        try {
          JSONObject result=reply(status).put("role",role).put("address",Base64.encodeToString(value.getLocalAddress().getAddress(),Base64.NO_WRAP)).put("security","PROVISIONED_STS");
          if(controller){UwbComplexChannel channel=((UwbControllerSessionScope)value).getUwbComplexChannel();result.put("channel",channel.getChannel()).put("preamble",channel.getPreambleIndex());}
          done.accept(result);
        }catch(Exception ignored){stop();done.accept(reply("UNAVAILABLE"));}
      }), error -> activity.runOnUiThread(() -> {
        if(attempt!=generation)return;
        stop();status="UNAVAILABLE";done.accept(reply(status));
      }));
    }catch(Exception ignored){stop();done.accept(reply("UNAVAILABLE"));}
  }
  public JSONObject start(JSONObject payload, boolean foreground) {
    if(!foreground || scope==null || !status.equals("READY"))return reply("UNAVAILABLE");
    byte[] sessionKey=null;
    try {
      LandfallUwbParameters.shape(payload);
      String peerId=payload.getString("peerId");
      if(!peerId.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))throw new IllegalArgumentException();
      int sessionId=(int)LandfallUwbParameters.integer(payload,"sessionId",1,Integer.MAX_VALUE);long expiresAt=LandfallUwbParameters.integer(payload,"expiresAt",1,9007199254740991L);long remaining=expiresAt-System.currentTimeMillis();
      if(sessionId<=0 || remaining<=0 || remaining>300000 || !payload.getString("security").equals("PROVISIONED_STS"))throw new IllegalArgumentException();
      sessionKey=decode(payload.getString("sessionKey"),16);
      byte[] peerAddress=decode(payload.getString("peerAddress"),2);
      UwbComplexChannel channel=new UwbComplexChannel((int)LandfallUwbParameters.integer(payload,"channel",5,9),(int)LandfallUwbParameters.integer(payload,"preamble",9,12));
      if(channel.getChannel()!=5&&channel.getChannel()!=9)throw new IllegalArgumentException();
      if(!scope.getRangingCapabilities().getSupportedChannels().contains(channel.getChannel()))throw new IllegalArgumentException();
      if(controller){UwbComplexChannel allocated=((UwbControllerSessionScope)scope).getUwbComplexChannel();if(channel.getChannel()!=allocated.getChannel() || channel.getPreambleIndex()!=allocated.getPreambleIndex())throw new IllegalArgumentException();}
      RangingParameters parameters=new RangingParameters(RangingParameters.CONFIG_PROVISIONED_UNICAST_DS_TWR,sessionId,0,sessionKey,null,channel,Collections.singletonList(UwbDevice.createForAddress(peerAddress)),RangingParameters.RANGING_UPDATE_RATE_AUTOMATIC);
      key=sessionKey;sessionKey=null;handler.removeCallbacks(expire);handler.postDelayed(expire,remaining);
      final int attempt=generation;
      status="INITIALIZING";
      operation=UwbClientSessionScopeRx.rangingResultsObservable(scope,parameters).subscribeOn(Schedulers.io()).subscribe(result -> activity.runOnUiThread(() -> {
        if(attempt!=generation)return;
        if(result instanceof RangingResult.RangingResultFailure || result instanceof RangingResult.RangingResultPeerDisconnected){stop();stateEvent("UNAVAILABLE");return;}
        if(result instanceof RangingResult.RangingResultInitialized){stateEvent("READY");return;}
        if(!(result instanceof RangingResult.RangingResultPosition))return;
        RangingPosition position=((RangingResult.RangingResultPosition)result).getPosition();
        long age=SystemClock.elapsedRealtimeNanos()-position.getElapsedRealtimeNanos();
        if(age<0 || age>10000000000L || position.getDistance()==null)return;
        float distance=position.getDistance().getValue();long now=System.currentTimeMillis();
        if(!Float.isFinite(distance) || distance<0 || distance>1000 || now-lastReport<1000)return;
        lastReport=now;status="READY";
        try { emit.accept(new JSONObject().put("type","nearby").put("family","UWB").put("id",UUID.randomUUID().toString()).put("peerId",peerId).put("observedAt",now-age/1000000L).put("distanceMeters",distance).put("uncertaintyMeters",JSONObject.NULL).put("authenticated",false).put("sessionProtected",true)); }catch(Exception ignored){}
      }), error -> activity.runOnUiThread(() -> {if(attempt==generation){stop();stateEvent("UNAVAILABLE");}}), () -> activity.runOnUiThread(() -> {if(attempt==generation){stop();stateEvent("UNAVAILABLE");}}));
      return reply("INITIALIZING");
    }catch(Exception ignored){if(sessionKey!=null)Arrays.fill(sessionKey,(byte)0);stop();return reply("UNAVAILABLE");}
  }
  private static byte[] decode(String input,int length) {
    if(input.length()>64 || !input.matches("[A-Za-z0-9+/]+={0,2}"))throw new IllegalArgumentException();
    byte[] value=Base64.decode(input,Base64.NO_WRAP);
    if(value.length!=length || !Base64.encodeToString(value,Base64.NO_WRAP).equals(input)){Arrays.fill(value,(byte)0);throw new IllegalArgumentException();}
    return value;
  }
  public void stop() {
    generation++;handler.removeCallbacks(expire);
    if(operation!=null){operation.dispose();operation=null;}
    scope=null;if(key!=null){Arrays.fill(key,(byte)0);key=null;}lastReport=0;status="UNAVAILABLE";
  }
}
