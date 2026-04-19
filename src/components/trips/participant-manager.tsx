"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ParticipantItem = {
  id: string;
  name: string;
};

type ParticipantManagerProps = {
  tripId: string;
  participants: ParticipantItem[];
  addAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function ParticipantManager({
  tripId,
  participants,
  addAction,
  deleteAction,
}: ParticipantManagerProps) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const addParticipant = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tripId", tripId);
      formData.set("name", trimmed);
      await addAction(formData);
      setName("");
    });
  };

  const removeParticipant = (participantId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tripId", tripId);
      formData.set("participantId", participantId);
      await deleteAction(formData);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Participant name"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addParticipant();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addParticipant} disabled={pending} aria-label="Add participant">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {participants.map((participant) => (
          <span
            key={participant.id}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm"
          >
            {participant.name}
            <button
              type="button"
              className="rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              onClick={() => removeParticipant(participant.id)}
              aria-label={`Remove ${participant.name}`}
              disabled={pending}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
