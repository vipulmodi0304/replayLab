import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  XCircle,
  GitBranch,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import type { Severity, Snapshot } from "@/packages/core/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** The ReplayLab mark: a removed line over an added one. */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeWidth="2.6">
        <path d="M4 7h7" stroke="#ff6b6b" />
        <path d="M11 16h10M16 11v10" stroke="#3fb950" />
      </svg>
    </span>
  );
}
export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link className="brand" to={to} aria-label="ReplayLab home">
      <BrandMark />
      ReplayLab
    </Link>
  );
}
/** True while the dark theme is applied; follows changes made anywhere. */
export function useIsDark() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
/** Cycles light, dark and the device setting. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "system" ? "Theme: match device" : `Theme: ${theme}`;
  return (
    <button type="button" className="theme-toggle" onClick={() => setTheme(next)} aria-label={`${label}. Switch theme`} title={label}>
      <Icon size={17} />
    </button>
  );
}
export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon =
    severity === "pass"
      ? CheckCircle2
      : severity === "info"
        ? Info
        : severity === "warning"
          ? AlertTriangle
          : XCircle;
  return (
    <span className={`badge ${severity}`}>
      <Icon size={12} />
      {severity === "pass"
        ? "Passed"
        : severity[0].toUpperCase() + severity.slice(1)}
    </span>
  );
}
export function Choice({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <GitBranch className="empty-icon" />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}
export function Busy({ text = "Loading workspace" }: { text?: string }) {
  return (
    <div className="busy">
      <LoaderCircle className="animate-spin" size={20} />
      <span>{text}</span>
    </div>
  );
}
export function Method({ method }: { method: string }) {
  return (
    <span className={`method method-${method.toLowerCase()}`}>{method}</span>
  );
}
export function RelativeDate({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <time title={d.toLocaleString()} dateTime={date}>
      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      <span className="muted">
        ,{" "}
        {d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </time>
  );
}
export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
      {action}
    </div>
  );
}
export function JsonViewer({ value }: { value: unknown }) {
  return <pre className="json-viewer">{JSON.stringify(value, null, 2)}</pre>;
}
export function SnapshotMeta({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="snapshot-meta">
      <span>
        <Check size={13} /> {snapshot.status}
      </span>
      <span>{snapshot.latencyMs} ms</span>
      <span>
        {new TextEncoder().encode(JSON.stringify(snapshot.body)).length} bytes
      </span>
      <span>{snapshot.contentType}</span>
    </div>
  );
}
export function ViewAll({ href }: { href: string }) {
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link to={href}>
        View all
        <ChevronRight size={14} />
      </Link>
    </Button>
  );
}
