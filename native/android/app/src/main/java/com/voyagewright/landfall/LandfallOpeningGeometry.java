package com.voyagewright.landfall;

import android.net.Uri;
import android.webkit.WebView;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;

/** Debug-only bounded UI geometry, never content, navigation evidence or GPS.
 * The release compiler removes the guarded observer and write bodies. */
final class LandfallOpeningGeometry {
  static void observe(WebView view){
    if(!BuildConfig.DEBUG)return;
    view.getViewTreeObserver().addOnGlobalLayoutListener(()->record(view));
  }
  static void record(WebView view){
    if(!BuildConfig.DEBUG)return;
    try{
      Uri uri=Uri.parse(view.getUrl()==null?"":view.getUrl());
      if(!"http".equals(uri.getScheme()) || !"127.0.0.1".equals(uri.getHost()) || uri.getPort()<=0){view.getContext().deleteFile("landfall-opening-geometry.json");return;}
      android.graphics.Rect visible=new android.graphics.Rect();
      boolean shown=view.isShown() && view.isAttachedToWindow() && view.hasWindowFocus() && view.getWidth()>0 && view.getHeight()>0 &&
        view.getGlobalVisibleRect(visible) && visible.width()==view.getWidth() && visible.height()==view.getHeight();
      int[] origin=new int[2];view.getLocationOnScreen(origin);
      int right=origin[0]+view.getWidth(),bottom=origin[1]+view.getHeight();
      if(origin[0]<0 || origin[1]<0 || right>4096 || bottom>4096){view.getContext().deleteFile("landfall-opening-geometry.json");return;}
      JSONObject value=new JSONObject().put("version",1).put("packageName",view.getContext().getPackageName())
        .put("shown",shown).put("attached",view.isAttachedToWindow()).put("focused",view.hasWindowFocus())
        .put("left",origin[0]).put("top",origin[1]).put("right",right).put("bottom",bottom);
      try(java.io.FileOutputStream output=view.getContext().openFileOutput("landfall-opening-geometry.json",android.content.Context.MODE_PRIVATE)){
        output.write(value.toString().getBytes(StandardCharsets.UTF_8));
      }
    }catch(Exception ignored){}
  }
}
