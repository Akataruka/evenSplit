export type ExpenseLike = {
  amount: number;
  paidByParticipantId: string;
  splits: Array<{ participantId: string; shareAmount: number }>;
};

export type TripBalanceSummary = {
  totalExpense: number;
  byParticipant: Record<
    string,
    {
      paid: number;
      share: number;
      net: number;
    }
  >;
};

export type SuggestedSettlement = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export function computeBalances(
  participantIds: string[],
  expenses: ExpenseLike[],
): TripBalanceSummary {
  const summary: TripBalanceSummary = {
    totalExpense: 0,
    byParticipant: Object.fromEntries(
      participantIds.map((id) => [id, { paid: 0, share: 0, net: 0 }]),
    ),
  };

  for (const expense of expenses) {
    summary.totalExpense += expense.amount;

    const payer = summary.byParticipant[expense.paidByParticipantId];
    if (payer) payer.paid += expense.amount;

    for (const split of expense.splits) {
      const receiver = summary.byParticipant[split.participantId];
      if (receiver) receiver.share += split.shareAmount;
    }
  }

  for (const participantId of participantIds) {
    const item = summary.byParticipant[participantId];
    item.paid = Number(item.paid.toFixed(2));
    item.share = Number(item.share.toFixed(2));
    item.net = Number((item.paid - item.share).toFixed(2));
  }

  summary.totalExpense = Number(summary.totalExpense.toFixed(2));
  return summary;
}

export function getMinimalSettlements(
  balances: Record<string, { net: number }>,
  preferredReceiverId?: string,
): SuggestedSettlement[] {
  const creditors = Object.entries(balances)
    .map(([participantId, item]) => ({ participantId, netCents: toCents(item.net) }))
    .filter((item) => item.netCents > 0)
    .sort((a, b) => {
      if (preferredReceiverId) {
        if (a.participantId === preferredReceiverId) return -1;
        if (b.participantId === preferredReceiverId) return 1;
      }
      return b.netCents - a.netCents;
    });

  const debtors = Object.entries(balances)
    .map(([participantId, item]) => ({ participantId, netCents: toCents(item.net) }))
    .filter((item) => item.netCents < 0)
    .map((item) => ({ ...item, netCents: Math.abs(item.netCents) }))
    .sort((a, b) => b.netCents - a.netCents);

  const settlements: SuggestedSettlement[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const payCents = Math.min(debtor.netCents, creditor.netCents);

    if (payCents > 0) {
      settlements.push({
        fromParticipantId: debtor.participantId,
        toParticipantId: creditor.participantId,
        amount: fromCents(payCents),
      });

      debtor.netCents -= payCents;
      creditor.netCents -= payCents;
    }

    if (debtor.netCents === 0) i += 1;
    if (creditor.netCents === 0) j += 1;
  }

  return settlements;
}
