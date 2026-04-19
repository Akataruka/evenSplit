"use server";

import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { parseSplitPayload } from "@/lib/expense";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getMinimalSettlements, computeBalances } from "@/lib/settlement";
import {
  expenseFormSchema,
  finalizeSchema,
  participantSchema,
  tripSchema,
} from "@/lib/validation";

function redirectWithWarning(path: string, warning: string): never {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("warning", warning);
  redirect(`${url.pathname}${url.search}`);
}

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
}

async function verifyTripOwnership(tripId: string) {
  const userId = await requireUserId();
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, createdById: userId },
    include: { participants: true },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  return trip;
}

export async function createTripAction(formData: FormData) {
  const name = formData.get("name");
  const participantsRaw = formData.get("participants");

  const parsed = tripSchema.safeParse({ name });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid trip name");

  const userId = await requireUserId();
  const participants = String(participantsRaw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (participants.length < 2) {
    throw new Error("Add at least two participants.");
  }

  const uniqueParticipants = Array.from(new Set(participants));

  const trip = await prisma.trip.create({
    data: {
      name: parsed.data.name,
      createdById: userId,
      participants: {
        createMany: {
          data: uniqueParticipants.map((participant, index) => ({
            name: participant,
            order: index,
          })),
        },
      },
    },
  });

  revalidatePath("/dashboard");
  return trip.id;
}

export async function updateTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const name = String(formData.get("name") ?? "");

  const parsed = tripSchema.safeParse({ name });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid trip name");

  await verifyTripOwnership(tripId);

  await prisma.trip.update({
    where: { id: tripId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteTripAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  try {
    await verifyTripOwnership(tripId);

    await prisma.trip.delete({ where: { id: tripId } });

    revalidatePath("/dashboard");
  } catch {
    redirectWithWarning("/dashboard", "Could not delete trip. It may still have linked records.");
  }
}

export async function addParticipantAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const name = String(formData.get("name") ?? "");

  const parsed = participantSchema.safeParse({ tripId, name });
  if (!parsed.success) throw new Error("Invalid participant data");

  const trip = await verifyTripOwnership(tripId);

  await prisma.participant.create({
    data: {
      tripId,
      name: parsed.data.name,
      order: trip.participants.length,
    },
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function deleteParticipantAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");

  await verifyTripOwnership(tripId);

  const used = await prisma.expense.count({
    where: {
      tripId,
      OR: [{ paidByParticipantId: participantId }, { splits: { some: { participantId } } }],
    },
  });

  if (used > 0) {
    throw new Error("Participant is used in expenses and cannot be removed.");
  }

  await prisma.participant.delete({ where: { id: participantId } });
  revalidatePath(`/trips/${tripId}`);
}

export async function upsertExpenseAction(formData: FormData) {
  const parsed = expenseFormSchema.safeParse({
    tripId: formData.get("tripId"),
    title: formData.get("title"),
    amount: formData.get("amount"),
    paidByParticipantId: formData.get("paidByParticipantId"),
    splitPayload: formData.get("splitPayload"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid expense.");
  }

  const trip = await verifyTripOwnership(parsed.data.tripId);

  const participantIds = trip.participants.map((participant) => participant.id);
  if (!participantIds.includes(parsed.data.paidByParticipantId)) {
    throw new Error("Payer must be a trip participant.");
  }

  const splitResult = parseSplitPayload(
    parsed.data.splitPayload,
    parsed.data.amount,
    participantIds,
  );

  const expenseId = String(formData.get("expenseId") ?? "").trim();

  const data = {
    title: parsed.data.title,
    amount: new Prisma.Decimal(parsed.data.amount),
    paidByParticipantId: parsed.data.paidByParticipantId,
    splitType: splitResult.splitType,
    splits: {
      create: splitResult.entries.map((entry) => ({
        participantId: entry.participantId,
        shareAmount: new Prisma.Decimal(entry.shareAmountCents / 100),
        percentage:
          typeof entry.percentage === "number" ? new Prisma.Decimal(entry.percentage) : undefined,
      })),
    },
  };

  if (expenseId) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, tripId: parsed.data.tripId },
      select: { id: true },
    });
    if (!expense) throw new Error("Expense not found");

    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({ where: { expenseId: expense.id } });
      await tx.expense.update({
        where: { id: expense.id },
        data,
      });
    });
  } else {
    await prisma.expense.create({
      data: {
        tripId: parsed.data.tripId,
        ...data,
      },
    });
  }

  await prisma.trip.update({
    where: { id: parsed.data.tripId },
    data: { finalizedAt: null },
  });

  revalidatePath(`/trips/${parsed.data.tripId}`);
}

export async function updateExpenseBasicAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const paidByParticipantId = String(formData.get("paidByParticipantId") ?? "");

  if (!title || amount <= 0) throw new Error("Invalid expense edit data.");

  const trip = await verifyTripOwnership(tripId);
  const participantIds = new Set(trip.participants.map((p) => p.id));
  if (!participantIds.has(paidByParticipantId)) throw new Error("Invalid payer.");

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, tripId },
    include: { splits: true },
  });

  if (!expense) throw new Error("Expense not found.");

  const oldTotalCents = expense.splits.reduce((sum, split) => sum + Math.round(Number(split.shareAmount) * 100), 0);
  const newTotalCents = Math.round(amount * 100);

  const recalculated = expense.splits.map((split, index) => {
    if (index === expense.splits.length - 1) {
      const used = expense.splits
        .slice(0, index)
        .reduce((sum, current) => sum + Math.round((Math.round(Number(current.shareAmount) * 100) / oldTotalCents) * newTotalCents), 0);
      return {
        participantId: split.participantId,
        shareAmount: new Prisma.Decimal((newTotalCents - used) / 100),
      };
    }

    const shareCents = Math.round((Math.round(Number(split.shareAmount) * 100) / oldTotalCents) * newTotalCents);
    return {
      participantId: split.participantId,
      shareAmount: new Prisma.Decimal(shareCents / 100),
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        title,
        amount: new Prisma.Decimal(amount),
        paidByParticipantId,
        splits: { create: recalculated },
      },
    });
    await tx.trip.update({
      where: { id: tripId },
      data: { finalizedAt: null },
    });
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function deleteExpenseAction(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");

  await verifyTripOwnership(tripId);

  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: expenseId } });
    await tx.trip.update({
      where: { id: tripId },
      data: { finalizedAt: null },
    });
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function finalizeTripAction(formData: FormData) {
  const tripId = formData.get("tripId");
  const preferredReceiverId = formData.get("preferredReceiverId");
  const customSettlements = formData.get("customSettlements");

  const parsed = finalizeSchema.safeParse({
    tripId: typeof tripId === "string" ? tripId : "",
    preferredReceiverId:
      typeof preferredReceiverId === "string" ? preferredReceiverId : undefined,
    customSettlements:
      typeof customSettlements === "string" ? customSettlements : undefined,
  });

  if (!parsed.success) {
    redirectWithWarning("/dashboard", "Invalid finalize request.");
  }
  const data = parsed.data;

  try {
    const trip = await verifyTripOwnership(data.tripId);

    const expenses = await prisma.expense.findMany({
      where: { tripId: data.tripId },
      include: { splits: true },
    });

    const participantIds = trip.participants.map((participant) => participant.id);

    const balances = computeBalances(
      participantIds,
      expenses.map((expense) => ({
        amount: Number(expense.amount),
        paidByParticipantId: expense.paidByParticipantId,
        splits: expense.splits.map((split) => ({
          participantId: split.participantId,
          shareAmount: Number(split.shareAmount),
        })),
      })),
    );

    const suggested = getMinimalSettlements(
      balances.byParticipant,
      data.preferredReceiverId || undefined,
    );

    let settlementsToPersist = suggested;

    const participantIdSet = new Set(trip.participants.map((participant) => participant.id));
    const rawCustom = data.customSettlements?.trim();

    if (rawCustom) {
      let parsedCustom: unknown;
      try {
        parsedCustom = JSON.parse(rawCustom);
      } catch {
        throw new Error("Invalid custom settlement data.");
      }

      if (!Array.isArray(parsedCustom)) {
        throw new Error("Custom settlements must be a list.");
      }

      const custom = parsedCustom
        .map((item) => {
          if (
            typeof item !== "object" ||
            item === null ||
            !("fromParticipantId" in item) ||
            !("toParticipantId" in item) ||
            !("amount" in item)
          ) {
            throw new Error("Invalid custom settlement item.");
          }

          return {
            fromParticipantId: String(item.fromParticipantId),
            toParticipantId: String(item.toParticipantId),
            amount: Number(item.amount),
          };
        })
        .filter((item) => item.amount > 0);

      for (const item of custom) {
        if (!participantIdSet.has(item.fromParticipantId) || !participantIdSet.has(item.toParticipantId)) {
          throw new Error("Custom settlements include unknown participant.");
        }

        if (item.fromParticipantId === item.toParticipantId) {
          throw new Error("A participant cannot pay themselves.");
        }
      }

      const expectedCents = new Map<string, number>();
      const actualCents = new Map<string, number>();

      for (const [participantId, item] of Object.entries(balances.byParticipant)) {
        expectedCents.set(participantId, Math.round(item.net * 100));
        actualCents.set(participantId, 0);
      }

      for (const item of custom) {
        const cents = Math.round(item.amount * 100);
        actualCents.set(item.fromParticipantId, (actualCents.get(item.fromParticipantId) ?? 0) - cents);
        actualCents.set(item.toParticipantId, (actualCents.get(item.toParticipantId) ?? 0) + cents);
      }

      for (const [participantId, expected] of expectedCents.entries()) {
        const actual = actualCents.get(participantId) ?? 0;
        if (actual !== expected) {
          throw new Error("Custom settlements do not match current balances.");
        }
      }

      settlementsToPersist = custom;
    }

    await prisma.$transaction(async (tx) => {
      await tx.settlement.deleteMany({ where: { tripId: data.tripId } });

      if (settlementsToPersist.length > 0) {
        await tx.settlement.createMany({
          data: settlementsToPersist.map((item) => ({
            tripId: data.tripId,
            fromParticipantId: item.fromParticipantId,
            toParticipantId: item.toParticipantId,
            amount: new Prisma.Decimal(item.amount),
          })),
        });
      }

      for (const participant of trip.participants) {
        await tx.publicBillLink.upsert({
          where: {
            tripId_participantId: {
              tripId: data.tripId,
              participantId: participant.id,
            },
          },
          create: {
            tripId: data.tripId,
            participantId: participant.id,
            token: randomBytes(8).toString("hex"),
          },
          update: {},
        });
      }

      await tx.trip.update({
        where: { id: data.tripId },
        data: { finalizedAt: new Date() },
      });
    });

    revalidatePath(`/trips/${data.tripId}`);
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Could not finalize settlements.";
    redirectWithWarning(`/trips/${data.tripId}`, warning);
  }
}
