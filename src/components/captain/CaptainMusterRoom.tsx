"use client";
import { MusterRoom } from "@/components/muster/MusterRoom";
export function CaptainMusterRoom({ voyageId }: { voyageId: string }) {
  return <MusterRoom voyageId={voyageId} />;
}
