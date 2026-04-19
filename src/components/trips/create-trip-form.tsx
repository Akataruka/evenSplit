"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateTripFormProps = {
  action: (formData: FormData) => Promise<void>;
};

export function CreateTripForm({ action }: CreateTripFormProps) {
  const [tripName, setTripName] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);

  const participantsPayload = useMemo(() => participants.join("\n"), [participants]);

  const addParticipant = () => {
    const name = participantInput.trim();
    if (!name) return;
    if (participants.some((item) => item.toLowerCase() === name.toLowerCase())) return;

    setParticipants((prev) => [...prev, name]);
    setParticipantInput("");
  };

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Trip name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Goa Weekend"
          value={tripName}
          onChange={(event) => setTripName(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="participant">Participants</Label>
        <div className="flex gap-2">
          <Input
            id="participant"
            placeholder="Add participant"
            value={participantInput}
            onChange={(event) => setParticipantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addParticipant();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addParticipant} aria-label="Add participant">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {participants.map((participant) => (
          <span
            key={participant}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm"
          >
            {participant}
            <button
              type="button"
              className="rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              onClick={() => setParticipants((prev) => prev.filter((item) => item !== participant))}
              aria-label={`Remove ${participant}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <input type="hidden" name="participants" value={participantsPayload} />

      <Button type="submit" className="w-full" disabled={participants.length < 2}>
        Create trip
      </Button>

      {participants.length < 2 ? (
        <p className="text-xs text-zinc-500">Add at least 2 participants.</p>
      ) : null}
    </form>
  );
}
