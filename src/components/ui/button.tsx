import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
type ButtonSize = "default" | "sm";

const variants: Record<ButtonVariant, string> = {
  default:
    "border-2 border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow",
  outline:
    "border-2 border-zinc-400 bg-white text-zinc-800 shadow-sm hover:bg-zinc-100 hover:shadow",
  ghost: "border-2 border-transparent text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100",
  destructive: "border-2 border-red-700 bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 py-1 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
