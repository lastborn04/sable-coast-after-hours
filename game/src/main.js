import {Mesh,renderer,tint as C} from './render.js';
import {buildCity,blocked,cameraBlocked,district,northGreen,streets} from './world.js';
import {drawCar,drawPerson,drawWheel,models} from './actors.js';
import {makeAudio} from './audio.js';
import {stages,missionContact} from './missions.js';

const $=id=>document.getElementById(id);
const canvas=$('view'), map=$('map').getContext('2d');
const keys=new Set(), pressed=new Set();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const angle=(x,z)=>Math.atan2(x,z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const moveAngle=(a,b,t)=>a+wrap(b-a)*Math.min(1,t);
const saveKey='sable-coast.save.v1',settingsKey='sable-coast.settings.v1';
const audio=makeAudio();
let gfx,chunks;
const actorMeshes=new Map();
const groups=new Map();
let mode='title',stage=0,player,cars,people,patrol,ride=null,wanted=0,heat=0,clock=0,night=0;
let money=0,rank=0,armor=25,view=0,pitch=.18,eye=null,drag=null,noticeUntil=0,last=0,hudClock=0,crash=0,kick=0,pauseOrigin='play';
let checkpoint=null, screenMessage='',missionTime=0,runner=null,boarding=null,ambientTick=0,physicsDebt=0;
const storageRead=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const storageWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const settings=Object.assign({volume:48,quality:.8,lighting:'story'},storageRead(settingsKey));
for(const name of Object.keys(settings))if($(name))$(name).value=settings[name];
for(const name of ['volume','quality','lighting'])$(name).addEventListener('input',()=>{
  settings[name]=name==='lighting'?$(name).value:Number($(name).value);
  storageWrite(settingsKey,settings);audio.level(settings.volume/100);
});
function car(x,z,a,kind,extra={}){
  return {x,z,a,kind,hp:100,speed:0,...extra};
}
function reset(save){
  player={x:-7.3,z:-15,a:0,hp:100,pace:0,style:1};
  cars=[
    car(2.6,6,0,0,{target:true,missionCar:'vesper'}),car(-4.15,21,Math.PI,1),car(4.1,-28,0,2),
    car(42.5,15,0,3),car(26,-35,Math.PI/2,4),
    car(40.6,-64,0,4,{missionCar:'transit'}),
  ];
  for(let i=0;i<13;i++){
    const axis=i%3>0, lane=axis?streets.x[i%4]:streets.z[i%5],sign=i%2?1:-1;
    const start=-75+(i*29)%160;
    const x=axis?lane+sign*2.85:clamp(start,8,111),z=axis?start:lane-sign*2.85;
    cars.push(car(x,z,axis?(sign>0?0:Math.PI):(sign>0?Math.PI/2:-Math.PI/2),[1,2,4,0][i%4],{traffic:{axis,sign}}));
  }
  people=Array.from({length:39},(_,i)=>{
    const axis=i%3!==0, lane=axis?streets.x[i%4]:streets.z[i%5],sign=i%2?1:-1;
    return {x:axis?lane+(i%5?-6.85:6.85):8+(i*19)%109,z:axis?-90+(i*22)%182:lane+6.75,
      a:axis?(sign>0?0:Math.PI):(sign>0?Math.PI/2:-Math.PI/2),axis,sign,style:i%10,pace:.66,stun:0,police:i%14===13};
  });
  const marketPeople=[
    [67.65,43.5,Math.PI/2,0,5],[67.65,47.0,Math.PI/2,0,8],[67.65,50.7,Math.PI/2,0,3],
    [69.96,44.02,-Math.PI/2,0,9],[70.02,48.05,-Math.PI/2,0,4],
    [71.33,42.2,0,.71,3],[71.49,49.36,Math.PI,.58,8],[71.15,51.3,Math.PI,.64,5],
  ];
  for(const [x,z,a,pace,style] of marketPeople)
    people.push({x,z,a,pace,style,stun:0,market:true});
  patrol=[];ride=null;wanted=0;heat=0;stage=0;money=0;rank=0;armor=25;
  view=0;pitch=.18;eye=null;crash=0;kick=0;clock=0;boarding=null;ambientTick=0;physicsDebt=0;night=0;noticeUntil=0;screenMessage='';
  if(save){
    ({stage,money,rank,armor,wanted,heat}=save);
    Object.assign(player,save.player);
    const target=cars[0];Object.assign(target,save.target);
    if(save.transit)Object.assign(missionVehicle('transit'),save.transit);
    if(save.ride){
      const origin=save.ride.target?target:missionVehicle(save.ride.missionCar);
      ride=origin||car(save.ride.x,save.ride.z,save.ride.a,save.ride.kind,save.ride);
      Object.assign(ride,save.ride,{speed:0,traffic:null});
      if(!origin)cars.push(ride);
    }
    view=(ride||player).a;
  }
  prepareStage();
  if(save&&Number.isFinite(save.missionTime))missionTime=save.missionTime;
  if(runner&&save?.runnerHealth===1)runner.endurance=1;
}
function readSave(){
  const s=storageRead(saveKey);
  return s?.version===1&&Number.isInteger(s.stage)&&s.stage>=0&&s.stage<stages.length&&
    [s.player?.x,s.player?.z,s.player?.a,s.player?.hp,s.target?.x,s.target?.z,s.target?.a,s.target?.hp,s.money,s.rank,s.armor,s.wanted,s.heat].every(Number.isFinite)&&
    (!s.ride||([s.ride.x,s.ride.z,s.ride.a,s.ride.hp].every(Number.isFinite)&&models[s.ride.kind]))?s:null;
}
function snapshot(){
  const {x,z,a,hp}=player;
  const vehicle=v=>({x:v.x,z:v.z,a:v.a,hp:v.hp,kind:v.kind,target:!!v.target,missionCar:v.missionCar});
  return {version:1,stage,money,rank,armor,wanted,heat,player:{x,z,a,hp},target:vehicle(cars[0]),transit:vehicle(missionVehicle('transit')),missionTime,runnerHealth:runner?.endurance,ride:ride?vehicle(ride):null};
}
function save(announce=false){
  const ok=storageWrite(saveKey,snapshot());
  if(announce){say(ok?'Progress saved':'Storage unavailable');if(ok)audio.signal();}
  $('continue').disabled=!readSave();
}
function say(text){screenMessage=text;noticeUntil=clock+4;}
function menus(){
  $('menu').hidden=mode!=='title';
  $('hud').hidden=mode==='title'||(mode==='pause'&&pauseOrigin==='title');
  $('overlay').hidden=mode==='title'||mode==='play';
  $('touch').hidden=mode!=='play';
  $('continue').disabled=!readSave();
}
function start(s=null){
  reset(s);checkpoint=snapshot();
  if(stages[stage].seconds)checkpoint.missionTime=stages[stage].seconds;
  if(runner)checkpoint.runnerHealth=2;
  mode='play';menus();audio.start(settings.volume/100);
}
function panel(kind){
  mode=kind;keys.clear();pressed.clear();drag=null;
  $('panelTitle').textContent=kind==='fail'?stages[stage].mission+' failed':pauseOrigin==='title'?'Settings':'Paused';
  $('panelText').textContent=kind==='fail'?screenMessage:'';
  $('options').hidden=kind==='fail';
  $('resume').hidden=kind==='fail';
  $('resume').firstChild.textContent=pauseOrigin==='title'?'Back to title ':'Resume ';
  $('restart').hidden=pauseOrigin==='title';
  $('home').hidden=pauseOrigin==='title';
  menus();
}
function toggle(){if(mode==='play'){pauseOrigin='play';panel('pause');}else if(mode==='pause'){mode=pauseOrigin;menus();}}
$('start').onclick=()=>start();
$('continue').onclick=()=>{const s=readSave();if(s)start(s);};
$('setup').onclick=()=>{pauseOrigin='title';panel('pause');};
$('resume').onclick=toggle;
$('restart').onclick=()=>start(checkpoint);
$('home').onclick=()=>{mode='title';menus();};
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(!e.repeat)toggle();return;}
  if(mode!=='play')return;
  if(/^(Arrow|Space|Key[WASDEFM]|Shift)/.test(e.code))e.preventDefault();
  if(!keys.has(e.code))pressed.add(e.code);
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();pressed.clear();drag=null;});
for(const button of document.querySelectorAll('#touch button')){
  const code=button.dataset.code;
  button.addEventListener('pointerdown',e=>{
    e.preventDefault();button.setPointerCapture(e.pointerId);
    if(code==='Escape'){toggle();return;}
    if(!keys.has(code))pressed.add(code);
    keys.add(code);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])
    button.addEventListener(event,()=>keys.delete(code));
}
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='play'||e.button!==0)return;
  drag={x:e.clientX,y:e.clientY,travel:0};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  view-=dx*.006;pitch=clamp(pitch+dy*.005,-.14,.67);
  drag.x=e.clientX;drag.y=e.clientY;drag.travel+=Math.abs(dx)+Math.abs(dy);
});
canvas.addEventListener('pointerup',()=>{if(drag?.travel<5)pressed.add('KeyF');drag=null;});
canvas.addEventListener('lostpointercapture',()=>{drag=null;});
const held=(...codes)=>codes.some(x=>keys.has(x));
function vehiclesOverlap(actor,x,z,other){
  const dx=other.x-x,dz=other.z-z;
  if(dx*dx+dz*dz>23)return false;
  const first=models[actor.kind], second=models[other.kind];
  const [ax,az]=[Math.sin(actor.a),Math.cos(actor.a)];
  const [bx,bz]=[Math.sin(other.a),Math.cos(other.a)];
  const parallel=Math.abs(ax*bx+az*bz),normal=Math.abs(ax*bz-az*bx);
  const lengths=[first.length*.48,second.length*.48],widths=[first.width*.49,second.width*.49];
  return Math.abs(dx*ax+dz*az)<lengths[0]+lengths[1]*parallel+widths[1]*normal&&
    Math.abs(dx*az-dz*ax)<widths[0]+lengths[1]*normal+widths[1]*parallel&&
    Math.abs(dx*bx+dz*bz)<lengths[1]+lengths[0]*parallel+widths[0]*normal&&
    Math.abs(dx*bz-dz*bx)<widths[1]+lengths[0]*normal+widths[0]*parallel;
}
function shiftPosition(actor,dx,dz,r,vehicle=false){
  const nextX=actor.x+dx,nextZ=actor.z+dz;
  const contact=(x,z)=>{
    if(blocked(x,z,r))return true;
    if(!vehicle)return false;
    const reach=models[actor.kind].length*.32,fx=Math.sin(actor.a)*reach,fz=Math.cos(actor.a)*reach;
    if(blocked(x+fx,z+fz,.65)||blocked(x-fx,z-fz,.65))return true;
    return [...cars,...patrol].some(v=>v!==actor&&vehiclesOverlap(actor,x,z,v)&&
      Math.hypot(v.x-x,v.z-z)<=distance(v,actor));
  };
  let impact=false;
  if(dx!==0){if(!contact(nextX,actor.z))actor.x=nextX;else impact=true;}
  if(dz!==0){if(!contact(actor.x,nextZ))actor.z=nextZ;else impact=true;}
  return impact;
}
function damage(amount){
  const absorbed=Math.min(armor,amount*.7);armor-=absorbed;player.hp=Math.max(0,player.hp-(amount-absorbed));
}
function missionVehicle(id){return id?cars.find(v=>v.missionCar===id):null;}
function marker(){
  const step=stages[stage];
  if(step.action==='acquire')return missionVehicle(step.vehicle);
  if(step.action==='fight')return runner;
  return step.point;
}
function prepareStage(){
  const step=stages[stage];
  missionTime=step.seconds||0;
  runner=step.action==='fight'?{...step.point,a:Math.PI/2,pace:0,style:6,endurance:2}:null;
}
function completeStep(){
  const step=stages[stage];
  if(step.reward){
    money+=step.reward;rank++;armor=clamp(armor+25,0,100);
    player.hp=Math.max(player.hp,76);
  }
  if(step.wanted)alert(step.wanted);
  stage++;prepareStage();
  say(step.line+(step.reward?'  +$'+step.reward.toLocaleString('en-US'):''));
  audio.signal();checkpoint=snapshot();save();
}
function fail(message){say(message);panel('fail');}
function alert(level){
  wanted=Math.max(wanted,level);heat=0;
}
function nearestCar(){
  let close=null,best=3;
  for(const c of cars){
    const d=distance(c,player);
    if(d<best&&c.hp>0&&Math.abs(c.speed)<3){best=d;close=c;}
  }
  return close;
}
function interact(){
  if(boarding)return;
  const step=stages[stage];
  if(!ride&&step.point&&distance(player,step.point)<2.45&&(step.action==='talk'||step.action==='collect')){
    if(stage===0&&cars[0].hp<=0)Object.assign(cars[0],car(2.6,6,0,0,{target:true,missionCar:'vesper'}));
    if(stage===7&&missionVehicle('transit').hp<=0)
      Object.assign(missionVehicle('transit'),car(40.6,-64,0,4,{missionCar:'transit'}));
    completeStep();return;
  }
  if(ride){
    if(Math.abs(ride.speed)>9){say('Slow down to exit');return;}
    for(const side of [1,-1]){
      const x=ride.x+Math.cos(ride.a)*side*1.47,z=ride.z-Math.sin(ride.a)*side*1.47;
      if(!blocked(x,z,.35)){
        boarding={v:ride,enter:false,x,z,left:.33,total:.33};ride.speed=0;return;
      }
    }
    say('Move the car to clear the doors');return;
  }
  const near=nearestCar();
  if(!near)return;
  near.traffic=null;near.speed=0;
  const side=(player.x-near.x)*Math.cos(near.a)-(player.z-near.z)*Math.sin(near.a)<0?-1:1;
  boarding={v:near,enter:true,left:.37,total:.37,x:near.x+side*Math.cos(near.a)*.62,z:near.z-side*Math.sin(near.a)*.62};
}
function board(dt){
  const task=boarding,v=task.v;
  task.left-=dt;
  const t=1-Math.exp(-dt*13);
  player.x+=(task.x-player.x)*t;player.z+=(task.z-player.z)*t;
  player.a=moveAngle(player.a,v.a,dt*12);player.pace=.48;
  if(task.left>0)return;
  boarding=null;player.pace=0;
  if(!task.enter){ride=null;Object.assign(player,{x:task.x,z:task.z,a:v.a});return;}
  ride=v;view=v.a;player.x=v.x;player.z=v.z;player.a=v.a;
  const step=stages[stage];
  if(step.action==='acquire'&&v.missionCar===step.vehicle)completeStep();
  else if(!v.missionCar){alert(v.kind===3?3:1);say('Vehicle reported stolen');}
}
function runPlayer(dt){
  if(boarding){board(dt);return;}
  const north=Number(held('KeyW','ArrowUp'))-Number(held('KeyS','ArrowDown'));
  const side=Number(held('KeyD','ArrowRight'))-Number(held('KeyA','ArrowLeft'));
  if(ride){
    const v=ride, max=models[v.kind].speed;
    v.steering=(v.steering||0)+(-side*.32-(v.steering||0))*Math.min(1,dt*8);
    v.roll=(v.roll||0)+(-v.steering*.16-(v.roll||0))*Math.min(1,dt*5);
    v.wheelTurn=((v.wheelTurn||0)+v.speed*dt/.32)%(Math.PI*2);
    v.speed=clamp(v.speed+north*dt*(north*v.speed<0?25:12),-7,max);
    v.speed*=Math.exp(-dt*(held('Space')?8:north? .13:1.2));
    if(Math.abs(v.speed)<.045)v.speed=0;
    v.a+=v.steering*dt*4.9*clamp(v.speed/4.5,-1,1)/(1+Math.abs(v.speed)*.029);
    if(!drag)view=moveAngle(view,v.a,dt*3.6);
    const impact=shiftPosition(v,Math.sin(v.a)*v.speed*dt,Math.cos(v.a)*v.speed*dt,.92,true);
    if(impact&&Math.abs(v.speed)>2.2&&crash<=0){
      v.hp=Math.max(0,v.hp-Math.abs(v.speed)*1.15);damage(Math.abs(v.speed)*.28);audio.hit();
      v.speed*=-.25;crash=.34;say('Collision • Vehicle damaged');
    }else if(impact)v.speed*=.78;
    if(v.hp<=0){
      if(v.missionCar&&(v.missionCar===stages[stage].vehicle||v.target&&stage<4)){fail(models[v.kind].name+' was wrecked.');return;}
      interact();damage(18);
    }
    player.x=v.x;player.z=v.z;player.a=v.a;return;
  }
  const dx=Math.sin(view)*north-Math.cos(view)*side,dz=Math.cos(view)*north+Math.sin(view)*side;
  const moving=Boolean(north||side);
  player.fast=held('ShiftLeft','ShiftRight');player.pace+=((moving?1:0)-player.pace)*Math.min(1,dt*11);
  if(moving){
    const a=angle(dx,dz),speed=player.fast?6.35:3.7;
    player.a=moveAngle(player.a,a,dt*14);
    shiftPosition(player,Math.sin(a)*speed*dt,Math.cos(a)*speed*dt,.33);
  }
  if(pressed.has('KeyF')&&kick<=0){
    kick=.45;audio.hit();
    const inReach=p=>!p.stun&&distance(p,player)<1.78&&Math.abs(wrap(angle(p.x-player.x,p.z-player.z)-player.a))<1.65;
    if(runner&&inReach(runner)){
      runner.endurance--;
      if(!runner.endurance)completeStep();else{runner.stagger=.62;say('Runner staggered • Strike again');}
      return;
    }
    const target=people.find(inReach);
    if(target){target.stun=5;alert(Math.min(3,wanted+(target.police?2:1)));say('Witness alert • Patrol notified');}
  }
  player.strike=kick>.18;
}
function traffic(dt){
  for(const v of cars){
    if(!v.traffic)continue;
    const {axis,sign}=v.traffic;
    const at=axis?v.z:v.x,fixed=axis?v.x:v.z;
    const inverseRoads=axis?streets.z:streets.x;
    const cross=inverseRoads.find(n=>(n-at)*sign>5.55&&(n-at)*sign<10.8);
    const lane=nearestRoad(fixed,axis?streets.x:streets.z);
    const green=cross===undefined||northGreen(axis?lane:cross,axis?cross:lane,clock)===axis;
    const desired=green?5.1+v.kind*.75:0;
    v.speed+=(desired-v.speed)*Math.min(1,dt*(green?1.5:5));
    const move=sign*dt*v.speed;
    const x=v.x+(axis?0:move),z=v.z+(axis?move:0);
    if(cars.some(c=>c!==v&&vehiclesOverlap(v,x,z,c)&&
      Math.hypot(c.x-x,c.z-z)<=distance(c,v))){v.speed*=.6;continue;}
    if(distance(player,{x,z})<2&&!ride)continue;
    v.x=x;v.z=z;v.wheelTurn=((v.wheelTurn||0)+v.speed*dt/.32)%(Math.PI*2);
    if(axis&&Math.abs(v.z)>93)v.z=-v.z;
    if(!axis&&(v.x< -4||v.x>124))v.x=v.x<0?124:-4;
  }
  for(const p of people){
    if(p.stun){p.stun=Math.max(0,p.stun-dt);continue;}
    if(p.market&&!p.pace)continue;
    const d=dt*(.9+p.style*.047);
    const dx=Math.sin(p.a)*d,dz=Math.cos(p.a)*d;
    const nx=p.x+dx,nz=p.z+dz;
    if(blocked(nx,nz,.2)||nx< -9||nx>124||Math.abs(nz)>94||p.market&&(nz<40.5||nz>55)){p.a+=Math.PI;continue;}
    p.x=nx;p.z=nz;
  }
}
function nearestRoad(value,roads){return roads.reduce((near,x)=>Math.abs(value-x)<Math.abs(value-near)?x:near);}
function police(dt){
  if(!wanted){patrol.length=0;return;}
  while(patrol.length<wanted){
    const ax=nearestRoad(player.x,streets.x);
    const z=clamp(player.z-19-patrol.length*7,-89,92);
    patrol.push(car(ax-2.6+patrol.length*2.6,z,0,3));
  }
  let close=Infinity;
  for(const v of patrol){
    const d=distance(v,player);
    close=Math.min(close,d);
    const roadX=nearestRoad(v.x,streets.x),roadZ=nearestRoad(v.z,streets.z);
    const targetX=nearestRoad(player.x,streets.x);
    let tx=player.x,tz=player.z;
    if(d>12&&roadX!==targetX){
      if(Math.abs(v.z-roadZ)<3){tz=roadZ;tx=targetX;}
      else{tx=roadX;tz=roadZ;}
    }
    const a=angle(tx-v.x,tz-v.z);
    v.a=moveAngle(v.a,a,dt*4.3);
    v.speed=clamp((d-(ride?4.15:1.62))*3.7,0,ride?14+wanted*1.2:8);
    const impact=shiftPosition(v,Math.sin(v.a)*v.speed*dt,Math.cos(v.a)*v.speed*dt,.74);
    if(impact)v.a=moveAngle(v.a,angle(roadX-v.x,roadZ-v.z),dt*13);
    if(d<(ride?5.0:2.45)){
      damage(dt*(ride?3.4:11));
      if(ride)ride.hp=Math.max(0,ride.hp-dt*1.8);
    }
  }
  if(close>19)heat+=dt*(Math.abs(ride?.speed||0)>18?1.6:1);else heat=Math.max(0,heat-dt*.48);
  const step=stages[stage];
  const safeGate=step.action==='escape'&&ride?.missionCar===step.vehicle&&distance(ride,step.point)<5;
  if(heat>5.5||safeGate){
    wanted=0;patrol=[];heat=0;
    if(step.action==='escape'&&ride?.missionCar===step.vehicle)completeStep();
    else say('Search called off');
  }
}
function missionTick(dt){
  const step=stages[stage];
  if(step.action==='escape'&&!wanted&&ride?.missionCar===step.vehicle&&distance(ride,step.point)<5)completeStep();
  if(step.action==='park'&&ride?.missionCar===step.vehicle&&distance(ride,step.point)<5&&Math.abs(ride.speed)<4)completeStep();
  if(step.action==='cross'&&ride?.missionCar===step.vehicle&&distance(ride,step.point)<6)completeStep();
  if(step.seconds){
    missionTime-=dt;
    if(missionTime<=0){fail(step.timeout||'The club closed its doors. Retry the delivery.');return;}
    if(step.action==='timed'&&!ride&&distance(player,step.point)<2.4)completeStep();
  }
  if(runner){
    runner.stagger=Math.max(0,(runner.stagger||0)-dt);
    const d=distance(runner,player);
    const a=angle(player.x-runner.x,player.z-runner.z);
    runner.a=moveAngle(runner.a,a,dt*6);
    runner.pace=d>1.26&&!runner.stagger?1:0;
    if(runner.pace)shiftPosition(runner,Math.sin(a)*dt*2.45,Math.cos(a)*dt*2.45,.24);
    else if(!runner.stagger&&!ride)damage(dt*10);
  }
}
function simulate(dt){
  kick=Math.max(0,kick-dt);crash=Math.max(0,crash-dt);
  if(pressed.has('KeyE'))interact();
  runPlayer(dt);
  if(mode!=='play')return;
  ambientTick+=dt;
  if(ambientTick>=.065){traffic(ambientTick);ambientTick=0;}
  police(dt);missionTick(dt);
  if(player.hp<=0)fail('You were taken down.');
  if(pressed.has('KeyM')&&mode==='play')save(true);
  pressed.clear();
}
function camera(dt){
  if(mode==='title'||mode==='pause'&&pauseOrigin==='title'){
    const t=clock*.12;
    return [[-7+Math.sin(t)*3,4.9,20+Math.cos(t)*3],[13,3.4,-20]];
  }
  const actor=ride||player,d=ride?7.4:4.3;
  const target=[actor.x,ride?1.1:1.38,actor.z];
  const ax=Math.sin(view),az=Math.cos(view);
  let reach=d;
  for(let i=.7;i<=d;i+=.38){
    const h=target[1]+.69*i/d+Math.sin(pitch)*i;
    if(cameraBlocked(target[0]-ax*i,h,target[2]-az*i)){reach=Math.max(.65,i-.52);break;}
  }
  const next=[target[0]-ax*reach,target[1]+.69+Math.sin(pitch)*reach,target[2]-az*reach];
  if(!eye||Math.hypot(next[0]-eye[0],next[2]-eye[2])>15)eye=next;
  else eye=eye.map((x,i)=>x+(next[i]-x)*Math.min(1,dt*11));
  if(cameraBlocked(...eye))eye=next;
  return [eye,[target[0]+ax*(ride?1.45:.8),target[1]+Math.sin(pitch)*-.4,target[2]+az*(ride?1.45:.8)]];
}
function mark(mesh,p,time){
  if(!p)return;
  const c=C('98ffe0',2),r=1.05+.15*Math.sin(time*3);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    mesh.box(p.x+Math.cos(a)*r,.035,p.z+Math.sin(a)*r,.18,.045,.18,c);
  }
  const y=2.55+.13*Math.sin(time*3);
  const top=[p.x,y+.3,p.z],base=[p.x,y-.27,p.z];
  const ring=[[p.x+.24,y,p.z],[p.x,y,p.z+.22],[p.x-.24,y,p.z],[p.x,y,p.z-.22]];
  for(let i=0;i<4;i++){
    mesh.triangle(top,ring[i],ring[(i+1)%4],c);
    mesh.triangle(base,ring[(i+1)%4],ring[i],C('55c7bb',1.9));
  }
}
function radar(){
  const x=v=>90+(v-player.x)*2,z=v=>90+(v-player.z)*2;
  map.fillStyle='#322842';map.fillRect(0,0,180,180);
  map.fillStyle='#335676';map.fillRect(0,0,clamp(x(-12),0,180),180);
  map.fillStyle='#6e6077';
  for(const r of streets.x)map.fillRect(x(r)-9,0,18,180);
  for(const r of streets.z)map.fillRect(Math.max(0,x(-9)),z(r)-8,180,16);
  const objective=marker();
  if(objective){
    map.lineWidth=1.35;map.strokeStyle='#85edce80';map.setLineDash([3,4]);
    map.beginPath();map.moveTo(90,90);map.lineTo(clamp(x(objective.x),8,172),clamp(z(objective.z),8,172));map.stroke();map.setLineDash([]);
    map.fillStyle='#85edce';
    map.beginPath();map.arc(clamp(x(objective.x),8,172),clamp(z(objective.z),8,172),5,0,Math.PI*2);map.fill();
  }
  for(const c of patrol){map.fillStyle='#fb7183';map.fillRect(x(c.x)-2,z(c.z)-2,4,4);}
  map.save();map.translate(90,90);map.rotate(-player.a);
  map.fillStyle='#fff1dc';map.beginPath();map.moveTo(0,8);map.lineTo(5,-6);map.lineTo(0,-3);map.lineTo(-5,-6);map.fill();map.restore();
}
function hud(){
  $('district').textContent=district(player.x,player.z);
  const step=stages[stage],goal=marker();
  $('mission').textContent=step.mission;
  $('task').textContent=step.text+(step.seconds?'  ·  '+Math.ceil(Math.max(0,missionTime))+'s':goal?'  ·  '+Math.round(distance(player,goal))+' m':'');
  $('money').textContent='$'+money.toLocaleString('en-US');
  $('rank').textContent=rank?'REPUTATION '+rank:'MARISOL BAY';
  $('wanted').textContent='★'.repeat(wanted)+'☆'.repeat(3-wanted);
  $('wanted').setAttribute('aria-label','Wanted level '+wanted+' of 3');
  $('health').style.width=player.hp*.76+'%';$('armor').style.width=armor*.76+'%';
  $('notice').textContent=noticeUntil>clock?screenMessage:'';
  $('speed').hidden=!ride;
  if(ride){
    $('velocity').textContent=Math.round(Math.abs(ride.speed)*3.6);
    $('vehicle').textContent=models[ride.kind].name;
    $('condition').textContent='Condition '+Math.round(ride.hp)+'%';
  }
  const near=ride?null:nearestCar();
  const close=goal&&distance(player,goal)<2.45;
  $('prompt').textContent=boarding?'':close&&!ride&&step.contact?'E  /  TALK TO '+step.contact.toUpperCase():
    close&&!ride&&step.action==='collect'?'E  /  TAKE REEL':
    ride&&step.action==='park'&&distance(ride,step.point)<8?'SPACE  /  BRAKE TO DELIVER':
    ride?'E  /  EXIT VEHICLE':close&&step.action==='fight'?'F  /  STRIKE':
    near?'E  /  ENTER '+models[near.kind].name.toUpperCase():'';
  radar();
}
function queue(key,actor,build,motion){
  if(!actorMeshes.has(key)){
    const mesh=new Mesh();build(mesh);
    actorMeshes.set(key,gfx.buffer(mesh));
  }
  const mesh=actorMeshes.get(key);
  let rows=groups.get(mesh);
  if(!rows){rows=[];groups.set(mesh,rows);}
  rows.push(actor.x,actor.z,Math.sin(actor.a),Math.cos(actor.a),...motion);
}
function queueCar(v,time,detail){
  const damage=v.hp<45?35:100;
  const flash=v.kind===3&&Math.sin(time*17)<0?1:0;
  queue('v/'+v.kind+'/'+damage+'/'+flash+'/'+detail,v,
    mesh=>drawCar(mesh,{x:0,z:0,a:0,kind:v.kind,hp:damage},flash?.22:.03,detail),
    [-1,Math.sin(time*12)*Math.min(.038,Math.abs(v.speed)*.002),v.roll||0,0]);
  const model=models[v.kind],larger=v.kind===2||v.kind===4;
  const sa=Math.sin(v.a),ca=Math.cos(v.a);
  const rate=v.speed;
  for(const side of [-1,1])for(const end of [-1,1]){
    const x=side*model.width*.44,z=end*model.length*.323;
    const wheel={x:v.x+x*ca+z*sa,z:v.z+z*ca-x*sa,a:v.a+(end===1?(v.steering||0):0)};
    queue('w/'+side+'/'+detail+'/'+larger,wheel,mesh=>drawWheel(mesh,side,detail,larger),
      [-2,larger?.342:.31,0,v.wheelTurn??time*rate/.32]);
  }
}
function queuePerson(p,time,hero=false,detail=true){
  const gait=Math.sin(time*(p.fast?13:9)+(p.style||0)*2)*Math.min(1,p.pace||0)*(p.fast?1:.68);
  queue('p/'+p.style+'/'+!!p.police+'/'+hero+'/'+detail,p,
    mesh=>drawPerson(mesh,{...p,x:0,z:0,a:0,pace:0,strike:false},0,hero,detail),
    [1,gait,p.strike?1:0,0]);
}
function frame(ms){
  const dt=last?Math.min((ms-last)/1000,.42):0;
  last=ms;clock+=dt;
  physicsDebt=mode==='play'?Math.min(.42,physicsDebt+dt):0;
  while(mode==='play'&&physicsDebt>=1/60){simulate(1/60);physicsDebt-=1/60;}
  const nightTarget=settings.lighting==='night'?1:settings.lighting==='sunset'?0:stage>=3?.94:stage===2?.31:0;
  night+=(nightTarget-night)*Math.min(1,dt*.62);
  const [from,to]=camera(dt),mesh=new Mesh();
  const hx=to[0]-from[0],hz=to[2]-from[2],length=Math.hypot(hx,hz)||1;
  const visible=(p,d)=>{
    const x=p.x-from[0],z=p.z-from[2];
    const ahead=(x*hx+z*hz)/length,side=Math.abs(x*hz-z*hx)/length;
    return x*x+z*z<d*d&&ahead> -3&&side<ahead*.99+3.2;
  };
  const lite=settings.quality<0||settings.quality===.62;
  const carRange=lite?52:70,carDetail=lite?13:19,walkingRange=lite?23:30;
  groups.clear();
  for(const v of cars)if(visible(v,carRange))queueCar(v,clock,visible(v,carDetail));
  for(const v of patrol)if(visible(v,carRange))queueCar(v,clock,visible(v,carDetail));
  for(const p of people)if(!p.stun&&visible(p,walkingRange))queuePerson(p,clock,false,visible(p,lite?9:13));
  const contact=missionContact(stage);
  if(contact&&visible(contact,36))queuePerson(contact,clock);
  if(runner&&visible(runner,34))queuePerson(runner,clock);
  if((!ride||boarding)&&mode!=='title')queuePerson(player,clock,true);
  if(mode==='play')mark(mesh,marker(),clock);
  audio.tick(mode==='play',ride?.speed||0,wanted,night,clock,ride?Math.abs(ride.steering||0)*Math.abs(ride.speed)+(held('Space')?Math.abs(ride.speed)*.4:0):0,Boolean(ride));
  gfx.frame(chunks,mesh,groups,from,to,night,clock,settings.quality,ms,ride?[ride.x,ride.z,Math.sin(ride.a),Math.cos(ride.a)]:[10000,10000,0,0]);
  hudClock+=dt;
  if(hudClock>.085&&mode==='play'){hud();hudClock=0;}
  requestAnimationFrame(frame);
}
try{gfx=renderer(canvas);chunks=buildCity(gfx);reset();menus();requestAnimationFrame(frame);}
catch(error){
  console.error(error);$('start').disabled=true;$('continue').disabled=true;
  const note=document.createElement('p');note.textContent='The city could not start. Open in Chromium with WebGL 2 enabled.';$('start').before(note);
}
