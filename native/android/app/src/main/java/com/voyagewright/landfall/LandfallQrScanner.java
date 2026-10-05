package com.voyagewright.landfall;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.Size;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Same-Activity, bundled QR-only camera. No images, decoded text or frames are saved or uploaded. */
final class LandfallQrScanner {
  private final ComponentActivity activity;
  private final Consumer<JSONObject> emit;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private volatile long generation;
  private FrameLayout overlay;
  private ProcessCameraProvider camera;
  private Preview preview;
  private ImageAnalysis analysis;
  private BarcodeScanner scanner;
  private ExecutorService executor;
  private Runnable expiry;
  private String activeScanId;
  private volatile boolean bound;
  private volatile String outcome="NOT_STARTED";
  private final java.util.concurrent.atomic.AtomicInteger frames=new java.util.concurrent.atomic.AtomicInteger();
  private final java.util.concurrent.atomic.AtomicInteger decoded=new java.util.concurrent.atomic.AtomicInteger();
  private final java.util.concurrent.atomic.AtomicInteger errors=new java.util.concurrent.atomic.AtomicInteger();
  private long diagnosticAt;
  private synchronized void diagnostic(boolean force){
    if(!BuildConfig.DEBUG)return;
    long now=android.os.SystemClock.elapsedRealtime();if(!force && now-diagnosticAt<1000)return;diagnosticAt=now;
    try{
      JSONObject value=new JSONObject().put("frames",frames.get()).put("decoded",decoded.get()).put("errors",errors.get()).put("bound",bound).put("outcome",outcome);
      try(java.io.FileOutputStream output=activity.openFileOutput("landfall-camera-debug.json",android.content.Context.MODE_PRIVATE)){
        output.write(value.toString().getBytes(StandardCharsets.UTF_8));
      }
    }catch(Exception ignored){}
  }
  private static void increment(java.util.concurrent.atomic.AtomicInteger value){value.updateAndGet(current->Math.min(100000,current+1));}
  LandfallQrScanner(ComponentActivity activity,Consumer<JSONObject> emit){this.activity=activity;this.emit=emit;}
  boolean active(){return overlay!=null;}
  String start(boolean foreground,String scanId,ViewGroup parent){
    if(!foreground || parent==null || overlay!=null || !scanId.matches("[a-fA-F0-9-]{36}"))return "UNAVAILABLE";
    if(!activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY))return "UNSUPPORTED";
    if(activity.checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){
      if(activity.getPreferences(android.content.Context.MODE_PRIVATE).getBoolean("landfallCameraAsked",false) && !activity.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA))return "DENIED_PERMANENTLY";
      activity.getPreferences(android.content.Context.MODE_PRIVATE).edit().putBoolean("landfallCameraAsked",true).apply();
      activity.requestPermissions(new String[]{Manifest.permission.CAMERA},44);return "PROMPTABLE";
    }
    final long attempt=++generation;
    bound=false;outcome="SCANNING";frames.set(0);decoded.set(0);errors.set(0);diagnosticAt=0;diagnostic(true);
    activeScanId=scanId;
    overlay=new FrameLayout(activity);overlay.setBackgroundColor(Color.BLACK);
    PreviewView view=new PreviewView(activity);view.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
    overlay.addView(view,new FrameLayout.LayoutParams(-1,-1));
    TextView explanation=new TextView(activity);explanation.setText("Optional QR identity only. Center the code. No image is saved and no arrival is recorded.");explanation.setTextColor(Color.WHITE);explanation.setBackgroundColor(0xdd000000);explanation.setPadding(20,20,20,20);
    FrameLayout.LayoutParams textLayout=new FrameLayout.LayoutParams(-1,-2,Gravity.TOP);overlay.addView(explanation,textLayout);
    Button cancel=new Button(activity);cancel.setText("Cancel QR scan");cancel.setContentDescription("Cancel QR scan");cancel.setMinHeight((int)(48*activity.getResources().getDisplayMetrics().density));cancel.setOnClickListener(v->end(attempt,scanId,null));
    overlay.addView(cancel,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));parent.addView(overlay,new ViewGroup.LayoutParams(-1,-1));
    expiry=()->{outcome="EXPIRED";end(attempt,scanId,null);};handler.postDelayed(expiry,30000);
    executor=Executors.newSingleThreadExecutor();
    scanner=BarcodeScanning.getClient(new BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build());
    final BarcodeScanner decoder=scanner;
    final ExecutorService ownedExecutor=executor;
    var future=ProcessCameraProvider.getInstance(activity);
    future.addListener(()->{
      if(attempt!=generation || overlay==null)return;
      try {
        camera=future.get();preview=new Preview.Builder().build();preview.setSurfaceProvider(view.getSurfaceProvider());
        analysis=new ImageAnalysis.Builder().setTargetResolution(new Size(1280,720)).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
        analysis.setAnalyzer(ownedExecutor,image->{
          if(attempt!=generation || image.getImage()==null){image.close();return;}
          increment(frames);diagnostic(false);
          try {decoder.process(InputImage.fromMediaImage(image.getImage(),image.getImageInfo().getRotationDegrees()))
            .addOnSuccessListener(values->{
              if(attempt!=generation)return;
              for(Barcode barcode:values){String token=barcode.getRawValue();if(token!=null && token.getBytes(StandardCharsets.UTF_8).length<=2048){increment(decoded);outcome="DECODED";end(attempt,scanId,token);break;}}
            }).addOnFailureListener(error->{increment(errors);diagnostic(false);}).addOnCompleteListener(task->image.close());
          }catch(Exception ignored){increment(errors);diagnostic(false);image.close();}
        });
        CameraSelector selector=camera.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)?CameraSelector.DEFAULT_BACK_CAMERA:CameraSelector.DEFAULT_FRONT_CAMERA;
        camera.bindToLifecycle(activity,selector,preview,analysis);
        bound=true;diagnostic(true);
      }catch(Exception ignored){increment(errors);outcome="BIND_FAILED";end(attempt,scanId,null);}
    },ContextCompat.getMainExecutor(activity));
    return "GRANTED";
  }
  private void end(long attempt,String scanId,String token){
    if(attempt!=generation)return;stop();
    try{JSONObject value=new JSONObject().put("type",token==null?"interaction-ended":"interaction").put("medium","QR").put("scanId",scanId);if(token!=null)value.put("token",token);emit.accept(value);}catch(Exception ignored){}
  }
  void stop(){
    if("SCANNING".equals(outcome))outcome="STOPPED";
    diagnostic(true);
    activeScanId=null;
    generation++;
    if(expiry!=null)handler.removeCallbacks(expiry);expiry=null;
    if(analysis!=null)analysis.clearAnalyzer();
    // Unbind only this scanner's use cases; never another owner's camera.
    if(camera!=null){if(preview!=null)camera.unbind(preview);if(analysis!=null)camera.unbind(analysis);}
    camera=null;preview=null;analysis=null;
    if(scanner!=null)scanner.close();scanner=null;
    if(executor!=null)executor.shutdown();executor=null;
    if(overlay!=null && overlay.getParent() instanceof ViewGroup)((ViewGroup)overlay.getParent()).removeView(overlay);overlay=null;
  }
  void stop(String scanId){if(scanId.equals(activeScanId))stop();}
}
