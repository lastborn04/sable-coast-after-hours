const step=(mission,text,x,z,action,extra={})=>({mission,text,point:{x,z},action,...extra});
const dead='Dead Air',neon='Neon Debt',harbor='Harbor Heat',midnight='Midnight Exchange';

export const stages=[
  step(dead,'Meet Imani at the promenade.',-7.3,-5,'talk',{
    contact:'Imani',style:2,line:'Imani • The coral Vesper has our missing master tape.'}),
  step(dead,'Take the coral Vesper on the boulevard.',2.6,6,'acquire',{
    vehicle:'vesper',wanted:2,line:'Dispatch • Coastal units, intercept the coral Vesper.'}),
  step(dead,'Lose the patrol at the coastal underpass.',2.6,62,'escape',{
    vehicle:'vesper',line:'Imani • You’re clear. South garage. Bring my tape home.'}),
  step(dead,'Bring the Vesper to the southbound garage.',2.6,76,'park',{
    vehicle:'vesper',reward:850,line:'Dead Air complete • Imani’s tape is safe.'}),
  step(neon,'Meet Nessa on Lantern Row.',21,38,'talk',{
    contact:'Nessa',style:8,line:'Nessa • Run this envelope to the club on foot. Keep its name off the radio.'}),
  step(neon,'Deliver the envelope to the club on foot.',34,38,'timed',{
    seconds:27,line:'Nessa • They followed the envelope. Stop the runner before they reach me.'}),
  step(neon,'Stop the runner. Face them and strike.',38,39.5,'fight',{
    reward:1250,line:'Neon Debt complete • Nessa traced the envelope to the harbor.'}),
  step(harbor,'Meet Bayo at Pier 4.',40.6,-54,'talk',{
    contact:'Bayo',style:5,line:'Bayo • That transit van holds my ledger. Take it south before dispatch seals the docks.'}),
  step(harbor,'Recover the Harbor Transit van.',40.6,-64,'acquire',{
    vehicle:'transit',wanted:1,line:'Bayo • Camera at the customs line. Keep going.'}),
  step(harbor,'Pass through the customs checkpoint.',40.6,-30,'cross',{
    vehicle:'transit',wanted:3,line:'Dispatch • Three units to Pier 4. Intercept the van.'}),
  step(harbor,'Lose the patrol at the financial district gate.',40.6,0,'escape',{
    vehicle:'transit',line:'Bayo • The gate cut the road feeds. Park by the exchange.'}),
  step(harbor,'Park the van at the exchange.',40.6,8,'park',{
    vehicle:'transit',reward:1850,line:'Harbor Heat complete • Bayo has the ledger.'}),
  step(midnight,'Meet Imani at the exchange.',42,8,'talk',{
    contact:'Imani',style:2,line:'Imani • The master and the ledger match. Pick up the duplication reel downtown.'}),
  step(midnight,'Collect the reel in the financial district.',70,0,'collect',{
    line:'Imani • Get the reel to Nessa. Her night-market broadcast starts in 55 seconds.'}),
  step(midnight,'Hand the reel to Nessa at the night market.',73.4,44,'talk',{
    contact:'Nessa',style:8,reward:2600,seconds:55,timeout:'The broadcast started without the reel. Retry the handoff.',line:'Midnight Exchange complete • The whole coast just heard the truth.'}),
  {mission:'Free roam',text:'Explore Marisol Bay.'},
];

export function missionContact(stage){
  const step=stages[stage];
  return step.contact?{...step.point,a:2.7,style:step.style,pace:0}:null;
}
