export function diff_position(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) {
      return i;
    }
  }

  if (a.byteLength > b.byteLength) {
    return b.byteLength;
  }

  if (a.byteLength < b.byteLength) {
    return a.byteLength;
  }

  return -1;
}
