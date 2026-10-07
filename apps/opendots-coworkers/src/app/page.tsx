import { Playground } from "@/components/dots/playground";
import { liveAvailable, MODEL } from "@/server/claude";

export const dynamic = "force-dynamic";

export default function Home() {
  const live = liveAvailable();
  return <Playground live={live} model={live ? MODEL : null} />;
}
