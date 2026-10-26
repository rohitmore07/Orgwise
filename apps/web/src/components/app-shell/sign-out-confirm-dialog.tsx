'use client';

import { Loader2, LogOut, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface SignOutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  userName?: string;
}

/** Reusable modal pop-up requesting confirmation before logging out. */
export function SignOutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
}: SignOutConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!loading) onOpenChange(val);
      }}
      size="sm"
    >
      <div className="flex flex-col items-center text-center p-2">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
          <TriangleAlert className="size-6" aria-hidden />
        </div>

        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
          Sign out of orgwise?
        </h3>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">
          {userName
            ? `You are signed in as ${userName}. Signing out will end your session.`
            : 'Are you sure you want to sign out? You will need to log back in to access your workspace.'}
        </p>

        <div className="mt-6 flex w-full items-center justify-end gap-3 border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="size-4" aria-hidden />
                Sign out
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
