/*
 * GryphonEDM blacklight paint mandala.
 * A WebGL2 fluid simulation of fluorescent paint, seeded with a code-drawn
 * version of the swirl logo and folded into a kaleidoscope.
 * Public API: window.GryphonMandala.start(canvas) / .stop() / .set(name, value) / .pour() / .defaults
 */
(function () {
'use strict';
var DEFAULTS = { flow: 0.26, trip: 0.35, swirl: 0.7, drips: 1, gloss: 1, glow: 0.55, folds: 6, uv: 1 };
var params = Object.assign({}, DEFAULTS);
var gl = null, cv = null, ready = false, running = false, rafId = 0;
var P = {}, api;

function init(canvas) {
cv = canvas;
gl = cv.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
if (!gl) return 'This browser doesn’t support WebGL2, which the mandala needs.';
var canFloat = !!gl.getExtension('EXT_color_buffer_float');
if (!canFloat) return 'This browser can’t render the paint simulation (no floating-point WebGL).';
const VS=`#version 300 es
in vec2 p;out vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0,1);}`;

const NOISE=`
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.+2.*fract(sin(p)*43758.5453123);}
vec2 hash2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
float hash1(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
 return mix(mix(mix(dot(hash3(i),f),dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
            mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
`;

/* The painting, generated from scratch: marbled petals, filigree veins, curl eyes, center spiral, dots. */
const GEN=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;
uniform float t,seed,flow;
${NOISE}
// swirl the plane around a few moving cell centers: gives the little curls / eyes all over the logo
vec2 vortex(vec2 q,float sc,float str,float tt,float sd){
 vec2 g=floor(q*sc),f=fract(q*sc),acc=vec2(0);
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
  vec2 n=vec2(i,j),h=hash2(g+n+sd);
  vec2 c=n+.5+.3*sin(tt*.35+6.283*h);
  vec2 d=f-c;float s=(h.x>.5?1.:-1.)*str*(.6+.8*h.y)*exp(-dot(d,d)*7.);
  acc+=rot(s)*d-d;
 }
 return q+acc/sc;
}
vec3 pal(float x){ // navy, royal, azure, teal, turquoise, green, mint - the logo's marble
 x=fract(x);
 vec3 c0=vec3(.03,.07,.26),c1=vec3(.10,.25,.72),c2=vec3(.12,.45,.85),c3=vec3(.05,.60,.56),
      c4=vec3(.12,.78,.66),c5=vec3(.10,.62,.33),c6=vec3(.26,.85,.52);
 float k=x*7.;
 vec3 c=mix(c0,c1,smoothstep(0.,1.,k));
 c=mix(c,c2,smoothstep(1.,2.,k));c=mix(c,c3,smoothstep(2.,3.,k));c=mix(c,c4,smoothstep(3.,4.,k));
 c=mix(c,c5,smoothstep(4.,5.,k));c=mix(c,c6,smoothstep(5.,6.,k));c=mix(c,c0*1.4+c1*.3,smoothstep(6.,7.,k));
 return c;
}
float lineAA(float v,float w){float fr=fract(v);float d=min(fr,1.-fr)/max(fwidth(v),1e-4);return 1.-smoothstep(w-.8,w+.8,d);}
void main(){
 float T=t;
 vec2 p=uv-.5;
 vec2 p0=p;
 float r=length(p);
 // slow whole-body rotation + stronger twist toward the middle (differential swirl)
 p=rot(T*.025+ (1.6*exp(-r*7.)+.25)*sin(T*.11)*.6 + 2.2*exp(-r*9.))*p;
 float a=atan(p.y,p.x);
 // ---------- marbled petals ----------
 vec2 q=p*3.2+seed;
 q=vortex(q,2.2,2.6,T,seed);
 q=vortex(q,5.,2.2,T*1.3,seed+7.);
 q=vortex(q,11.,1.6,T*1.7,seed+19.);
 float w1=fbm(vec3(q*.9,T*.03+seed));
 float w2=fbm(vec3(q*1.7+w1*1.8,T*.04));
 float petal=cos(a*8.+w1*3.+r*6.)*.5+.5;           // eight big lobes flowing out from the center
 float band=w2*2.6+petal*.55+r*1.6+w1*.8;
 vec3 col=pal(band*1.1+seed*.1);
 // painterly streaks inside each band
 float streak=sin(fbm(vec3(q*3.,T*.05))*14.+band*6.);
 col*=.82+.22*streak;
 col=mix(col,col*vec3(.55,.75,1.25),smoothstep(.3,.8,fbm(vec3(q*.6,seed))));  // drift toward blue in places
 // black filigree veins: two families of contours with varying width
 float wv=1.8+3.2*(fbm(vec3(q*1.3,4.))*.5+.5);
 float veins=max(lineAA(band*1.1,wv),lineAA((w1*3.+petal*.4)*1.3+r*2.,wv*.8)*.9);
 col=mix(col,vec3(.005,.01,.04),veins);
 // darker rim like the edge of the pour
 col*=mix(1.,.55,smoothstep(.33,.47,r));
 // ---------- dots: orange + yellow droplets orbiting the center ----------
 vec2 pd=rot(T*.05)*p0;
 for(int L=0;L<3;L++){
  float cs=L==0?.022:(L==1?.034:.05);
  vec2 g=floor(pd/cs+float(L)*3.1),f=fract(pd/cs+float(L)*3.1);
  vec2 h=hash2(g+seed*3.+float(L)*11.);
  vec2 cc=(g+.5+(h-.5)*.5)*cs-float(L)*3.1*cs;
  float rr=length(cc);
  float dens=exp(-pow((rr-.15)/(.055+.015*float(L)),2.))*.6+(L==2?.035:.008);
  if(hash1(g+seed+float(L))<dens){
   float rad=cs*(.14+.22*h.y)*(L==2?.75:1.);
   float d=length(pd-cc);
   float m=1.-smoothstep(rad-.0015,rad+.0015,d);
   vec3 dc=h.x>.4?vec3(1.,.26,.03):vec3(1.,.8,.08);
   if(h.x>.93)dc=vec3(.95,.25,.12);
   col=mix(col,dc*(.9+.15*(1.-d/rad)),m);
  }
 }
 // ---------- center: green core, yellow spiral arm, orange ring ----------
 float edgeN=.012*fbm(vec3(p*18.,T*.1+seed));
 float ringR=.105+edgeN;
 float sp=fract(a/6.2832 + 3.2*sqrt(r)*2. - T*.12*flow);
 vec3 core=mix(vec3(.10,.62,.32),vec3(.08,.45,.30),smoothstep(0.,.06,r));
 float arm=smoothstep(.55,.62,sp)*(1.-smoothstep(.9,.97,sp));
 core=mix(core,vec3(1.,.83,.10),arm);
 core=mix(core,vec3(1.,.95,.45),arm*smoothstep(.07,.0,r)*.4);
 // orange swirl ring with yellow sweep
 float ringBand=smoothstep(ringR-.03,ringR-.02,r);
 vec3 orange=mix(vec3(1.,.2,.02),vec3(1.,.38,.04),smoothstep(.3,.9,fract(a/6.2832*2.+r*9.-T*.08)));
 core=mix(core,orange,ringBand*(.85+.15*sin(a*5.+T)));
 core=mix(core,vec3(1.,.8,.12),ringBand*smoothstep(.6,.95,fract(a/6.2832-r*6.-T*.1))*.55);
 float coreMask=1.-smoothstep(ringR-.004,ringR+.004,r);
 col=mix(col,core,coreMask);
 // thin dark lines inside the spiral for definition
 col=mix(col,col*.35,coreMask*lineAA(a/6.2832+6.4*sqrt(r)-T*.12*flow+.5,1.)*smoothstep(.015,.03,r)*(1.-ringBand)*.6);
 o=vec4(clamp(col,0.,1.),1);
}`;

/* Display: fluorescent response, wet-paint relief, glow, grain. */
const DISP=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;
uniform sampler2D paint,fine;uniform float t,uvOn,trip,gloss,glow,lodOff;uniform vec2 res,m;
// region: which part of the full image this pass draws (whole image live; one tile of a big PNG)
uniform vec4 region;
${NOISE}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 hueShift(vec3 c,float h){const vec3 k=vec3(.57735);float ca=cos(h);return c*ca+cross(k,c)*sin(h)+k*dot(k,c)*(1.-ca);}
vec3 fluor(vec3 c){
 float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));float sat=(mx-mn)/(mx+1e-4);
 vec3 s=mix(vec3(lum(c)),c,1.55);
 s.b+=.18*s.b; s.r+=.08*s.b; s.g*=1.08;
 float e=pow(clamp(sat*mx,0.,1.),1.6);
 return max(s,0.)*(.25+1.9*e);
}
void main(){
 vec2 U=region.xy+uv*region.zw;
 vec2 c=U-.5;float r=length(c);
 float edge=.466+.006*noise(vec3(c*9.,t*.1))+.003*sin(atan(c.y,c.x)*23.);
 float inside=smoothstep(edge,edge-.004,r);
 float px=1./res.x;
 float hC=lum(texture(paint,U,2.+lodOff).rgb);
 float hX=lum(texture(paint,U+vec2(px*3.,0),2.+lodOff).rgb);
 float hY=lum(texture(paint,U+vec2(0,px*3.),2.+lodOff).rgb);
 vec3 n=normalize(vec3((hC-hX)*1.6*gloss,(hC-hY)*1.6*gloss,1.));
 vec2 ca=c*.004*smoothstep(.2,.46,r);
 // sharp colour comes from the fine paint layer (the tile's own, for big PNGs)
 vec2 caL=ca/region.zw;
 vec3 col=vec3(texture(fine,uv+caL).r,texture(fine,uv).g,texture(fine,uv-caL).b);
 float hz=fbm(vec3(U*2.,t*.05))*6.2831;
 float hs=trip*(hz*.55+sin(t*.25)*.6);
 col=clamp(hueShift(col,hs),0.,1.);
 vec3 glowS=textureLod(paint,U,4.5+lodOff).rgb+textureLod(paint,U,6.+lodOff).rgb;
 glowS=clamp(hueShift(glowS*.5,hs),0.,1.);
 // the light drifts on its own and always stays tilted: straight-on light would glare off every flat patch at once
 vec2 tilt=vec2(cos(t*.3),sin(t*.23))*.6;
 float tl=length(tilt);tilt=tl<1e-3?vec2(.5,0.):tilt/tl*clamp(tl,.5,.9);
 vec3 L=normalize(vec3(tilt,1.));
 float rv=max(dot(reflect(-L,n),vec3(0,0,1)),0.);float spec=pow(rv,70.)+.18*pow(rv,10.);
 float grain=noise(vec3(U*res*.5,1.))*.5+.5;
 vec3 lit;
 if(uvOn>.5){
  lit=fluor(col)+fluor(glowS)*glow;
  lit+=spec*vec3(.75,.7,1.)*.9*min(gloss,1.5);
  lit*=.92+.16*grain;
  lit+=vec3(.02,0,.05);
 }else{
  float diff=max(dot(n,L),0.);
  lit=col*(.72+.35*diff)+spec*.6;
  lit*=.95+.1*grain;
 }
 float halo=exp(-max(r-edge,0.)*28.)*(1.-inside);
 vec3 room=uvOn>.5?vec3(.028,.012,.06):vec3(.05,.045,.06);
 vec3 spill=(uvOn>.5?fluor(textureLod(paint,.5+normalize(c+1e-5)*.43,5.+lodOff).rgb)*.45:vec3(0))*halo;
 o=vec4(mix(room+spill+vec3(.18,.05,.5)*halo*.25*uvOn,lit,inside),1.);
 o.rgb=1.-exp(-o.rgb*1.35);
}`;

/* ---------- fluid simulation (stable fluids) ---------- */
const HDR=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;`;
const ADVECT=HDR+`uniform sampler2D src,vel;uniform float dt,diss;uniform float rad;
void main(){vec2 v=texture(vel,uv).xy;vec4 s=texture(src,uv-dt*v)*diss;
 float r=length(uv-.5);o=s*(rad>0.?smoothstep(rad,rad-.02,r):1.);}`;
/* MacCormack correction keeps paint edges crisp instead of blurring to mud */
const MACC=HDR+`uniform sampler2D phi,hat,vel;uniform float dt;uniform vec2 tx;
void main(){vec2 v=texture(vel,uv).xy;vec2 back=uv-dt*v;
 vec4 h=texture(hat,uv);vec4 bar=texture(hat,uv+dt*texture(vel,uv).xy);
 vec4 res=h+.5*(texture(phi,uv)-bar);
 vec2 st=back/tx-.5;vec2 i=(floor(st)+.5)*tx;
 vec4 a=texture(phi,i),b=texture(phi,i+vec2(tx.x,0)),c=texture(phi,i+vec2(0,tx.y)),d=texture(phi,i+tx);
 o=clamp(res,min(min(a,b),min(c,d)),max(max(a,b),max(c,d)));}`;
const CURL=HDR+`uniform sampler2D vel;uniform vec2 tx;
void main(){float L=texture(vel,uv-vec2(tx.x,0)).y,R=texture(vel,uv+vec2(tx.x,0)).y,B=texture(vel,uv-vec2(0,tx.y)).x,T=texture(vel,uv+vec2(0,tx.y)).x;
 o=vec4((R-L-T+B)/(2.*tx.x),0,0,1);}`;
/* vorticity confinement + the dish's own currents: a whirlpool in the middle and a slow wandering breeze */
const FORCE=HDR+`uniform sampler2D vel,curl;uniform vec2 tx;uniform float dt,eps,t,swirl,breeze;
${NOISE}
void main(){
 float L=abs(texture(curl,uv-vec2(tx.x,0)).x),R=abs(texture(curl,uv+vec2(tx.x,0)).x),B=abs(texture(curl,uv-vec2(0,tx.y)).x),T=abs(texture(curl,uv+vec2(0,tx.y)).x);
 float C=texture(curl,uv).x;
 vec2 g=vec2(R-L,T-B);g/=length(g)+1e-5;vec2 f=eps*vec2(g.y,-g.x)*C*tx.x;
 vec2 c=uv-.5;float r=length(c);
 // the dish's own currents are a target the paint relaxes toward, so speeds stay gentle
 vec2 tgt=vec2(-c.y,c.x)*swirl*(1.1*exp(-r*r*40.)+.12);
 float e=.02;vec3 q=vec3(uv*2.5,t*.05);
 tgt+=breeze*vec2(fbm(q+vec3(0,e,0))-fbm(q-vec3(0,e,0)),-(fbm(q+vec3(e,0,0))-fbm(q-vec3(e,0,0))))/(2.*e);
 vec2 v=texture(vel,uv).xy;
 v+=(tgt-v)*(1.-exp(-1.5*dt))+f*dt;
 o=vec4(v*smoothstep(.47,.45,r),0,1);}`;
const DIV=HDR+`uniform sampler2D vel;uniform vec2 tx;
void main(){float L=texture(vel,uv-vec2(tx.x,0)).x,R=texture(vel,uv+vec2(tx.x,0)).x,B=texture(vel,uv-vec2(0,tx.y)).y,T=texture(vel,uv+vec2(0,tx.y)).y;
 o=vec4((R-L+T-B)/(2.*tx.x),0,0,1);}`;
const PRES=HDR+`uniform sampler2D p,div;uniform vec2 tx;
void main(){float L=texture(p,uv-vec2(tx.x,0)).x,R=texture(p,uv+vec2(tx.x,0)).x,B=texture(p,uv-vec2(0,tx.y)).x,T=texture(p,uv+vec2(0,tx.y)).x;
 o=vec4((L+R+B+T-texture(div,uv).x*tx.x*tx.x)*.25,0,0,1);}`;
const GRAD=HDR+`uniform sampler2D p,vel;uniform vec2 tx;
void main(){float L=texture(p,uv-vec2(tx.x,0)).x,R=texture(p,uv+vec2(tx.x,0)).x,B=texture(p,uv-vec2(0,tx.y)).x,T=texture(p,uv+vec2(0,tx.y)).x;
 o=vec4(texture(vel,uv).xy-vec2(R-L,T-B)/(2.*tx.x),0,1);}`;
/* velocity splat: push (stir) or push outward (a drop spreading) */
const VSPLAT=HDR+`uniform sampler2D src;uniform vec2 pt,push;uniform float r,outward;
void main(){vec2 d=uv-pt;float g=exp(-dot(d,d)/r);
 o=vec4(texture(src,uv).xy+g*push+outward*g*d/(sqrt(dot(d,d))+.002)*.12,0,1);}`;
/* paint drop: opaque pigment, optional dark rim like a cell */
const DSPLAT=HDR+`uniform sampler2D src;uniform vec2 pt;uniform vec3 col;uniform float r,rim;
void main(){float d=length(uv-pt);vec4 s=texture(src,uv);
 float w=smoothstep(r,r*.85,d);
 vec3 c=mix(col,vec3(.01,.015,.05),rim*smoothstep(r*.55,r*.95,d));
 o=vec4(mix(s.rgb,c,w),1);}`;
/* Keep feeding the dish: blend a little of the slowly changing design back in so it never turns to mud */
const MIXP=HDR+`uniform sampler2D dye,src;uniform float k;void main(){o=vec4(mix(texture(dye,uv).rgb,texture(src,uv).rgb,k),1);}`;
/* Pigment separation: snap mixed colors toward real paints, and lay dark lacing where two paints meet */
const PAINT=HDR+`uniform sampler2D dye;uniform float folds,t,smoothDye;uniform vec4 region;
// B-spline sampling of the simulation grid: removes the stair-steps a 1024-cell grid shows when blown up to 4k/8k
vec4 cubicW(float v){vec4 n=vec4(1,2,3,4)-v;vec4 s=n*n*n;float x=s.x,y=s.y-4.*s.x,z=s.z-4.*s.y+6.*s.x;return vec4(x,y,z,6.-x-y-z)*(1./6.);}
vec3 bicubic(sampler2D tx,vec2 p){
 vec2 ts=vec2(textureSize(tx,0)),inv=1./ts;p=p*ts-.5;vec2 f=fract(p);p-=f;
 vec4 xc=cubicW(f.x),yc=cubicW(f.y);vec4 c=p.xxyy+vec2(-.5,1.5).xyxy;
 vec4 s=vec4(xc.xz+xc.yw,yc.xz+yc.yw);vec4 off=(c+vec4(xc.yw,yc.yw)/s)*inv.xxyy;
 vec3 s0=texture(tx,off.xz).rgb,s1=texture(tx,off.yz).rgb,s2=texture(tx,off.xw).rgb,s3=texture(tx,off.yw).rgb;
 float sx=s.x/(s.x+s.y),sy=s.z/(s.z+s.w);
 return mix(mix(s3,s2,sx),mix(s1,s0,sx),sy);
}
const int NP=10;
uniform vec3 P[NP];
void main(){
 vec2 c=region.xy+uv*region.zw-.5;
 if(folds>.5){float a=atan(c.y,c.x),r=length(c),s=6.2832/folds;a=mod(a+t*.02,s);a=abs(a-s*.5);c=r*vec2(cos(a),sin(a));}
 vec3 x=smoothDye>.5?bicubic(dye,c+.5):texture(dye,c+.5).rgb;
 float d1=9.,d2=9.;vec3 acc=vec3(0);float ws=0.;
 for(int i=0;i<NP;i++){float d=distance(x,P[i]);
  if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}
  float w=exp(-d*d*38.);acc+=w*P[i];ws+=w;}
 vec3 snap=acc/max(ws,1e-5);
 vec3 col=mix(x,snap,.55);
 float lace=1.-smoothstep(.0,.07,d2-d1);
 col=mix(col,vec3(.01,.012,.04),lace*.8);
 o=vec4(col,1);
}`;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('compile: '+(gl.getShaderInfoLog(s)||'no log'));return s;}
function prog(fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
 gl.bindAttribLocation(p,0,'p');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link: '+(gl.getProgramInfoLog(p)||'no log'));
 const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);u[a.name.replace('[0]','')]=gl.getUniformLocation(p,a.name);}
 return{p,u};}
let stage='';
try{for(const[k,s]of Object.entries({gen:GEN,disp:DISP,adv:ADVECT,macc:MACC,curl:CURL,force:FORCE,div:DIV,pres:PRES,grad:GRAD,vs:VSPLAT,ds:DSPLAT,paint:PAINT,mix:MIXP})){stage=k;P[k]=prog(s);}}
catch(e){
 // report exactly what this device's compiler said, plus which GPU it is
 let gpu='unknown GPU';
 try{const d=gl.getExtension('WEBGL_debug_renderer_info');gpu=d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}catch(_){}
 const log=String(e&&e.message||e).replace(/\s+/g,' ').trim().slice(0,400)||'(the device gave no error text)';
 console.error('mandala shader "'+stage+'" failed on '+gpu+':',e);
 return 'The mandala couldn\u2019t start on this device. Shader: '+stage+' \u00b7 GPU: '+gpu+' \u00b7 Error: '+log;
}

const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function target(w,fmt,mips){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 if(fmt==='f')gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,w,0,gl.RGBA,gl.HALF_FLOAT,null);
 else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,w,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mips?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 if(mips)gl.generateMipmap(gl.TEXTURE_2D);
 const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
 gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);return{t,f,w};}
function dbl(w){const a=target(w,'f'),b=target(w,'f');return{get r(){return this.x[0]},get w(){return this.x[1]},x:[a,b],swap(){this.x.reverse();}};}
function bindT(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
const N=256,D=1024;
const vel=dbl(N),pres=dbl(N),dye=dbl(D),curlT=target(N,'f'),divT=target(N,'f'),hatT=target(D,'f');
const paint=target(1024,'8',true),genT=target(D,'8');
function run(pg,tgt,tex,uni){gl.useProgram(pg.p);let unit=0;
 for(const[k,t]of Object.entries(tex||{})){bindT(unit,t);gl.uniform1i(pg.u[k],unit);unit++;}
 for(const[k,v]of Object.entries(uni||{})){const l=pg.u[k];if(l==null)continue;
  if(typeof v==='number')gl.uniform1f(l,v);else if(v.length===2)gl.uniform2fv(l,v);else gl.uniform3fv(l,v);}
 const w=tgt?tgt.w:0;gl.bindFramebuffer(gl.FRAMEBUFFER,tgt?tgt.f:null);gl.viewport(0,0,w,w);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}

const PIG={
 ink:[.012,.02,.07],navy:[.04,.09,.32],royal:[.09,.24,.78],cobalt:[.22,.52,.95],teal:[.03,.6,.58],
 turq:[.2,.82,.72],green:[.07,.6,.28],mint:[.4,.92,.58],yellow:[1,.84,.08],orange:[1,.3,.02]};
const PAL=new Float32Array(Object.values(PIG).flat());
const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];

let seed=0,T=8;
function pour(){
 seed=Math.floor(Math.random()*997)+1;
 run(P.gen,dye.w,{},{t:T,seed:seed,flow:1});dye.swap();
 for(const d of[vel,pres])for(const x of d.x){gl.bindFramebuffer(gl.FRAMEBUFFER,x.f);gl.clear(gl.COLOR_BUFFER_BIT);}
}
function dropPaint(x,y,col,r,rim,spread){
 run(P.ds,dye.w,{src:dye.r.t},{pt:[x,y],col:col,r:r,rim:rim});dye.swap();
 run(P.vs,vel.w,{src:vel.r.t},{pt:[x,y],push:[0,0],r:r*r*1.5,outward:spread});vel.swap();
}
function bigDrop(){
 const a=Math.random()*6.283,rr=.1+Math.random()*.28;
 const col=pick([PIG.ink,PIG.navy,PIG.royal,PIG.cobalt,PIG.royal,PIG.teal,PIG.turq,PIG.mint,PIG.orange,PIG.yellow]);
 dropPaint(.5+Math.cos(a)*rr,.5+Math.sin(a)*rr,col,.04+Math.random()*.05,Math.random()<.5?1:0,1.4);
 if(Math.random()<.5)dropPaint(.5+Math.cos(a)*rr,.5+Math.sin(a)*rr,pick([PIG.orange,PIG.yellow,PIG.mint,PIG.cobalt]),.015+Math.random()*.02,0,.5);
}
function autoDrop(){
 const u=Math.random();let x,y,col,r,rim=Math.random()<.45?1:0;
 if(u<.5){const a=Math.random()*6.283,rr=.07+Math.random()*.16;x=.5+Math.cos(a)*rr;y=.5+Math.sin(a)*rr;
  col=Math.random()<.6?PIG.orange:PIG.yellow;r=.008+Math.random()*.014;rim=0;
 }else if(u<.62){const a=Math.random()*6.283;x=.5+Math.cos(a)*.025;y=.5+Math.sin(a)*.025;col=Math.random()<.5?PIG.yellow:PIG.green;r=.018;rim=0;
 }else{const a=Math.random()*6.283,rr=.12+Math.random()*.3;x=.5+Math.cos(a)*rr;y=.5+Math.sin(a)*rr;
  col=pick([PIG.royal,PIG.cobalt,PIG.royal,PIG.teal,PIG.turq,PIG.mint,PIG.navy,PIG.ink,PIG.ink]);r=.012+Math.random()*.03;}
 dropPaint(x,y,col,r,rim,1);
}

const ptr={x:.5,y:.5,dx:0,dy:0,down:0,moved:0};
function pos(e){const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);[ptr.x,ptr.y]=pos(e);ptr.down=1;ptr.moved=0;});
cv.addEventListener('pointermove',e=>{const[x,y]=pos(e);if(ptr.down){ptr.dx+=x-ptr.x;ptr.dy+=y-ptr.y;ptr.moved+=Math.hypot(x-ptr.x,y-ptr.y);}ptr.x=x;ptr.y=y;});
cv.addEventListener('pointerup',()=>{if(ptr.down&&ptr.moved<.01){
  dropPaint(ptr.x,ptr.y,pick([PIG.orange,PIG.yellow,PIG.mint,PIG.cobalt,PIG.turq,PIG.green]),.02+Math.random()*.02,Math.random()<.5?1:0,1.6);}
 ptr.down=0;});
cv.addEventListener('pointercancel',()=>ptr.down=0);

let forceW=0,lookW=0;
function resize(){const d=Math.min(devicePixelRatio||1,2);const w=forceW||Math.min(Math.round(cv.clientWidth*d),1600);if(w>0&&cv.width!==w){cv.width=w;cv.height=w;}}
const txN=[1/N,1/N],txD=[1/D,1/D];
let last=0,dropClock=0,bigClock=3,genTick=0;
function step(dt){
 const sdt=dt*params.flow;
 run(P.curl,curlT,{vel:vel.r.t},{tx:txN});
 run(P.force,vel.w,{vel:vel.r.t,curl:curlT.t},{tx:txN,dt:sdt,eps:4,t:T,swirl:params.swirl,breeze:.035});vel.swap();
 if(ptr.down&&(ptr.dx||ptr.dy)){
  run(P.vs,vel.w,{src:vel.r.t},{pt:[ptr.x,ptr.y],push:[ptr.dx/Math.max(dt,.008)*.55,ptr.dy/Math.max(dt,.008)*.55],r:.0012,outward:0});vel.swap();}
 ptr.dx=ptr.dy=0;
 run(P.div,divT,{vel:vel.r.t},{tx:txN});
 for(let i=0;i<22;i++){run(P.pres,pres.w,{p:pres.r.t,div:divT.t},{tx:txN});pres.swap();}
 run(P.grad,vel.w,{p:pres.r.t,vel:vel.r.t},{tx:txN});vel.swap();
 run(P.adv,vel.w,{src:vel.r.t,vel:vel.r.t},{dt:sdt,diss:Math.exp(-.35*sdt),rad:.47});vel.swap();
 run(P.adv,hatT,{src:dye.r.t,vel:vel.r.t},{dt:sdt,diss:1,rad:0});
 run(P.macc,dye.w,{phi:dye.r.t,hat:hatT.t,vel:vel.r.t},{dt:sdt,tx:txD});dye.swap();
 if((genTick++)%3===0)run(P.gen,genT,{},{t:T,seed:seed,flow:1});
 run(P.mix,dye.w,{dye:dye.r.t,src:genT.t},{k:1-Math.exp(-1.2*sdt)});dye.swap();
 if(params.drips>0){
  bigClock-=sdt*params.drips;if(bigClock<=0){bigDrop();bigClock=6+Math.random()*6;}
  dropClock-=sdt*params.drips;if(dropClock<=0){autoDrop();dropClock=.35+Math.random()*.6;}
 }
}
const FULL=new Float32Array([0,0,1,1]);
function renderPaint(tgt,region){
 tgt=tgt||paint;
 gl.useProgram(P.paint.p);gl.uniform3fv(P.paint.u.P,PAL);gl.uniform4fv(P.paint.u.region,region||FULL);
 run(P.paint,tgt,{dye:dye.r.t},{folds:params.folds,t:T,smoothDye:tgt===paint?0:1});
 gl.bindTexture(gl.TEXTURE_2D,tgt.t);gl.generateMipmap(gl.TEXTURE_2D);
}
// res = the size the look is tuned to (the live canvas), so exports match what's on screen
function display(fbo,w,src,look,fine,region){
 src=src||paint;look=look||w;fine=fine||src;
 gl.useProgram(P.disp.p);gl.uniform4fv(P.disp.u.region,region||FULL);
 run(P.disp,{f:fbo,w:w},{paint:src.t,fine:fine.t},{t:T,uvOn:params.uv,trip:params.trip,gloss:params.gloss,glow:params.glow,lodOff:Math.log2(src.w/1024),res:[look,look],m:[ptr.x,ptr.y]});
}
function frame(now){
 if(!running)return;
 resize();const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;
 if(api.recording!==true){T+=dt*params.flow;if(params.flow>0)step(dt);}
 // while a video records, the canvas renders at 2048px from the full-resolution paint layer
 if(forceW){if(!paintHi)paintHi=target(2048,'8',true);renderPaint(paintHi);display(null,cv.width,paintHi,lookW);}
 else{renderPaint();display(null,cv.width);}
 rafId=requestAnimationFrame(frame);
}
// offscreen render at any size -> RGBA pixels, top row first
const snap={t:null,f:null,w:0};let paintHi=null;
function grab(size){
 if(snap.w!==size){
  if(snap.t){gl.deleteTexture(snap.t);gl.deleteFramebuffer(snap.f);}
  snap.t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,snap.t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  snap.f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,snap.f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,snap.t,0);snap.w=size;
 }
 // big exports get their own 2048px paint layer so edges stay crisp instead of being stretched
 let src=paint;
 if(size>1024){if(!paintHi)paintHi=target(2048,'8',true);src=paintHi;}
 renderPaint(src);display(snap.f,size,src,Math.max(cv.width,512));
 const px=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,px);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 const out=new Uint8ClampedArray(px.length),row=size*4;
 for(let y=0;y<size;y++)out.set(px.subarray((size-1-y)*row,(size-y)*row),y*row);
 return out;
}
// Big PNGs are drawn in 2048px tiles: a whole 8192px frame is too big for many GPUs to draw in one go.
// Each tile gets its own 2048px paint layer, so edges stay sharp at full size; glow and relief come from
// a shared 2048px layer so they match across tiles. Tiles are stitched onto a 2D canvas.
let paintTile=null,tileOut=null;
function tiled(size){
 const TILE=Math.min(size,2048),n=size/TILE;
 if(!paintHi)paintHi=target(2048,'8',true);
 if(!paintTile)paintTile=target(2048,'8',true);
 if(!tileOut)tileOut=target(2048,'8',false);
 renderPaint(paintHi);
 const out=document.createElement('canvas');out.width=out.height=size;
 const ctx=out.getContext('2d');
 if(!ctx)throw new Error('this browser can\u2019t make an image that big');
 const px=new Uint8Array(TILE*TILE*4),img=new ImageData(TILE,TILE),row=TILE*4;
 for(let ty=0;ty<n;ty++)for(let tx=0;tx<n;tx++){
  const region=new Float32Array([tx/n,ty/n,1/n,1/n]);
  renderPaint(paintTile,region);
  display(tileOut.f,TILE,paintHi,Math.max(cv.width,512),paintTile,region);
  gl.readPixels(0,0,TILE,TILE,gl.RGBA,gl.UNSIGNED_BYTE,px);
  for(let y=0;y<TILE;y++)img.data.set(px.subarray((TILE-1-y)*row,(TILE-y)*row),y*row);
  ctx.putImageData(img,tx*TILE,(n-1-ty)*TILE);
 }
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 return out;
}
function advance(dt){T+=dt*params.flow;step(dt);}
pour();
api._frame=frame;api._pour=pour;api._grab=grab;api._tiled=tiled;api._advance=advance;
api._force=function(w){lookW=cv.width;forceW=w;};api._unforce=function(){forceW=0;};api._canvas=cv;
return null;
}

api = {
 defaults: Object.freeze(Object.assign({}, DEFAULTS)),
 params: params,
 /* returns null on success, or a message explaining why it can't run */
 start: function (canvas) {
  if (!ready) { var err = init(canvas); if (err) return err; ready = true; }
  if (!running) { running = true; rafId = requestAnimationFrame(api._frame); }
  return null;
 },
 stop: function () { running = false; cancelAnimationFrame(rafId); },
 set: function (k, v) { if (k in params) params[k] = +v; },
 reset: function () { Object.assign(params, DEFAULTS); },
 pour: function () { if (ready) api._pour(); },
 recording: false,

 /* PNG of the current moment */
 /* PNG of the current moment, 1024 to 8192px */
 savePNG: function (size) {
  if (!ready) return Promise.reject(new Error('not running'));
  size = size || 2048;
  var c;
  if (size <= 1024) {
   c = document.createElement('canvas'); c.width = c.height = size;
   c.getContext('2d').putImageData(new ImageData(api._grab(size), size, size), 0, 0);
  } else {
   try { c = api._tiled(size); } catch (e) { return Promise.reject(e); }
  }
  return new Promise(function (res, rej) {
   c.toBlob(function (b) {
    c.width = c.height = 0;  // free the big canvas
    if (!b) return rej(new Error('this browser couldn\u2019t build a ' + size + 'px image'));
    download(b, 'gryphon-mandala-' + size + '.png'); res();
   }, 'image/png');
  });
 },

 /* Full-quality video: records the live canvas at 2048px in real time.
    MP4 where the browser can record it (Chrome, Edge, Safari), otherwise WebM (Firefox). */
 videoType: function () {
  if (!window.MediaRecorder) return null;
  var types = ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported(types[i])) return types[i];
  return null;
 },
 saveVideo: async function (seconds, size, onProgress) {
  if (!ready || api.recording) return;
  var type = api.videoType();
  if (!type) throw new Error('this browser can\u2019t record video');
  api.recording = 'video';
  api._force(size || 2048);
  try {
   await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
   var stream = api._canvas.captureStream(60);
   var rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 40000000 });
   var chunks = [];
   rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
   var stopped = new Promise(function (r) { rec.onstop = r; });
   rec.start(500);
   var t0 = performance.now();
   await new Promise(function (r) {
    (function tick() {
     var f = (performance.now() - t0) / 1000 / seconds;
     if (onProgress) onProgress(Math.min(f, 1));
     if (f >= 1) r(); else setTimeout(tick, 200);
    })();
   });
   rec.stop(); await stopped;
   stream.getTracks().forEach(function (t) { t.stop(); });
   var mp4 = type.indexOf('mp4') >= 0;
   download(new Blob(chunks, { type: mp4 ? 'video/mp4' : 'video/webm' }), 'gryphon-mandala.' + (mp4 ? 'mp4' : 'webm'));
  } finally { api._unforce(); api.recording = false; }
 },

 /* Seamless GIF loop recorded forward from now. onProgress(stage, fraction)
    Frames are captured here and encoded in a background worker so the page keeps running smoothly. */
 saveGIF: async function (opts, onProgress) {
  if (!ready || api.recording) return;
  opts = Object.assign({ seconds: 5, size: 640, fps: 20 }, opts);
  var fps = opts.fps, L = Math.round(opts.seconds * fps), F = Math.min(fps, Math.floor(L / 3)), size = opts.size;
  var worker = new Worker(URL.createObjectURL(new Blob([GIF_WORKER], { type: 'text/javascript' })), { type: 'module' });
  var encoded = 0, inFlight = 0, waiters = [], done, failed;
  var finished = new Promise(function (res, rej) { done = res; failed = rej; });
  worker.onmessage = function (e) {
   var m = e.data;
   if (m.type === 'frame-done') {
    encoded++; inFlight--;
    if (onProgress) onProgress('encoding', encoded / L);
    var w = waiters.shift(); if (w) w();
   } else if (m.type === 'done') done(m.bytes);
   else if (m.type === 'error') failed(new Error(m.message));
  };
  worker.onerror = function (e) { failed(new Error(e.message || 'GIF worker failed to start')); };
  worker.postMessage({ type: 'start', size: size, L: L, F: F, delay: Math.round(1000 / fps) });
  var saved = params.flow;
  api.recording = true;
  try {
   params.flow = Math.max(params.flow, 0.15);
   for (var i = 0; i < L + F; i++) {
    api._advance(1 / fps / 2); api._advance(1 / fps / 2);
    var d = api._grab(size);
    // don't let captured frames pile up faster than the worker can encode them
    if (i >= F) { while (inFlight >= 4) await new Promise(function (r) { waiters.push(r); }); inFlight++; }
    worker.postMessage({ type: 'frame', i: i, buf: d.buffer }, [d.buffer]);
    if (onProgress) onProgress('recording', (i + 1) / (L + F));
    await new Promise(function (r) { requestAnimationFrame(r); });
   }
   worker.postMessage({ type: 'finish' });
   var bytes = await finished;
   download(new Blob([bytes], { type: 'image/gif' }), 'gryphon-mandala.gif');
  } finally { api.recording = false; params.flow = saved; worker.terminate(); }
 }
};
/* Runs off the main thread: dithers each frame (smooths the glow gradients that 256-colour GIFs band),
   builds its palette, encodes it, and cross-fades the last second into the first so the loop is seamless. */
var GIF_WORKER = [
"import { GIFEncoder, quantize, applyPalette } from 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';",
"var enc, o, head = [];",
"var BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];",
"function dither(d, s) {",
"  for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {",
"    var t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 9, k = (y * s + x) * 4;",
"    d[k] += t; d[k + 1] += t; d[k + 2] += t;",
"  }",
"}",
"function write(d) {",
"  dither(d, o.size);",
"  var pal = quantize(d, 256, { format: 'rgb565' });",
"  enc.writeFrame(applyPalette(d, pal, 'rgb565'), o.size, o.size, { palette: pal, delay: o.delay });",
"  postMessage({ type: 'frame-done' });",
"}",
"onmessage = function (e) {",
"  var m = e.data;",
"  try {",
"    if (m.type === 'start') { o = m; enc = GIFEncoder(); head = []; }",
"    else if (m.type === 'frame') {",
"      var d = new Uint8ClampedArray(m.buf);",
"      if (m.i < o.F) { head.push(d); return; }",
"      if (m.i >= o.L) {",
"        var k = m.i - o.L, w = (k + 1) / o.F, h = head[k];",
"        for (var j = 0; j < d.length; j++) d[j] = d[j] * (1 - w) + h[j] * w;",
"      }",
"      write(d);",
"    } else if (m.type === 'finish') {",
"      enc.finish(); var b = enc.bytes();",
"      postMessage({ type: 'done', bytes: b }, [b.buffer]);",
"    }",
"  } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); }",
"};"
].join('\n');
function download(blob, name) {
 var a = document.createElement('a');
 a.href = URL.createObjectURL(blob); a.download = name;
 document.body.appendChild(a); a.click(); a.remove();
 setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
}
window.GryphonMandala = api;
})();
