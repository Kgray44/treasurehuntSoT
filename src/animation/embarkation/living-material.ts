/** The same localized material runs during entry, stillness, and live Muster.
 * All motion uses continuous authored time; there is no arrival reset. */
export const livingMaterial = `
uniform sampler2D livingMasks,liveBacking,roomOriginal,liveProps,liveFlames;
uniform float livingQuality,reducedMotion,livingEnabled;
const vec4 flames[13]=vec4[13](vec4(1028.,674.,12.,61.),vec4(109.,471.,6.,34.),vec4(135.,477.,5.,28.),vec4(1297.,546.,6.,30.),vec4(1320.,526.,7.,37.),vec4(1340.,509.,7.,44.),vec4(501.,427.,4.,20.),vec4(686.,423.,5.,29.),vec4(404.,94.,7.,31.),vec4(301.,210.,4.,21.),vec4(735.,165.,5.,25.),vec4(1090.,178.,5.,25.),vec4(518.,364.,4.,23.));
const vec4 lamps[5]=vec4[5](vec4(348.,0.,466.,157.),vec4(277.,112.,327.,234.),vec4(706.,64.,772.,204.),vec4(1046.,67.,1133.,218.),vec4(488.,297.,546.,390.));
vec2 imageUV(vec2 pixel){return vec2(pixel.x/1536.,1.-pixel.y/1024.);}
float pulse(float t,float phase){return sin(t*4.73+phase)*.44+sin(t*7.19+phase*1.7)*.32+sin(t*1.137+phase*.3)*.24;}
vec3 livingRoom(vec2 sourceUV,vec3 base){
 if(livingEnabled<.5)return base;
 base=texture(liveBacking,sourceUV).rgb;
 vec2 pixel=vec2(sourceUV.x*1536.,(1.-sourceUV.y)*1024.);
 float scale=mix(.48,1.,livingQuality*.5), quiet=mix(1.,.12,reducedMotion);
 vec2 p=sourceUV;float water=texture(livingMasks,p).b;
 if(water>.001){
  float nearWater=clamp((pixel.y-320.)/180.,0.,1.);
  float energy=(.22+nearWater*.40)*(1.+windLevel*.5)*scale*(1.-reducedMotion);
  vec2 ripple=vec2(sin(pixel.y*.171+time*.73)+sin(pixel.y*.319-time*.413)*.43,sin(pixel.x*.091+time*.317)*.37+sin(pixel.x*.217-time*.571)*.22);
  p+=ripple*vec2(1./1536.,1./1024.)*water*energy;
  base=texture(roomOriginal,p).rgb;
  float silver=max(smoothstep(.25,.8,dot(base,vec3(.2126,.7152,.0722))),smoothstep(.19,.48,base.r)*smoothstep(.02,.13,base.r-base.b)*.55);
  float shimmer=pulse(time*.31,pixel.y*.09+pixel.x*.017)*.085*silver;
  float sparkle=pow(max(0.,sin(pixel.x*.41+time*.291)*sin(pixel.y*.73-time*.137)),18.)*.16*silver;
  base*=1.+water*(shimmer+sparkle)*scale*mix(1.,.18,reducedMotion);
 }
 // Inverse transport around fixed suspension points. The rope follows the
 // pivot, while the lamp retains the small residual energy of the arrival.
 for(int i=0;i<5;i++){
  vec4 b=lamps[i];vec2 center=vec2((b.x+b.z)*.5,b.y);vec2 local=pixel-center;
  if(pixel.x<b.x-6.||pixel.x>b.z+6.||pixel.y<b.y-3.||pixel.y>b.w+5.)continue;
  float f=float(i),phase=f*1.731;
  float residual=.023*exp(-max(0.,time-31.)/3.8)*sin((time-31.)*2.13+phase);
  float angle=(sin(time*(.91+f*.037)+phase)*.0105+sin(time*.271+phase*2.)*.0032+residual+windLevel*.009*sin(time*.71+phase))*quiet;
  float c=cos(angle),s=sin(angle);vec2 old=center+mat2(c,s,-s,c)*local;
  // Attachment response decays to zero at the fixed hanging pivot.
  old.x+=sin(time*2.9+f)*.62*pow(clamp(local.y/(b.w-b.y),0.,1.),2.)*quiet;
  vec2 op=imageUV(old);vec4 prop=texture(liveProps,op);
  base=mix(base,prop.rgb,prop.a);
  p=op;
 }
 vec2 flamePixel=vec2(p.x*1536.,(1.-p.y)*1024.);
 for(int i=0;i<13;i++){
  vec4 f=flames[i];float phase=float(i)*2.173,fl= pulse(time,phase);
  vec2 delta=flamePixel-f.xy;
  float radius=i==0?98.:i<6?61.:48.;float distance=length(delta/vec2(radius,radius*1.2));
  if(distance<1.6&&livingQuality>.5){float glow=exp(-distance*distance*3.)*fl*.037*scale;base*=1.+vec3(1.,.56,.19)*glow;}
  if(abs(delta.x)>f.z*2.5||delta.y>4.||delta.y<-f.w*1.3)continue;
  float height=clamp(-delta.y/f.w,0.,1.3), shelter=i>=8?.38:1.;
  float flameMotion=mix(1.,.12,reducedMotion)*scale*shelter*(1.+windLevel*.65);
  float tip=(sin(time*(5.1+float(i)*.07)+phase)*.72+sin(time*8.731+phase)*.28)*f.z*.32*height*height*flameMotion;
  float stretch=1.+fl*.085*flameMotion;
  vec2 samplePoint=f.xy+vec2(delta.x-tip,delta.y/stretch);
  vec2 sp=imageUV(samplePoint);
  vec4 fire=texture(liveFlames,sp);
  base=mix(base,fire.rgb*(1.+fl*.072*scale),fire.a);
 }
 return base;
}
`;
