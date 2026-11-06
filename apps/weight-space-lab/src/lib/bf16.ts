// Decoding helpers for the sparse bfloat16 edit in public/data/weight-edit.json.
// idx: flat row-major index into a [rows, cols] tensor.
// val: the edited value as a uint16 bfloat16 bit pattern.
// A bfloat16 is the top 16 bits of a float32, so (bits << 16) reinterpreted as
// float32 gives the exact value. Base (unedited) weights are NOT in the diff.

export type TensorEdit = {
  tensor: string;
  shape: [number, number];
  changed_entries: number;
  changed_columns: number;
  relative_change: number;
  base_sha256: string;
  edited_sha256: string;
  columns: number[];
  rows: number[];
  idx: number[];
  val: number[];
  max_abs_edited_weight?: number;
};

export type WeightEdit = { manifest: TensorEdit[] };

const scratch = new DataView(new ArrayBuffer(4));

export function decodeBf16(bits: number): number {
  scratch.setUint32(0, (bits & 0xffff) << 16 >>> 0);
  return scratch.getFloat32(0);
}

export function bitsHex(bits: number): string {
  return "0x" + (bits & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}

/** sign | exponent (8) | mantissa (7) */
export function bitsFields(bits: number): { sign: string; exponent: string; mantissa: string } {
  const b = (bits & 0xffff).toString(2).padStart(16, "0");
  return { sign: b.slice(0, 1), exponent: b.slice(1, 9), mantissa: b.slice(9) };
}

export function flatToRowCol(idx: number, cols: number): { row: number; col: number } {
  return { row: Math.floor(idx / cols), col: idx % cols };
}

export type ColumnEntry = { row: number; idx: number; bits: number; value: number };
export type ColumnDetail = {
  col: number;
  entries: ColumnEntry[];
  min: number;
  max: number;
  meanAbs: number;
};

export type DecodedTensor = {
  tensor: string;
  layer: number;
  shape: [number, number];
  columns: number[];
  /** column index -> position in `columns` */
  colPos: Map<number, number>;
  /** dense [rows x columns.length] grid of decoded values, NaN where the slot is not in the diff */
  grid: Float32Array;
  /** dense grid of raw bits, 0 where not in diff */
  gridBits: Uint16Array;
  present: Uint8Array;
  changedEntries: number;
  changedRows: number;
  maxAbs: number;
  manifest: TensorEdit;
};

export function layerOf(tensor: string): number {
  const m = tensor.match(/layers\.(\d+)\./);
  return m ? Number(m[1]) : -1;
}

export function decodeTensor(t: TensorEdit): DecodedTensor {
  const [rows, cols] = t.shape;
  if (t.idx.length !== t.val.length) throw new Error(`${t.tensor}: idx/val length mismatch`);
  const colPos = new Map<number, number>();
  t.columns.forEach((c, i) => colPos.set(c, i));
  const w = t.columns.length;
  const grid = new Float32Array(rows * w).fill(NaN);
  const gridBits = new Uint16Array(rows * w);
  const present = new Uint8Array(rows * w);
  const rowSeen = new Uint8Array(rows);
  let maxAbs = 0;
  for (let i = 0; i < t.idx.length; i++) {
    const { row, col } = flatToRowCol(t.idx[i], cols);
    const p = colPos.get(col);
    if (p === undefined || row >= rows) throw new Error(`${t.tensor}: idx ${t.idx[i]} outside listed columns`);
    const v = decodeBf16(t.val[i]);
    const k = row * w + p;
    grid[k] = v;
    gridBits[k] = t.val[i];
    present[k] = 1;
    rowSeen[row] = 1;
    if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  }
  let changedRows = 0;
  for (let r = 0; r < rows; r++) changedRows += rowSeen[r];
  return {
    tensor: t.tensor,
    layer: layerOf(t.tensor),
    shape: t.shape,
    columns: t.columns,
    colPos,
    grid,
    gridBits,
    present,
    changedEntries: t.idx.length,
    changedRows,
    maxAbs,
    manifest: t,
  };
}

export function columnDetail(d: DecodedTensor, col: number): ColumnDetail | null {
  const p = d.colPos.get(col);
  if (p === undefined) return null;
  const w = d.columns.length;
  const [rows, cols] = d.shape;
  const entries: ColumnEntry[] = [];
  let min = Infinity, max = -Infinity, sumAbs = 0;
  for (let r = 0; r < rows; r++) {
    const k = r * w + p;
    if (!d.present[k]) continue;
    const value = d.grid[k];
    entries.push({ row: r, idx: r * cols + col, bits: d.gridBits[k], value });
    if (value < min) min = value;
    if (value > max) max = value;
    sumAbs += Math.abs(value);
  }
  return { col, entries, min, max, meanAbs: entries.length ? sumAbs / entries.length : 0 };
}

/** Author's touched-slot budget: changed columns x rows, summed over tensors. */
export function touchedSlots(ts: TensorEdit[]): number {
  return ts.reduce((s, t) => s + t.changed_columns * t.shape[0], 0);
}

export function totalChanged(ts: TensorEdit[]): number {
  return ts.reduce((s, t) => s + t.idx.length, 0);
}
