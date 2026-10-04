package com.voyagewright.landfall;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.nfc.NdefMessage;
import android.nfc.tech.Ndef;
import android.os.Build;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;
import java.util.function.Consumer;

/** Radio observations are untrusted proximity hints until configured peer/token verification. */
final class LandfallHardware {
  private final Activity activity;
  private final Consumer<JSONObject> emit;
  private BluetoothLeScanner scanner;
  private long lastBle;
  private volatile boolean bleActive;
  private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
  private Runnable nfcExpiry;
  private final LandfallQrScanner qr;
  private volatile String nfcScanId;
  private ScanCallback callback;
  private volatile String bleScanId;
  private Runnable bleExpiry;
  private ScanCallback bleCallback(String scanId){final String salt=UUID.randomUUID().toString();return new ScanCallback(){
    @Override public void onScanResult(int type,ScanResult result){
      long now=System.currentTimeMillis(); if(!bleActive || !scanId.equals(bleScanId) || now-lastBle<1000)return;lastBle=now;
      try {
        String protocol="GENERIC";
        android.bluetooth.le.ScanRecord record=result.getScanRecord();
        if(record!=null){
          byte[] apple=record.getManufacturerSpecificData(0x004c);
          byte[] uid=record.getServiceData(android.os.ParcelUuid.fromString("0000feaa-0000-1000-8000-00805f9b34fb"));
          if(apple!=null && apple.length==23 && apple[0]==0x02 && apple[1]==0x15)protocol="IBEACON";
          else if(uid!=null && uid.length==20 && uid[0]==0x00)protocol="EDDYSTONE_UID";
        }
        byte[] digest=MessageDigest.getInstance("SHA-256").digest((salt+result.getDevice().getAddress()).getBytes(StandardCharsets.UTF_8));
        StringBuilder peer=new StringBuilder();for(byte value:digest)peer.append(String.format("%02x",value));
        emit.accept(new JSONObject().put("type","nearby").put("family","BLE").put("protocol",protocol).put("scanId",scanId).put("authenticated",false).put("peerId",peer.toString()).put("rssi",result.getRssi()).put("observedAt",now));
      }catch(Exception ignored){}
    }
    @Override public void onScanFailed(int error){if(scanId.equals(bleScanId))endBle(scanId);}
  };}
  LandfallHardware(Activity activity,Consumer<JSONObject> emit){this.activity=activity;this.emit=emit;this.qr=new LandfallQrScanner((androidx.activity.ComponentActivity)activity,emit);}
  String startBle(boolean foreground,String scanId){
    if(!foreground || !scanId.matches("[a-fA-F0-9-]{36}") || bleActive)return "UNAVAILABLE";
    if(!activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE))return "UNSUPPORTED";
    if(Build.VERSION.SDK_INT>=31 && (activity.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED || activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)){
      boolean asked=activity.getPreferences(android.content.Context.MODE_PRIVATE).getBoolean("landfallBleAsked",false);
      for(String permission:new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT})if(asked && activity.checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED && !activity.shouldShowRequestPermissionRationale(permission))return "DENIED_PERMANENTLY";
      activity.getPreferences(android.content.Context.MODE_PRIVATE).edit().putBoolean("landfallBleAsked",true).apply();
      activity.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},42);return "PROMPTABLE";
    }
    if(Build.VERSION.SDK_INT<31 && activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){activity.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},42);return "PROMPTABLE";}
    BluetoothManager manager=(BluetoothManager)activity.getSystemService(Activity.BLUETOOTH_SERVICE);
    if(manager==null || manager.getAdapter()==null)return "UNSUPPORTED";
    try {
      if(!manager.getAdapter().isEnabled())return "UNAVAILABLE";
      scanner=manager.getAdapter().getBluetoothLeScanner();if(scanner==null)return "UNSUPPORTED";
      bleScanId=scanId;lastBle=0;callback=bleCallback(scanId);bleActive=true;scanner.startScan(callback);
      bleExpiry=()->endBle(scanId);handler.postDelayed(bleExpiry,30000);return "GRANTED";
    }catch(SecurityException error){stopBle();return "DENIED";}catch(RuntimeException error){stopBle();return "UNAVAILABLE";}
  }
  String startQr(boolean foreground,String scanId,android.view.ViewGroup parent){return nfcScanId!=null?"UNAVAILABLE":qr.start(foreground,scanId,parent);}
  String startNfc(boolean foreground,String scanId){
    if(!foreground || !scanId.matches("[a-fA-F0-9-]{36}") || nfcScanId!=null || qr.active())return "UNAVAILABLE";
    NfcAdapter adapter=NfcAdapter.getDefaultAdapter(activity);if(adapter==null)return "UNSUPPORTED";if(!adapter.isEnabled())return "UNAVAILABLE";
    nfcScanId=scanId;
    nfcExpiry=()->{if(scanId.equals(nfcScanId)){stopInteractions();try{emit.accept(new JSONObject().put("type","interaction-ended").put("medium","NFC").put("scanId",scanId));}catch(Exception ignored){}}};handler.postDelayed(nfcExpiry,30000);
    adapter.enableReaderMode(activity,tag->{
      Ndef ndef=Ndef.get(tag);if(ndef==null)return;
      try { ndef.connect();NdefMessage message=ndef.getNdefMessage();if(message==null || message.toByteArray().length>4096)return;
        for(android.nfc.NdefRecord record:message.getRecords()){
          if(record.getTnf()!=android.nfc.NdefRecord.TNF_WELL_KNOWN || !java.util.Arrays.equals(record.getType(),android.nfc.NdefRecord.RTD_TEXT))continue;
          byte[] payload=record.getPayload();if(payload.length<2 || (payload[0]&0x80)!=0)continue;int skip=1+(payload[0]&0x3f);if(skip>=payload.length)continue;
          if(payload.length-skip>2048)continue;
          String token=StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(payload,skip,payload.length-skip)).toString();
          if(!scanId.equals(nfcScanId))return;
          nfcScanId=null;handler.post(()->{if(nfcScanId==null)adapter.disableReaderMode(activity);});
          emit.accept(new JSONObject().put("type","interaction").put("medium","NFC").put("scanId",scanId).put("token",token));break;
        }
      }catch(Exception ignored){}finally{try{ndef.close();}catch(Exception ignored){}}
    },NfcAdapter.FLAG_READER_NFC_A|NfcAdapter.FLAG_READER_NFC_B,null);
    return "GRANTED";
  }
  void stopInteractions(){nfcScanId=null;if(nfcExpiry!=null)handler.removeCallbacks(nfcExpiry);nfcExpiry=null;qr.stop();NfcAdapter adapter=NfcAdapter.getDefaultAdapter(activity);if(adapter!=null)adapter.disableReaderMode(activity);}
  void stopInteractions(String scanId){if(scanId.equals(nfcScanId))stopInteractions();else qr.stop(scanId);}
  private void endBle(String scanId){if(!scanId.equals(bleScanId))return;stopBle();try{emit.accept(new JSONObject().put("type","ble-ended").put("scanId",scanId));}catch(Exception ignored){}}
  void stopBle(){bleActive=false;bleScanId=null;if(bleExpiry!=null)handler.removeCallbacks(bleExpiry);bleExpiry=null;if(scanner!=null && callback!=null){try{scanner.stopScan(callback);}catch(RuntimeException ignored){}}scanner=null;callback=null;}
  void stopBle(String scanId){if(scanId.equals(bleScanId))stopBle();}
  void stop(){stopBle();stopInteractions();}
}
