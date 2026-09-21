import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

/**
 * Observed (Appendix E): off = dark/gray track with white thumb left; on = bright blue
 * (bg-accent-primary) track with white thumb right. 32×18 track, 14px thumb.
 */
export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-tint-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-bg-accent-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[14px] translate-x-[1px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-transform data-[state=checked]:translate-x-[15px]" />
    </SwitchPrimitive.Root>
  );
}
