import type {Edge,Explosion,ExplosionData} from './explosion';
type AudioData=ExplosionData & {tones:Record<number,Edge[]>;noiseTimes:number[];beeps:Record<number,Edge[]>;beepDurations:Record<number,number>};
/** Playback of original instruction-timed output-port transitions. */
export class AudioSystem {
  enabled=true;
  private nextBeep=0;
  private explosionSource?:AudioBufferSourceNode;
  context?:AudioContext;
  output?:GainNode;
  data?:AudioData;
  music=new Audio(`${import.meta.env.BASE_URL}assets/title.wav?v=filtered-48k`);
  ready:Promise<void>;
  constructor(){this.music.loop=true;this.music.volume=0.25;this.ready=fetch(`${import.meta.env.BASE_URL}assets/audio.json`).then(r=>r.json()).then(d=>{this.data=d;});}
  async unlock(title:boolean){
    if(!this.enabled)return;
    // Create/resume synchronously inside the user gesture, before any awaits.
    this.context??=new AudioContext();
    if(!this.output){
      const filter=this.context.createBiquadFilter();filter.type='highpass';filter.frequency.value=100;
      this.output=this.context.createGain();this.output.gain.value=0.22;
      this.output.connect(filter);filter.connect(this.context.destination);
    }
    const resume=this.context.resume();
    const music=title&&this.music.paused?this.music.play():Promise.resolve();
    await Promise.all([resume,music,this.ready]);
  }
  async toggle(title:boolean){
    this.enabled=!this.enabled;
    if(this.enabled)await this.unlock(title);
    else{this.music.pause();await this.context?.suspend();}
    return this.enabled;
  }
  async playMusic(){if(this.enabled)await this.music.play();}
  stopMusic(){this.music.pause();this.music.currentTime=0;}
  edges(edges:Edge[],duration:number,when?:number){
    if(!this.enabled||!this.context||!this.output||!this.data||!edges.length)return;
    const rate=this.context.sampleRate,count=Math.ceil(duration*rate);
    const buffer=this.context.createBuffer(1,count,rate),out=buffer.getChannelData(0);
    let index=0,level=0;
    for(let i=0;i<count;i++){
      const cycles=i*this.data.clock/rate;
      while(index<edges.length&&edges[index][0]<=cycles)level=edges[index++][1];
      out[i]=level?0.7:-0.7;
    }
    const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.output);source.start(when);return source;
  }
  explosion(effect:Explosion){
    this.stopExplosion();this.explosionSource=this.edges(effect.edges,effect.duration);
  }
  stopExplosion(){this.explosionSource?.stop();this.explosionSource=undefined;}
  async pause(paused:boolean){if(this.enabled&&this.context){if(paused)await this.context.suspend();else await this.context.resume();}}
  frame(state:number,noise:number[]){
    if(!this.data)return;
    const edges=state&128?this.data.noiseTimes.map((time,i)=>[time,noise[i]] as Edge):this.data.tones[state];
    if(edges)this.edges(edges,this.data.frame/this.data.clock);
  }
  beep(pitch:number){
    const edges=this.data?.beeps[pitch];if(!this.enabled||!this.context||!edges?.length)return;
    const duration=this.data!.beepDurations[pitch]/this.data!.clock;
    const when=Math.max(this.context.currentTime,this.nextBeep);this.edges(edges,duration,when);this.nextBeep=when+duration;
  }
}
