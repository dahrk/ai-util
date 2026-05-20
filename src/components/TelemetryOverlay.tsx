import { useEffect, useState } from "react";
import { emptyBuffer, subscribe, type TelemetryBuffer, type TelemetrySample } from "../lib/telemetry";
import "./TelemetryOverlay.css";

/**
 * Dev-only overlay toggled with `Cmd+Shift+;` (Ctrl on Windows). Renders the
 * three target latencies for the last sample plus a compact history strip.
 */
export function TelemetryOverlay() {
  const [open, setOpen] = useState(false);
  const [buffer, setBuffer] = useState<TelemetryBuffer>(emptyBuffer);
  const [last, setLast] = useState<TelemetrySample | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ";") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribe((sample, buf) => {
      setLast(sample);
      setBuffer(buf);
    });
    return unsub;
  }, [open]);

  if (!open) return null;

  return (
    <div className="telemetry-overlay" data-testid="telemetry-overlay">
      <div className="telemetry-overlay__row">
        <Stat label="Hotkey → visible" value={last?.hotkeyToVisibleMs ?? null} target={150} />
        <Stat label="First token" value={last?.firstTokenMs ?? null} target={500} />
        <Stat label="Token → done" value={last?.tokenToDoneMs ?? null} />
      </div>
      <div className="telemetry-overlay__history">
        {buffer.samples.map((s) => (
          <span key={s.capturedAt} className="telemetry-overlay__dot" title={`${s.firstTokenMs ?? "?"}ms`} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, target }: { label: string; value: number | null; target?: number }) {
  const display = value === null ? "—" : `${value}ms`;
  const overBudget = target !== undefined && value !== null && value > target;
  return (
    <span className={`telemetry-overlay__stat${overBudget ? " is-over" : ""}`}>
      <span className="telemetry-overlay__label">{label}</span>
      <span className="telemetry-overlay__value">{display}</span>
    </span>
  );
}
