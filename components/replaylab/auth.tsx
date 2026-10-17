import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { Brand, ThemeToggle } from "./common";

export default function Auth({ register = false }: { register?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <aside className="auth-side">
        <Brand />
        <div>
          <h2>Every API change, reviewed before it ships.</h2>
          <p>Record what your API returns today, replay the same requests against your next build, and review each difference like a pull request.</p>
        </div>
        <div className="review-card" aria-hidden>
          <div className="review-head">
            <span className="method method-get">GET</span>
            <code>/users/42</code>
            <span className="badge breaking">Breaking</span>
          </div>
          <div className="review-code" style={{ minHeight: 0 }}>
            <div>
              <i>2</i>
              <b />
              {'  "name": "Alice",'}
            </div>
            <div className="del">
              <i>3</i>
              <b>−</b>
              {'  "id": 42,'}
            </div>
            <div className="add">
              <i>3</i>
              <b>+</b>
              {'  "id": "42",'}
            </div>
            <div>
              <i>4</i>
              <b />
              {'  "plan": "pro"'}
            </div>
          </div>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
            <ThemeToggle />
          </div>
          <h1>{register ? "Create your account" : "Sign in to ReplayLab"}</h1>
          <p>{register ? "Your account starts with a demo project, so you can run a replay right away." : "Welcome back."}</p>
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
                <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} />
              </div>
            )}
            <div className="field">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
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
              {register && <p>At least 10 characters.</p>}
            </div>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              {register ? "Create account" : "Sign in"}
            </Button>
            <p className="auth-note">
              {register ? "Already have an account? " : "New to ReplayLab? "}
              <Link to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link>
            </p>
          </form>
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
