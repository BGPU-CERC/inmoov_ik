export function keydown(code, ctrlKey = false) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, ctrlKey }));
}
