import raw from "../../data/packs.json"
import type { Mechanism, Pack } from "./types"

export const PACKS = raw as Pack[]

export const LADDER: { mechanism: Mechanism; label: string; layer: string }[] = [
  { mechanism: "unrepresentable", label: "Unrepresentable state", layer: "types / architecture" },
  { mechanism: "lint", label: "Lint or banned API", layer: "checks" },
  { mechanism: "helper", label: "Canonical helper", layer: "checks" },
  { mechanism: "runtime", label: "Runtime check", layer: "checks" },
  { mechanism: "prose", label: "Prose reminder", layer: "the symptom" },
]
