import {Mesh,tint as C} from './render.js';
const roadsX=[0,38,76,114],roadsZ=[-76,-38,0,38,76];
export const bounds={left:-12,right:127,top:-95,bottom:98};
export const obstacles=[];
const foliage=[];
const collisionBuckets=new Map();
const cell=16;
export const streets={x:roadsX,z:roadsZ};
export const district=(x,z)=>x<18?(z>56?'Coastal Highway':'Oceanfront Boulevard'):z<-39?'Industrial Harbor':x>91?'Marisol Heights':z>8?'Neon Quarter':'Financial District';
const stone=C('93847e',-.24), kerb=C('c1ad9c'), dark=C('29313b'), asphalt=C('484850',-.29), stripe=C('dcb76e',1.12);
function seeded(seed){return ()=>{seed=Math.imul(1664525,seed)+1013904223|0;return (seed>>>0)/4294967296;};}
function flat(m,x,y,z,w,d,c){
  m.quad([x-w/2,y,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],c);
}
function lamp(m,x,z){
  m.box(x,1.48,z,.09,2.96,.09,dark);
  m.box(x+.24,2.9,z,.55,.09,.12,dark);
  m.box(x+.48,2.84,z,.32,.045,.24,C('ffd197',2));
}
function palm(m,x,z,h,phase){
  const bark=C('786553',-.17),darkLeaf=C('2d5147'),leaf=C('48745a'),light=C('6b865e');
  const samples=[];
  for(let i=0;i<=9;i++){
    const t=i/9;samples.push([x+t*t*.66,h*t,z+Math.sin(t)*.22,.16-t*.09]);
  }
  for(let j=1;j<samples.length;j++){
    const [x1,y1,z1,r1]=samples[j-1],[x2,y2,z2,r2]=samples[j];
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
      m.quad([x1+Math.cos(a)*r1,y1,z1+Math.sin(a)*r1],[x2+Math.cos(a)*r2,y2,z2+Math.sin(a)*r2],
        [x2+Math.cos(b)*r2,y2,z2+Math.sin(b)*r2],[x1+Math.cos(b)*r1,y1,z1+Math.sin(b)*r1],bark);
    }
  }
  m.shadow(x+.64,z+.13,1.07,.35);
  foliage.push({x:x+.44,z:z+.16,h});
  for(let j=0;j<9;j++){
    const a=j*Math.PI*2/9+phase,dx=Math.cos(a),dz=Math.sin(a),r=1.84+.52*Math.sin(j*21+phase);
    const crown=[x+.66,h,z+.19];
    let previous=crown;
    for(let i=1;i<=7;i++){
      const t=i/7,curve=Math.sin(t*3.12)*(.45+j%3*.11)-.92*t*t;
      const ridge=[crown[0]+dx*t*r,h+curve,crown[2]+dz*t*r],w=Math.sin(t*Math.PI)*(.19+j%3*.054);
      const left=[ridge[0]-dz*w,ridge[1]-.17,ridge[2]+dx*w],right=[ridge[0]+dz*w,ridge[1]-.18,ridge[2]-dx*w];
      m.triangle(previous,left,ridge,i%2?leaf:darkLeaf);m.triangle(previous,ridge,right,light);
      if(i<7){
        const r2=r*.12;
        m.triangle(previous,[left[0]+dx*r2,left[1]-.18,left[2]+dz*r2],left,darkLeaf);
        m.triangle(previous,right,[right[0]+dx*r2,right[1]-.18,right[2]+dz*r2],leaf);
      }
      previous=ridge;
    }
  }
}
const glyphs={
  A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[14,17,16,16,16,17,14],
  D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],
  G:[14,17,16,23,17,17,14],H:[17,17,17,31,17,17,17],I:[31,4,4,4,4,4,31],
  K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],
  N:[17,25,21,19,17,17,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],
  R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],
  U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,27,17],
  X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],
};
function signage(m,text,x,y,z,unit,color,sideways=false){
  const width=text.length*6*unit;
  m.box(x,y,z,sideways?.11:width+.32,unit*8+.25,sideways?width+.32:.11,C('282633'));
  for(const [i,letter] of Array.from(text).entries()){
    const grid=glyphs[letter];
    if(!grid)continue;
    for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(grid[row]&(16>>col)){
      const u=(i*6+col)*unit-width/2,yy=y+unit*(3-row),q=unit*.89;
      const direction=sideways===2?-1:1;
      const a=sideways?[x-direction*.062,yy,z+u*direction]:[x+u,yy,z+.062];
      const b=sideways?[a[0],yy,a[2]+q*direction]:[a[0]+q,yy,a[2]];
      m.quad(a,b,[b[0],yy+q,b[2]],[a[0],yy+q,a[2]],color);
    }
  }
}
function shelter(m,x,z){
  const frame=C('343e4d',.36),pane=C('6a7e82',.55),seat=C('9b7461');
  for(const dx of [-.6,.6])for(const dz of [-1.57,1.57])m.box(x+dx,1.09,z+dz,.075,2.18,.075,frame);
  m.box(x,2.2,z,1.38,.14,3.32,frame);
  m.box(x+.58,1.34,z,.045,1.01,2.94,pane);
  m.box(x+.24,.53,z,.54,.09,2.43,seat);
  for(const a of [-.9,.9])m.box(x+.24,.28,z+a,.12,.49,.11,frame);
  signage(m,'COAST',x-.65,1.89,z,.075,C('e5ccaa',1.45),true);
}
function marketStall(m,x,z,accent,kind){
  const wood=C('755646',-.22),metal=C('3b3948'),bulb=C('ffd6a2',2);
  m.box(x,.41,z,1.25,.77,2.38,wood);
  m.box(x,.86,z,1.53,.13,2.58,C('af8669',-.25));
  for(const dx of [-.67,.67])for(const dz of [-1.1,1.1])
    m.box(x+dx,1.43,z+dz,.058,1.14,.06,metal);
  for(let k=0;k<8;k++){
    const z1=z-1.33+k*.33,z2=z1+.33;
    const cloth=k%2?accent:C('dfbd8f',-.43);
    m.quad([x-.95,1.96,z1],[x-.95,1.96,z2],[x,2.31,z2],[x,2.31,z1],cloth);
    m.quad([x,2.31,z1],[x,2.31,z2],[x+.98,1.96,z2],[x+.98,1.96,z1],cloth);
    m.box(x+.98,1.92,(z1+z2)*.5,.033,.115,.325,cloth);
  }
  for(let k=0;k<6;k++)m.box(x+.88,1.85,z-1.12+k*.44,.066,.076,.07,bulb);
  const colours=kind===0?['ce6749','d9ae58','789454']:kind===1?['8b6179','9a6851','728d87']:['bd905a','e0a46a','985149'];
  for(let i=0;i<3;i++){
    const offset=-.72+i*.71;
    m.box(x+.27,.965,z+offset,.48,.102,.60,C('534442'));
    for(let k=0;k<6;k++){
      const u=x+.11+(k%2)*.20,w=z+offset+(Math.floor(k/2)-1)*.16;
      if(kind===0)m.ellipsoid(u,1.07,w,.085,.082,.086,C(colours[i],.17),6,3);
      else m.box(u,1.045+k%2*.026,w,.17,.075,.11,C(colours[i],-.34));
    }
  }
}
function bench(m,x,z){
  const metal=C('363a3e'),slat=C('9e7054',-.23);
  for(const offset of [-.62,.62]){
    m.box(x,.22,z+offset,.31,.40,.07,metal);
    m.box(x-.12,.51,z+offset,.065,.50,.068,metal);
  }
  for(let i=0;i<4;i++)m.box(x-.15+i*.104,.44,z,.083,.065,1.47,slat);
  for(let i=0;i<3;i++)m.box(x-.18,.59+i*.084,z,.055,.066,1.47,slat);
}
function planter(m,x,z){
  m.box(x,.21,z,1.02,.41,1.84,C('aa9987',-.24));
  m.box(x,.426,z,.92,.031,1.75,C('504746'));
  for(let k=0;k<5;k++){
    const at=z+(k-2)*.29,h=.18+(k%2)*.08;
    m.ellipsoid(x+(k%2-.5)*.23,.47+h,at,.34,h,.30,C(k%2?'5d7451':'495e46'),6,3);
  }
}
function junction(m,x,z){
  const pole=C('39404a');
  for(const [dx,dz,axis] of [[5.86,-6.01,0],[-5.86,6.01,0],[5.86,6.01,1],[-5.86,-6.01,1]]){
    m.box(x+dx,1.35,z+dz,.082,2.7,.085,pole);
    m.box(x+dx,2.55,z+dz,.25,.48,.26,pole);
    const u=x+dx,w=z+dz;
    m.box(u,2.65,w,.242,.094,.253,C('fc674c',axis?3.2:3.1));
    m.box(u,2.46,w,.242,.094,.253,C('83f4aa',axis?4.2:4.1));
  }
}
export function northGreen(x,z,time){
  return (Math.floor(time/7)+Math.round(x/38)+Math.round(z/38))%2===0;
}
function building(m,x,z,w,d,h,style,r,low){
  const pane=(x,y,z,w,h,side,alongX,material)=>{
    const u=w/2,v=h/2;
    const a=alongX?[x-u,y-v,z]:[x,y-v,z+u];
    const b=alongX?[x+u,y-v,z]:[x,y-v,z-u];
    const c=alongX?[x+u,y+v,z]:[x,y+v,z-u];
    const d=alongX?[x-u,y+v,z]:[x,y+v,z+u];
    if(side===1)m.quad(a,b,c,d,material);else m.quad(b,a,d,c,material);
  };
  const palette=[['a58779','3a4656','e6bf93'],['758592','384b60','a8cbce'],['ad8f78','605462','f0cba1'],['8f7389','48445b','eb96bb'],['697f7d','3e535c','9fd6bf']];
  const [base,glass,lit]=palette[style%palette.length];
  const wall=C(base,-.22),paneTint=C(glass,.68),windowLight=C(lit);
  const trim=C(style===3?'f07ca6':'d4a6a0',style===3?1.8:.15);
  low.box(x,h/2+.16,z,w,h,d,wall);
  low.box(x,h+.16,z,w+.35,.22,d+.35,trim);
  low.box(x,h+.50,z,w*.73,.53,d*.75,wall);
  for(let y=2.24;y<h;y+=2.4){
    low.box(x,y,z,w*.84,.61,d+.025,paneTint);
    low.box(x,y,z,w+.025,.61,d*.84,paneTint);
  }
  m.box(x,h/2+.16,z,w,h,d,wall);
  m.box(x,.5,z,w+.35,.65,d+.35,dark);
  m.box(x,h+.16,z,w+.5,.29,d+.5,trim);
  m.box(x,h+.55,z,w*.76,.65,d*.74,wall);
  if(h>14){
    m.box(x,h+1.15,z,w*.52,1.1,d*.63,paneTint);
    m.box(x+w*.15,h+2.3,z,.08,2.5,.08,dark);
    m.ellipsoid(x+w*.15,h+3.5,z,.12,.11,.12,C('ff7587',2),6,3);
  }
  const rows=Math.floor((h-.8)/1.55);
  for(let i=0;i<rows;i++){
    const y=1.35+i*1.55;
    if(i%3===0)m.box(x,y-.56,z,w+.16,.09,d+.16,trim);
    for(let side of [-1,1]){
      const gx=Math.max(2,Math.floor(w/1.65)),gz=Math.max(2,Math.floor(d/1.6));
      for(let j=0;j<gx;j++){
        const q=x+w*((j+.5)/gx-.5),win=r()<.26?windowLight:paneTint;
        pane(q,y,z+side*(d/2+.027),w/gx*.72,.92,side,true,[...win.slice(0,3),win===windowLight?1.43:.64]);
      }
      for(let j=0;j<gz;j++){
        const q=z+d*((j+.5)/gz-.5),win=r()<.23?windowLight:paneTint;
        pane(x+side*(w/2+.027),y,q,d/gz*.72,.92,side,false,[...win.slice(0,3),win===windowLight?1.39:.61]);
      }
    }
  }
  for(const side of [-1,1]){
    m.box(x+side*w*.46,h/2,z,w*.07,h,.18+d,trim);
    m.box(x,h*.65,z+side*d*.48,w*.13,h*.73,.13,trim);
  }
  const entrance=C('344553',.69),metal=C('b4a999',.27);
  m.box(x,1.39,z+d*.5+.048,w*.36,2.27,.13,metal);
  m.box(x,1.33,z+d*.5+.12,w*.315,2.05,.065,entrance);
  m.box(x,1.34,z+d*.5+.168,.056,2.06,.06,metal);
  m.box(x,.88,z+d*.5+.174,.31,.055,.04,metal);
  m.box(x-w*.5-.033,1.30,z,.10,2.14,d*.71,entrance);
  for(const offset of [-.31,-.12,.12,.31])m.box(x-w*.5-.094,1.30,z+d*offset,.06,2.14,.061,metal);
  const label=style===3?'LANTERN':style===1?'EXCHANGE':style===2?'MARISOL':style===4?'HARBOR':'BAY HOUSE';
  if(style===0||style===2){
    const face=x-w*.5,awning=C(style===0?'758a7c':'ab765a',-.40),hem=C('e0b891');
    m.quad([face-.95,1.95,z-d*.45],[face-.95,1.95,z+d*.45],
      [face-.15,2.34,z+d*.45],[face-.15,2.34,z-d*.45],awning);
    m.box(face-.96,1.91,z,.06,.125,d*.9,hem);
    for(const k of [-.31,.31])m.box(face-.91,.97,z+d*k,.055,1.88,.06,metal);
  }
  if(style===1){
    for(const k of [-.36,.36]){
      m.box(x+w*k,h*.54,z+d*.5+.091,.105,h*.88,.13,C('b3a299',-.24));
      m.box(x-w*.5-.095,h*.53,z+d*k,.14,h*.91,.117,C('b3a299',-.24));
    }
  }
  signage(m,label,x-w*.5-.15,2.77,z,.08,C(style===3?'ff82ad':'eccf9d',1.75),true);
  if(style===3||style===2){
    for(let y=3.75;y<h-1;y+=3.1){
      m.box(x,y,z+d*.49,w*.85,.12,1.05,trim);
      for(const shift of [-.36,.36])m.box(x+w*shift,y+.32,z+d*.49+.44,.053,.54,.059,metal);
      m.box(x,y+.53,z+d*.49+.44,w*.85,.049,.065,metal);
    }
  }
  if(style===1&&h>8){
    m.box(x+w*.17,h+.88,z,w*.57,1.32,d*.82,paneTint);
    m.box(x-w*.36,h*.59,z,w*.25,h*.68,d+.27,paneTint);
    for(let i=0;i<3;i++)m.box(x-w*.36,h*.34+i*h*.23,z,w*.26,.095,d+.34,trim);
  }
  if(style===2){
    for(const side of [-1,1]){
      m.box(x+side*w*.38,2.31,z,w*.47,.16,d+1.15,trim);
      m.box(x+side*w*.38,1.09,z+d*.55,.1,2.16,.13,C('54415f'));
    }
  }
  if(style===3||x<30){
    const neon=C(style===3?'fa4995':'6ce7ce',2);
    m.box(x-w/2-.18,1.95,z,.29,.17,d*.92,neon);
    m.box(x,1.97,z+d/2+.15,w*.94,.15,.28,neon);
    m.box(x-w/2-.24,2.08,z+d*.19,.62,.12,d*.38,paneTint);
    for(let i=0;i<5;i++)
      m.box(x-w/2-.43,2.09,z+d*.03+i*d*.078,.39,.1,d*.035,neon);
    m.box(x-w/2-.32,3.05,z-d*.25,.28,1.83,.62,paneTint);
    for(let i=0;i<5;i++)m.box(x-w/2-.49,2.43+i*.3,z-d*.25,.08,.08,.4,neon);
  }
  obstacles.push({x,z,w:w/2+.32,d:d/2+.32,h});
}
export function buildCity(renderer){
  obstacles.length=0;foliage.length=0;collisionBuckets.clear();
  const r=seeded(6679),base=new Mesh(),chunks=[];
  flat(base,57,-.028,0,143,210,asphalt);
  flat(base,-85,-.15,0,147,290,C('345f79',-1));
  flat(base,-10,0,0,6,207,C('c09b82',-.14));
  flat(base,-12.7,.18,0,.24,207,kerb);
  for(let z=-95;z<98;z+=2.4)flat(base,-9,.022,z,5.8,.019,C('88776f',-.12));
  for(let z=-92;z<94;z+=15)for(const x of [-5.2,5.2]){
    flat(base,x,.024,z,.42,.77,C('2b2a31'));
    for(let n=0;n<5;n++)flat(base,x,.027,z-.29+n*.146,.34,.019,C('70666a'));
  }
  for(const x of roadsX)for(let z=-94;z<99;z+=3.4)
    if(!roadsZ.some(y=>Math.abs(z-y)<5.9)){
      flat(base,x-.13,.006,z,.07,1.7,stripe);flat(base,x+.13,.006,z,.07,1.7,stripe);
      for(const offset of [-5.24,5.24])flat(base,x+offset,.006,z,.065,3.4,kerb);
    }
  for(const z of roadsZ)for(let x=-6;x<127;x+=3.4)
    if(!roadsX.some(y=>Math.abs(x-y)<6.2))flat(base,x,.007,z,1.65,.085,stripe);
  for(const z of roadsZ)for(const x of roadsX){
    const signalMesh=new Mesh();junction(signalMesh,x,z);
    chunks.push({...renderer.buffer(signalMesh),center:[x,z],far:46,radius:8});
    for(let i=-4;i<=4;i++){
      flat(base,x+i*1.05,.012,z-5.35,.47,1.25,kerb);
      flat(base,x+i*1.05,.012,z+5.35,.47,1.25,kerb);
    }
  }
  for(let z=-96;z<101;z+=4){
    base.box(-12.15,.52,z,.09,.72,.09,dark);
    base.box(-12.15,.85,z,.08,.08,4.02,dark);
    base.box(-12.15,.49,z,.065,.065,4.02,dark);
  }
  chunks.push(renderer.buffer(base));
  for(let j=0;j<5;j++)for(let i=0;i<4;i++){
    const x=i*38+18,z=j*38-57,m=new Mesh(),low=new Mesh();
    const w=i===3?10:25;
    const px=i===3?122:x;
    low.box(px,.05,z,w,.2,25,stone);
    m.box(px,.05,z,w,.2,25,stone);
    m.box(px,.17,z,w-.2,.045,24.8,kerb);
    m.box(px,.19,z,w-1,.05,24,stone);
    if(i===0){
      flat(m,-8,.019,z,4,32,C('b69888',-.3));
      for(const shift of [-13,-4,5,14])palm(m,-8.8,z+shift,3.7+r()*1.2,r()*5);
      for(const shift of [-11,8])lamp(m,-6.35,z+shift);
      if(j%2)shelter(m,-10.1,z+8.3);
      for(const shift of [-6,12])bench(m,-10.65,z+shift);
      planter(m,-10.68,z-2.4);
    }
    const high=j===1||j===2;
    const industrial=j===0;
    const residential=i===3||i===2&&!high&&j>=3;
    if(industrial){
      for(let k=0;k<3;k++){
        const zz=z-8+k*8;
        building(m,px,zz,w-4,5,3.4+k*.36,k,r,low);
        for(let a=-1;a<=1;a++)m.box(px+a*2.5,.63,zz+3.2,2.25,1.22,1.7,C(['65679a','ab596a','b4855f'][k]));
      }
    }else{
      for(const side of [-1,1]){
        const bx=px+(i===3?0:side*5.5),bz=z+(i===3?side*6:side*2.5);
        const h=residential?3+r()*4:high?9+r()*18:5+r()*8;
        building(m,bx,bz,(i===3?6:7.3)+r()*1.8,(i===3?6:9)+r()*3,h,j>=3&&!residential?3:(i+j+(side===1?1:0))%5,r,low);
      }
      if(i<3)for(const s of [-1,1]){
        palm(m,x+s*10,z-s*8,2.8+r(),r()*2);lamp(m,x+s*12,z+s*11);
      }
    }
    chunks.push({...renderer.buffer(m),lod:renderer.buffer(low),center:[x,z]});
  }
  const end=new Mesh();
  const concrete=C('867485'),beam=C('554159'),copper=C('a56665'),signal=C('66efc2',2);
  for(const z of [57,66]){
    for(const x of [-5.65,5.65]){
      end.box(x,2.32,z,.55,4.64,.57,concrete);
      end.box(x,.4,z,.82,.8,.75,beam);
      end.box(x,3.29,z,.58,.105,.58,signal);
    }
    end.box(0,4.63,z,12.4,.54,.62,beam);
    end.box(0,4.4,z,11.1,.08,.64,signal);
  }
  end.box(0,4.82,61.5,12.4,.28,9.1,concrete);
  for(const x of [-6.04,6.04]){
    end.box(x,5.09,61.5,.37,.48,9.25,copper);
    for(let z=57;z<=66;z+=1.8)end.box(x,5.48,z,.13,.34,.17,beam);
    end.box(x,5.67,61.5,.14,.075,9.24,beam);
  }
  for(const x of [-4,-2,2,4])end.box(x,4.65,61.5,.22,.11,8.4,C('ffd6a7',1.25));
  for(let z=78;z<100;z+=6){palm(end,-8.7,z,4,z);lamp(end,-6.4,z);}
  for(let x=-10;x<124;x+=4){
    end.box(x,.32,98,3.77,.64,.58,concrete);
    end.box(x,.54,97.69,3.27,.085,.055,C('ffbc89',1.45));
  }
  for(const x of [-2.9,8.2]){
    end.box(x,1.42,76,.23,2.84,.26,beam);
    end.box(x,2.51,76,.28,.14,.27,signal);
  }
  end.box(2.65,2.83,76,11.3,.17,.23,beam);
  for(let x=-1.4;x<7;x+=.85)end.box(x,2.77,75.86,.49,.08,.08,signal);
  for(let i=0;i<7;i++){
    const z=i*7-67;
    end.box(-18,-.035,z,13,.26,2.7,C('807382'));
    end.box(-23.9,.5,z,.22,1,.22,dark);
  }
  signage(end,'COASTAL GATE',0,4.78,66.42,.115,C('e5e2aa',1.62));
  end.box(44.35,1.69,-3.21,.12,3.38,.14,beam);
  signage(end,'EXCHANGE',43,3.35,-3.2,.11,C('e9d5a8',1.52));
  const market=new Mesh();
  marketStall(market,68.6,43.4,C('973e56',-.43),0);
  marketStall(market,68.6,47.1,C('527d69',-.43),1);
  marketStall(market,68.6,50.7,C('b18545',-.43),2);
  bench(market,71,54.6);planter(market,70.9,52.9);
  for(const pos of [40.3,52.2])market.box(69.25,1.55,pos,.09,3.1,.09,beam);
  signage(market,'NIGHT MARKET',69.4,2.99,46.3,.077,C('ffbf91',1.98),2);
  for(let k=0;k<14;k++){
    const t=k/13,z=40.3+t*11.9,x=69.22+Math.sin(t*Math.PI)*.25,y=3.18-Math.sin(t*Math.PI)*.44;
    market.box(x,y,z,.065,.059,.065,C(k%3?'ffd7ab':'ffc081',2));
  }
  market.box(69.28,3.09,46.3,.06,.05,12.1,beam);
  chunks.push({...renderer.buffer(market),center:[69,46],far:47,radius:10});
  chunks.push(renderer.buffer(end));
  for(const entry of obstacles){
    const {x,z,w,d}=entry;
    for(let a=Math.floor((x-w)/cell);a<=Math.floor((x+w)/cell);a++)
      for(let b=Math.floor((z-d)/cell);b<=Math.floor((z+d)/cell);b++){
        const key=a+','+b;
        if(!collisionBuckets.has(key))collisionBuckets.set(key,[]);
        collisionBuckets.get(key).push(entry);
      }
  }
  renderer.bakeShadows(obstacles);
  return chunks;
}
export function blocked(x,z,r=.3){
  if(x<bounds.left+r||x>bounds.right-r||z<bounds.top+r||z>bounds.bottom-r)return true;
  for(let a=Math.floor((x-r)/cell);a<=Math.floor((x+r)/cell);a++)
    for(let b=Math.floor((z-r)/cell);b<=Math.floor((z+r)/cell);b++){
      const block=collisionBuckets.get(a+','+b);
      if(block?.some(o=>Math.abs(x-o.x)<o.w+r&&Math.abs(z-o.z)<o.d+r))return true;
    }
  return false;
}
export function cameraBlocked(x,y,z){
  if(blocked(x,z,.22))return true;
  return foliage.some(o=>{
    const dx=o.x-x,dz=o.z-z;
    const radius=y>o.h-.30&&y<o.h+.83?.97:.23;
    return y<o.h+.83&&dx*dx+dz*dz<radius*radius;
  });
}
