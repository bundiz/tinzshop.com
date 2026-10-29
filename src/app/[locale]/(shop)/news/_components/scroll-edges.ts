export type ScrollEdges = { canScrollLeft: boolean; canScrollRight: boolean };

/** Which ways a horizontal strip can still scroll; 1px of tolerance absorbs sub-pixel rounding. */
export function scrollEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): ScrollEdges {
  return {
    canScrollLeft: scrollLeft > 1,
    canScrollRight: scrollLeft + clientWidth < scrollWidth - 1,
  };
}
