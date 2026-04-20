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
      ? "bg-[#ffd100] text-black hover:bg-[#e8bd00] focus-visible:ring-[#ffd100]"
      : "bg-[#6a14ff] text-white hover:bg-[#5a0fd6] focus-visible:ring-[#6a14ff]";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-testid={testid}
        className="bg-white border border-[#6a14ff]/30 rounded-xl shadow-[0_30px_80px_rgba(0,0,0,0.65)] max-w-md"
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="font-head text-2xl uppercase text-[#ffffff]"
            data-testid={`${testid}-title`}
          >
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription
              className="text-[#cccccc] text-sm leading-relaxed mt-2"
              data-testid={`${testid}-description`}
            >
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel
            data-testid={`${testid}-cancel`}
            className="border border-[#3a3a3a] font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 rounded-md hover:border-[#6a14ff]/60 hover:text-[#ffffff]"
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
