import { z } from "zod";

export const tripSchema = z.object({
  name: z.string().trim().min(2, "Trip name must be at least 2 characters").max(80),
});

export const participantSchema = z.object({
  tripId: z.string().cuid(),
  name: z.string().trim().min(1).max(50),
});

export const expenseFormSchema = z.object({
  tripId: z.string().cuid(),
  title: z.string().trim().min(1).max(100),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paidByParticipantId: z.string().cuid(),
  splitPayload: z.string().min(1),
});

const exactSplitSchema = z.object({
  splitType: z.literal("EXACT"),
  entries: z.array(
    z.object({
      participantId: z.string().cuid(),
      amount: z.coerce.number().nonnegative(),
    }),
  ),
});

const percentageSplitSchema = z.object({
  splitType: z.literal("PERCENTAGE"),
  entries: z.array(
    z.object({
      participantId: z.string().cuid(),
      percentage: z.coerce.number().nonnegative(),
    }),
  ),
});

const evenSplitSchema = z.object({
  splitType: z.literal("EVEN"),
  includedParticipantIds: z.array(z.string().cuid()).min(1),
});

export const splitPayloadSchema = z.discriminatedUnion("splitType", [
  evenSplitSchema,
  exactSplitSchema,
  percentageSplitSchema,
]);

export const finalizeSchema = z.object({
  tripId: z.string().cuid(),
  preferredReceiverId: z.string().cuid().optional().or(z.literal("")),
  customSettlements: z.string().optional(),
});
