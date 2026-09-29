import { Studio } from "@/components/studio/studio";
import { capabilities } from "@/server/scan";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Studio caps={capabilities()} />;
}
