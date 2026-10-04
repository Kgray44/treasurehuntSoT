package com.voyagewright.landfall;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.widget.TextView;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONObject;

/** Debug APK only: bounded synthetic radio peer. It has no bridge, accounts, location or progression writer. */
public final class LandfallBleLabActivity extends Activity {
  private BluetoothLeAdvertiser advertiser;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private String sessionId;
  private Integer failureCode;
  private boolean active;
  private TextView label;
  private final AdvertiseCallback callback=new AdvertiseCallback(){
    @Override public void onStartSuccess(AdvertiseSettings settings){if(active)record("STARTED");}
    @Override public void onStartFailure(int code){if(active){failureCode=code;stop();record(code==ADVERTISE_FAILED_FEATURE_UNSUPPORTED?"UNSUPPORTED":"UNAVAILABLE");}}
  };
  @Override public void onCreate(Bundle state){
    super.onCreate(state);label=new TextView(this);label.setText("Synthetic Device Lab peer. No navigation authority.");setContentView(label);
    sessionId=getIntent().getStringExtra("labSession");
    try{if(sessionId==null || !UUID.fromString(sessionId).toString().equalsIgnoreCase(sessionId))return;}catch(IllegalArgumentException ignored){return;}
    if(checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE)!=PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){record("DENIED");return;}
    String protocol=getIntent().getStringExtra("labProtocol");
    if(!"GENERIC".equals(protocol) && !"IBEACON".equals(protocol) && !"EDDYSTONE_UID".equals(protocol)){record("INVALID");return;}
    BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
    try{
      if(manager==null || manager.getAdapter()==null || !manager.getAdapter().isEnabled()){record("UNSUPPORTED");return;}
      advertiser=manager.getAdapter().getBluetoothLeAdvertiser();if(advertiser==null){record("UNSUPPORTED");return;}
      AdvertiseData.Builder data=new AdvertiseData.Builder().setIncludeDeviceName(false).setIncludeTxPowerLevel(false);
      if("IBEACON".equals(protocol)){
        byte[] frame=new byte[23];frame[0]=0x02;frame[1]=0x15;
        System.arraycopy("LANDFALL-LAB-ONLY".getBytes(StandardCharsets.US_ASCII),0,frame,2,16);frame[19]=1;frame[21]=2;frame[22]=-59;
        data.addManufacturerData(0x004c,frame);
      }else if("EDDYSTONE_UID".equals(protocol)){
        byte[] frame=new byte[20];frame[1]=-30;System.arraycopy("LAB-ONLY00".getBytes(StandardCharsets.US_ASCII),0,frame,2,10);
        data.addServiceData(ParcelUuid.fromString("0000feaa-0000-1000-8000-00805f9b34fb"),frame);
      }else data.addServiceUuid(ParcelUuid.fromString("ef8361b0-8c56-4a91-93e3-3c5b0307494f"));
      active=true;record("INITIALIZING");
      advertiser.startAdvertising(new AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY).setConnectable(false).setTimeout(20000).build(),data.build(),callback);
      handler.postDelayed(()->{stop();record("STOPPED");},20000);
    }catch(RuntimeException ignored){stop();record("UNAVAILABLE");}
  }
  private void record(String state){
    if(sessionId==null)return;
    try{
      JSONObject value=new JSONObject().put("sessionId",sessionId).put("state",state).put("synthetic",true).put("canComplete",false).put("failureCode",failureCode==null?JSONObject.NULL:failureCode);
      try(java.io.FileOutputStream stream=openFileOutput("landfall-ble-lab-"+sessionId+".json",MODE_PRIVATE)){stream.write(value.toString().getBytes(StandardCharsets.UTF_8));}
      label.setText("Synthetic Device Lab peer: "+state+". No navigation authority.");
    }catch(Exception ignored){}
  }
  private void stop(){active=false;handler.removeCallbacksAndMessages(null);if(advertiser!=null){try{advertiser.stopAdvertising(callback);}catch(RuntimeException ignored){}}advertiser=null;}
  @Override public void onPause(){stop();record("STOPPED");super.onPause();}
  @Override public void onDestroy(){stop();super.onDestroy();}
}
