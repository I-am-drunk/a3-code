export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-w-0 flex-1 items-center justify-center px-3 py-[28px]">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-14 font-medium text-text-primary">{title}</span>
        <span className="max-w-[320px] text-13 text-text-secondary">This surface is outside the Automations scope of this replica.</span>
      </div>
    </div>
  );
}
