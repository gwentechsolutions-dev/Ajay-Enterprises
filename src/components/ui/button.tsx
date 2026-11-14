"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary-900 text-white hover:bg-primary-800 focus-visible:ring-primary-700 shadow-sm active:bg-primary-950",
        accent:
          "bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-400 shadow-sm active:bg-accent-700",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 shadow-sm active:bg-red-800",
        outline:
          "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 active:bg-slate-100",
        secondary:
          "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300",
        ghost:
          "hover:bg-slate-100 hover:text-slate-900 text-slate-700 active:bg-slate-200",
        link:
          "text-primary-900 underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function deriveLoadingText(text: string): string {
  const trimmed = text.trim();
  const rules: [RegExp, string][] = [
    [/^save\s*(.*)$/i, "Saving $1..."],
    [/^submit\s*(.*)$/i, "Submitting $1..."],
    [/^update\s*(.*)$/i, "Updating $1..."],
    [/^delete\s*(.*)$/i, "Deleting $1..."],
    [/^create\s*(.*)$/i, "Creating $1..."],
    [/^add\s*(.*)$/i, "Adding $1..."],
    [/^approve\s*(.*)$/i, "Approving $1..."],
    [/^reject\s*(.*)$/i, "Rejecting $1..."],
    [/^post\s*(.*)$/i, "Posting $1..."],
    [/^generate\s*(.*)$/i, "Generating $1..."],
    [/^export\s*(.*)$/i, "Exporting $1..."],
    [/^import\s*(.*)$/i, "Importing $1..."],
    [/^upload\s*(.*)$/i, "Uploading $1..."],
    [/^download\s*(.*)$/i, "Downloading $1..."],
    [/^sign\s*in\s*(.*)$/i, "Signing in $1..."],
    [/^log\s*in\s*(.*)$/i, "Signing in $1..."],
    [/^log\s*out\s*(.*)$/i, "Signing out $1..."],
    [/^record\s*(.*)$/i, "Recording $1..."],
    [/^complete\s*(.*)$/i, "Completing $1..."],
    [/^confirm\s*(.*)$/i, "Confirming $1..."],
    [/^reconcile\s*(.*)$/i, "Reconciling $1..."],
    [/^verify\s*(.*)$/i, "Verifying $1..."],
    [/^dispatch\s*(.*)$/i, "Dispatching $1..."],
    [/^transfer\s*(.*)$/i, "Transferring $1..."],
    [/^settle\s*(.*)$/i, "Settling $1..."],
    [/^apply\s*(.*)$/i, "Applying $1..."],
    [/^process\s*(.*)$/i, "Processing $1..."],
    [/^refresh\s*(.*)$/i, "Refreshing $1..."],
    [/^search\s*(.*)$/i, "Searching $1..."],
    [/^filter\s*(.*)$/i, "Filtering $1..."],
    [/^reset\s*(.*)$/i, "Resetting $1..."],
    [/^cancel\s*(.*)$/i, "Cancelling $1..."],
    [/^close\s*(.*)$/i, "Closing $1..."],
  ];

  for (const [pattern, repl] of rules) {
    if (pattern.test(trimmed)) {
      const res = trimmed
        .replace(pattern, repl)
        .replace(/\s+\.\.\.$/, "...")
        .replace(/\s{2,}/g, " ")
        .trim();
      return res.charAt(0).toUpperCase() + res.slice(1);
    }
  }

  return `${trimmed}...`;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loading = false,
      loadingText,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [internalLoading, setInternalLoading] = React.useState(false);
    const activeLoading = isLoading || loading || internalLoading;

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (activeLoading || disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (onClick) {
        try {
          const result: any = onClick(e);
          if (result && typeof result.then === "function") {
            setInternalLoading(true);
            await result;
          }
        } finally {
          setInternalLoading(false);
        }
      }
    };

    // Determine displayed loading text
    let displayContent = children;
    if (activeLoading) {
      if (loadingText) {
        displayContent = loadingText;
      } else if (typeof children === "string") {
        displayContent = deriveLoadingText(children);
      } else if (
        React.Children.count(children) === 1 &&
        typeof React.Children.toArray(children)[0] === "string"
      ) {
        displayContent = deriveLoadingText(
          String(React.Children.toArray(children)[0])
        );
      }
    }

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref as any}
          onClick={handleClick as any}
          {...(props as any)}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || activeLoading}
        aria-busy={activeLoading ? "true" : undefined}
        aria-disabled={disabled || activeLoading ? "true" : undefined}
        onClick={handleClick}
        {...props}
      >
        {activeLoading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0 text-current" />
        )}
        {displayContent}
      </button>
    );
  }
);
Button.displayName = "Button";

// Export LoadingButton as explicit alias for convenience
const LoadingButton = Button;

export { Button, LoadingButton, buttonVariants };
