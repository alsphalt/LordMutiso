"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  full?: boolean;
  /** Render as a child element (e.g. next/link) with button styling applied. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, full, children, disabled, asChild, ...props }, ref) => {
    const variants = {
      primary: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-glow hover:shadow-violet-500/40 border border-white/10",
      secondary: "bg-white/10 text-white hover:bg-white/15 border border-white/5",
      outline: "bg-transparent border border-white/20 text-white hover:bg-white/5",
      ghost: "bg-transparent text-slate-300 hover:text-white hover:bg-white/5",
      danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-glow shadow-rose-900/20",
      success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-glow shadow-emerald-900/20",
    };

    const sizes = {
      xs: "h-7 px-2 text-xs",
      sm: "h-9 px-3 text-sm",
      md: "h-11 px-6 text-base",
      lg: "h-14 px-8 text-lg font-semibold",
    };

    const classes = cn(
      "inline-flex items-center justify-center rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus-ring whitespace-nowrap",
      variants[variant],
      sizes[size],
      full && "w-full",
      className
    );

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
      const childClassName = typeof child.props?.className === "string" ? child.props.className : "";
      return React.cloneElement(child, {
        className: cn(childClassName, classes),
        ...(loading || disabled ? { "aria-disabled": true as const } : {}),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading && <Spinner size={16} className="mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
