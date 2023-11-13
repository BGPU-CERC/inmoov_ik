let domElement = window;
export function dispatchTo(element) {
  domElement = element;
}

export function wheel(deltaY) {
  domElement.dispatchEvent(new WheelEvent("wheel", { deltaY }));
}
