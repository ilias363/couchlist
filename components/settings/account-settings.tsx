"use client";

import { useState, type ComponentProps } from "react";
import { useAccessToken, useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  UserProfile,
  UserProfileLoading,
  UserSecurity,
  UserSecurityLoading,
  UserSessions,
  UserSessionsLoading,
  WorkOsWidgets,
} from "@workos-inc/widgets";
import {
  MonitorSmartphone,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { ConfirmButton } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type AccountView = "profile" | "security" | "sessions";

type WorkOSDialogElement = NonNullable<
  NonNullable<ComponentProps<typeof WorkOsWidgets>["elements"]>["dialog"]
> & {
  container?: HTMLElement | null;
};

type DeleteAccountResponse = {
  error?: string;
  reauthUrl?: string;
};

const accountViews = [
  {
    value: "profile" as const,
    label: "Profile",
    description: "Personal details and connected accounts",
    icon: UserRound,
  },
  {
    value: "security" as const,
    label: "Security",
    description: "Password and multi-factor authentication",
    icon: ShieldCheck,
  },
  {
    value: "sessions" as const,
    label: "Sessions",
    description: "Devices currently signed in",
    icon: MonitorSmartphone,
  },
];

type AccountSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  const { accessToken } = useAccessToken();
  const { user, sessionId } = useAuth();
  const [view, setView] = useState<AccountView>("profile");
  const [error, setError] = useState<string | null>(null);
  const [widgetDialogContainer, setWidgetDialogContainer] =
    useState<HTMLDivElement | null>(null);

  const widgetDialogElement = {
    container: widgetDialogContainer,
    maxHeight: "calc(100svh - 3rem)",
    maxWidth: "min(30rem, calc(100svw - 3rem))",
  } satisfies WorkOSDialogElement;

  const handleDeleteAccount = async () => {
    setError(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const result = (await response.json()) as DeleteAccountResponse;

      if (result.reauthUrl) {
        window.location.assign(result.reauthUrl);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "The account could not be deleted.");
      }

      window.location.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const activeView = accountViews.find(item => item.value === view)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setWidgetDialogContainer}
        overlayClassName="z-0"
        className="z-0 max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">Account settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile, security, and active sessions.
        </DialogDescription>

        <div className="grid max-h-[calc(100svh-2rem)] min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-1">
          <aside className="flex flex-col gap-4 border-b bg-muted/40 p-4 md:border-r md:border-b-0 md:p-5">
            <div className="min-w-0 pr-8 md:pr-0">
              <p className="font-semibold">Account</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>

            <nav
              aria-label="Account settings"
              className="grid grid-cols-3 gap-1 md:flex md:flex-col"
            >
              {accountViews.map(item => {
                const Icon = item.icon;

                return (
                  <Button
                    key={item.value}
                    type="button"
                    variant={view === item.value ? "secondary" : "ghost"}
                    className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs md:h-10 md:flex-none md:flex-row md:justify-start md:px-5 md:py-2.5 md:text-sm"
                    onClick={() => setView(item.value)}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </aside>

          <section className="isolate min-w-0 overflow-y-auto">
            <header className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur md:px-7">
              <h3 className="font-semibold">{activeView.label}</h3>
              <p className="text-sm text-muted-foreground">
                {activeView.description}
              </p>
            </header>

            <div className="flex flex-col gap-6 p-5 md:p-7 min-h-96">
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <WorkOsWidgets
                key={accessToken ?? "loading"}
                className="account-settings-widgets"
                elements={{ dialog: widgetDialogElement }}
                style={{ blockSize: "auto", minBlockSize: "0" }}
                theme={{
                  accentColor: "amber",
                  grayColor: "sand",
                  radius: "medium",
                  appearance: "inherit",
                  hasBackground: false,
                  panelBackground: "solid",
                  fontFamily: "var(--font-geist-sans)",
                }}
              >
                {view === "profile" ? (
                  accessToken ? (
                    <UserProfile authToken={accessToken} />
                  ) : (
                    <UserProfileLoading />
                  )
                ) : null}
                {view === "security" ? (
                  accessToken ? (
                    <UserSecurity authToken={accessToken} />
                  ) : (
                    <UserSecurityLoading />
                  )
                ) : null}
                {view === "sessions" ? (
                  accessToken && sessionId ? (
                    <UserSessions
                      authToken={accessToken}
                      currentSessionId={sessionId}
                    />
                  ) : (
                    <UserSessionsLoading />
                  )
                ) : null}
              </WorkOsWidgets>

              {view === "profile" ? (
                <div className="flex flex-col gap-4 rounded-lg border border-destructive/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Delete account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently remove your account and all CouchList data.
                    </p>
                  </div>
                  <ConfirmButton
                    title="Delete your CouchList account?"
                    description="Your profile, movies, TV series, episode history, and sessions will be permanently removed. You may be asked to sign in again first."
                    confirmText="Delete account"
                    confirmPhrase="delete my account"
                    variant="destructive"
                    onConfirm={handleDeleteAccount}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete account
                  </ConfirmButton>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
