# Asset provenance and licensing

Neather Earth Rebuilt reconstructs Nether Earth for the ZX Spectrum in TypeScript.

## References used

| Resource | Use in the reconstruction |
| --- | --- |
| [Annotated disassembly by Santiago Ontañón](https://github.com/santiontanon/netherearth-disassembly) | Main routine, graphics-table and interface reference; [pinned revision 762e33e](https://github.com/santiontanon/netherearth-disassembly/tree/762e33e4bb1a5d2f608c6436d489a8376ef11cd5). |
| [Annotated assembly](https://github.com/santiontanon/netherearth-disassembly/blob/762e33e4bb1a5d2f608c6436d489a8376ef11cd5/netherearth-annotated.asm) and [graphics data](https://github.com/santiontanon/netherearth-disassembly/blob/762e33e4bb1a5d2f608c6436d489a8376ef11cd5/netherearth-annotated-data.asm) | Sources inspected privately to recover behavior and identify data-only segments. |
| [World of Spectrum catalog](https://worldofspectrum.net/item/0003391/), [TAP archive](https://worldofspectrum.net/pub/sinclair/games/n/NetherEarth.tap.zip), [instructions](https://worldofspectrum.net/pub/sinclair/games-info/n/NetherEarth.txt) | Reference game bytes and gameplay instructions. |
| [MDL Z80 assembler/optimizer](https://github.com/santiontanon/mdlz80optimizer) | Assembled the disassembly privately for comparison with the tape and symbol-address extraction. |
| [JSSpeccy 3 ROM directory](https://github.com/gasman/jsspeccy3/tree/main/static/roms) | Source of the 48K ROM used only in private audio extraction and verification. |
| [z80-emulator and z80-base](https://github.com/lkesteloot/trs80) | Development-only CPU oracle; the browser runs native TypeScript. |

The disassembly's names and comments are the annotator's interpretations. We checked behavior against execution of the original routines rather than treating every annotation as authoritative.

The original executable, tape archive, ROM and disassembly are excluded from this repository and its browser package. They were used privately for verification. The original reference binary SHA-256 was `2c38b69f5af9e18c66129d73cc5ca6216e09eceb129d4760d846c013586be819`.

## Data-only runtime

`public/assets/game-data.json` contains 19,612 bytes of graphics, font, map, interface strings, tables and initial data in 63 addressed segments. Extraction selected assembled `db`, `dw` and `ds` directives, excluding Z80 instruction bytes. Addresses are retained to support the native reconstruction; no CPU emulator runs in the browser. The complete recorded campaign reaches victory using these assets.

`title.wav` preserves the original music and tempo. Output-port transitions were integrated at 192 kHz, low-pass filtered at 9 kHz, DC-blocked at 20 Hz, and downsampled to 48 kHz / 16-bit PCM. Peak normalization and short boundary fades avoid clipping and loop clicks.

`audio.json` contains derived sound timing data and the short noise bit pattern needed for the nuclear effect, not a ROM image. The original 48K ROM was used only by private offline verification.

## Rights

The reconstruction source is Apache-2.0; see LICENSE and NOTICE. Santiago Ontañón is credited for the Apache-licensed disassembly annotations used during reconstruction. That license is not treated as relicensing the original game assets. Graphics, music, font, map and interface data retain their original rights and are excluded from our Apache licensing grant.

Development dependencies retain their respective licenses. The original-code differential verification suite passed 48 tests before packaging. The public tests run without any original executable or reference files.

## Build and media tools

The project uses [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [tsx](https://tsx.is/) and [Playwright](https://playwright.dev/). The gameplay montage is rendered from the production game engine and encoded with [FFmpeg](https://ffmpeg.org/); captions use [DejaVu fonts](https://dejavu-fonts.github.io/). Their respective licenses apply to those tools and fonts.

Screenshots and video in `public/media/` show this reconstruction. The 53-second edit opens with the menu and normal robot construction, then staged battles and a nuclear blast. Staged initial positions are disclosed in the footage. Original game visuals and music shown in the media retain the asset rights described above.
