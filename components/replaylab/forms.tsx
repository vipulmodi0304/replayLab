"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api-client";
import {
  caseSchema,
  environmentSchema,
  projectSchema,
} from "@/packages/core/schemas";
import type { RequestCase, Environment, Project } from "@/packages/core/types";
import { Choice } from "./common";
export type Editor =
  | { type: "project"; value?: Project }
  | { type: "environment"; value?: Environment }
  | { type: "case"; value?: RequestCase };
export function EntityDialog({
  editor,
  projectId,
  onClose,
  onSaved,
}: {
  editor: Editor;
  projectId?: string;
  onClose: () => void;
  onSaved: (id?: string, type?: string) => void;
}) {
  const value = editor.value;
  const env = editor.type === "environment" ? editor.value : undefined;
  const req = editor.type === "case" ? editor.value : undefined;
  const project = editor.type === "project" ? editor.value : undefined;
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: value?.name || "",
      description: project?.description || "",
      baseUrl: env?.baseUrl || "https://api.example.com",
      path: req?.path || "/users/42",
      query: JSON.stringify(req?.query || {}, null, 2),
      headers: JSON.stringify(req?.headers || env?.headers || {}, null, 2),
      body: JSON.stringify(req?.body || null, null, 2),
      timeoutMs: req?.timeoutMs || 10000,
      secret: "",
    },
  });
  const [method, setMethod] = useState(req?.method || "GET"),
    [kind, setKind] = useState(env?.kind || "external"),
    [enabled, setEnabled] = useState(req?.enabled ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    setError("");
    try {
      let payload: unknown;
      let path = "";
      if (editor.type === "project") {
        payload = projectSchema.parse({
          name: values.name,
          description: values.description,
        });
        path = value ? `/projects/${value.id}` : "/projects";
      } else if (editor.type === "environment") {
        payload = environmentSchema.parse({
          name: values.name,
          baseUrl: values.baseUrl,
          headers: JSON.parse(values.headers),
          kind,
          ...(values.secret ? { secret: values.secret } : {}),
        });
        path = value
          ? `/environments/${value.id}`
          : `/projects/${projectId}/environments`;
      } else {
        payload = caseSchema.parse({
          name: values.name,
          method,
          path: values.path,
          query: JSON.parse(values.query),
          headers: JSON.parse(values.headers),
          body: JSON.parse(values.body),
          timeoutMs: Number(values.timeoutMs),
          enabled,
        });
        path = value ? `/cases/${value.id}` : `/projects/${projectId}/cases`;
      }
      const result = await api<{ id: string }>(path, {
        method: value ? "PATCH" : "POST",
        body: payload,
      });
      toast.success(
        `${editor.type === "case" ? "Request" : editor.type[0].toUpperCase() + editor.type.slice(1)} saved`,
      );
      onSaved(result.id, editor.type);
      onClose();
    } catch (e) {
      const err = e as { issues?: { message: string }[]; message: string };
      setError(
        err.issues
          ? err.issues.map((i) => i.message).join(". ")
          : e instanceof SyntaxError
            ? "Enter valid JSON in the editor fields."
            : err.message,
      );
    } finally {
      setBusy(false);
    }
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="entity-dialog">
        <DialogHeader>
          <DialogTitle>
            {value ? "Edit" : "New"}{" "}
            {editor.type === "case" ? "request case" : editor.type}
          </DialogTitle>
          <DialogDescription>
            {editor.type === "case"
              ? "Save a reproducible HTTP request for baseline recording and replay."
              : editor.type === "environment"
                ? "Configure where your requests will run."
                : "Organize requests, environments, and comparison rules."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="entity-form">
          <div className="field">
            <Label htmlFor="entity-name">Name</Label>
            <Input id="entity-name" autoFocus required {...register("name")} />
          </div>
          {editor.type === "project" && (
            <div className="field">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="What does this API do?"
              />
            </div>
          )}
          {editor.type === "environment" && (
            <>
              <div className="field">
                <Label>Target type</Label>
                <Choice
                  label="Target type"
                  value={kind}
                  onChange={(v) => setKind(v as Environment["kind"])}
                  options={[
                    { value: "external", label: "External API" },
                    { value: "demo-v1", label: "Built-in demo · v1" },
                    { value: "demo-v2", label: "Built-in demo · v2" },
                  ]}
                />
              </div>
              <div className="field">
                <Label htmlFor="base-url">Base URL</Label>
                <Input id="base-url" {...register("baseUrl")} required />
              </div>
              <div className="field">
                <Label htmlFor="secret">
                  Authorization header{" "}
                  {env?.secretConfigured ? "· saved value is encrypted" : ""}
                </Label>
                <Input
                  id="secret"
                  type="password"
                  {...register("secret")}
                  autoComplete="off"
                  placeholder={
                    env?.secretConfigured
                      ? "Leave blank to keep the current token"
                      : "Bearer …"
                  }
                />
                <p>
                  Encrypted on the server. Saved values are never displayed.
                </p>
              </div>
            </>
          )}
          {editor.type === "case" && (
            <>
              <div className="field">
                <Label htmlFor="request-path">Request</Label>
                <div className="method-path">
                  <Choice
                    value={method}
                    onChange={setMethod}
                    label="HTTP method"
                    options={["GET", "POST", "PUT", "PATCH", "DELETE"].map(
                      (x) => ({ value: x, label: x }),
                    )}
                  />
                  <Input id="request-path" {...register("path")} required />
                </div>
              </div>
              <div className="field">
                <Label htmlFor="query">Query parameters · JSON</Label>
                <Textarea
                  id="query"
                  className="mono"
                  {...register("query")}
                  rows={2}
                />
              </div>
              <div className="field">
                <Label htmlFor="body">Request body · JSON</Label>
                <Textarea
                  id="body"
                  className="mono"
                  {...register("body")}
                  rows={3}
                />
              </div>
            </>
          )}
          {editor.type !== "project" && (
            <div className="field">
              <Label htmlFor="headers">Headers · JSON</Label>
              <Textarea
                id="headers"
                className="mono"
                {...register("headers")}
                rows={2}
              />
            </div>
          )}
          {editor.type === "case" && (
            <div className="form-row">
              <div className="field">
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={1000}
                  max={30000}
                  {...register("timeoutMs")}
                />
              </div>
              <div className="toggle-field">
                <Switch
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <Label htmlFor="enabled">Include in replays</Label>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}Save{" "}
              {editor.type === "case" ? "request" : editor.type}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  action,
  onClose,
  destructive = true,
}: {
  title: string;
  description: string;
  action: () => Promise<void>;
  onClose: () => void;
  destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-background" : ""}
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await action();
                onClose();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : destructive ? "Delete" : "Approve baseline"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
