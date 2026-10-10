package com.voyagewright.landfall;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.Base64;

/** Also runnable on the JVM: executes the actual companion boundary, without claiming Android UI/AR proof. */
public final class ParallaxBoundaryFixtures {
  private static int assertions;
  static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
  static JSONObject identity() throws Exception { return new JSONObject().put("sessionId","fixture-session").put("epoch",1).put("transactionId","fixture-transaction").put("generation",1); }
  static boolean scene(JSONObject scene) throws Exception {
    byte[] bytes = scene.toString().getBytes(StandardCharsets.UTF_8);
    StringBuilder digest = new StringBuilder(); for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))digest.append(String.format("%02x",b&255));
    ParallaxSceneTransfer t=new ParallaxSceneTransfer("fixture-session",1);
    JSONObject begin=identity().put("sceneTransferVersion",1).put("totalBytes",bytes.length).put("chunkCount",(bytes.length+8191)/8192).put("digest",digest.toString());
    check(t.begin(begin,0),"begin valid scene");
    for(int offset=0,index=0;offset<bytes.length;offset+=8192,index++) {
      byte[] part=java.util.Arrays.copyOfRange(bytes,offset,Math.min(bytes.length,offset+8192));
      check(t.chunk(identity().put("index",index).put("data",Base64.getEncoder().encodeToString(part)),0),"ordered chunk");
    }
    return t.commit(identity(),0)!=null;
  }
  public static int run(JSONObject fixtures) throws Exception {
    assertions=0;
    JSONObject start=new JSONObject().put("sessionId","fixture-session").put("epoch",1).put("sceneTransferVersion",1).put("versionChecksum","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").put("instanceId","fixture-instance");
    check(ParallaxSceneTransfer.validStart(start),"valid start");
    for(Object invalid:new Object[]{1.5,true,"1",0,2147483648L})check(!ParallaxSceneTransfer.validStart(new JSONObject(start.toString()).put("epoch",invalid)),"invalid start epoch");
    check(!ParallaxSceneTransfer.validStart(new JSONObject(start.toString()).put("sceneTransferVersion",true)),"boolean start version");
    check(!ParallaxSceneTransfer.validStart(new JSONObject(start.toString()).put("extra",1)),"extra start field");
    JSONObject limits=fixtures.getJSONObject("limits");
    check(limits.getInt("sceneBytes")==ParallaxSceneTransfer.SCENE_BYTES,"scene bytes");
    check(limits.getInt("chunkBytes")==ParallaxSceneTransfer.CHUNK_BYTES,"chunk bytes");
    check(limits.getInt("chunks")==ParallaxSceneTransfer.MAX_CHUNKS,"chunks");
    check(limits.getInt("timeoutMs")==ParallaxSceneTransfer.TIMEOUT_MS,"timeout");
    JSONArray cases=fixtures.getJSONArray("sceneCases");
    for(int i=0;i<cases.length();i++){JSONObject c=cases.getJSONObject(i);check(scene(c.getJSONObject("scene"))==c.getBoolean("accepted"),c.getString("name"));}
    JSONArray traces=fixtures.getJSONArray("transferTraces");
    // A fractional generation must not truncate into an abort of the active transaction.
    JSONArray complete=traces.getJSONObject(0).getJSONArray("steps");
    ParallaxSceneTransfer fractionalAbort=new ParallaxSceneTransfer("fixture-session",1);
    check(fractionalAbort.begin(complete.getJSONArray(0).getJSONObject(1),0),"fractional abort setup");
    fractionalAbort.abort(identity().put("generation",1.5));
    check(fractionalAbort.chunk(complete.getJSONArray(1).getJSONObject(1),0),"fractional abort preserves transaction");
    check(fractionalAbort.commit(identity(),0)!=null,"fractional abort preserves commit");
    for(int i=0;i<traces.length();i++) {
      JSONObject trace=traces.getJSONObject(i);ParallaxSceneTransfer t=new ParallaxSceneTransfer("fixture-session",1);JSONArray steps=trace.getJSONArray("steps");long now=0;
      for(int j=0;j<steps.length();j++) {JSONArray step=steps.getJSONArray(j);JSONObject p=step.getJSONObject(1);boolean result;
        switch(step.getString(0)){
          case "BEGIN":result=t.begin(p,now);break;
          case "CHUNK":result=t.chunk(p,now);break;
          case "COMMIT":result=t.commit(p,now)!=null;break;
          case "ABORT":result=t.abort(p);break;
          case "EXPIRE":now=15000;t.expire(now);result=true;break;
          default:throw new AssertionError("unknown fixture operation");
        }
        check(result==step.getBoolean(2),trace.getString("name")+" step "+j);
      }
    }
    JSONArray sizes=fixtures.getJSONArray("sizeCases");
    for(int i=0;i<sizes.length();i++) {JSONObject size=sizes.getJSONObject(i), scene=new JSONObject(cases.getJSONObject(0).getJSONObject("scene").toString());JSONArray entities=new JSONArray();
      for(int j=0;j<size.getInt("count");j++){JSONObject e=new JSONObject(scene.getJSONArray("entities").getJSONObject(0).toString());e.put("id","entity-"+j);e.put("content",size.getString("content"));entities.put(e);}scene.put("entities",entities);check(scene(scene),"size "+i);
    }
    return assertions;
  }
  public static void main(String[] args) throws Exception {System.out.println("Parallax native JVM boundary: "+run(new JSONObject(new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8)))+" assertions passed (no Android UI/AR claim)");}
}
