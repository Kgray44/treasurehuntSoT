package com.voyagewright.landfall;

import org.json.JSONObject;

/** Accepted navigation compatibility projection of the canonical radio boundary. */
final class LandfallUwbParameters {
  private LandfallUwbParameters(){}
  static void shape(JSONObject payload){
    SextantUwbParameters.shape(payload);
  }
  static long integer(JSONObject payload,String field,long minimum,long maximum){
    return SextantUwbParameters.integer(payload,field,minimum,maximum);
  }
}
