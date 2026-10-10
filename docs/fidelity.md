# Fidelity evidence and browser boundaries

The browser reconstruction is implemented and playable from the original starting state through victory or defeat. The checks below establish gameplay and rendering fidelity; this is not a claim of cycle-exact Spectrum hardware emulation.

## Evidence currently covered

`npm test` executes the original machine-code routines in a test-only Z80 oracle and compares native TypeScript results. Coverage includes:

- Full 512×16 map initialization, building/decorations records, ownership changes, resource income and caps.
- All 51 paired masked sprite graphics, selected edge-clipping cases, full-map views sampled every eight columns, robot chassis/modules and directions.
- 10,000 RNG outputs including the actual self-modifying selector address.
- Ship movement, altitude, scrolling and radar through 2,000 input frames; terrain/collision samples across the map.
- Weapon types, facing directions, electronics, damage and destruction timing.
- 5,000 enemy decisions; 2,000 complete unit-update cycles; a 3,000-cycle mixed-army simulation; an extended simulation that combines ten original sound interrupts with each game tick and reaches defeat after 4,547 matching cycles on day 15.
- Five nuclear damage scenarios covering map, robots, buildings and RNG state. Seven additional effect traces execute the full original ROM-noise routine with different sound states and interrupt phases, comparing all 61 colors, every output-port edge, every interrupt-frame attribute snapshot, exact routine duration and final RNG state. The native effect also preserves interrupts that occur halfway through a color RNG call.
- Original screen/font/UI-script output and alternating radar pixels/attributes. Full construction screens for all 256 part masks, robot/orders/capture/destroy/combat screens across all nine orders, all three title controller highlights, every key-redefinition prompt, and full victory/defeat screens match original pixels and attributes. Purchase/refund sequences include failed chassis replacement. Distance selection covers zero and 50-mile bounds, cursor history, opposing directions and fire priority. Original-code branch traces verify when menu confirmations, direct control, distance selection and manual weapon fire advance the world or the clock.
- Capture timers at 143/144 cycles, followed by original victory/defeat branching.
- Original keyboard matrix results for all 40 Spectrum keys, three input modes, and redefined controls.
- Save/load round trips, menu/terminal state, and rejection of invalid records without mutating the running game.

`npm run test:browser` exercises the actual browser input and canvas: title options, key redefinition, flight to Kerberus, construction and launch, sound activation, save/load, pause/resume, robot landing, movement orders, direct control, manual cannon fire, abort and title load. It then starts a new game, earns a day of income, builds a nuclear robot, detonates it, pauses/resumes the effect and returns to flight. `npm run test:audio` separately verifies title music and effects produce nonzero audio samples under normal Chrome autoplay restrictions, along with mute, pause/resume and keyboard activation. The offline resampler tests additionally check pitch preservation, rejection of ultrasonic aliasing, DC offset, headroom and loop boundaries. This verifies signal quality numerically, not a subjective listening review.

`tests/fixtures/victory.json` records 49,679 inputs from a normal new game. The player builds 100 robots using earned resources, captures bases and factories, uses nuclear weapons, and wins on day 160 with two friendly bases and no enemy bases. There are no resource grants, teleports, ownership edits, or disabled opponents. Both the Node test and `npm run test:victory` replay this through the complete controller and renderer. The browser test also verifies the ending delay, return to title and a new start.

## Original behavior deliberately retained

- Initial general resources are 20 and cannon cost is 2, as in the binary. The archived manual differs on some values.
- Each side has at most 24 robots; projectile storage has five slots including a manual-combat slot.
- Orders, terrain speeds, target selection and eight-bit arithmetic follow the binary, including its limited navigation and target-search quirks.
- A nuclear blast destroys at most one building per activation.
- A game cycle advances the clock by five minutes. Capturing a building requires 144 cycles of continuous occupation.
- Negative sound states consume RNG values even if browser sound is disabled.

## Delivery checks

Verified on 2026-10-09:

- 48 automated tests pass, including the complete normal-start victory replay.
- Type checking and the Vite production build pass.
- Original binary/graphics and audio extraction reproduce successfully; the archive comparison retains only the four documented self-modifying music-operand differences.
- The production build passes the keyboard gameplay, audio-output, and victory/return-to-title browser checks.
- Gameplay, nuclear-effect and victory screenshots were inspected.

## Timing boundaries

Normal gameplay uses a 50 Hz interrupt schedule and a 5 Hz simulation. Menu branch ordering and key-release waits follow the original. Browser beeps play asynchronously; the original CPU's blocking beep delays, video-bus contention and slowdown during long normal-game routines are not reproduced cycle for cycle. Nuclear noise/color effects have their own instruction-boundary timing translation, verified against the uncontended Z80 reference including interrupt/RNG interleaving.

These are explicit hardware-timing boundaries of the browser reconstruction. The original game rules, map, assets, AI and navigation quirks are retained; improved pathfinding or easier enemy behavior have not been substituted.

## Browser adaptations

Browser saves replace tape I/O. Arrow keys, Space when unbound, Escape, gamepad translation, toolbar buttons and fullscreen are convenience controls. The original eight Spectrum key definitions remain in game memory and can be redefined. Touch controls are not provided; use a keyboard or gamepad.
