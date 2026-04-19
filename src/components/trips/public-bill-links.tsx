"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

type BillLinkItem = {
  id: string;
  participantName: string;
  token: string;
};

type PublicBillLinksProps = {
  items: BillLinkItem[];
};

export function PublicBillLinks({ items }: PublicBillLinksProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = async (token: string, id: string) => {
    const origin = window.location.origin;
    const fullLink = `${origin}/bills/${token}`;
    await navigator.clipboard.writeText(fullLink);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-2 border-t border-emerald-200 pt-2 text-sm">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-emerald-100/50 px-2 py-1">
          <p className="truncate text-emerald-900">
            {item.participantName}: <Link href={`/bills/${item.token}`}>/bills/{item.token}</Link>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 bg-white"
            onClick={() => copyLink(item.token, item.id)}
          >
            {copiedId === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedId === item.id ? "Copied" : "Copy"}
          </Button>
        </div>
      ))}
    </div>
  );
}
