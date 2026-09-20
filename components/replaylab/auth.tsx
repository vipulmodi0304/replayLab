import { useState } from "react";
import { Workflow, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
export default function Auth({ register = false }: { register?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <a className="brand" href="/">
        <span className="brand-mark">
          <Workflow size={21} />
        </span>
        ReplayLab
      </a>
      <section className="auth-card">
        <div className="eyebrow">YOUR API, IN FOCUS</div>
        <h1>{register ? "Create your account" : "Welcome to ReplayLab"}</h1>
        <p>Record known behavior. Ship changes with confidence.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              await api(`/auth/${register ? "register" : "login"}`, {
                method: "POST",
                body: {
                  email: form.get("email"),
                  password: form.get("password"),
                  ...(register ? { name: form.get("name") } : {}),
                },
              });
              window.location.assign("/app");
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {register && (
            <div className="field">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
              />
            </div>
          )}
          <div className="field">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={10}
              maxLength={72}
              required
            />
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            {register ? "Create account" : "Sign in"}
          </Button>
          <p className="auth-note">
            <a href={register ? "/login" : "/register"}>
              {register
                ? "Already have an account? Sign in"
                : "New to ReplayLab? Create an account"}
            </a>
          </p>
        </form>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
      </section>
      <p className="auth-footer">
        Deterministic comparison. Reproducible results.
      </p>
    </main>
  );
}
