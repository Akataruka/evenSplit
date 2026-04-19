import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { createTripAction, deleteTripAction, updateTripAction } from "@/app/(app)/actions";
import { CreateTripForm } from "@/components/trips/create-trip-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : undefined;
  const warningParam = query?.warning;
  const warning = Array.isArray(warningParam) ? warningParam[0] : warningParam;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const trips = await prisma.trip.findMany({
    where: { createdById: session.user.id },
    include: {
      _count: { select: { participants: true, expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  async function createTripAndRedirect(formData: FormData) {
    "use server";
    const tripId = await createTripAction(formData);
    redirect(`/trips/${tripId}`);
  }

  return (
    <div className="space-y-4">
      {warning ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create a trip</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTripForm action={createTripAndRedirect} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My trips</CardTitle>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="text-sm text-zinc-600">No trips yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link href={`/trips/${trip.id}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                        {trip.name}
                      </Link>
                      <p className="text-xs text-zinc-600">
                        {trip._count.participants} participants • {trip._count.expenses} expenses
                      </p>
                      <p className="text-xs text-zinc-500">
                        {trip.finalizedAt
                          ? `Finalized on ${trip.finalizedAt.toLocaleDateString()}`
                          : "Not finalized"}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                      <form action={updateTripAction} className="flex items-center gap-2">
                        <input type="hidden" name="tripId" value={trip.id} />
                        <Input name="name" defaultValue={trip.name} className="h-8 w-36" required />
                        <Button size="sm" variant="outline" type="submit">
                          Rename
                        </Button>
                      </form>
                      <form action={deleteTripAction}>
                        <input type="hidden" name="tripId" value={trip.id} />
                        <Button size="sm" variant="destructive" type="submit">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
