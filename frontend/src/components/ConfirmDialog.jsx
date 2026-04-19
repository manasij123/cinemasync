import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

/**
 * Themed confirmation dialog — drop-in replacement for window.confirm.
 * Controlled by `open` / `onOpenChange`. Renders a pastel-purple brand
 * AlertDialog with an optional danger tone for destructive actions.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="End the watch party?"
 *     description="All guests will be kicked and the room deleted."
 *     confirmLabel="End room"
 *     tone="danger"
 *     onConfirm={endRoom}
 *   />
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary", // "primary" | "danger"
  onConfirm,
  testid = "confirm-dialog",
  loading = false,
}) {
  const actionClass =
    tone === "danger"
      ? "bg-[#f72585] text-white hover:bg-[#d81674] focus-visible:ring-[#f72585]"
      : "bg-[#7209b7] text-white hover:bg-[#4a0580] focus-visible:ring-[#7209b7]";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-testid={testid}
        className="bg-white border border-[#7209b7]/30 rounded-xl shadow-[0_30px_80px_rgba(26,11,46,0.4)] max-w-md"
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="font-head text-2xl uppercase text-[#1a0b2e]"
            data-testid={`${testid}-title`}
          >
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription
              className="text-[#6b5b84] text-sm leading-relaxed mt-2"
              data-testid={`${testid}-description`}
            >
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel
            data-testid={`${testid}-cancel`}
            className="border border-[#e7c6ff] font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 rounded-md hover:border-[#7209b7]/60 hover:text-[#1a0b2e]"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              if (loading) return;
              onConfirm?.();
            }}
            data-testid={`${testid}-confirm`}
            className={`${actionClass} font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 rounded-md disabled:opacity-60 transition-colors`}
          >
            {loading ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
