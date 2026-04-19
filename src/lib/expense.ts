import { SplitType } from "@prisma/client";

import { splitPayloadSchema } from "@/lib/validation";

type SplitResult = {
  splitType: SplitType;
  entries: Array<{ participantId: string; shareAmountCents: number; percentage?: number }>;
};

const twoDecimals = (value: number) => Math.round(value * 100) / 100;

export function parseSplitPayload(
  rawPayload: string,
  amount: number,
  participantIds: string[],
): SplitResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawPayload);
  } catch {
    throw new Error("Invalid split payload.");
  }

  const parsed = splitPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Invalid split configuration.");
  }

  const validParticipants = new Set(participantIds);
  const amountCents = Math.round(amount * 100);

  if (parsed.data.splitType === "EVEN") {
    const included = Array.from(new Set(parsed.data.includedParticipantIds)).filter((id) =>
      validParticipants.has(id),
    );

    if (included.length === 0) {
      throw new Error("At least one participant must be included.");
    }

    const base = Math.floor(amountCents / included.length);
    let remainder = amountCents - base * included.length;

    const entries = included
      .sort()
      .map((participantId) => {
        const shareAmountCents = base + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return { participantId, shareAmountCents };
      });

    return { splitType: "EVEN", entries };
  }

  if (parsed.data.splitType === "EXACT") {
    const filtered = parsed.data.entries
      .filter((entry) => entry.amount > 0 && validParticipants.has(entry.participantId))
      .map((entry) => ({
        participantId: entry.participantId,
        shareAmountCents: Math.round(entry.amount * 100),
      }));

    if (filtered.length === 0) {
      throw new Error("Add at least one custom split amount.");
    }

    const total = filtered.reduce((sum, item) => sum + item.shareAmountCents, 0);
    if (total !== amountCents) {
      throw new Error("Exact split total must match expense amount.");
    }

    return { splitType: "EXACT", entries: filtered };
  }

  const filtered = parsed.data.entries
    .filter((entry) => entry.percentage > 0 && validParticipants.has(entry.participantId))
    .sort((a, b) => b.percentage - a.percentage || a.participantId.localeCompare(b.participantId));

  if (filtered.length === 0) {
    throw new Error("Add at least one percentage split entry.");
  }

  const percentageTotal = twoDecimals(
    filtered.reduce((sum, item) => sum + twoDecimals(item.percentage), 0),
  );
  if (Math.abs(percentageTotal - 100) > 0.001) {
    throw new Error("Percentage splits must add up to 100.");
  }

  let used = 0;
  const entries = filtered.map((entry, index) => {
    const percentage = twoDecimals(entry.percentage);
    const shareAmountCents =
      index === filtered.length - 1
        ? amountCents - used
        : Math.round((amountCents * percentage) / 100);

    used += shareAmountCents;

    return {
      participantId: entry.participantId,
      shareAmountCents,
      percentage,
    };
  });

  return { splitType: "PERCENTAGE", entries };
}
