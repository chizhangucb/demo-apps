import { Desk } from "@/components/desk/desk";
import { sampleRun } from "@/lib/sample";
import { liveAvailable } from "@/server/claude";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Desk initial={sampleRun()} liveEnabled={liveAvailable()} />;
}
