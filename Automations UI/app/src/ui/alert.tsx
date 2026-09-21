import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { t } from "@/i18n/t";

/**
 * Inline/centered error alert: `role=alert`, Retry with `aria-describedby` → message
 * (AutomationViewPage-CI_ytw7M.js:940-957 and siblings).
 */
export function ErrorAlert({
  message, onRetry, bordered = true, className, retryLabel,
}: { message: ReactNode; onRetry?: () => void; bordered?: boolean; className?: string; retryLabel?: string }) {
  const id = useId();
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-center gap-3",
        bordered ? "rounded-lg border border-border-secondary px-4 py-3" : "py-12",
        className,
      )}
    >
      <span id={id} className="text-13 leading-[18px] text-text-secondary">{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" aria-describedby={id} onClick={onRetry}>{retryLabel ?? t("retry")}</Button>
      )}
    </div>
  );
}
