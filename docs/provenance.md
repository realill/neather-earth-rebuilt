# Asset provenance and licensing

Neather Earth Rebuilt reconstructs Nether Earth for the ZX Spectrum in TypeScript.

Original reference archive: https://worldofspectrum.net/pub/sinclair/games/n/NetherEarth.tap.zip

Annotated disassembly by Santiago Ontañón: https://github.com/santiontanon/netherearth-disassembly

Reference revision: `762e33e4bb1a5d2f608c6436d489a8376ef11cd5`.

The original executable, tape archive, ROM and disassembly are excluded from this repository and its browser package. They were used privately for verification. The original reference binary SHA-256 was `2c38b69f5af9e18c66129d73cc5ca6216e09eceb129d4760d846c013586be819`.

## Data-only runtime

`public/assets/game-data.json` contains 19,612 bytes of graphics, font, map, interface strings, tables and initial data in 63 addressed segments. Extraction selected assembled `db`, `dw` and `ds` directives, excluding Z80 instruction bytes. Addresses are retained to support the native reconstruction; no CPU emulator runs in the browser. The complete recorded campaign reaches victory using these assets.

`title.wav` preserves the original music and tempo. Output-port transitions were integrated at 192 kHz, low-pass filtered at 9 kHz, DC-blocked at 20 Hz, and downsampled to 48 kHz / 16-bit PCM. Peak normalization and short boundary fades avoid clipping and loop clicks.

`audio.json` contains derived sound timing data and the short noise bit pattern needed for the nuclear effect, not a ROM image. The original 48K ROM was used only by private offline verification.

## Rights

The reconstruction source is Apache-2.0; see LICENSE and NOTICE. Santiago Ontañón is credited for the Apache-licensed disassembly annotations used during reconstruction. That license is not treated as relicensing the original game assets. Graphics, music, font, map and interface data retain their original rights and are excluded from our Apache licensing grant.

Development dependencies retain their respective licenses. The original-code differential verification suite passed 48 tests before packaging. The public tests run without any original executable or reference files.
