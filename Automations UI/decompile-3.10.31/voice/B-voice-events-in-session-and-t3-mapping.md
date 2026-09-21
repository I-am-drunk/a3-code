# Voice Call — Task B: how a call becomes session events/messages, and the T3 Code mapping

Devin 3.10.31, web bundle captured 2026-09-20 + desktop Sessions bundle. Static analysis only. Evidence labels: **PROVEN** / **PROJECTED** / **DERIVED** / **REMOTE**. Paths: `F/` = `_work/formatted/`, `VF/` = `_work/voice/formatted/`, `D/` = `_work/formatted-desktop/`. Task A (controller/WebRTC/signaling transport) is documented separately; this file only touches signaling where it feeds the transcript.

## What this proves

A voice call leaves **no special message type in the persisted ACP stream**. The server emits an ordinary ACP `tool_call` named `set_voice_mode` whose `_meta` carries `cognition.ai/voiceCallEnabled`, `cognition.ai/userId`, `cognition.ai/voiceSessionId`, and (on end) `cognition.ai/durationSeconds`. The client folds those tool calls into two things: an `activeVoiceCall` reducer (who is on a call, which voice session) and a `voiceCallWindows` reducer (list of `{startMs, endMs|null}` intervals). Everything else is derived by time-window membership: an agent message with `_meta['cognition.ai/voiceChannel'] ∈ {commentary, progress, answer}` whose timestamp falls in a window becomes a `voice_message` transcript event (rendered as a lighter agent bubble with extracted links); while streaming, such messages are hidden entirely; a message marked `cognition.ai/userQuestion: true` always escapes both rules. Spoken user/assistant turns are **transcribed server-side**: the signaling WebSocket pushes `{type:'transcript', turn_id, role, text, started_at, done, event_id}` frames, which the client shows as optimistic `voice_event` items (`user_said` / `assistant_said`, id `live-voice-turn-<turn_id>`) and drops as soon as the persisted message with the announced `event_id` arrives in the session history. The desktop Sessions renderer contains the identical pipeline with unminified names (`isVoiceCallStart`, `getSetVoiceModeMeta`, `getVoiceCallDurationSeconds`). The server-side turn detection, STT/TTS, and the decision of which agent messages get a `voiceChannel` are REMOTE.

## 1. `cognition.ai/*` meta keys relevant to voice (PROVEN)

Zod object literals in `F/en-CsbykFSh.js` (`d()` = `z.string()`, `w()` = `z.boolean()`, `u()` = timestamp-ish scalar, `h()` = `z.object`). Same shapes in `D/sessions.desktop.main.js` using `Z.string()/Z.boolean()`.

| Key | Zod type | Schema object / line | Carried on | Read by |
|---|---|---|---|---|
| `cognition.ai/voiceCallEnabled` | `boolean.nullish()` | anonymous tool-call meta variant, `en:5360`; `D:~352500` | `tool_call` named `set_voice_mode` | `Np` (`isVoiceCallStart`) `en:8602`; `Pp` (`getSetVoiceModeMeta`) `en:8605`; desktop `qye` `D:356521`, `Vye` |
| `cognition.ai/userId` | `string.nullish()` | `en:5361` (also `en:3944` in another meta object) | `set_voice_mode` tool_call | `Pp` → `userId` |
| `cognition.ai/voiceSessionId` | `string.nullish()` | `en:5362`; `D:352516` | `set_voice_mode` tool_call | `Pp` → `voiceSessionId`; desktop `D:356525` |
| `cognition.ai/durationSeconds` | number (read via numeric getter `B`) | getter only, `en:8612` (`Fp`/`getVoiceCallDurationSeconds`) | `set_voice_mode` with `voiceCallEnabled !== true` | `globalState:3835`; `D:801955` |
| `cognition.ai/voiceChannel` | `string.nullish()` | `Ui` content-block meta, `en:3848` | agent message content blocks | `globalState:4251`; `D:802370` |
| `cognition.ai/userQuestion` | `boolean.nullish()` | `Ui`, `en:3849` | agent message content blocks | escape hatch in `globalState:4256, 4480, 4521` |
| `cognition.ai/voiceCallBootstrap` | `boolean.nullish()` | `Do` user-input/session-update meta, `en:5126`; `D:352293`; lenient `.catch(undefined)` at `en:9111`, `D:356255` | user-input messages (`kind: 'userInput'`) | `en:10779-10780`: `if meta.voiceCallBootstrap && sender.id → item.voiceBootstrapSenderId = sender.id`; `D:360833` |
| `cognition.ai/sender` | `yi.nullish()` (object with `id`, `name`) | `Ui` `en:3862`, `Do` `en:5128` | any | used with `voiceCallBootstrap` to pick who started the voice-bootstrapped session |
| `cognition.ai/timestamp` | `u().optional()` / `string.nullish()` | `Do` `en:5125`, `Ui` `en:3857` | any | `voiceCallWindows` reducer reads message timestamp via `_(t.content)` `VF/app-initial-YZlMuTy0.js:1642` |

Observed voiceChannel values: only `commentary`, `progress`, `answer` are acted on (`globalState:4254`). Other values fall through to a normal `agent_message` (DERIVED). The vocabulary the server may emit beyond these three is REMOTE.

Session creation with voice: `F/requests-DN_jEueP.js:168` takes `voiceCallBootstrap` and sets `additional_args.voice_call_bootstrap: true` (`:193`) in `POST sessions` (`:207`). Callers: `VF/useInputBox-U7TgCrww.js:1166,1290`, `F/InputBox-CFvzp3_F.js:19062`. The server then echoes it back as `cognition.ai/voiceCallBootstrap` on the first user message (PROJECTED from the read at `en:10780`).

## 2. Message model and derived events

### 2.1 The ACP message the client receives (PROVEN shape, PROJECTED field-completeness)

The transcript mapper `Hd(e, t, n, r, i, a)` at `F/globalState-DdM6ySxY.js:2494` destructures `e.content` as `{ status, rawInput, _meta, kind, title, toolCallId }` and uses `V(e) ?? o.kind ?? 'tool_call'` as the discriminator. The `set_voice_mode` case (`:3833-3840`) reads only `_meta`:

```ts
// PROVEN fields only (globalState:2494-2500, 3833-3840; en:8602-8614; VF/app-initial-YZlMuTy0.js:1641-1656)
type SetVoiceModeToolCall = {
  kind: 'tool_call';
  content: {
    kind?: string;              // 'set_voice_mode' resolved via V(e) — tool name
    toolCallId: string;
    status: string;             // generic tool_call status; not read for voice
    rawInput?: unknown;         // not read for voice
    title?: string;
    _meta: {
      'cognition.ai/voiceCallEnabled'?: boolean | null;   // true → started, else ended
      'cognition.ai/userId'?: string | null;              // caller
      'cognition.ai/voiceSessionId'?: string | null;      // voice session (equals signaling `voice_session_id`, PROJECTED)
      'cognition.ai/durationSeconds'?: number | null;     // only on end
      'cognition.ai/timestamp'?: string;                  // used to build windows
      'cognition.ai/eventId'?: string | null;
    };
  };
};

type VoiceAgentMessageMeta = {
  'cognition.ai/voiceChannel'?: 'commentary' | 'progress' | 'answer' | (string & {}) | null; // en:3848
  'cognition.ai/userQuestion'?: boolean | null;                                              // en:3849
  'cognition.ai/streaming'?: boolean | null;
  'cognition.ai/eventId'?: string | null;
  'cognition.ai/timestamp'?: string | null;
};
```

`_meta` rides on **every content block** (the `Ui` schema at `en:3835` is a per-content-block meta object); `of()` reads `H(e)?._meta` — the first content block's meta (`globalState:4240`). Who emits `set_voice_mode` — the Devin backend when the WebRTC call connects/disconnects — is REMOTE; the client never sends it (no `set_voice_mode` string anywhere outside readers).

### 2.2 Reducers over the message stream (PROVEN)

```ts
// VF/app-initial-CXtT6h8w.js:104-113  (exported as `activeVoiceCall`, VF/app-initial-YZlMuTy0.js:1937)
type ActiveVoiceCall = { userId: string | undefined; voiceSessionId: string | undefined } | null;
// apply: if tool_call && name==='set_voice_mode':
//   enabled → (state?.voiceSessionId === meta.voiceSessionId ? state : {userId, voiceSessionId})
//   disabled → null

// VF/app-initial-YZlMuTy0.js:1637-1657  (exported as `voiceCallWindows`, :1961)
type VoiceCallWindow = { startMs: number; endMs: number | null };
// apply: ts = message timestamp; enabled → push {startMs: ts, endMs: null} unless last window still open
//        disabled → close last window {…last, endMs: ts} (no-op if none open)
// predicate ui()/Af(): windows.some(w => ms >= w.startMs && (w.endMs === null || ms < w.endMs))
//   VF/app-initial-YZlMuTy0.js:1631-1633 ; F/globalState:4800-4804 ; D:Z4s
```

### 2.3 Derived transcript events (PROVEN)

```ts
type VoiceCallStartedEvent = { id: string; timestamp: string; event_type: 'voice_call_started' };          // globalState:3834
type VoiceCallEndedEvent   = { id: string; timestamp: string; event_type: 'voice_call_ended'; duration_seconds?: number }; // :3836-3840
type VoiceMessageEvent = {                                                                                  // :4258-4265
  id: string; timestamp: string;
  event_type: 'voice_message';
  message: string;                        // markdown-stripped/resolved text (same pipeline as agent_message)
  voice_channel: 'commentary' | 'progress' | 'answer';
  attachments?: Attachment[];
  streaming?: true;
};
```

Rules in `of(e, t, n, r, i, a, o, s, c, l /*voiceCallWindows*/, u)` (`globalState:4235-4265`) and the `agent_message` case of `vf` (`:4467, 4472-4525`):

| # | Condition | Result | Cite |
|---|---|---|---|
| R1 | `voiceChannel ∈ {commentary,progress,answer}` AND `Af(windows, Date.parse(ts))` AND `userQuestion !== true` | `event_type: 'voice_message'` (not `agent_message`) | `:4253-4265` |
| R2 | streaming (`n`, the "this is the last message and it is still streaming" flag from `qa(c, isLast, n)` at `:4974`) AND windows defined AND `Af(windows, ts)` AND `userQuestion !== true` | event **suppressed** (mapper returns `undefined`, item skipped at `:5042`) | `:4517-4523` |
| R3 | `devin_message` streaming with all-whitespace text AND `userQuestion !== true` | suppressed (generic, not voice-only) | `:4476-4480` |
| R4 | `voiceChannel` present but timestamp outside every window | ordinary `agent_message` | DERIVED from R1 fallthrough `:4266` |
| R5 | `userQuestion === true` | always rendered as a normal agent message (question bubble) even mid-call | R1/R2 guards |

Net effect (DERIVED): during a live call the transcript hides in-flight agent chatter (the user hears it), then when the message lands it appears as a compact `voice_message`; explicit questions to the user always surface as normal messages so they can be answered by typing. Memoization keys include `voiceCallWindows` (`:5007, 5071`), so window changes re-run the mapping.

## 3. Renderer behaviour (PROVEN)

Component registry `F/app-initial-D26asGkT.js:1816-1818` maps `voice_message → ja`, `voice_call_started → $i`, `voice_call_ended → ea`.

| Event | Component | Rendering | Cite |
|---|---|---|---|
| `voice_call_started` | `$i` | system row `O` with a phone icon (`De`, size 16), trailing formatted timestamp, text `t('transcript.callStarted')` | `D26asGkT:1208-1215` |
| `voice_call_ended` | `ea` | same row shape, icon `Ee`; text `transcript.callEndedWithDuration` `{duration: fmt(duration_seconds*1000)}` when `duration_seconds >= 1`, else `transcript.callEnded` | `:1216-1227` |
| `voice_message` | `ja` | `Da` markdown body (identical body component as agent message, `thinking: undefined`, `useStreamedEvent` handler); below it, when not streaming, links extracted from the text (`sn(e.message)`) that are not already attachments, rendered as `[label](href)` markdown in `data-testid="voice-message-links"`, plus the attachments strip `Xn`. Indented `ml-6` when not in compact mode | `:1610-1645` |

Other consumers: `F/SessionPanes-DVXGQT13.js:16732, 16760-16761` include the three types in the "renderable/visible event" case list; `F/useSessionActivityState-BT7mjKgZ.js:2015, 2052-2053` search-text extractors (`V` = message text); `:8698` `_x()` classifies `voice_message` like `agent_message` (sender `devin`); `F/app-initial-D_yQB7sx.js:348` visibility predicate `ln(e)` for `voice_message`. Legacy-event sender resolution treats `voice_event` as `devin` when `assistant_said` (`globalState:4694`, `VF/translateTranscript-BJlxHFX1.js:2039-2047`).

i18n keys `transcript.callStarted`, `transcript.callEnded`, `transcript.callEndedWithDuration` live in the minified `en` translation blob (`en:20564` region); exact copy is in the Task A / copy catalog, not re-extracted here.

## 4. User speech path: server-side transcription, optimistic client turns (PROVEN)

There is no client-side STT. `F/VoiceCallController-D1fhynnv.js:496-503` configures a VAD (`positiveSpeechThreshold`, `negativeSpeechThreshold`, `minSpeechMs`, `onSpeechStart/onSpeechEnd`) used only for the local "talking" indicator. Transcripts arrive on the signaling WebSocket (`:642-662`):

```ts
// Signaling frames the client handles (VoiceCallController:646-662). Transport details → Task A.
type SignalingIn =
  | { type: 'answer'; sdp: string; live_session_id?: string; voice_session_id?: string }
  | { type: 'resumed' }
  | { type: 'transcript'; turn_id: string; role: 'user' | 'assistant'; text: string;
      started_at?: string; done?: boolean; event_id?: string }
  | { type: 'error' };
```

Flow (`transcript` frame → store → transcript):

1. `store.upsertTurn(turn_id, role, text, startedAtMs)`; if `done`, `store.finishTurn(turn_id, event_id)` (`VoiceCallController:656-657`).
2. Zustand voice store `VF/app-initial-ClK3cO3o.js:2694-2752`: `turns[]` and `transcriptTurns[]` (`{turnId, role, text, startedAtMs, eventId?}`); `upsertTurn` (`:2717`) merges by `turnId`; `finishTurn` (`:2731`) tags the turn with the server `eventId`, or **drops** it from `turns` when the server finishes without an `event_id` (turn not persisted). `removeTurn` (`:2737`). Prefix constant `live-voice-turn-` (`:2692`).
3. `F/useSessionActivityState-BT7mjKgZ.js:8740-8752` `xx()` converts each live turn into an optimistic legacy event:

```ts
type LiveVoiceEvent = {
  type: 'voice_event';
  kind: 'user_said' | 'assistant_said';    // from role
  text: string;
  event_id: `live-voice-turn-${string}`;
  user_id: string; username: string;       // viewer identity (Yr())
  timestamp: string; timestampMs: number;  // startedAtMs
  optimistic: true;
  streaming: boolean;                      // eventId === undefined
};
```

4. `Sx()` (`:8754-8771`): any live turn whose `eventId ?? turnId` is already present in the session's `eventById` map is removed from the store (dedupe against the persisted message); remaining non-empty turns are converted and merged into the timeline via `wx → Ua(...)` (`:8778-8786`) and `Ax → yx(delta.items, liveItems)` (`:8795-8797`).
5. Legacy mapping `globalState:7492-7497` `xm()`: `assistant_said → {type:'devin_message', message}`, `user_said → {type:'user_message', message}` — i.e. spoken turns render exactly as typed messages while optimistic.

DERIVED: the backend persists each finished spoken turn as an ordinary `user_message` / agent message in the ACP history and announces its `event_id` in the `done` transcript frame; the client's optimistic bubble is replaced by the real one. Which of those persisted agent messages carry `voiceChannel` (and thus render as `voice_message` per §2.3) is REMOTE. `VoiceCallButton-Dihi99Wb.js:241` reads `transcriptTurns` (the never-pruned copy) for the in-call live caption UI.

## 5. Desktop parity (PROVEN, `D/sessions.desktop.main.js`)

The Sessions window bundles the same pipeline, unminified:

| Concern | Desktop line | Web equivalent |
|---|---|---|
| `set_voice_mode` → `voice_call_started` / `voice_call_ended` via `Yt.isVoiceCallStart(meta)` and `Yt.getVoiceCallDurationSeconds(meta)` | `D:801953-801961` | `globalState:3833-3840` |
| helper exports `getSetVoiceModeMeta` (`qye`, body `D:356521-356527`), `getVoiceCallDurationSeconds` (`zye`, `D:346114`), `isVoiceCallStart` (`Vye`, `D:~346247`) | `D:346066-346247` | `en:8602-8614` |
| zod meta `cognition.ai/voiceCallBootstrap: Z.boolean().nullish()`; `voiceSessionId: Z.string().nullish()`; lenient `.catch(void 0)` | `D:352293, 352516, 356255` | `en:5126, 5362, 9111` |
| `voiceBootstrapSenderId` on user-input items | `D:360833` | `en:10780` |
| `voice_message` derivation with `Z4s(windows, ts)` and `userQuestion` guard | `D:802370-802385` | `globalState:4253-4265` |
| streaming suppression inside windows | `D:802563-802571` | `globalState:4517-4525` |
| memo keys on `voiceCallWindows` | `D:803054, 803117` | `globalState:5007, 5071` |
| component maps for the three event types (two registries) | `D:795139, 795163; 823711, 823748` | `D26asGkT:1816-1818` |
| case lists / search extractors | `D:782090, 782117, 782288` | `SessionPanes:16732…` |

No desktop-only voice event types were found; desktop and web share the event model byte-for-byte.

## 6. T3 Code mapping (PROPOSAL — nothing here is implemented; all T3 citations are read-only anchors)

### 6.1 Where the concepts land

| Devin concept | T3 Code anchor (read-only) | Proposal |
|---|---|---|
| ACP `tool_call set_voice_mode` (call start/end) | `OrchestrationThreadActivity {id, tone, kind, summary, payload, turnId, sequence?, createdAt}` — `packages/contracts/src/orchestration.ts:640`; appended via event `thread.activity-appended` (`:2157`), projected at `apps/server/src/orchestration/projector.ts:1037` | Two new activity `kind`s: `voice-call.started` (`payload: {voiceSessionId, userId}`) and `voice-call.ended` (`payload: {voiceSessionId, durationSeconds}`), tone `info`. No new event type needed — activities already flow to web/desktop/mobile through the projection. |
| `voiceCallWindows` reducer | client-side derivation in `packages/client-runtime` (shared web+mobile) | Derive `{startMs,endMs|null}[]` from the two activity kinds inside the projected thread; do not persist windows. |
| Spoken user turn (`transcript` frame, `role:'user'`, `done`) | `thread.message-sent` payload `{messageId, role:'user', text, attachments?, context?, turnId, streaming, createdAt}` (`:1868, :2102`); `thread.turn.start` command (`:1286`) | A server-side **voice reactor** owns the realtime speech WebSocket. On a finished user turn it issues `thread.turn.start` with the transcript as the user message, tagging `context.records` (`composerContext.ts:261`, `records: unknown[]`) with `{kind:'voice', voiceSessionId, turnId}` so the renderer can badge it. Optimistic/partial user speech stays client-local (exactly Devin's `live-voice-turn-*`) and is dropped when the persisted message with the same `turnId` arrives. |
| Spoken assistant turn / `voiceChannel` agent message | `OrchestrationMessage {role:'assistant', text, streaming, turnId}` (`:553`), streamed by `thread.message.assistant.delta/complete` (`:1467/1477`) | Assistant text comes from the provider subprocess as today. The voice reactor feeds completed assistant text to TTS and marks the message with `context.records += {kind:'voice-channel', channel:'answer'}`. **Do not** invent `commentary/progress` channels for the first cut; Claude Code / Codex do not split speech-vs-text output — YAGNI. |
| `voice_message` suppression while streaming inside a window | `apps/web/src/components/chat/MessagesTimeline.logic.ts` (`entry.kind` message/work/proposed-plan/activity-group, `:320-331`) | Timeline logic: while a window is open, fold streaming assistant messages behind the live activity row (`LIVE_ACTIVITY_ROW_ID`, `:315`) and show the compact voice bubble when `streaming:false`. Reverse state: when the call ends the same messages render normally. |
| `voiceCallBootstrap` on session create | `thread.create` (`:1094`) / `thread.turn.start` `ThreadTurnStartRequestedPayload` (`:1881`) | Optional `voiceCallSessionId` on `thread.create` so a call can open a thread; server emits `voice-call.started` immediately. |
| `userQuestion` escape hatch | `thread.user-input.respond` (`:1345`) — providers already surface questions as user-input requests | Never fold user-input requests behind the voice row; they need a typed answer. |

### 6.2 Provider adapters

Claude Code and Codex run as subprocesses via `apps/server/src/provider/Drivers/*Driver.ts`; neither has a voice channel. Required changes are **zero** in the adapters: the voice reactor converts speech → ordinary user text turns, and reads ordinary assistant text → speech. Per-provider decision table: Claude/Codex/Cursor/OpenCode/Grok/Antigravity — "supported, text-only passthrough". Interruption while the agent is speaking maps to `thread.turn.interrupt` (`:1328`) followed by a new turn with the interrupting utterance.

### 6.3 Surfaces

- **Web / desktop**: shared React timeline; new activity rows + voice bubble badge + optimistic live-turn merge (client-runtime). Desktop adds mic permission via Electron IPC.
- **Mobile**: same client-runtime derivation; native audio capture separate (out of scope here).
- **Contracts**: activity kinds are free-form `TrimmedNonEmptyString`, so the only schema change is the optional `context.records` voice record convention and, later, a typed `VoiceActivityPayload`.
- **Remote/relay/tunnel**: the realtime speech socket must terminate at the T3 server (environment), not the client, so all connection modes see identical projected state — this is exactly the Devin split (server owns STT/TTS, client only displays).

REMOTE in Devin and open for T3: who runs STT/TTS (Devin: backend), turn segmentation, and whether agent commentary gets its own channel.

## 7. Evidence appendix

Web (`_work/formatted/`): `globalState-DdM6ySxY.js` 179,181 (imports `na`/`no`), 2494-2500, 3833-3840, 4235-4266, 4467-4469, 4476-4480, 4517-4525, 4694, 4800-4804, 4974, 5007, 5028-5042, 5071, 7492-7497 · `en-CsbykFSh.js` 3835-3862, 3944, 5122-5130, 5359-5362, 8602-8614, 9111-9112, 10779-10780, 23397, 23438, 23441 · `requests-DN_jEueP.js` 168, 193, 207 · `app-initial-D26asGkT.js` 1129, 1208-1227, 1610-1645, 1816-1818, 1960 · `SessionPanes-DVXGQT13.js` 16732, 16760-16761 · `useSessionActivityState-BT7mjKgZ.js` 2015, 2052-2053, 8698, 8740-8797 · `app-initial-D_yQB7sx.js` 348 · `VoiceCallController-D1fhynnv.js` 496-503, 642-662 · `VoiceCallButton-Dihi99Wb.js` 241 · `InputBox-CFvzp3_F.js` 19062.
Web (`_work/voice/formatted/`): `app-initial-CXtT6h8w.js` 104-113 · `app-initial-YZlMuTy0.js` 1631-1657, 1937, 1961 · `app-initial-ClK3cO3o.js` 2692-2752 · `useInputBox-U7TgCrww.js` 1166, 1290 · `translateTranscript-BJlxHFX1.js` 2039-2060, 2255.
Desktop (`_work/formatted-desktop/sessions.desktop.main.js`): 346066-346247, 352293, 352516, 356255-356256, 356521-356527, 360833, 782090-782288, 795139-795163, 801953-801961, 802370-802385, 802563-802571, 803054, 803117, 823711-823748.
T3 (read-only): `packages/contracts/src/orchestration.ts` 545-563, 640-650, 1094, 1286, 1328, 1345, 1467-1483, 1868-1894, 1999, 2102, 2157 · `packages/contracts/src/composerContext.ts` 261 · `apps/server/src/orchestration/projector.ts` 1037 · `apps/web/src/components/chat/MessagesTimeline.logic.ts` 315-331.
Working notes: `_work/voice/NOTES-B-messages.md`.
