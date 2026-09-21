import fs from 'node:fs';
const src = fs.readFileSync('DEVIN_AUTOMATIONS_FULL_ANNOTATED_DECOMPILE.txt','utf8').split('\n');
const wanted = ['automations-0Mti9mBk.js','AutomationListItem-DpZGEBDn.js','templates-79NPCJA-.js','TemplateCard-mNWSVrH3.js','ListPagination-CEa4Aq4o.js','AutomationTagFilter-D8SPb3pA.js','AutomationEditorPage-tUXHQ5Au.js','TriggerEditor-D8VGRxC1.js','NotificationsSection-nD9RC7ou.js','RunAsSelect-BVWa2gvo.js','useDevinModeOptions-DUD254GY.js','AutomationViewPage-CI_ytw7M.js','schedule-time-select-bigiPXHr.js','JitteredScheduleTimeSelect-BSFBBNau.js','RRuleEditor-CoIr8z0T.js','network-policy-editor-CvHMbvLE.js','SecurityProfileSelect-B8zdT-I1.js','NumericField-BD2V7ypZ.js','TypePicker-B3dMVFd0.js','SpendingFrozenTooltipContent-CIKIP-sj.js','TagSelector-Y-yUVCoa.js','SessionSelect-Ck6Tlg2o.js','useGenerateAutomationWithDevin-DjIbxaeY.js','ServiceLogos-Fi18aFob.js','mcpServiceIcons-C68gba_q.js','tagColors-DaUCHgQm.js'];
const tw = /(^|\s|!)(flex|grid|inline|block|hidden|items-|justify-|gap-|p[xytblrse]?-|m[xytblrse]?-|-m[xytblr]?-|w-|h-|size-|min-|max-|text-|font-|bg-|border|rounded|shadow|ring|opacity|overflow|truncate|whitespace|leading|tracking|absolute|relative|sticky|fixed|inset|top-|left-|right-|bottom-|z-|cursor|select-|transition|duration|animate|divide|space-|shrink|grow|basis|self-|order-|col-|row-|line-clamp|outline|pointer-events|group|peer|hover:|focus|disabled:|data-\[|aria-|sm:|md:|lg:|dark:|light:|motion-|scroll|tabular|uppercase|capitalize|italic|underline|break-|resize|appearance|placeholder:|first:|last:|odd:|even:|not-|\[&)/;
let cur=null, start=0, out={}, summary=[];
for (let i=0;i<src.length;i++){
  const l=src[i];
  const b=l.match(/^===== BEGIN VERBATIM MODULE: (.+?) =====$/);
  const e=l.match(/^===== END VERBATIM MODULE: (.+?) =====$/);
  if(b){cur=b[1];start=i+1;out[cur]=[];continue;}
  if(e){cur=null;continue;}
  if(cur && wanted.includes(cur)){
    const rel=i-start+1;
    // template literals
    const re=/`([^`]*)`/g; let m;
    while((m=re.exec(l))){ const s=m[1]; if(s.length>2 && s.length<600 && tw.test(s) && !/^[a-z]+:\/\//.test(s)) out[cur].push(rel+': '+s); }
    // also plain quoted class strings
    const re2=/"([^"]{3,400})"/g;
    while((m=re2.exec(l))){ const s=m[1]; if(tw.test(s) && /\s|-/.test(s) && !/[{}();=]/.test(s)) out[cur].push(rel+': '+s); }
  }
}
for (const k of wanted){ const arr=out[k]||[]; const txt=arr.join('\n'); fs.writeFileSync('_work/classes/'+k+'.txt',txt); summary.push(`${String(arr.length).padStart(4)} strings ${String(txt.length).padStart(7)} bytes  ${k}`); }
console.log(summary.join('\n'));
// copy catalog -> JSON
const cat=fs.readFileSync('DEVIN_AUTOMATIONS_COPY_CATALOG.md','utf8').split('\n');
const json={};
for(const l of cat){ const m=l.match(/^\| `([^`]+)` \| (.*) \|$/); if(m){ json[m[1]]=m[2].replace(/\\\|/g,'|'); } }
fs.writeFileSync('_work/en.automations.json', JSON.stringify(json,null,2));
console.log('copy keys:',Object.keys(json).length);
