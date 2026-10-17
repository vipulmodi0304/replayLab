import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, LoaderCircle, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useTheme, type Theme } from "@/lib/theme";
import type { ApiToken } from "@/packages/core/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelativeDate, SectionHeading } from "./common";

/** Account settings: who you are, how the app looks, and API tokens for CI. */
export function AccountPage({
  user,
  signOut,
  signOutIcon,
}: {
  user: { name: string; email: string };
  signOut: () => Promise<void>;
  signOutIcon: ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <section className="panel project-settings">
        <SectionHeading title="Profile" meta="Projects are private to your account." />
        <dl>
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Appearance</dt>
          <dd>
            <div className="segmented" role="group" aria-label="Theme">
              {(
                [
                  ["light", "Light", Sun],
                  ["dark", "Dark", Moon],
                  ["system", "Match device", Monitor],
                ] as [Theme, string, typeof Sun][]
              ).map(([value, label, Icon]) => (
                <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>
                  <Icon size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
                  {label}
                </button>
              ))}
            </div>
          </dd>
        </dl>
        <Button variant="outline" onClick={signOut}>
          {signOutIcon}
          Sign out
        </Button>
      </section>
      <TokensPanel />
    </>
  );
}

function TokensPanel() {
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: ["tokens"], queryFn: () => api<{ tokens: ApiToken[] }>("/tokens") });
  const [name, setName] = useState("GitHub Actions");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<ApiToken & { token: string }>("/tokens", { method: "POST", body: { name } });
      setCreated(res.token);
      setCopied(false);
      await qc.invalidateQueries({ queryKey: ["tokens"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(t: ApiToken) {
    try {
      await api(`/tokens/${t.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["tokens"] });
      toast.success(`Revoked ${t.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="panel" id="tokens">
      <SectionHeading
        title="API tokens"
        meta="Let a CI job start replays and read results. A token can do anything you can, except manage tokens."
        action={
          <Link className="subtle-link" to="/docs#ci">
            CI setup guide
          </Link>
        }
      />
      <form className="token-form" onSubmit={create}>
        <Input aria-label="Token name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="GitHub Actions" />
        <Button type="submit" disabled={busy || name.trim().length < 2}>
          {busy ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
          Create token
        </Button>
      </form>
      {created && (
        <div className="new-token" role="status">
          <strong>Copy this token now. It won't be shown again.</strong>
          <div>
            <code>{created}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created);
                  setCopied(true);
                } catch {
                  toast.error("Couldn't copy. Select the token and copy it manually.");
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <span className="muted">Save it as a secret named REPLAYLAB_TOKEN in your repository settings.</span>
        </div>
      )}
      <div className="token-list">
        {tokens.data?.tokens.map((t) => (
          <div className="token-row" key={t.id}>
            <KeyRound size={16} className="muted" />
            <div>
              <strong>{t.name}</strong>
              <span>
                <code>{t.prefix}…</code> created <RelativeDate date={t.createdAt} />
                {t.lastUsedAt ? (
                  <>
                    , last used <RelativeDate date={t.lastUsedAt} />
                  </>
                ) : (
                  ", never used"
                )}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => revoke(t)} aria-label={`Revoke ${t.name}`}>
              <Trash2 />
              Revoke
            </Button>
          </div>
        ))}
        {tokens.data && !tokens.data.tokens.length && (
          <div className="token-row">
            <span className="muted">No tokens yet.</span>
          </div>
        )}
      </div>
    </section>
  );
}
