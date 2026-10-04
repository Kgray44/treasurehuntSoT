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
  private final String salt=UUID.randomUUID().toString();
  private long lastBle;
  private volatile boolean bleActive;
  private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
  private Runnable nfcExpiry;
  private final LandfallQrScanner qr;
  private volatile String nfcScanId;
  private final ScanCallback callback=new ScanCallback(){
    @Override public void onScanResult(int type,ScanResult result){
      long now=System.currentTimeMillis(); if(!bleActive || now-lastBle<1000)return;lastBle=now;
      try {
        byte[] digest=MessageDigest.getInstance("SHA-256").digest((salt+result.getDevice().getAddress()).getBytes(StandardCharsets.UTF_8));
        StringBuilder peer=new StringBuilder();for(byte value:digest)peer.append(String.format("%02x",value));
        emit.accept(new JSONObject().put("type","nearby").put("family","BLE").put("authenticated",false).put("peerId",peer.toString()).put("rssi",result.getRssi()).put("observedAt",now));
      }catch(Exception ignored){}
    }
  };
  LandfallHardware(Activity activity,Consumer<JSONObject> emit){this.activity=activity;this.emit=emit;this.qr=new LandfallQrScanner((androidx.activity.ComponentActivity)activity,emit);}
  String startBle(boolean foreground){
    if(!foreground)return "UNAVAILABLE";
    if(Build.VERSION.SDK_INT>=31 && (activity.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED || activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)){activity.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},42);return "PROMPTABLE";}
    if(Build.VERSION.SDK_INT<31 && activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return "DENIED";
    BluetoothManager manager=(BluetoothManager)activity.getSystemService(Activity.BLUETOOTH_SERVICE);
    if(manager.getAdapter()==null)return "UNSUPPORTED";
    try { if(!manager.getAdapter().isEnabled())return "UNAVAILABLE";scanner=manager.getAdapter().getBluetoothLeScanner();if(scanner==null)return "UNSUPPORTED";bleActive=true;scanner.startScan(callback);return "GRANTED"; }catch(SecurityException error){bleActive=false;return "DENIED";}
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
  void stop(){bleActive=false;if(scanner!=null){try{scanner.stopScan(callback);}catch(SecurityException ignored){}scanner=null;}stopInteractions();}
}
