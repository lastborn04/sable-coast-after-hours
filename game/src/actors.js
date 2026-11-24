import {tint as C} from './render.js';

const rubber=C('262631'),tread=C('191923'),alloy=C('c6c7d0',.78),glass=C('263b4d',.92);
const seal=C('232831',.15),trim=C('32323b',.38);
export const models=[
  {name:'Vesper R',color:'bb354e',width:1.82,length:3.99,height:1.15,speed:31},
  {name:'Arden LX',color:'748f9d',width:1.76,length:4.05,height:1.39,speed:25},
  {name:'Marea SX',color:'546e60',width:1.91,length:4.23,height:1.72,speed:22},
  {name:'Coastal Interceptor',color:'bfc3c9',width:1.84,length:4.15,height:1.39,speed:27},
  {name:'Harbor Transit',color:'b87b50',width:1.94,length:4.47,height:1.91,speed:20},
];
const contour=[
  [-.65,0],[-.87,.08],[-.99,.25],[-1,.58],[-.94,.78],[-.79,.94],[-.51,1],
  [.51,1],[.79,.94],[.94,.78],[1,.58],[.99,.25],[.87,.08],[.65,0],
];
function body(m,sections,paint){
  const rings=sections.map(([z,w,lo,hi])=>contour.map(([u,v])=>[u*w,lo+(hi-lo)*v,z]));
  const normals=contour.map(([u,v])=>[u*.84,(v-.51)*1.7,0]);
  for(let i=1;i<rings.length;i++){
    const a=rings[i-1],b=rings[i],slope=(sections[i-1][3]-sections[i][3])*.85;
    for(let j=0;j<a.length;j++){
      const k=(j+1)%a.length;
      if(j===a.length-1)continue;
      const mat=j===0||j===12?trim:paint;
      const n=[normals[j][0],normals[j][1],slope],o=[normals[k][0],normals[k][1],slope];
      m.triangle(a[j],b[j],b[k],mat,n,n,o);m.triangle(a[j],b[k],a[k],mat,n,o,o);
    }
  }
  for(const i of [0,rings.length-1]){
    const a=rings[i];
    for(let j=1;j<a.length-1;j++)m.triangle(a[0],a[j],a[j+1],trim,[0,0,i===0?-1:1]);
  }
}
function greenhouse(m,sections,paint){
  const rings=sections.map(([z,w,lo,hi])=>[[-w,lo,z],[-w*.82,hi-.04,z],[-w*.67,hi,z],[w*.67,hi,z],[w*.82,hi-.04,z],[w,lo,z]]);
  for(let i=1;i<rings.length;i++){
    const a=rings[i-1],b=rings[i];
    const window=i===1||i===rings.length-1;
    for(let j=0;j<5;j++)m.quad(a[j],b[j],b[j+1],a[j+1],j===2?(window?glass:paint):j===0||j===4?glass:trim);
  }
}
export function drawCar(m,car,time,detail=true){
  const model=models[car.kind],w=model.width/2,len=model.length/2,h=model.height;
  const van=car.kind===4,tall=car.kind===2||van,sport=car.kind===0,police=car.kind===3;
  const damaged=car.hp<45,paint=C(damaged?'674757':model.color,.81);
  m.pose=[car.x,0,car.z,car.a];
  m.shadow(.23,-.17,w*1.35,len*1.12);
  body(m,[
    [-len,w*.76,.32,.53],[-len*.96,w*.92,.29,.64],[-len*.81,w,.25,.73],
    [-len*.41,w*1.01,.285,.76],[len*.29,w*.99,.285,.75],
    [len*.61,w,.25,sport?.7:.74],[len*.88,w*.91,.29,.61],[len,w*.72,.36,.51],
  ],paint);
  greenhouse(m,[
    [-len*(van?.89:.67),w*.86,.71,.75],[-len*(tall?.78:.37),w*.71,.75,h-.045],
    [-len*.15,w*.73,.75,h],[len*(tall?.31:.21),w*.71,.74,h-.040],
    [len*(tall?.63:.55),w*.87,.71,.75],
  ],paint);
  for(const s of [-1,1]){
    m.box(s*w*.51,.50,len-.015,w*.44,.076,.062,C(damaged&&s<0?'665259':'fff0cb',2));
    m.box(s*w*.60,.51,-len+.011,w*.41,.085,.075,C('fc414a',2.05));
    if(detail){
      m.box(s*w*.52,.405,len-.001,w*.39,.02,.042,C('eb9959',1.35));
      m.ellipsoid(s*w*.97,.83,len*.29,.153,.063,.109,paint,9,4);
      m.box(s*w*1.02,.837,len*.22,.122,.041,.018,glass);
      m.box(s*w*1.003,.653,-.18,.018,.047,.153,alloy);
      m.box(s*w*.996,.49,.025,.018,.021,len*.83,seal);
      m.box(s*w*.981,.36,0,.025,.056,len*.57,trim);
    }
    if(police)m.box(s*w*.985,.51,0,.035,.18,len*1.55,C('294267',.42));
  }
  m.box(0,.432,len-.003,w*.66,.108,.039,seal);
  m.box(0,.42,-len-.009,.34,.095,.031,C('d8cfac',1.12));
  if(sport&&detail){
    m.box(0,.725,-len*.81,w*1.69,.039,.163,seal);
    for(const s of [-1,1])m.box(s*w*.55,.681,-len*.81,.045,.1,.057,trim);
  }
  if(damaged&&detail){
    m.box(-w*.23,.405,len*.985,w*.40,.048,.06,C('302a37'));
    m.box(-w*.973,.53,len*.4,.032,.035,len*.54,C('cab5a2',.22));
  }
  if(police){
    m.box(0,h+.051,-.05,.91,.09,.25,trim);
    m.box(-.24,h+.106,-.05,.405,.063,.22,C('ff5275',Math.sin(time*23)>0?2:1.05));
    m.box(.24,h+.106,-.05,.405,.063,.22,C('559aff',Math.sin(time*23)<0?2:1.05));
  }
}
export function drawWheel(m,side,detail,larger){
  const r=larger?.342:.31;
  m.ellipsoid(0,r,0,.142,r,r,rubber,detail?12:7,detail?5:3);
  if(!detail)return;
  m.ellipsoid(side*.098,r,0,.072,r*.91,r*.91,tread,12,3);
  m.ellipsoid(side*.155,r,0,.032,r*.66,r*.66,alloy,12,3);
  m.ellipsoid(side*.177,r,0,.014,r*.45,r*.45,seal,10,3);
  for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5,dy=Math.sin(a),dz=Math.cos(a),x=side*.188;
    m.quad([x,r+dy*.036-dz*.017,dz*.036+dy*.017],[x,r+dy*.194-dz*.025,dz*.194+dy*.025],
      [x,r+dy*.194+dz*.025,dz*.194-dy*.025],[x,r+dy*.036+dz*.017,dz*.036-dy*.017],alloy);
  }
  m.ellipsoid(side*.19,r,0,.025,.047,.047,alloy,8,3);
}
const skins=['8f584b','a97259','75453e','be8468','a56a55'];
const tops=['a96b51','568f89','b0624d','5a637f','895e74','b18f65','68614d','617980','966577','64778a'];
const trousers=['4d4c53','383544','343f48','443e48','4e5359'];
function taper(m,rings,color,segments){
  const points=rings.map(([x,y,z,rx,rz])=>Array.from({length:segments},(_,i)=>{
    const a=i*Math.PI*2/segments,c=Math.cos(a),s=Math.sin(a);
    return [[x+rx*c,y,z+rz*s],[c,0,s]];
  }));
  for(let j=1;j<points.length;j++)for(let i=0;i<segments;i++){
    const k=(i+1)%segments;
    const [a,na]=points[j-1][i],[b,nb]=points[j][i],[c,nc]=points[j][k],[d,nd]=points[j-1][k];
    m.triangle(a,b,c,color,na,nb,nc);m.triangle(a,c,d,color,na,nc,nd);
  }
}
export function drawPerson(m,person,time,hero=false,detail=true){
  const {x,z,a,police,style}=person;
  const skin=C(skins[style%skins.length]),cloth=C(hero?'804452':police?'24354e':tops[style%tops.length],-.47),
    pant=C(hero?'363641':police?'303c50':trousers[style%trousers.length],-.46),
    leather=C('302b35'),sole=C('918782'),hair=C(style%3===0?'35262a':'27232a'),metal=C('d4a77f',.34);
  const segments=detail?12:6,scale=hero?1:.93+(style%4)*.031;
  const torso=hero?1:.93+(style%3)*.046;
  m.pose=[x,0,z,a];m.shadow(.22,-.14,.53,.33);
  const body=(rings,color)=>taper(m,rings.map(([u,y,v,w,d])=>[u,y*scale,v,w,d]),color,segments);
  const oval=(u,y,v,w,h,d,color,n=segments,r=5)=>m.ellipsoid(u,y*scale,v,w,h*scale,d,color,n,r);
  body([[0,.91,0,.17,.104],[0,1.07,0,.179,.106],[0,1.18,0,.15,.085]],pant);
  body([[0,1.04,0,.156*torso,.101],[0,1.16,-.009,.154*torso,.106],[0,1.34,-.016,.2*torso,.116],
    [0,1.44,-.015,.218*torso,.104],[0,1.51,0,.132,.087],[0,1.54,0,.062,.058]],cloth);
  body([[0,1.49,0,.063,.056],[0,1.62,.005,.06,.059],[0,1.65,.003,.051,.05]],skin);
  body([[0,1.603,.025,.052,.056],[0,1.637,.028,.077,.075],[0,1.695,.02,.098,.095],
    [0,1.763,.007,.103,.094],[0,1.822,0,.084,.076],[0,1.855,0,.029,.031]],skin);
  oval(0,1.795,-.039,.103,style%3===0?.088:.062,.078,hair);
  if(detail&&!police){
    const curls=hero?7:style%3===0?10:4;
    for(let j=0;j<curls;j++){
      const a=j*Math.PI*2/curls;
      oval(Math.cos(a)*.064,1.824+Math.sin(a*3)*.016,Math.sin(a)*.05-.034,.034,.026,.036,hair,6,3);
    }
  }
  if(police){
    oval(0,1.815,.004,.12,.043,.107,cloth);
    oval(0,1.795,.076,.109,.014,.089,leather);
  }
  for(const s of [-1,1]){
    const u=s*.092;
    body([[u,.11,0,.051,.047],[u,.31,-.004,.057,.062],[u,.53,.011,.064,.066],
      [u,.78,.004,.082,.092],[u,.97,0,.082,.086],[u,1.09,0,.067,.071]],pant);
    body([[s*.163,1.453,-.006,.064,.075],[s*.209,1.398,-.008,.064,.061],
      [s*.241,1.271,-.005,.055,.055],[s*.258,1.197,.008,.044,.044]],cloth);
    body([[s*.258,1.201,.008,.045,.044],[s*.273,1.132,.02,.034,.036],[s*.289,1.066,.032,.029,.033]],skin);
    oval(s*.291,1.028,.04,.034,.061,.029,skin,detail?9:6,4);
    oval(s*.292,1.046,.065,.019,.041,.017,skin,6,3);
    oval(u,.082,.065,.064,.064,.14,leather,detail?11:6,4);
    oval(u,.035,.064,.066,.021,.139,sole,detail?10:6,3);
    if(detail){
      oval(s*.097,1.711,.009,.022,.035,.025,skin,8,4);
      m.box(s*.038,1.742*scale,.098,.03,.012,.012,leather);
      m.box(s*.040,1.757*scale,.099,.032,.009,.013,hair);
      if(hero)m.box(s*.13,1.338*scale,-.109,.025,.22,.025,leather);
    }
  }
  if(detail){
    oval(0,1.706,.112,.019,.034,.023,skin,8,4);
    m.box(0,1.66*scale,.106,.033,.008,.012,C('624447'));
    if(hero){
      m.box(0,1.289,.104,.012,.385,.016,metal);
      const collar=C('aa6d72',-.45);
      m.triangle([-.062,1.50,.068],[-.098,1.45,.099],[-.028,1.397,.11],collar);
      m.triangle([.062,1.50,.068],[.028,1.397,.11],[.098,1.45,.099],collar);
      m.box(-.108,1.343,.111,.081,.056,.022,C('986268'));
      oval(0,1.282,-.146,.128,.193,.057,leather,10,5);
      for(const s of [-1,1])m.box(s*.092,1.40,.081,.028,.208,.033,leather);
    }
    if(police)m.box(-.102,1.388*scale,.103,.037,.042,.015,metal);
  }
}
