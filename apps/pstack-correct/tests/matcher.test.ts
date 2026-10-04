import { describe, expect, test } from "bun:test"
import { PACKS } from "../src/lib/packs"
import { match, splitNotes } from "../src/lib/matcher"

describe("canned packs", () => {
  for (const pack of PACKS) {
    test(`${pack.id} clusters onto itself`, () => {
      const r = match(pack.notes, PACKS)
      expect(r.kind).toBe("pattern")
      if (r.kind !== "pattern") return
      expect(r.clusters[0].pack.id).toBe(pack.id)
      expect(r.clusters[0].hits.length).toBeGreaterThanOrEqual(pack.notes.length - 1)
    })
  }

  test("at least four packs ship", () => expect(PACKS.length).toBeGreaterThanOrEqual(4))
})

describe("pasted notes", () => {
  test("empty paste", () => expect(match(splitNotes("  \n \n"), PACKS).kind).toBe("empty"))

  test("one note never invents a fix", () => {
    expect(match(["stop using any here"], PACKS).kind).toBe("no-pattern")
  })

  test("unrelated one-offs do not cluster", () => {
    const r = match(
      splitNotes("rename the button to Save\nuse the brand blue\nstop using any in the order type\nthe webhook body was trusted"),
      PACKS,
    )
    expect(r.kind).toBe("no-pattern")
  })

  test("paraphrased notes match with visible reasons", () => {
    const r = match(
      splitNotes("- please validate the request body\n- crashed on unparsed JSON from the webhook\n- rename the button"),
      PACKS,
    )
    expect(r.kind).toBe("pattern")
    if (r.kind !== "pattern") return
    expect(r.clusters[0].pack.id).toBe("validate-later")
    expect(r.clusters[0].hits.every((h) => h.keywords.length > 0 || h.similarTo)).toBe(true)
    expect(r.leftAlone).toEqual(["rename the button"])
  })
})
