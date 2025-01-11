export function keydown(code, ctrlKey = false) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, ctrlKey }));
}

export function keyup(code, ctrlKey = false) {
  window.dispatchEvent(new KeyboardEvent("keyup", { code, ctrlKey }));
}
