import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function PublicBillPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const link = await prisma.publicBillLink.findUnique({
    where: { token },
    include: {
      participant: true,
      trip: {
        include: {
          expenses: {
            include: {
              payer: true,
              splits: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          settlements: {
            include: {
              fromParticipant: true,
              toParticipant: true,
            },
          },
        },
      },
    },
  });

  if (!link || !link.trip.finalizedAt) {
    notFound();
  }

  const owes = link.trip.settlements
    .filter((settlement) => settlement.fromParticipantId === link.participantId)
    .map((settlement) => ({
      person: settlement.toParticipant.name,
      amount: Number(settlement.amount),
    }));

  const receives = link.trip.settlements
    .filter((settlement) => settlement.toParticipantId === link.participantId)
    .map((settlement) => ({
      person: settlement.fromParticipant.name,
      amount: Number(settlement.amount),
    }));

  const totalOwes = owes.reduce((sum, item) => sum + item.amount, 0);
  const totalReceives = receives.reduce((sum, item) => sum + item.amount, 0);
  const expenseBills = link.trip.expenses
    .map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: Number(
        expense.splits.find((split) => split.participantId === link.participantId)?.shareAmount ?? 0,
      ),
    }))
    .filter((item) => item.amount > 0);

  const paidBills = link.trip.expenses
    .filter((expense) => expense.paidByParticipantId === link.participantId)
    .map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: Number(expense.amount),
    }));

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <div className="mb-3 flex justify-end">
        <ThemeToggle />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {link.participant.name}&apos;s bill · {link.trip.name}
          </CardTitle>
          <p className="text-sm text-zinc-600">Read-only settlement summary</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">You owe</p>
              <p className="text-xl font-semibold text-red-800">{formatCurrency(totalOwes)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-700">You receive</p>
              <p className="text-xl font-semibold text-emerald-800">{formatCurrency(totalReceives)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-zinc-900">Expense bills</h3>
            {expenseBills.length === 0 ? (
              <p className="text-sm text-zinc-600">No expense bills.</p>
            ) : (
              <div className="space-y-1">
                {expenseBills.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                    <p className="text-zinc-800">{item.title}</p>
                    <p className="font-semibold text-red-700">-{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-zinc-900">Amount paid</h3>
            {paidBills.length === 0 ? (
              <p className="text-sm text-zinc-600">No direct payments.</p>
            ) : (
              <div className="space-y-1">
                {paidBills.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                    <p className="text-zinc-800">{item.title}</p>
                    <p className="font-semibold text-emerald-700">+{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-zinc-900">Payment instructions</h3>

            {owes.length === 0 && receives.length === 0 ? (
              <p className="text-sm text-zinc-600">Nothing to settle.</p>
            ) : (
              <div className="space-y-2">
                {owes.map((item) => (
                  <div
                    key={`owe-${item.person}-${item.amount}`}
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                  >
                    <Badge className="mr-2 bg-red-100 text-red-800">Owe</Badge>
                    Pay {item.person} {formatCurrency(item.amount)}
                  </div>
                ))}

                {receives.map((item) => (
                  <div
                    key={`receive-${item.person}-${item.amount}`}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                  >
                    <Badge className="mr-2 bg-emerald-100 text-emerald-800">Receive</Badge>
                    Receive {formatCurrency(item.amount)} from {item.person}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            Finalized on {link.trip.finalizedAt.toLocaleDateString()} • Powered by Evensplit
          </p>
          <Link href="/login" className="text-sm text-emerald-700 hover:text-emerald-800">
            Open Evensplit
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
