export function makeAudio(){
  let ctx,master,engine,siren,wind,engineGain,sirenGain,windGain,engineBass,bassGain,tireGain;
  function start(volume){
    try{
      if(!ctx){
        ctx=new AudioContext();
        master=ctx.createGain();master.connect(ctx.destination);
        function tone(type){
          const source=ctx.createOscillator(),amp=ctx.createGain();
          source.type=type;amp.gain.value=0;source.connect(amp).connect(master);source.start();
          return [source,amp];
        }
        [engine,engineGain]=tone('triangle');
        [engineBass,bassGain]=tone('sawtooth');
        [siren,sirenGain]=tone('sine');
        const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),samples=noise.getChannelData(0);
        let level=0;
        for(let i=0;i<samples.length;i++){level=level*.98+(Math.random()-.5)*.055;samples[i]=level;}
        wind=ctx.createBufferSource();wind.buffer=noise;wind.loop=true;
        windGain=ctx.createGain();windGain.gain.value=0;wind.connect(windGain).connect(master);wind.start();
        const hiss=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
        hiss.buffer=noise;hiss.loop=true;filter.type='highpass';filter.frequency.value=1050;
        tireGain=ctx.createGain();tireGain.gain.value=0;
        hiss.connect(filter).connect(tireGain).connect(master);hiss.start();
      }
      master.gain.value=volume;ctx.resume().catch(()=>{});
    }catch{ctx=null;}
  }
  return {start,level(volume){if(ctx)master.gain.value=volume;},
    tick(active,speed,wanted,night,time,slip,driving){
      if(!ctx)return;
      const t=ctx.currentTime;
      engine.frequency.setTargetAtTime(31+Math.abs(speed)*4.4,t,.1);
      engineGain.gain.setTargetAtTime(active&&driving?.034+Math.abs(speed)*.001:0,t,.13);
      engineBass.frequency.setTargetAtTime(22+Math.abs(speed)*2.18,t,.12);
      bassGain.gain.setTargetAtTime(active&&driving?.016+Math.abs(speed)*.0009:0,t,.14);
      tireGain.gain.setTargetAtTime(active&&driving?Math.min(.36,slip*.017):0,t,.09);
      siren.frequency.setTargetAtTime(580+235*Math.sin(time*5.7),t,.04);
      sirenGain.gain.setTargetAtTime(active?wanted*.018:0,t,.15);
      windGain.gain.setTargetAtTime(active?.20+night*.1:0,t,.2);
    },signal(){
      if(!ctx)return;
      const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.setValueAtTime(510,t);o.frequency.setValueAtTime(765,t+.095);
      g.gain.setValueAtTime(.055,t);g.gain.exponentialRampToValueAtTime(.001,t+.23);
      o.connect(g).connect(master);o.start(t);o.stop(t+.24);
    },hit(){
      if(!ctx)return;
      const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
      o.type='triangle';o.frequency.setValueAtTime(128,t);o.frequency.exponentialRampToValueAtTime(38,t+.19);
      g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);
      o.connect(g).connect(master);o.start(t);o.stop(t+.23);
    }};
}
