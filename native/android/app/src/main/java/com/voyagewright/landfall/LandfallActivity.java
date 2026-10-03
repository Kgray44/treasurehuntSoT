package com.voyagewright.landfall;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Collections;
import java.util.UUID;

/** Native acquisition only. One Voyage on the authenticated server owns all progression. */
public final class LandfallActivity extends Activity implements LocationListener {
  private WebView web;
  private LocationManager locations;
  private String origin;
  private boolean foreground;
  private boolean acquiring;
  private JavaScriptReplyProxy permissionReply;
  private String permissionRequestId;
  private LandfallSensors sensors;
  private LandfallHardware hardware;
  private LandfallPrivateStore privateStore;
  private LandfallPower power;
  private long requestedInterval=5000;
  private boolean requestedPrecise;
  private static final int LOCATION_REQUEST = 41;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    origin = BuildConfig.LANDFALL_ORIGIN;
    if (BuildConfig.DEBUG && getIntent().getStringExtra("labOrigin") != null) {
      String lab = getIntent().getStringExtra("labOrigin");
      if (lab.matches("http://(10\\.0\\.2\\.2|127\\.0\\.0\\.1):[0-9]{2,5}")) origin = lab;
    }
    if (origin.isEmpty()) { TextView message = new TextView(this); message.setText("Landfall companion is not configured. Build with your VoyageWright HTTPS origin."); setContentView(message); return; }
    privateStore = new LandfallPrivateStore(origin);
    locations = (LocationManager)getSystemService(LOCATION_SERVICE);
    sensors = new LandfallSensors(this, this::event);
    hardware = new LandfallHardware(this, this::event);
    power = new LandfallPower(this, this::powerChanged);
    power.watch();
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(false);
    web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return !isAllowed(request.getUrl());
      }
      @Override public void onPageFinished(WebView view, String url) {
        if (isAllowed(Uri.parse(url))) view.evaluateJavascript(bridgeScript(), null);
      }
    });
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      TextView message = new TextView(this); message.setText("Update Android System WebView to enable native navigation. Your browser chart remains available."); setContentView(message); return;
    }
    WebViewCompat.addWebMessageListener(web, "LandfallHost", Collections.singleton(origin), (view, message, source, mainFrame, reply) -> {
      if (!mainFrame || !source.toString().equals(origin) || message.getData() == null || message.getData().length() > 16384) return;
      try { command(new JSONObject(message.getData()), reply); }
      catch (Exception ignored) { /* No coordinates, tokens or page payloads enter logs. */ }
    });
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
      WebViewCompat.addDocumentStartJavaScript(web, bridgeScript(), Collections.singleton(origin));
    setContentView(web);
    openReturn(getIntent());
  }
  private boolean isAllowed(Uri url) {
    Uri allowed = Uri.parse(origin);
    return allowed.getScheme().equals(url.getScheme()) && allowed.getHost().equals(url.getHost()) && allowed.getPort() == url.getPort() && url.getUserInfo() == null;
  }
  private String bridgeScript() {
    return "(()=>{if(window.LandfallNative||!window.LandfallHost)return;const pending=new Map();LandfallHost.onmessage=e=>{try{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);p.resolve(m.value)}}catch{}};Object.defineProperty(window,'LandfallNative',{value:Object.freeze({version:1,platform:'ANDROID',request:message=>new Promise((resolve,reject)=>{const id=JSON.parse(message).id;const timer=setTimeout(()=>{pending.delete(id);reject(Error('NATIVE_TIMEOUT'))},15000);pending.set(id,{resolve,timer});LandfallHost.postMessage(message)})}),configurable:false})})()";
  }
  private void reply(JavaScriptReplyProxy proxy, String id, JSONObject value) {
    try { proxy.postMessage(new JSONObject().put("id", id).put("value", value).toString()); } catch (Exception ignored) {}
  }
  private JSONObject state(String value) throws Exception { return new JSONObject().put("state", value); }
  private String permission() {
    if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) return "GRANTED";
    if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) return "APPROXIMATE";
    return "DENIED";
  }
  private void command(JSONObject request, JavaScriptReplyProxy proxy) throws Exception {
    if (request.optInt("version") != 1) return;
    String id = request.getString("id");
    if (!id.matches("[A-Za-z0-9-]{1,128}")) return;
    String operation = request.getString("operation");
    JSONObject payload = request.optJSONObject("payload");
    if (payload == null) payload = new JSONObject();
    switch (operation) {
      case "LOCATION_PERMISSION_STATE": reply(proxy, id, state(permission())); break;
      case "LOCATION_PERMISSION":
        if (!foreground || permissionReply != null) { reply(proxy, id, state("UNAVAILABLE")); break; }
        if (!permission().equals("DENIED")) { reply(proxy, id, state(permission())); break; }
        permissionReply = proxy; permissionRequestId = id;
        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
        break;
      case "LOCATION_START":
        if (!foreground || payload.optBoolean("background") || permission().equals("DENIED")) { reply(proxy, id, new JSONObject().put("accepted", false)); break; }
        long interval = payload.optLong("intervalMs", 5000);
        if (interval < 1000 || interval > 60000) { reply(proxy, id, new JSONObject().put("accepted", false)); break; }
        requestedInterval=interval;requestedPrecise=payload.optBoolean("precise");
        reply(proxy,id,new JSONObject().put("accepted",startLocation()));
        break;
      case "LOCATION_STOP": stopLocation(); reply(proxy, id, new JSONObject().put("accepted", true)); break;
      case "BACKGROUND_PERMISSION":
        // Android requires a separate settings-based background grant. No launch-time sweep.
        if (!foreground || permission().equals("DENIED")) { reply(proxy, id, state("DENIED")); break; }
        if (android.os.Build.VERSION.SDK_INT < 29 || checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED) { reply(proxy, id, state("GRANTED")); break; }
        startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
        reply(proxy, id, state("PROMPTABLE")); break;
      case "NOTIFICATION_PERMISSION":
        if (!foreground) { reply(proxy,id,state("UNAVAILABLE"));break; }
        if (android.os.Build.VERSION.SDK_INT<33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED) reply(proxy,id,state("GRANTED"));
        else { requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},43);reply(proxy,id,state("PROMPTABLE")); }
        break;
      case "GEOFENCE_REGISTER": registerGeofence(payload, proxy, id); break;
      case "GEOFENCE_CLEAR": LocationServices.getGeofencingClient(this).removeGeofences(geofenceIntent()); LandfallSecureHints.clear(this); reply(proxy, id, new JSONObject().put("accepted", true)); break;
      case "POWER_STATE": reply(proxy,id,power.snapshot());break;
      case "SENSORS_START": reply(proxy, id, new JSONObject().put("accepted", sensors.start(foreground && !power.constrained()))); break;
      case "SENSORS_STOP": sensors.stop(); reply(proxy, id, new JSONObject().put("accepted", true)); break;
      case "BLE_START": reply(proxy, id, state(hardware.startBle(foreground && !power.critical()))); break;
      case "BLE_STOP": hardware.stop(); reply(proxy, id, new JSONObject().put("accepted", true)); break;
      case "NFC_READ": reply(proxy, id, state(hardware.startNfc(foreground && !power.critical()))); break;
      case "QR_SCAN":
        if (!foreground || power.critical()) { reply(proxy,id,state("UNAVAILABLE")); break; }
        com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions options = new com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions.Builder().setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE).build();
        com.google.mlkit.vision.codescanner.GmsBarcodeScanning.getClient(this, options).startScan()
          .addOnSuccessListener(barcode -> { String token=barcode.getRawValue(); if(token!=null && token.length()<=2048) try { event(new JSONObject().put("type","interaction").put("medium","QR").put("token",token)); } catch(Exception ignored){} })
          .addOnFailureListener(error -> { try { event(new JSONObject().put("type","error")); }catch(Exception ignored){} });
        reply(proxy,id,state("GRANTED")); break;
      case "PRIVATE_STORE_PUT": reply(proxy,id,new JSONObject().put("accepted",foreground && privateStore.put(this,payload.optString("key"),payload.optString("value"),payload.optLong("expiresAt")))); break;
      case "PRIVATE_STORE_GET": reply(proxy,id,new JSONObject().put("value",foreground ? privateStore.get(this,payload.optString("key")) : JSONObject.NULL)); break;
      case "PRIVATE_STORE_LIST": reply(proxy,id,new JSONObject().put("keys",foreground ? privateStore.list(this) : new JSONArray())); break;
      case "PRIVATE_STORE_DELETE": if(foreground)privateStore.remove(this,payload.optString("key"));reply(proxy,id,new JSONObject().put("accepted",foreground));break;
      case "CLEAR_PRIVATE_DATA": stopLocation(); sensors.stop(); hardware.stop(); LocationServices.getGeofencingClient(this).removeGeofences(geofenceIntent()); LandfallSecureHints.clear(this); privateStore.clear(this); web.clearCache(true); reply(proxy, id, new JSONObject().put("accepted", true)); break;
      default: reply(proxy, id, state("UNSUPPORTED"));
    }
  }
  private PendingIntent geofenceIntent() {
    return PendingIntent.getBroadcast(this, 0, new Intent(this, LandfallGeofenceReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
  }
  private void registerGeofence(JSONObject payload, JavaScriptReplyProxy proxy, String id) throws Exception {
    if (!foreground || !permission().equals("GRANTED") || (android.os.Build.VERSION.SDK_INT >= 29 && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED)) { reply(proxy, id, state("PERMISSION_REQUIRED")); return; }
    String handle = payload.getString("returnHandle");
    double latitude = payload.getDouble("latitude"), longitude = payload.getDouble("longitude");
    float radius = (float)payload.getDouble("radiusMeters");
    long expiry = payload.getLong("expiresAt");
    if (!handle.matches("[A-Za-z0-9_-]{32,2048}") || !Double.isFinite(latitude) || Math.abs(latitude)>90 || !Double.isFinite(longitude) || Math.abs(longitude)>180 || radius<100 || radius>10000 || expiry<=System.currentTimeMillis() || expiry-System.currentTimeMillis()>86400000) { reply(proxy, id, state("UNAVAILABLE")); return; }
    Geofence fence = new Geofence.Builder().setRequestId(handle).setCircularRegion(latitude, longitude, radius).setExpirationDuration(expiry-System.currentTimeMillis()).setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT).build();
    LocationServices.getGeofencingClient(this).addGeofences(new GeofencingRequest.Builder().setInitialTrigger(0).addGeofence(fence).build(), geofenceIntent())
      .addOnSuccessListener(unused -> { try { LandfallSecureHints.register(this,handle,expiry,payload.optBoolean("notifications",false));reply(proxy, id, state("GRANTED")); } catch(Exception ignored){} })
      .addOnFailureListener(error -> { try { reply(proxy, id, state("UNAVAILABLE")); } catch(Exception ignored){} });
  }
  private void stopLocation() { if (locations != null) locations.removeUpdates(this); acquiring = false; }
  private boolean startLocation(){
    stopLocation();if(!foreground || permission().equals("DENIED") || power.critical())return false;
    String provider=permission().equals("GRANTED") && requestedPrecise?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;
    if(!locations.isProviderEnabled(provider))provider=LocationManager.NETWORK_PROVIDER;
    try{locations.requestLocationUpdates(provider,power.interval(requestedInterval),0,this);acquiring=true;return true;}catch(SecurityException|IllegalArgumentException error){return false;}
  }
  private void powerChanged(){
    if(!foreground || power==null)return;
    if(power.constrained() && sensors!=null)sensors.stop();
    if(power.critical() && hardware!=null)hardware.stop();
    if(acquiring && !startLocation())try{event(new JSONObject().put("type","error"));}catch(Exception ignored){}
    try{event(new JSONObject().put("type","power").put("power",power.snapshot()));}catch(Exception ignored){}
  }
  private void event(JSONObject value) {
    if (web == null || !foreground || !isAllowed(Uri.parse(web.getUrl()==null ? origin : web.getUrl()))) return;
    runOnUiThread(() -> web.evaluateJavascript("window.dispatchEvent(new CustomEvent('landfall-native-event',{detail:" + value.toString() + "}))", null));
  }
  @Override public void onLocationChanged(Location location) {
    if (!acquiring || !foreground || permission().equals("DENIED")) { stopLocation(); return; }
    try {
      JSONObject fix = new JSONObject().put("id", UUID.randomUUID().toString()).put("timestamp", location.getTime()).put("latitude", location.getLatitude()).put("longitude", location.getLongitude()).put("accuracyMeters", location.getAccuracy());
      if (location.hasBearing()) fix.put("headingDegrees", location.getBearing());
      if (location.hasSpeed()) fix.put("speedMetersPerSecond", location.getSpeed());
      if (location.hasAltitude() && location.hasVerticalAccuracy()) { fix.put("altitudeMeters", location.getAltitude()); fix.put("altitudeAccuracyMeters", location.getVerticalAccuracyMeters()); }
      event(new JSONObject().put("type", "fix").put("fix", fix));
    } catch (Exception ignored) {}
  }
  @Override public void onProviderDisabled(String provider) { try { event(new JSONObject().put("type", "error")); } catch(Exception ignored){} }
  @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(code, permissions, results);
    if (code == LOCATION_REQUEST && permissionReply != null) { try { reply(permissionReply, permissionRequestId, state(permission())); } catch(Exception ignored){} permissionReply=null; permissionRequestId=null; }
  }
  @Override public void onResume() { super.onResume(); foreground=true; if (web!=null) { web.onResume(); try { event(new JSONObject().put("type", "lifecycle").put("state", "FOREGROUND").put("pendingHints", LandfallSecureHints.read(this))); } catch(Exception ignored){} } }
  private void openReturn(Intent intent){String handle=intent.getStringExtra("returnHandle");String saved=privateStore.lastJourney(this);web.loadUrl(origin+(handle!=null&&handle.matches("[A-Za-z0-9_-]{32,2048}")?"/player/landfall-return?handle="+Uri.encode(handle):saved!=null?"/player/playthroughs/"+Uri.encode(saved)+"/journal":"/player"));}
  @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(web!=null)openReturn(intent);}
  @Override public void onPause() { try { event(new JSONObject().put("type", "lifecycle").put("state", "BACKGROUND")); } catch(Exception ignored){} foreground=false; stopLocation(); if(sensors!=null)sensors.stop(); if(hardware!=null)hardware.stop(); if(web!=null)web.onPause(); super.onPause(); }
  @Override public void onDestroy() { stopLocation(); if(power!=null)power.close(); if(sensors!=null)sensors.stop(); if(hardware!=null)hardware.stop(); if(web!=null){web.destroy();web=null;} super.onDestroy(); }
}
