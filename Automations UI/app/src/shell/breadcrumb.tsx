import { Ellipsis } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes, type LiHTMLAttributes, type OlHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Exact port of the breadcrumb primitives in app-initial-Dl6UrsMZ2.js. */
export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="breadcrumb" className={cn(className)} {...props} />;
}

export const BreadcrumbList = forwardRef<HTMLOListElement, OlHTMLAttributes<HTMLOListElement>>(function BreadcrumbList({ className, ...props }, ref) {
  return <ol ref={ref} className={cn("text-text-secondary text-13 flex flex-wrap items-center gap-[2px]", className)} {...props} />;
});

export function BreadcrumbItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

export const breadcrumbLinkClass = cn(
  "text-text-primary hover:text-text-primary-strong hover:bg-tint-secondary rounded-[6px]",
  "focus-ring text-13 h-[28px] font-medium flex items-center justify-center px-2",
);

export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={cn("text-13 text-text-primary hover:bg-tint-secondary flex h-[28px] items-center justify-center rounded-[6px] px-2 font-normal", className)} {...props} />;
}

export function BreadcrumbSeparator({ children, className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li role="presentation" aria-hidden="true" className={cn("text-text-secondary", className)} {...props}>
      {children ?? <SlashIcon />}
    </li>
  );
}

export function BreadcrumbEllipsis({ className, ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <button type="button" aria-label="Show more breadcrumbs" className={cn("text-text-secondary hover:text-text-primary hover:bg-tint-secondary flex size-6 items-center justify-center rounded transition-colors", "focus-ring", className)} {...props}>
      <Ellipsis size={16} />
    </button>
  );
}

function SlashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 4 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={cn("text-text-primary mx-[3px] mt-px h-[13px] w-auto opacity-10", className)}>
      <path d="M3.61255 0.0128174C3.88153 0.0748898 4.04947 0.343447 3.98755 0.612427L0.987549 13.6124C0.925467 13.8814 0.656962 14.0494 0.387939 13.9874C0.119036 13.9253 -0.0490458 13.6568 0.0129395 13.3878L3.01294 0.387817C3.07506 0.118938 3.34364 -0.0490406 3.61255 0.0128174Z" fill="currentColor" />
    </svg>
  );
}
