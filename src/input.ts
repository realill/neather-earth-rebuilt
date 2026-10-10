/** Spectrum keyboard matrix, with browser key codes as the physical input. */
export const actions=['up','down','left','right','fire','pause','abort','save'] as const;
export type Action=typeof actions[number];
const addresses:Record<Action,number>={pause:0xd3cc,abort:0xd3cf,save:0xd3d2,fire:0xd3d5,up:0xd3d8,down:0xd3db,left:0xd3de,right:0xd3e1};
const bits:Record<Action,number>={pause:128,abort:64,save:32,fire:16,up:8,down:4,left:2,right:1};
const rows=[['ShiftLeft','KeyZ','KeyX','KeyC','KeyV'],['KeyA','KeyS','KeyD','KeyF','KeyG'],['KeyQ','KeyW','KeyE','KeyR','KeyT'],['Digit1','Digit2','Digit3','Digit4','Digit5'],['Digit0','Digit9','Digit8','Digit7','Digit6'],['KeyP','KeyO','KeyI','KeyU','KeyY'],['Enter','KeyL','KeyK','KeyJ','KeyH'],['Space','ShiftRight','KeyM','KeyN','KeyB']];
export function spectrumKey(code:string){
  for(let row=0;row<8;row++){
    const column=rows[row].indexOf(code);if(column<0)continue;
    const ascii=code==='Space'?32:code==='Enter'?13:code==='ShiftLeft'?227:code==='ShiftRight'?14:code.at(-1)!.charCodeAt(0);
    return {row:255^(1<<row),mask:1<<column,ascii,label:code==='Space'?'SPACE':code==='Enter'?'ENTER':code==='ShiftLeft'?'CAPS SH':code==='ShiftRight'?'SYM SH':String.fromCharCode(ascii)};
  }
}
export class Input {
  constructor(public m:Uint8Array){}
  define(action:Action,code:string,assigned:Action[]){
    const key=spectrumKey(code);if(!key)return false;
    if(assigned.some(a=>this.m[addresses[a]]===key.row&&this.m[addresses[a]+1]===key.mask))return false;
    this.m.set([key.row,key.mask,key.ascii],addresses[action]);return true;
  }
  key(code:string){
    const key=spectrumKey(code);let result=0;
    if(key)for(const action of actions){const p=addresses[action];if(this.m[p]===key.row&&this.m[p+1]===key.mask)result|=bits[action];}
    // Arrow keys and an otherwise unbound Space are browser conveniences.
    if(!result)result=({ArrowRight:1,ArrowLeft:2,ArrowDown:4,ArrowUp:8,Space:16} as Record<string,number>)[code]??0;
    // Interface 2 maps its joystick onto Spectrum keys 6,7,8,9,0.
    if(this.m[0xd3e4]===3)result|=({Digit6:2,Digit7:1,Digit8:4,Digit9:8,Digit0:16} as Record<string,number>)[code]??0;
    return result;
  }
  gamepad(pads:readonly (Gamepad|null)[]){
    if(this.m[0xd3e4]===1)return 0;
    let result=0;
    for(const pad of pads){if(!pad?.connected)continue;
      if(pad.axes[0]>0.4||pad.buttons[15]?.pressed)result|=1;
      if(pad.axes[0]<-0.4||pad.buttons[14]?.pressed)result|=2;
      if(pad.axes[1]>0.4||pad.buttons[13]?.pressed)result|=4;
      if(pad.axes[1]<-0.4||pad.buttons[12]?.pressed)result|=8;
      if(pad.buttons[0]?.pressed)result|=16;
    }
    return result;
  }
}
