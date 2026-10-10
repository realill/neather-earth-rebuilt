/** Offline beeper reconstruction. Integrate pulse widths before downsampling;
 * point sampling loses short pulses and folds their harmonics into audible noise. */
export function renderBeeper(events:readonly (readonly [number,number])[],duration:number,clock:number,rate=48000){
  const oversample=4,internalRate=rate*oversample,step=clock/internalRate;
  const output=new Float32Array(Math.ceil(duration/clock*rate));
  // Three biquads form a sixth-order Butterworth anti-alias filter at 9 kHz.
  const w=2*Math.PI*9000/internalRate,cos=Math.cos(w),sin=Math.sin(w);
  const filters=[0.5176380902050415,0.7071067811865476,1.9318516525781366].map(q=>{
    const a0=1+sin/(2*q);
    return {b0:(1-cos)/(2*a0),b1:(1-cos)/a0,b2:(1-cos)/(2*a0),a1:-2*cos/a0,a2:(1-sin/(2*q))/a0,z1:0,z2:0};
  });
  const dcPole=Math.exp(-2*Math.PI*20/internalRate);
  let event=0,level=0,previous=0,dc=0;
  for(let i=0;i<output.length*oversample;i++){
    const start=i*step,end=(i+1)*step;let cursor=start,area=0;
    while(event<events.length&&events[event][0]<end){
      const [at,next]=events[event++];
      area+=level*(at-cursor);cursor=at;level=next;
    }
    area+=level*(end-cursor);let value=area/step;
    for(const f of filters){const next=f.b0*value+f.z1;f.z1=f.b1*value-f.a1*next+f.z2;f.z2=f.b2*value-f.a2*next;value=next;}
    dc=value-previous+dcPole*dc;previous=value;
    if(i%oversample===oversample-1)output[Math.floor(i/oversample)]=dc;
  }
  return output;
}
