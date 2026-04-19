"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ParticipantOption = {
  id: string;
  name: string;
};

type InitialExpense = {
  id: string;
  title: string;
  amount: number;
  paidByParticipantId: string;
  splitType: "EVEN" | "EXACT" | "PERCENTAGE";
  splits: Array<{ participantId: string; shareAmount: number; percentage?: number | null }>;
};

interface ExpenseFormProps {
  tripId: string;
  participants: ParticipantOption[];
  action: (formData: FormData) => Promise<void>;
  initialExpense?: InitialExpense;
}

export function ExpenseForm({ tripId, participants, action, initialExpense }: ExpenseFormProps) {
  const [title, setTitle] = useState(initialExpense?.title ?? "");
  const [amount, setAmount] = useState(initialExpense?.amount.toString() ?? "");
  const [paidByParticipantId, setPaidByParticipantId] = useState(
    initialExpense?.paidByParticipantId ?? participants[0]?.id ?? "",
  );
  const [splitType, setSplitType] = useState<"EVEN" | "EXACT" | "PERCENTAGE">(
    initialExpense?.splitType ?? "EVEN",
  );

  const [includedIds, setIncludedIds] = useState<string[]>(
    initialExpense?.splitType === "EVEN"
      ? initialExpense.splits.map((split) => split.participantId)
      : participants.map((participant) => participant.id),
  );

  const [exact, setExact] = useState<Record<string, string>>(
    Object.fromEntries(
      participants.map((participant) => {
        const matched = initialExpense?.splits.find((split) => split.participantId === participant.id);
        return [participant.id, matched ? String(matched.shareAmount) : ""];
      }),
    ),
  );

  const [percentage, setPercentage] = useState<Record<string, string>>(
    Object.fromEntries(
      participants.map((participant) => {
        const matched = initialExpense?.splits.find((split) => split.participantId === participant.id);
        return [participant.id, matched?.percentage != null ? String(matched.percentage) : ""];
      }),
    ),
  );

  const numericAmount = Number(amount || 0);

  const exactPlaceholders = useMemo(() => {
    const parsedValues = participants.map((participant) => {
      const raw = exact[participant.id]?.trim() ?? "";
      return { participantId: participant.id, raw, value: Number(raw || 0) };
    });

    const lockedTotal = parsedValues.reduce((sum, item) => (item.raw ? sum + item.value : sum), 0);

    return Object.fromEntries(
      parsedValues.map((item) => {
        if (item.raw) return [item.participantId, ""];

        const emptyCount = parsedValues.filter((entry) => !entry.raw).length;
        if (emptyCount === 0) return [item.participantId, "0.00"];

        const remaining = Math.max(0, numericAmount - lockedTotal);
        const suggested = remaining / emptyCount;
        return [item.participantId, suggested > 0 ? suggested.toFixed(2) : "0.00"];
      }),
    ) as Record<string, string>;
  }, [exact, numericAmount, participants]);

  const splitPayload = useMemo(() => {
    if (splitType === "EVEN") {
      return JSON.stringify({ splitType, includedParticipantIds: includedIds });
    }

    if (splitType === "EXACT") {
      return JSON.stringify({
        splitType,
        entries: participants.map((participant) => ({
          participantId: participant.id,
          amount: Number(exact[participant.id] || exactPlaceholders[participant.id] || 0),
        })),
      });
    }

    return JSON.stringify({
      splitType,
      entries: participants.map((participant) => ({
        participantId: participant.id,
        percentage: Number(percentage[participant.id] || 0),
      })),
    });
  }, [exact, exactPlaceholders, includedIds, participants, percentage, splitType]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="expenseId" value={initialExpense?.id ?? ""} />
      <input type="hidden" name="splitPayload" value={splitPayload} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="Cab from airport"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paidByParticipantId">Paid by</Label>
          <select
            id="paidByParticipantId"
            name="paidByParticipantId"
            value={paidByParticipantId}
            onChange={(event) => setPaidByParticipantId(event.target.value)}
            className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
            required
          >
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Split type</Label>
        <div className="flex flex-wrap gap-2">
          {(["EVEN", "EXACT", "PERCENTAGE"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSplitType(type)}
              className={`rounded-md border px-3 py-1 text-sm ${
                splitType === type
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-300 text-zinc-600"
              }`}
            >
              {type === "PERCENTAGE" ? "Percentage" : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {splitType === "EVEN" ? (
        <div className="space-y-2">
          <Label>Included participants</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {participants.map((participant) => {
              const checked = includedIds.includes(participant.id);
              return (
                <label key={participant.id} className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setIncludedIds((prev) =>
                        checked ? prev.filter((id) => id !== participant.id) : [...prev, participant.id],
                      );
                    }}
                  />
                  <span className="text-sm">{participant.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {splitType === "EXACT" ? (
        <div className="space-y-2">
          <Label>Exact amount split</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {participants.map((participant) => (
              <div key={participant.id} className="space-y-1">
                <Label htmlFor={`exact-${participant.id}`}>{participant.name}</Label>
                <Input
                  id={`exact-${participant.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={exactPlaceholders[participant.id] || "0.00"}
                  value={exact[participant.id] ?? ""}
                  onChange={(event) =>
                    setExact((prev) => ({
                      ...prev,
                      [participant.id]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Empty fields auto-suggest remaining amount divided equally.
          </p>
        </div>
      ) : null}

      {splitType === "PERCENTAGE" ? (
        <div className="space-y-2">
          <Label>Percentage split</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {participants.map((participant) => (
              <div key={participant.id} className="space-y-1">
                <Label htmlFor={`percentage-${participant.id}`}>{participant.name}</Label>
                <Input
                  id={`percentage-${participant.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={percentage[participant.id] ?? ""}
                  onChange={(event) =>
                    setPercentage((prev) => ({
                      ...prev,
                      [participant.id]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Button type="submit">{initialExpense ? "Update expense" : "Add expense"}</Button>
    </form>
  );
}
