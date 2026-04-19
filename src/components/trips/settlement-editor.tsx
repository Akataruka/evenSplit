"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus, RefreshCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type Participant = {
  id: string;
  name: string;
};

type Settlement = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
};

type BalanceMap = Record<string, { net: number }>;

type SettlementEditorProps = {
  tripId: string;
  participants: Participant[];
  balances: BalanceMap;
  suggestedSettlements: Settlement[];
  action: (formData: FormData) => Promise<void>;
};

export function SettlementEditor({
  tripId,
  participants,
  balances,
  suggestedSettlements,
  action,
}: SettlementEditorProps) {
  const [rows, setRows] = useState<Settlement[]>(
    suggestedSettlements.length > 0 ? suggestedSettlements : [],
  );

  const customSettlementsPayload = useMemo(() => JSON.stringify(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-zinc-900">Settlement preview (editable)</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows(suggestedSettlements)}
            className="gap-1"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Auto-fill
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600">No transactions yet. Add one manually or auto-fill.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div
                key={`${index}-${row.fromParticipantId}-${row.toParticipantId}`}
                className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_140px_auto]"
              >
                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={row.fromParticipantId}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, fromParticipantId: event.target.value } : item,
                      ),
                    )
                  }
                >
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 px-2"
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              fromParticipantId: item.toParticipantId,
                              toParticipantId: item.fromParticipantId,
                            }
                          : item,
                      ),
                    )
                  }
                  aria-label="Swap payer and receiver"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>

                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={row.toParticipantId}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, toParticipantId: event.target.value } : item,
                      ),
                    )
                  }
                >
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, amount: Number(event.target.value || 0) } : item,
                      ),
                    )
                  }
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Remove settlement row"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                fromParticipantId: participants[0]?.id ?? "",
                toParticipantId: participants[1]?.id ?? participants[0]?.id ?? "",
                amount: 0,
              },
            ])
          }
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add row
        </Button>
      </div>

      <div className="rounded-lg bg-zinc-50 p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Net balances</p>
        <ul className="space-y-1 text-sm">
          {participants.map((participant) => {
            const net = balances[participant.id]?.net ?? 0;
            return (
              <li key={participant.id} className="flex justify-between text-zinc-700">
                <span>{participant.name}</span>
                <span className={net >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <form action={action}>
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="customSettlements" value={customSettlementsPayload} />
        <Button type="submit">Finalize settlements</Button>
      </form>
    </div>
  );
}
