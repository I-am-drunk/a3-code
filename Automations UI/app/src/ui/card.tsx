import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Exact port of card-BnFC4Qyi.js primitives. */
export function CardText({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-text-primary", className)} {...p} />;
}
export function CardCap({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-tint-tertiary text-text-primary text-13", "rounded-t-[10px]", "px-[14px] pb-8 pt-2.5", "mb-[-22px]", className)} {...p} />;
}
export function CardShell({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-bg-elevated relative", "border-border-secondary light:bg-clip-padding border", "overflow-hidden rounded-[10px]", className)} {...p} />;
}
export function CardBody({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-[14px] py-5", className)} {...p} />;
}
export function CardFooter({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-tint-tertiary text-text-primary text-13", "rounded-b-[10px]", "px-[14px] pb-2.5 pt-8", "mt-[-22px]", className)} {...p} />;
}
export function CardDescription({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-text-secondary text-12 px-[14px] py-3", className)} {...p} />;
}
