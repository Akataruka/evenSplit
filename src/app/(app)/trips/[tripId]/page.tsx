import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import {
  addParticipantAction,
  deleteExpenseAction,
  deleteParticipantAction,
  finalizeTripAction,
  updateExpenseBasicAction,
  upsertExpenseAction,
} from "@/app/(app)/actions";
import { ExpenseForm } from "@/components/trips/expense-form";
import { ParticipantManager } from "@/components/trips/participant-manager";
import { PublicBillLinks } from "@/components/trips/public-bill-links";
import { SettlementEditor } from "@/components/trips/settlement-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { computeBalances, getMinimalSettlements } from "@/lib/settlement";
import { formatCurrency } from "@/lib/utils";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tripId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const warningParam = query?.warning;
  const warning = Array.isArray(warningParam) ? warningParam[0] : warningParam;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, createdById: session.user.id },
    include: {
      participants: {
        orderBy: { order: "asc" },
      },
      expenses: {
        include: {
          payer: true,
          splits: {
            include: { participant: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      settlements: {
        include: {
          fromParticipant: true,
          toParticipant: true,
        },
        orderBy: { createdAt: "asc" },
      },
      publicBillLinks: true,
    },
  });

  if (!trip) {
    notFound();
  }

  const summary = computeBalances(
    trip.participants.map((participant) => participant.id),
    trip.expenses.map((expense) => ({
      amount: Number(expense.amount),
      paidByParticipantId: expense.paidByParticipantId,
      splits: expense.splits.map((split) => ({
        participantId: split.participantId,
        shareAmount: Number(split.shareAmount),
      })),
    })),
  );

  const previewSettlements = getMinimalSettlements(summary.byParticipant);

  return (
    <div className="space-y-4 pb-10">
      {warning ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <p className="text-xs text-zinc-500">Trip workspace</p>
          <h1 className="text-xl font-semibold text-zinc-900">{trip.name}</h1>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add expense</CardTitle>
          </CardHeader>
          <CardContent>
            {trip.participants.length < 2 ? (
              <p className="text-sm text-zinc-600">Add at least two participants first.</p>
            ) : (
              <ExpenseForm
                tripId={trip.id}
                participants={trip.participants.map((participant) => ({
                  id: participant.id,
                  name: participant.name,
                }))}
                action={upsertExpenseAction}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ParticipantManager
              tripId={trip.id}
              participants={trip.participants.map((participant) => ({
                id: participant.id,
                name: participant.name,
              }))}
              addAction={addParticipantAction}
              deleteAction={deleteParticipantAction}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {trip.expenses.length === 0 ? (
            <p className="text-sm text-zinc-600">No expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {trip.expenses.map((expense) => (
                <details key={expense.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <summary className="cursor-pointer list-none sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{expense.title}</p>
                      <p className="text-xs text-zinc-600">
                        Paid by {expense.payer.name} • {formatCurrency(Number(expense.amount))} • {expense.splitType}
                      </p>
                    </div>
                    <div className="mt-2 flex gap-2 sm:mt-0">
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="tripId" value={trip.id} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <Button size="sm" variant="destructive" type="submit">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </summary>

                  <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {expense.splits.map((split) => (
                        <div
                          key={split.id}
                          className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm"
                        >
                          {split.participant.name}: {formatCurrency(Number(split.shareAmount))}
                        </div>
                      ))}
                    </div>

                    <form action={updateExpenseBasicAction} className="grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="tripId" value={trip.id} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <Input name="title" defaultValue={expense.title} required />
                      <Input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={Number(expense.amount)}
                        required
                      />
                      <select
                        name="paidByParticipantId"
                        defaultValue={expense.paidByParticipantId}
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                      >
                        {trip.participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline">
                        Quick update
                      </Button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-sm text-zinc-600">Total expense</p>
            <p className="text-2xl font-semibold text-zinc-900">{formatCurrency(summary.totalExpense)}</p>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Participant</TH>
                <TH>Paid</TH>
                <TH>Share</TH>
                <TH>Net</TH>
              </TR>
            </THead>
            <TBody>
              {trip.participants.map((participant) => {
                const item = summary.byParticipant[participant.id];
                return (
                  <TR key={participant.id}>
                    <TD>{participant.name}</TD>
                    <TD>{formatCurrency(item?.paid ?? 0)}</TD>
                    <TD>{formatCurrency(item?.share ?? 0)}</TD>
                    <TD>
                      <Badge
                        className={
                          (item?.net ?? 0) >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {(item?.net ?? 0) >= 0 ? "+" : ""}
                        {formatCurrency(item?.net ?? 0)}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <SettlementEditor
            tripId={trip.id}
            participants={trip.participants.map((participant) => ({
              id: participant.id,
              name: participant.name,
            }))}
            balances={summary.byParticipant}
            suggestedSettlements={previewSettlements}
            action={finalizeTripAction}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Finalize and generate public bills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600">
            Use the editable settlement preview above, then finalize to lock records and generate public bills.
          </p>

          {trip.settlements.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">Final settlement records</p>
              <ul className="space-y-1">
                {trip.settlements.map((settlement) => (
                  <li key={settlement.id} className="text-sm text-emerald-900">
                    {settlement.fromParticipant.name} pays {settlement.toParticipant.name}{" "}
                    {formatCurrency(Number(settlement.amount))}
                  </li>
                ))}
              </ul>

              <PublicBillLinks
                items={trip.publicBillLinks.map((bill) => ({
                  id: bill.id,
                  token: bill.token,
                  participantName:
                    trip.participants.find((participant) => participant.id === bill.participantId)?.name ??
                    "Participant",
                }))}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
