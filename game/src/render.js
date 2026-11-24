const vertex = `#version 300 es
layout(location=0) in vec3 a;
layout(location=1) in vec3 n;
layout(location=2) in vec4 c;
layout(location=3) in vec4 pose;
layout(location=4) in vec4 motion;
uniform mat4 vp;
uniform vec3 eye;
uniform vec3 ambient,sunlight;
uniform float time;
out vec3 p,light;
out vec3 surface;
flat out float kind;
void main(){
vec3 v;
#ifdef STATIC_GEOMETRY
p=a;v=n;
#else
vec3 local=a;
if(motion.x>0.){
  float gait=motion.y*sign(a.x);
  float leg=1.-smoothstep(.09,1.05,a.y);
  float arm=smoothstep(.17,.235,abs(a.x))*smoothstep(.82,1.05,a.y)*(1.-smoothstep(1.22,1.57,a.y));
  local.z+=gait*(leg*.38-arm*.22)+motion.z*arm*.36;
  local.y+=abs(gait)*leg*.06+abs(motion.y)*.035;
  local.x+=motion.z*a.y*.07;
}else if(motion.x< -1.5){
  float s=sin(motion.w),c=cos(motion.w),y=a.y-motion.y;
  local.y=motion.y+y*c-a.z*s;local.z=y*s+a.z*c;
}else if(motion.x<0.){
  float sprung=clamp((a.y-.29)*5.,0.,1.);
  local.y+=sprung*(motion.y+a.x*motion.z);
}
p=vec3(local.x*pose.w+local.z*pose.z,local.y,local.z*pose.w-local.x*pose.z)+vec3(pose.x,0.,pose.y);
v=vec3(n.x*pose.w+n.z*pose.z,n.y,n.z*pose.w-n.x*pose.z);
#endif
vec3 sun=vec3(-.805,.536,-.268);
#ifdef STATIC_GEOMETRY
vec3 normal=v;
#else
vec3 normal=normalize(v);
#endif
float diffuse=max(0.,dot(normal,sun));
float sky=max(0.,normal.y)*.13;
float foundation=mix(.77,1.,clamp(a.y*.60+.24,0.,1.));
light=c.rgb*(ambient*(foundation+sky)+sunlight*diffuse);
if(c.a>0.&&c.a<3.){
  vec3 toEye=normalize(eye-p);
  float reflection=max(0.,dot(reflect(-sun,normal),toEye));
  reflection*=reflection;reflection*=reflection;reflection*=reflection;reflection*=reflection;
  float rim=1.-max(0.,dot(normal,toEye));
  light+=min(c.a,1.)*(reflection*vec3(.76,.53,.32)+rim*rim*vec3(.12,.19,.24));
}
vec3 weights=abs(normal);
surface=vec3(weights.y>.67?a.xz:weights.x>weights.z?a.zy:a.xy,normal.y);
kind=c.a;
if(c.a>=3.){
  float parity=mod(floor(time/7.)+floor(p.x/38.+.5)+floor(p.z/38.+.5),2.);
  bool east=fract(c.a)>.15,go=(parity==0.)!=east,green=c.a>4.;
  light=c.rgb*(go==green?1.13:.19);
}else if(c.a>1.)light=mix(light,c.rgb,min(1.,c.a-1.));
gl_Position=vp*vec4(p,1.);
}`;
const fragment = `#version 300 es
precision highp float;
in vec3 p,light,surface;
flat in float kind;
uniform vec3 eye,fog;
uniform float night,time,detail;
uniform vec4 headlamp;
uniform sampler2D materialMap,shadowMap;
out vec4 pixel;
void main(){
vec3 offset=p-eye;
float distanceSq=dot(offset,offset);
vec3 color=light;
if(kind<-.8){
  vec2 waveUV=p.xz*.073+vec2(time*.046,-time*.026);
  vec2 wave=detail>.5?texture(materialMap,waveUV).rg:vec2(.5,.51);
  float grazing=1.-clamp(-offset.y*inversesqrt(distanceSq+.001),0.,1.);
  float coast=max(0.,1.-abs(p.x+12.8)*.32);
  vec3 water=mix(vec3(.16,.33,.35),vec3(.055,.135,.21),night);
  vec3 reflected=mix(vec3(.66,.53,.43),vec3(.18,.24,.38),night);
  float glint=max(0.,1.-abs(p.z-eye.z+14.)*.027)*max(0.,wave.y-.42)*.36;
  color=mix(water,reflected,grazing*.42)+(wave.x-.5)*.095;
  color+=vec3(.43,.20,.09)*glint*(1.-night)+coast*wave.y*.069;
}else if(kind<0.&&distanceSq<3500.&&detail>.5){
  // Mipmapped grain keeps distant paving stable while preserving close detail.
  if(p.y>.25||surface.z<.42){
    vec3 tex=texture(materialMap,surface.xy*(kind<-.35?1.8:.72)).rgb;
    color*=.80+(kind<-.35?tex.b:tex.r)*.40+tex.g*.058;
  }
}
if(surface.z>.42&&p.y<.25){
  if(detail>.5&&p.x>-12.5){
    vec2 ground=texture(shadowMap,(p.xz+vec2(13.,104.))/vec2(144.,208.)).rg;
    color*=1.-ground.x*.49*(1.-night*.66);
    if(kind<0.)color*=.86+ground.y*.26;
  }
  if(night>.04){
    float market=max(0.,1.-abs(p.x-70.)*.12)*max(0.,1.-abs(p.z-46.)*.074);
    color+=vec3(.39,.18,.075)*market*night;
    vec2 delta=p.xz-headlamp.xy;
    float front=dot(delta,headlamp.zw);
    if(front>.5&&front<20.){
      float side=abs(delta.x*headlamp.w-delta.y*headlamp.z);
      color+=vec3(.29,.22,.12)*night*(1.-front*.05)*max(0.,1.-side/(.85+front*.19));
    }
  }
}
float haze=clamp((distanceSq-75.)*.000066,0.,1.);
pixel=vec4(mix(color,fog,haze),1.);
}`;
const skyV = `#version 300 es
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,1.,1.);}`;
const skyF = `#version 300 es
precision mediump float;
in vec2 uv;
uniform float night,pitch,aspect,sunX;
out vec4 pixel;
void main(){
float y=uv.y+pitch*.48;
vec3 dusk=mix(vec3(.98,.65,.49),vec3(.235,.31,.49),smoothstep(.18,1.14,y));
vec3 dark=mix(vec3(.29,.20,.34),vec3(.07,.092,.18),smoothstep(.15,1.11,y));
vec2 delta=vec2((uv.x-sunX)*aspect,y-.45);
float d=dot(delta,delta);
float glow=1.-smoothstep(.003,.144,d);
dusk+=vec3(.20,.09,.028)*glow;
dusk=mix(dusk,vec3(1.,.9,.67),1.-smoothstep(.0010,.0015,d));
float layers=sin(uv.x*18.+y*89.)*.48+sin(uv.x*27.-y*126.)*.23;
dusk=mix(dusk,vec3(.95,.74,.65),smoothstep(.38,.71,layers)*smoothstep(.36,.65,y)*.31);
pixel=vec4(mix(dusk,dark,night),1.);
}`;
const norm = a => {const d=Math.hypot(...a)||1;return a.map(x=>x/d);};
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
export const tint = (hex, finish=0) => {
  const c=Number.parseInt(hex.replace('#',''),16);
  return [(c>>16)/255,((c>>8)&255)/255,(c&255)/255,finish];
};
export class Mesh {
  data=[];
  pose=[0,0,0,0];
  triangle(a,b,c,color,na,nb=na,nc=na){
    const [x,y,z,yaw]=this.pose, s=Math.sin(yaw), co=Math.cos(yaw);
    na??=norm(cross(sub(b,a),sub(c,a)));nb??=na;nc??=na;
    for(const [[u,v,w],[i,j,k]] of [[a,na],[b,nb],[c,nc]])
      this.data.push(x+u*co+w*s,y+v,z+w*co-u*s,i*co+k*s,j,k*co-i*s,...color);
  }
  quad(a,b,c,d,color){this.triangle(a,b,c,color);this.triangle(a,c,d,color);}
  box(x,y,z,w,h,d,color){
    const a=x-w/2,b=x+w/2,l=y-h/2,t=y+h/2,e=z-d/2,f=z+d/2;
    this.quad([a,t,e],[a,t,f],[b,t,f],[b,t,e],color);
    this.quad([a,l,f],[b,l,f],[b,t,f],[a,t,f],color);
    this.quad([b,l,e],[a,l,e],[a,t,e],[b,t,e],color);
    this.quad([a,l,e],[a,l,f],[a,t,f],[a,t,e],color);
    this.quad([b,l,f],[b,l,e],[b,t,e],[b,t,f],color);
  }
  ellipsoid(x,y,z,rx,ry,rz,color,segments=10,rings=6,tilt=0){
    const c=Math.cos(tilt),s=Math.sin(tilt);
    const sample=(i,j)=>{
      const a=i*Math.PI*2/segments,b=(j/rings-.5)*Math.PI;
      const u=Math.cos(a)*Math.cos(b),v=Math.sin(b),w=Math.sin(a)*Math.cos(b);
      return [[x+u*rx,y+v*ry*c-w*rz*s,z+w*rz*c+v*ry*s],norm([u/rx,v/ry*c-w/rz*s,w/rz*c+v/ry*s])];
    };
    for(let i=0;i<segments;i++)for(let j=0;j<rings;j++){
      const [a,na]=sample(i,j),[b,nb]=sample(i,j+1),[c,nc]=sample(i+1,j+1),[d,nd]=sample(i+1,j);
      this.triangle(a,b,c,color,na,nb,nc);this.triangle(a,c,d,color,na,nc,nd);
    }
  }
  shadow(x,z,w,d){
    const shade=tint('30303c'),up=[0,1,0],mid=[x,.024,z];
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5,b=(i+1)*Math.PI/5;
      this.triangle(mid,[x+Math.cos(b)*w,.024,z+Math.sin(b)*d],
        [x+Math.cos(a)*w,.024,z+Math.sin(a)*d],shade,up);
    }
  }
}
function matrix(eye,target,aspect){
  const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
  const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(.51),out=[];
  for(let i=0;i<16;i+=4)out.push(view[i]*f/aspect,view[i+1]*f,-1.0007*view[i+2]-.16*view[i+3],-view[i+2]);
  return out;
}
function surfaceTexture(){
  const size=128,data=new Uint8Array(size*size*4);
  let seed=51719;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const pebbles=random(),mottle=Math.sin(x*.098+y*.147+Math.cos(y*.098))*.5+.5;
    data[i]=80+pebbles*96+mottle*56;
    data[i+1]=127+Math.sin(y*.196+Math.sin(x*.147)*1.2)*62+(pebbles-.5)*28;
    data[i+2]=119+((x+y)%3===0?47:-25)+pebbles*58;
    data[i+3]=255;
  }
  return {size,data};
}
export function renderer(canvas){
  const gl=canvas.getContext('webgl2',{antialias:false,alpha:false});
  if(!gl)throw Error('WebGL 2 is required');
  function program(v,f,names){
    const p=gl.createProgram();
    for(const [kind,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
      const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
      gl.attachShader(p,s);gl.deleteShader(s);
    }
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    return {p,...Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]))};
  }
  const uniforms=['vp','eye','ambient','sunlight','fog','night','time','headlamp','detail','materialMap','shadowMap'];
  const world=program(vertex,fragment,uniforms);
  const staticWorld=program(vertex.replace('#version 300 es','#version 300 es\n#define STATIC_GEOMETRY'),fragment,uniforms);
  const sky=program(skyV,skyF,['night','sunX','pitch','aspect']);
  const grain=surfaceTexture();
  function texture(unit,width,height,data,repeat){
    gl.activeTexture(gl.TEXTURE0+unit);
    const id=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,id);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,repeat?gl.LINEAR_MIPMAP_NEAREST:gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    if(repeat)gl.generateMipmap(gl.TEXTURE_2D);
    else for(const direction of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D,direction,gl.CLAMP_TO_EDGE);
    return id;
  }
  const material=texture(0,grain.size,grain.size,grain.data,true);
  const shadow=texture(1,1,1,new Uint8Array([0,0,0,255]),false);
  function bakeShadows(buildings){
    const width=512,height=768,mask=document.createElement('canvas');
    mask.width=width;mask.height=height;
    const ctx=mask.getContext('2d');
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    ctx.setTransform(width/144,0,0,height/208,13*width/144,104*height/208);
    ctx.fillStyle='#fff';ctx.filter='blur(2px)';
    for(const {x,z,w,d,h} of buildings){
      const dx=h*.74,dz=h*.28;
      ctx.beginPath();ctx.moveTo(x-w,z-d);ctx.lineTo(x+w,z-d);
      ctx.lineTo(x+w+dx,z-d+dz);ctx.lineTo(x+w+dx,z+d+dz);
      ctx.lineTo(x-w+dx,z+d+dz);ctx.lineTo(x-w,z+d);ctx.closePath();ctx.fill();
    }
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadow);
    const pixels=ctx.getImageData(0,0,width,height).data;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      pixels[(y*width+x)*4+1]=grain.data[(((y*13)%128)*128+(x*11)%128)*4];
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  }
  const dynamic=gl.createBuffer(), instanceBuffer=gl.createBuffer(), skyArray=gl.createVertexArray();
  const format=[[0,3,0],[1,3,12],[2,4,24]];
  function geometry(b){
    const vao=gl.createVertexArray();
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,b);
    for(const [i,size,offset] of format){
      gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,40,offset);
    }
    return vao;
  }
  const movingArray=geometry(dynamic);
  const instanceArray=gl.createVertexArray();
  const instanceData=new Float32Array(2048);
  let adaptive=.8,average=16.67,adaptTime=0,previous=0,lastSize='';
  function buffer(mesh){
    const b=gl.createBuffer(),vao=geometry(b);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.STATIC_DRAW);
    return {b,vao,count:mesh.data.length/10};
  }
  function drawInstances(groups){
    let cursor=0;
    for(const [,rows] of groups){
      instanceData.set(rows,cursor);cursor+=rows.length;
    }
    if(!cursor)return;
    gl.bindVertexArray(instanceArray);
    gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,instanceData.subarray(0,cursor),gl.STREAM_DRAW);
    for(const index of [3,4]){gl.enableVertexAttribArray(index);gl.vertexAttribDivisor(index,1);}
    cursor=0;
    for(const [model,rows] of groups){
      gl.bindBuffer(gl.ARRAY_BUFFER,model.b);
      for(const [i,size,offset] of format){
        gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,40,offset);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
      gl.vertexAttribPointer(3,4,gl.FLOAT,false,32,cursor*4);
      gl.vertexAttribPointer(4,4,gl.FLOAT,false,32,cursor*4+16);
      gl.drawArraysInstanced(gl.TRIANGLES,0,model.count,rows.length/8);
      cursor+=rows.length;
    }
  }
  return {buffer,bakeShadows, frame(chunks,mesh,groups,eye,target,night,time,quality,stamp,headlamp){
    const elapsed=previous?Math.min(180,stamp-previous):16.67;
    previous=stamp;
    average+=(elapsed-average)*.095;adaptTime+=elapsed;
    if(quality===0&&adaptTime>1200){
      adaptive=Math.max(.45,Math.min(1,adaptive+(average>35?-.09:average<20?.04:0)));
      adaptTime=0;
    }
    const lite=quality<0||quality===.62||quality===0&&adaptive<.61;
    const ratio=Math.min(1.5,devicePixelRatio)*(Math.abs(quality)||adaptive);
    const w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));
    const size=w+'x'+h;
    if(size!==lastSize){canvas.width=w;canvas.height=h;lastSize=size;}
    gl.viewport(0,0,w,h);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);
    const vp=matrix(eye,target,w/h);
    const ambient=[.62-night*.27,.65-night*.27,.72-night*.23];
    const sunlight=[.94-night*.69,.74-night*.51,.52-night*.22];
    const fog=[.69-night*.54,.53-night*.37,.48-night*.22];
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,material);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadow);
    function use(p){
      gl.useProgram(p.p);gl.uniformMatrix4fv(p.vp,false,vp);gl.uniform3fv(p.eye,eye);
      gl.uniform1f(p.night,night);gl.uniform1f(p.time,time);gl.uniform4fv(p.headlamp,headlamp);
      gl.uniform3fv(p.ambient,ambient);gl.uniform3fv(p.sunlight,sunlight);gl.uniform3fv(p.fog,fog);
      gl.uniform1i(p.materialMap,0);gl.uniform1i(p.shadowMap,1);
      gl.uniform1f(p.detail,lite?0:1);
    }
    gl.vertexAttrib4f(3,0,0,0,1);gl.vertexAttrib4f(4,0,0,0,0);
    const heading=norm([target[0]-eye[0],target[2]-eye[2]]);
    const visible=[];
    for(const chunk of chunks){
      let distance=14500;
      if(chunk.center){
        const x=chunk.center[0]-eye[0],z=chunk.center[1]-eye[2];
        const ahead=x*heading[0]+z*heading[1],side=Math.abs(x*heading[1]-z*heading[0]);
        distance=x*x+z*z;
        const radius=chunk.radius??24,far=chunk.far??(lite?89:114);
        if(distance>far*far||ahead< -radius||side>Math.max(0,ahead)*(.56*w/h)+radius*1.2)continue;
      }
      visible.push([distance,chunk]);
    }
    visible.sort((a,b)=>a[0]-b[0]);
    use(world);drawInstances(groups);
    use(staticWorld);gl.enable(gl.CULL_FACE);
    for(const [distance,chunk] of visible){
      const detailRange=lite?36:60;
      const batch=distance>detailRange*detailRange&&chunk.lod?chunk.lod:chunk;
      gl.bindVertexArray(batch.vao);gl.drawArrays(gl.TRIANGLES,0,batch.count);
    }
    gl.disable(gl.CULL_FACE);
    if(mesh.data.length){
      gl.bindVertexArray(movingArray);gl.bindBuffer(gl.ARRAY_BUFFER,dynamic);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES,0,mesh.data.length/10);
    }
    gl.depthFunc(gl.LEQUAL);gl.useProgram(sky.p);gl.bindVertexArray(skyArray);
    gl.uniform1f(sky.night,night);gl.uniform1f(sky.aspect,w/h);
    const headingAngle=Math.atan2(target[0]-eye[0],target[2]-eye[2])+1.29;
    const relative=Math.atan2(Math.sin(headingAngle),Math.cos(headingAngle));
    gl.uniform1f(sky.sunX,.5+relative/(.8*w/h));
    gl.uniform1f(sky.pitch,Math.atan2(target[1]-eye[1],Math.hypot(target[0]-eye[0],target[2]-eye[2])));
    gl.drawArrays(gl.TRIANGLES,0,3);
  }};
}
