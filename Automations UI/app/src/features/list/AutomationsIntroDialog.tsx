import { Bell, Calendar, FileText, GitPullRequest, Tag } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Dialog, DialogContent } from "@/ui/dialog";
import { DevinMark } from "@/icons/devin";
import { LinearIcon } from "@/icons/brand";

/* Exact port of automations-0Mti9mBk.js `pn` (intro dialog) and visuals J/on/sn/Y/cn/ln/un/dn/fn/mn. */
function Pill({ icon, title, subtitle, className }: { icon: ReactNode; title: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn("shadow-L1 flex items-center gap-2.5 rounded-[10px] border border-border-secondary bg-bg-elevated px-4 py-2.5", className)}>
      <span className="flex shrink-0 items-center gap-1">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-13 font-medium text-text-primary">{title}</span>
        {subtitle && <span className="truncate text-12 text-text-secondary">{subtitle}</span>}
      </span>
    </div>
  );
}
function DownArrow() {
  return (
    <svg width="12" height="42" viewBox="0 0 12 42" fill="none" className="my-1.5 text-text-primary opacity-10" aria-hidden="true">
      <path d="M6 1v31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M6 41L1.5 31.5h9L6 41Z" fill="currentColor" />
    </svg>
  );
}
function FanOut() {
  return (
    <svg width="380" height="56" viewBox="0 0 380 56" fill="none" className="my-1.5 text-text-primary opacity-10" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2"><path d="M190 15c0 5-4 9-9 9H47c-5 0-9 4-9 9v9" /><path d="M190 1v41" strokeLinecap="round" /><path d="M190 15c0 5 4 9 9 9h134c5 0 9 4 9 9v9" /></g>
      <g fill="currentColor"><path d="M38 51l-4.5-9.5h9L38 51Z" /><path d="M190 51l-4.5-9.5h9L190 51Z" /><path d="M342 51l-4.5-9.5h9L342 51Z" /></g>
    </svg>
  );
}
function Reveal({ delayMs = 0, children }: { delayMs?: number; children: ReactNode }) {
  return <div className="flex flex-col items-center fade-in" style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both" }}>{children}</div>;
}
function EventsVisual() {
  return (
    <div className="flex flex-col items-center">
      <Reveal><Pill icon={<><LinearIcon size={16} className="text-text-primary" /><Bell className="size-4" /><Tag size={16} className="text-text-primary" /></>} title={t("introTriggerEvent")} /></Reveal>
      <Reveal delayMs={150}><DownArrow /></Reveal>
      <Reveal delayMs={300}><Pill icon={<DevinMark size={16} className="text-text-primary" />} title={t("introDevin")} /></Reveal>
      <Reveal delayMs={450}><FanOut /></Reveal>
      <Reveal delayMs={600}>
        <div className="flex items-start justify-center gap-3">
          <Pill className="w-[140px]" icon={<GitPullRequest size={16} className="text-text-green" />} title={t("introPullRequest")} />
          <Pill className="w-[140px]" icon={<FileText size={16} className="text-text-primary" />} title={t("introFileReport")} />
          <Pill className="w-[140px]" icon={<Bell className="size-4" />} title={t("introNotification")} />
        </div>
      </Reveal>
    </div>
  );
}
function ScheduleVisual() {
  return (
    <div className="flex flex-col items-center">
      <Reveal><Pill className="w-[280px]" icon={<Calendar size={16} className="text-text-primary" />} title={t("introAutomationPill")} subtitle={t("introSchedulePillSubtitle")} /></Reveal>
      <Reveal delayMs={150}><DownArrow /></Reveal>
      <Reveal delayMs={300}><Pill className="w-[280px]" icon={<DevinMark size={16} className="text-text-primary" />} title={t("introDevinSession")} subtitle={t("introDevinSessionSubtitle")} /></Reveal>
      <Reveal delayMs={450}><DownArrow /></Reveal>
      <Reveal delayMs={600}><Pill className="w-[280px]" icon={<LinearIcon size={16} className="text-text-primary" />} title={t("introLinearConnection")} subtitle={t("introLinearConnectionSubtitle")} /></Reveal>
    </div>
  );
}
function NoteCard({ title, titleClassName, barClassName, className }: { title: string; titleClassName: string; barClassName: string; className: string }) {
  return (
    <div className={cn("shadow-L1 flex w-[150px] flex-col gap-2.5 rounded-[10px] border p-3", className)}>
      <span className={cn("flex items-center gap-1 text-12 font-medium", titleClassName)}><FileText size={12} className="shrink-0" /><span className="truncate">{title}</span></span>
      <span className={cn("h-2 w-full rounded-[3px]", barClassName)} /><span className={cn("h-2 w-full rounded-[3px]", barClassName)} />
      <span className={cn("h-2 w-5/6 rounded-[3px]", barClassName)} /><span className={cn("h-2 w-1/2 rounded-[3px]", barClassName)} />
    </div>
  );
}
function MemoryVisual() {
  return (
    <div className="relative h-[300px] w-[440px] max-w-full">
      <div className="absolute left-1/2 top-1/2 flex size-[124px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28px] border border-border-secondary bg-bg-elevated text-text-primary shadow-L2"><DevinMark size={56} /></div>
      <svg width="440" height="300" viewBox="0 0 440 300" fill="none" className="absolute inset-0 text-text-primary opacity-10" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M165 32A130 130 0 0 1 347 123" pathLength={1} className="motion-safe:[animation:automations-intro-draw_0.8s_ease-out_forwards] motion-safe:[stroke-dasharray:1] motion-safe:[stroke-dashoffset:1]" />
          <path d="M275 268A130 130 0 0 1 93 177" pathLength={1} className="motion-safe:[animation:automations-intro-draw_0.8s_ease-out_0.9s_forwards] motion-safe:[stroke-dasharray:1] motion-safe:[stroke-dashoffset:1]" />
        </g>
        <g fill="currentColor"><path d="M349.1 132.8L351.4 122.1L342.6 123.9Z" /><path d="M90.9 167.2L88.6 177.9L97.4 176.1Z" /></g>
      </svg>
      <NoteCard title={t("introImproveMemory")} className="absolute bottom-1/2 left-0 border-[#D8CE6A] bg-[#EDE795]" titleClassName="text-[#A8A050]" barClassName="bg-[#A8A050]" />
      <NoteCard title={t("introNewKnowledge")} className="absolute right-0 top-1/2 border-[#4FA98C] bg-[#6FCDB4]" titleClassName="text-[#3F8F79]" barClassName="bg-[#3F8F79]" />
      <span className="absolute right-[6%] top-[3%] text-13 text-text-secondary">{t("introNewAutomation")}</span>
      <span className="absolute bottom-[3%] left-[6%] text-13 text-text-secondary">{t("introNewAutomation")}</span>
    </div>
  );
}
function CustomizationVisual() {
  return (
    <span className="relative inline-flex h-12 w-[88px] items-center justify-end overflow-hidden rounded-full bg-tint-secondary p-1" aria-hidden="true">
      <span className="absolute inset-0 rounded-full bg-bg-accent-primary fade-in" />
      <span className="shadow-L1 relative size-10 rounded-full bg-bg-elevated" />
    </span>
  );
}

const STEPS = [
  { titleKey: "introEventsTitle", descriptionKey: "introEventsDescription", Visual: EventsVisual },
  { titleKey: "introScheduleTitle", descriptionKey: "introScheduleDescription", Visual: ScheduleVisual },
  { titleKey: "introSelfImprovementTitle", descriptionKey: "introSelfImprovementDescription", Visual: MemoryVisual },
  { titleKey: "introCustomizationTitle", descriptionKey: "introCustomizationDescription", Visual: CustomizationVisual },
];

export function AutomationsIntroDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState(0);
  const Visual = STEPS[step]!.Visual;
  const last = step === STEPS.length - 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[980px] w-[calc(100vw-48px)] gap-0 p-0 overflow-hidden" hideClose={false}>
        <div className="flex min-h-[540px]">
          <div className="flex w-2/5 min-w-[360px] shrink-0 flex-col gap-5 p-5">
            <div className="flex flex-col gap-1.5 p-0">
              <h2 className="text-15 font-semibold leading-[20px] text-text-primary">{t("introTitle")}</h2>
              <p className="text-13 text-text-secondary">{t("introSubtitle")}</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <span className="text-12 text-text-secondary">{t("introKeyFeatures")}</span>
              <ol className="flex flex-col gap-1">
                {STEPS.map((s, i) => (
                  <li key={s.titleKey}>
                    <button type="button" onClick={() => setStep(i)} aria-pressed={i === step} className={cn("flex w-full items-start gap-3 rounded-[10px] p-3 text-left", i === step ? "bg-tint-blue" : "hover:bg-tint-tertiary")}>
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border border-border-secondary bg-bg-elevated text-11 font-medium", i === step ? "text-text-blue" : "text-text-primary")}>{i + 1}</span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-13 font-medium text-text-primary">{t(s.titleKey)}</span>
                        <span className="text-pretty text-12 leading-4 text-text-secondary">{t(s.descriptionKey)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <footer className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("introMaybeLater")}</Button>
              <Button variant="primary" onClick={() => (last ? onOpenChange(false) : setStep((s) => s + 1))}>{t(last ? "done" : "next")}</Button>
            </footer>
          </div>
          <div className="light relative isolate flex min-w-0 flex-1 flex-col items-center overflow-hidden bg-tint-tertiary p-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "radial-gradient(120% 80% at 30% 20%, #f5f1e8 0%, #e9e4d8 60%, #ddd6c6 100%)" }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-60" style={{ mixBlendMode: "overlay", backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,.035) 0 2px, transparent 2px 7px)" }} />
            <div className="flex min-h-0 flex-1 items-center justify-center"><Visual /></div>
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <button key={s.titleKey} type="button" onClick={() => setStep(i)} aria-label={t(s.titleKey)} className={cn("h-1.5 rounded-full", i === step ? "w-4 bg-text-primary" : "w-1.5 bg-text-disabled")} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

