import { Studio } from "@/components/studio/studio";
import { liveAvailable, MODEL } from "@/server/claude";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Studio liveAvailable={liveAvailable()} model={MODEL} />;
}
