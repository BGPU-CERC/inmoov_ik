import { mapLinear } from "./constants.js";
import { debounce } from "./debounce.js";
import { refs } from "./refs.js";

function handGrab(hand, target, value) {
  value = Number(value.toFixed(2));

  for (const part in hand.parts) {
    const finger = hand.parts[part];

    if (part.match(/thumb/)) {
      finger.rotationValue = Number((value * 0.4).toFixed(2));
    } else {
      finger.rotationValue = value;
    }

    for (const phalanx of finger) {
      const { from, to, axis } = phalanx.rotationMap;
      const rotation = mapLinear(finger.rotationValue, 0, 1, from, to);
      phalanx.rotation[axis] = rotation;
    }
  }
}

let handRelease = debounce(
  (hand, target) => handGrab(hand, target, 0),
  0.1 * 1000
);

export function handGrabLeft(value) {
  handGrab(refs.hands.l, refs.target_l, value);
  handRelease(refs.hands.l, refs.target_l);
}

export function handGrabRight(value) {
  handGrab(refs.hands.r, refs.target_r, value);
  handRelease(refs.hands.r, refs.target_r);
}
