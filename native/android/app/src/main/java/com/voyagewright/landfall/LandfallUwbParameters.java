package com.voyagewright.landfall;

import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Strict numeric/shape boundary shared by both optional UWB backends. */
final class LandfallUwbParameters {
  private LandfallUwbParameters(){}
  static void shape(JSONObject payload){
    Set<String> keys=new HashSet<>();payload.keys().forEachRemaining(keys::add);
    if(!keys.equals(new HashSet<>(Arrays.asList("peerId","sessionId","security","sessionKey","peerAddress","channel","preamble","expiresAt"))))throw new IllegalArgumentException();
  }
  static long integer(JSONObject payload,String field,long minimum,long maximum){
    Object value=payload.opt(field);
    if(!(value instanceof Number))throw new IllegalArgumentException();
    double number=((Number)value).doubleValue();
    if(!Double.isFinite(number)||number!=Math.rint(number)||number<minimum||number>maximum)throw new IllegalArgumentException();
    return ((Number)value).longValue();
  }
}
