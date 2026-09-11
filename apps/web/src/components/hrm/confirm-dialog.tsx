"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use "destructive" for actions like rejecting, deleting, or revoking. */
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  /** Extra content between the description and the footer - e.g. a required reason field. */
  children?: React.ReactNode;
  /** Disables the confirm button beyond the built-in pending state - e.g. while a required field is still empty. */
  confirmDisabled?: boolean;
  /** Extra classes on the confirm button, merged after the variant's own classes - e.g. a solid instead of tinted destructive fill. */
  confirmClassName?: string;
}

/**
 * The one confirmation dialog every "are you sure?" moment in HRM should use
 * (rejecting leave, deleting a document, revoking an asset, etc.) so the
 * interaction is consistent instead of ad hoc per feature.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  children,
  confirmDisabled = false,
  confirmClassName,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || confirmDisabled}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className={cn(
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" }),
              confirmClassName,
            )}
          >
            {pending ? "Please wait…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
