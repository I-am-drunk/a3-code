# NOTES — Voice Task B (events in session + T3 mapping)

Paths: F=`_work/formatted`, VF=`_work/voice/formatted`.

## Tool-call → event mapper (PROVEN)
- `F/globalState-DdM6ySxY.js:2494` `function Hd(e, t, n, r, i, a)`: `o = e.content`, `{status, rawInput} = o`, `l = o._meta ?? {}`, `d = V(e) ?? o.kind ?? 'tool_call'` (d = discriminator/tool name), `p()` = fallback generic tool event via `Vl(t, d, {title,message})`.
- `:3833-3840` `case 'set_voice_mode'`: `if (Nn(l)) return {...t, event_type:'voice_call_started'}`; else `e = jn(l)`; `{...t, event_type:'voice_call_ended', ...(duration_seconds: e)}`.
- Nn = `no`, jn = `na` imported from `./en-CsbykFSh.js` (globalState:179,181; import block ends :219). These read `_meta` (l). Need their bodies in en chunk (minified) — likely `cognition.ai/voiceCallEnabled` and `cognition.ai/durationSeconds`.
- globalState lines 1808/1828 `duration_seconds` are fast_context, NOT voice.

## Other hits to visit
- globalState :4251-4260 (`of(...)` voice_message), :4480, :4517-4525 (suppression via `Af(voiceCallWindows, ts)`), :5007/:5071 (memo/selectors), :8233 userQuestionEvents.
- VF/app-initial-CXtT6h8w.js ~95-115 active voice call reducer; VF/app-initial-YZlMuTy0.js ~1630-1655 voiceCallWindows reducer.

## Meta schemas (PROVEN, F/en-CsbykFSh.js — formatted; d()=string, w()=boolean, u()=? (timestamp), h()=z.object)
- :3835 `Ui` (agent/content-block meta): `cognition.ai/voiceChannel: string.nullish` (:3848), `cognition.ai/userQuestion: boolean.nullish` (:3849), plus eventId/eventType/streaming/sender/model...
- :5122 `Do` (user-input/session-update meta): `cognition.ai/voiceCallBootstrap: boolean.nullish` (:5126), eventType, eventId, timestamp, message, sender, sourceSender, isOptimistic.
- :5359 anonymous tool-call meta variant: `voiceCallEnabled: boolean.nullish`, `userId: string.nullish`, `voiceSessionId: string.nullish` (:5360-5362). Also :3944 userId in another obj.
- Helpers :8602 `Np(meta)` = `meta['cognition.ai/voiceCallEnabled'] === true` (exported `no` → globalState `Nn`, :23441); :8605 `Pp(meta)` → {voiceCallEnabled, userId, voiceSessionId} (exported `hi`, :23397); :8612 `Fp(meta)` = number `cognition.ai/durationSeconds` (exported `na` → `jn`, :23438).
- :9111 lenient parse: `voiceCallBootstrap: Do.shape[...].catch(undefined)`.
- :10779-10780 userInput mapping: `if meta['cognition.ai/voiceCallBootstrap'] && sender.id → C.voiceBootstrapSenderId = sender.id` (kind 'userInput').

## Session create with voice (PROVEN)
- F/requests-DN_jEueP.js:168 param `voiceCallBootstrap`, :193 → `additional_args.voice_call_bootstrap: true` in POST `sessions` (:~207). Called from VF/useInputBox-U7TgCrww.js:1166,1290; InputBox-CFvzp3_F.js:19062.

## voice_message + suppression (PROVEN)
- globalState:4235 `of(e,t,n,r,i,a,o,s,c,l,u)`: h=first content _meta; y=voiceChannel; if y∈{commentary,progress,answer} && Af(l=voiceCallWindows, Date.parse(t.timestamp)) && userQuestion!==true → `{...t, event_type:'voice_message', message, voice_channel:y, attachments?, streaming?}`; else `agent_message`.
- :4517-4523 in `vf` (message→transcript event, :4467) case agent_message: if `n`(=ae= streaming flag, :4974 `qa(c, isLast, n)`) && voiceCallWindows defined && Af(window, ts) && !userQuestion → return undefined (suppressed while streaming).
- :4800 `Af(windows, ms)`: windows.some(w => ms>=w.startMs && (w.endMs===null || ms<w.endMs)).
- :4480 empty devin_message while streaming suppressed unless userQuestion.

## Reducers (PROVEN, VF=_work/voice/formatted)
- VF/app-initial-CXtT6h8w.js:104-113 `activeVoiceCall` reducer (init null): on `tool_call` named `set_voice_mode`, `Se(_meta)`→{voiceCallEnabled,userId,voiceSessionId}; enabled → `{userId, voiceSessionId}` (keeps ref if same voiceSessionId), disabled → null. Exported as `activeVoiceCall` (YZlMuTy0:1937 `ot`).
- VF/app-initial-YZlMuTy0.js:1631-1633 `ui(windows, ms)` same predicate as Af. :1637-1657 `voiceCallWindows` reducer (init []): on set_voice_mode with timestamp n=_(content): enabled → push `{startMs:n,endMs:null}` unless last open; disabled → close last open window `{...last,endMs:n}`. Exported YZlMuTy0:1961.
- Timestamps come from message content (`_`), i.e. `cognition.ai/timestamp` on the tool_call. Windows are derived purely client-side from server-sent set_voice_mode tool_calls (DERIVED). Who emits set_voice_mode: server (REMOTE) — client only reads it.

## NEXT: renderers (MessageHistoryProvider/SessionPanes/useSessionActivityState), user speech path (VoiceCallController/voiceCallChannel), desktop parity, T3 mapping. Then write deliverable.

## Renderers (PROVEN)
- F/app-initial-D26asGkT.js:1816-1818 event_type→component map: voice_message→`ja` (:1610), voice_call_started→`$i` (:1208), voice_call_ended→`ea` (:1216).
- `$i`: system-row `O` with phone icon, trailing timestamp, text `t('transcript.callStarted')`. `ea`: `transcript.callEndedWithDuration` {duration} if duration_seconds>=1 else `transcript.callEnded`.
- `ja` (voice_message): renders `Da` markdown text body (same as agent message, thinking undefined), plus `data-testid="voice-message-links"` extracted links + attachments; `e.streaming` skips link extraction.
- SessionPanes-DVXGQT13.js:16732,16760-16761: voice_message/voice_call_started/voice_call_ended in the big "renderable event" case list. useSessionActivityState:2015,2052-2053 text extractors (`V`) for search; :8698 `_x` treats voice_message like agent_message for sender ('devin').
- app-initial-D_yQB7sx.js:348 `voice_message` → `ln(e)` visibility predicate.

## User speech path (PROVEN): server-side STT, not client
- F/VoiceCallController-D1fhynnv.js:653-658 signaling WS `onmessage`: `type:'transcript'` → `{turn_id, role, text, started_at?, done?, event_id?}` → store.upsertTurn(turn_id, role, text, startedAtMs); if done → finishTurn(turn_id, event_id). Also `answer` (sdp, live_session_id, voice_session_id), `resumed`, `error`. VAD (onSpeechStart/End :500-503) only for local talking indicator; no client STT.
- VF/app-initial-ClK3cO3o.js:2692 prefix `live-voice-turn-`; :2694-2752 zustand store: turns[], transcriptTurns[], upsertTurn (:2717), finishTurn (:2731: eventId set → keep tagged; no eventId → drop), removeTurn.
- F/useSessionActivityState-BT7mjKgZ.js:8740 `xx(turn,userId,username)` → optimistic legacy event `{type:'voice_event', kind: role==='user'?'user_said':'assistant_said', text, event_id:'live-voice-turn-'+turnId, user_id, username, timestamp, timestampMs, optimistic:true, streaming: eventId===undefined}`. :8754 `Sx`: live turns whose eventId (or turnId) already exists in eventById are removed from store (`removeTurn`) — i.e. server-persisted message replaces optimistic. :8778 `wx` → Ua(...) → transcript items; :8795 `Ax` merges via yx(delta.items, liveItems) (:8716).
- globalState:7492 `xm(voice_event)`: assistant_said→{type:'devin_message', message:text}; user_said→{type:'user_message', message:text}. translateTranscript-BJlxHFX1.js:2039-2047 sender resolution recurses through Mt(voice_event).
- DERIVED: server persists spoken turns as ordinary user_message / agent_message (with voiceChannel meta) whose event_id is announced via transcript.done.event_id; client dedupes.

## Desktop parity (PROVEN, _work/formatted-desktop/sessions.desktop.main.js)
- :801953-801961 same set_voice_mode case using original names `Yt.isVoiceCallStart` / `Yt.getVoiceCallDurationSeconds`; exports at :346114 getVoiceCallDurationSeconds, ~:346066 getSetVoiceModeMeta (qye :356521), ~:346247 isVoiceCallStart (Vye). :356525 voiceSessionId meta; :352293 voiceCallBootstrap zod; :360833 voiceBootstrapSenderId; :802370-802385 voice_message derivation w/ Z4s window predicate; :802563-802571 suppression; :795139/795163 & :823711/823748 component maps.

## T3 Code (read-only) anchors
- packages/contracts/src/orchestration.ts:545 OrchestrationMessageRole user|assistant|system|reasoning; :553 OrchestrationMessage {id,role,text,attachments?,context?,turnId,streaming,createdAt,updatedAt}; :640 OrchestrationThreadActivity {id,tone info|tool|approval|error,kind,summary,payload:unknown,turnId,sequence?,createdAt}; events :2102 thread.message-sent (payload :1868), :2157 thread.activity-appended; commands :1467/1477 thread.message.assistant.delta/complete, :1286 thread.turn.start.
- apps/server/src/orchestration/{decider,projector}.ts (projector :1037 activity-appended); apps/server/src/provider/Drivers/{ClaudeDriver,...}.ts; apps/web/src/components/chat/MessagesTimeline.tsx + .logic.ts (entry.kind message|work|proposed-plan|activity-group).
