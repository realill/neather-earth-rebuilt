/** Addresses retained from the original for direct differential tests. */
export const A = {
  origin: 0x6780, buffer: 0x5b00, map: 0xdd00, robots: 0xda00,
  bullets: 0xd7d3, decorations: 0xff01, buildings: 0xfd70,
  playerX: 0xfd0e, playerY: 0xfd0d, altitude: 0xfd10,
  resources: [0xfd22, 0xfd4a], counts: [0xfd3a, 0xfd42],
  costs: 0xcaf0, heights: 0xd7b4, factoryTypes: 0xcaf8,
} as const;
export const read16 = (m: Uint8Array, p: number): number => m[p] | m[(p+1)&65535]<<8;
export function write16(m: Uint8Array, p: number, value: number) {
  m[p] = value; m[(p+1)&65535] = value>>>8;
}
export const signed = (v: number) => (v & 128) ? v-256 : v;
export const mapPtr = (x: number, y: number) => (A.map + x + y*512)&65535;
export function freshMemory(binary: Uint8Array) {
  const m = new Uint8Array(65536); m.set(binary, A.origin); return m;
}

/** Data-only asset segments: no original CPU program is loaded. */
export function memoryFromAssets(data: {format: number; segments: [number, number[]][]}) {
  if(data.format!==1) throw new Error('Unsupported game asset format');
  const m=new Uint8Array(65536);
  for(const [address,bytes] of data.segments){
    if(!Number.isInteger(address)||address<0||address+bytes.length>65536||bytes.some(v=>!Number.isInteger(v)||v<0||v>255))throw new Error('Invalid game asset segment');
    m.set(bytes,address);
  }
  return m;
}
