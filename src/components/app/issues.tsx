"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client/api";
import { colomboTime, relative } from "@/lib/client/format";
import type { Issue } from "@/lib/client/types";
import { Badge, Dialog, Empty, useToast } from "@/lib/client/ui";
import type { DispatchProps } from "./dispatcher";

const KIND = {
  loading_shortfall: "Loading shortfall",
  delivery_issue: "From the road",
  receipt_issue: "From the store",
  sync_conflict: "Sync conflict",
} as const;

export function IssuesPage({ board, reload }: DispatchProps) {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [active, setActive] = useState<Issue | null>(null);
  const list = board.issues.filter((i) => i.status === tab);
  return (
    <section className="panel">
      <div className="table-toolbar">
        <div className="table-tabs">
          {(["open", "resolved"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "open" ? "Open" : "Resolved"}{" "}
              <span>{board.issues.filter((i) => i.status === t).length}</span>
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <Empty
          icon={<CheckCircle2 size={28} />}
          title={
            tab === "open"
              ? "Nothing needs a decision"
              : "No resolved issues yet"
          }
        />
      ) : (
        <div className="issue-list">
          {list.map((i) => (
            <article
              key={i.id}
              className={`issue-card ${i.blocks_departure && i.status === "open" ? "blocking" : ""}`}
            >
              <AlertTriangle size={18} />
              <div>
                <span className="eyebrow">
                  {KIND[i.kind]} · #{i.id} · {relative(i.created_at)}
                </span>
                <h3>
                  {i.category}
                  {i.order_id ? ` · ${i.order_id}` : ""}
                </h3>
                <p>{i.description}</p>
                <small className="muted">
                  {[
                    i.vehicle_id && `${i.vehicle_id} trip ${i.trip_no}`,
                    i.outlet_name,
                    i.units_affected && `${i.units_affected} units`,
                    i.reported_by_name && `by ${i.reported_by_name}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                {i.resolution && (
                  <p className="resolution">Decision: {i.resolution}</p>
                )}
              </div>
              {i.blocks_departure && i.status === "open" && (
                <Badge kind="at-risk">Holding departure</Badge>
              )}
              {i.status === "open" && (
                <button
                  className="btn secondary small-btn"
                  onClick={() => setActive(i)}
                >
                  Decide
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {active && (
        <ResolveDialog
          issue={active}
          onClose={() => setActive(null)}
          onDone={async () => {
            setActive(null);
            await reload();
          }}
        />
      )}
    </section>
  );
}

interface Proof {
  id: number;
  outcome: string;
  receiver_name: string | null;
  units_delivered: number | null;
  note: string | null;
  failure_reason: string | null;
  photo: string | null;
  signature: string | null;
  recorded_at: string;
  device_id: string | null;
  superseded: boolean;
  recorded_by: string | null;
}

function ResolveDialog({
  issue,
  onClose,
  onDone,
}: {
  issue: Issue;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const proofs = useApi<{ proofs: Proof[] }>(
    issue.order_id && issue.kind !== "loading_shortfall"
      ? `/api/proofs/${issue.order_id}`
      : null,
  );
  const decide = async (action: "proceed" | "remove_order") => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/resolve`, { json: { action, note } });
      toast(
        action === "remove_order"
          ? "Order removed from the trip and moved to the next run"
          : "Decision recorded",
      );
      await onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not resolve", "error");
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={issue.category}
      eyebrow={`ISSUE #${issue.id} · ${KIND[issue.kind].toUpperCase()}`}
      onClose={onClose}
    >
      <p className="modal-intro">{issue.description}</p>
      {proofs.data && proofs.data.proofs.length > 0 && (
        <div className="proof-compare">
          {proofs.data.proofs.map((p) => (
            <div key={p.id} className={p.superseded ? "superseded" : ""}>
              <b>
                {p.outcome} · {p.units_delivered ?? 0} units{" "}
                {p.superseded ? "(later record)" : "(applied)"}
              </b>
              <small>
                {colomboTime(p.recorded_at)} · {p.recorded_by} · {p.device_id}
              </small>
              <p>
                {[
                  p.receiver_name && `Received by ${p.receiver_name}`,
                  p.failure_reason,
                  p.note,
                ]
                  .filter(Boolean)
                  .join(". ")}
              </p>
              {p.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo}
                  alt={`Delivery photo ${p.id}`}
                  className="proof-photo"
                />
              )}
              {!p.photo && (
                <small className="muted">
                  <ImageIcon size={12} /> No photo
                </small>
              )}
            </div>
          ))}
        </div>
      )}
      <label className="field">
        Decision note (kept on the record)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you decide and why?"
        />
      </label>
      <button
        className="btn primary full"
        disabled={busy || note.trim().length < 3}
        onClick={() => decide("proceed")}
      >
        {issue.kind === "loading_shortfall"
          ? "Release vehicle as loaded"
          : "Mark resolved"}
      </button>
      {issue.kind === "loading_shortfall" && (
        <button
          className="btn secondary full"
          disabled={busy || note.trim().length < 3}
          onClick={() => decide("remove_order")}
        >
          Remove order from trip & defer to next run
        </button>
      )}
    </Dialog>
  );
}
