/**
 * Tracks which modal dialogs and drawers are open, in the order they opened.
 *
 * Without this, two overlays open at once (a confirmation dialog on top of a
 * detail drawer) both listen on `document`: Escape would close both, and the
 * two focus traps would fight each other. Only the topmost overlay reacts to
 * the keyboard, and the page's scroll lock is released only when the last
 * overlay closes, whichever order they close in.
 */
const stack: symbol[] = [];
let originalOverflow = "";

/** Registers a newly opened overlay and locks page scroll. Returns its id. */
export function pushOverlay(): symbol {
  const id = Symbol("overlay");
  if (stack.length === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  stack.push(id);
  return id;
}

/** Unregisters an overlay. Restores page scroll once none are left. */
export function removeOverlay(id: symbol): void {
  const index = stack.indexOf(id);
  if (index === -1) return;
  stack.splice(index, 1);
  if (stack.length === 0) {
    document.body.style.overflow = originalOverflow;
  }
}

/** True when this overlay is the one on top and should handle the keyboard. */
export function isTopOverlay(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}
