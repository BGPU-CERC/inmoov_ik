import { TARGET_L, TARGET_R } from "./constants.js";
import { keydown, keyup } from "./keyboard.js";
import { wheel, dispatchTo as wheelDispatchTo } from "./mouse.js";

let onControlLoop = undefined;
let onKeyboardMapLoop = undefined;
let animationFrameRequest = null;
const hasGamepadAPI = () => "getGamepads" in navigator;

let inUse = false;
let inUsePrev = false;
let onUseChange = undefined;

// [xbox, ps]
export const buttonMap = [
  ["A", "Cross"],
  ["B", "Circle"],
  ["X", "Square"],
  ["Y", "Triangle"],
  ["LB", "L1"],
  ["RB", "R1"],
  ["LT", "L2"],
  ["RT", "R2"],
  ["Addr Bar", "Share"],
  ["Menu", "Options"],
  ["LSB", "LSB"],
  ["RSB", "RSB"],
  ["Up", "Up"],
  ["Down", "Down"],
  ["Left", "Left"],
  ["Right", "Right"],
  ["Logo", "Logo"],
];

export function onUse(cb) {
  onUseChange = cb;
}

export function mapToKeyboard(keyboardMap) {
  const gamepadMap = keyboardMap.reduce(
    (map, [gamepadButton, keyboardCode]) => {
      const indexOfGamepadButton = buttonMap.findIndex((buttonNames) =>
        buttonNames.includes(gamepadButton)
      );

      map[indexOfGamepadButton] = {
        keyboardCode,
        pressed: false,
      };

      return map;
    },
    {}
  );

  onKeyboardMapLoop = (gamepad) => {
    for (let i = 0; i < gamepad.buttons.length; i++) {
      const mapped = gamepadMap[i];
      if (!mapped) continue;

      const button = gamepad.buttons[i];
      if (button.pressed) {
        mapped.pressed || keydown(mapped.keyboardCode);
      } else {
        !mapped.pressed || keyup(mapped.keyboardCode);
      }

      mapped.pressed = Boolean(button.pressed);
    }
  };

  const stop = () => (onKeyboardMapLoop = undefined);
  return stop;
}

export function controlScene(scene) {
  if (!hasGamepadAPI()) {
    return console.warn("Gamepad API not supported");
  }

  wheelDispatchTo(scene.domElement);

  let x1Prev = 0;
  let y1Prev = 0;
  let x2Prev = 0;
  let y2Prev = 0;
  onControlLoop = (gamepad) => {
    inUse = false;
    const x1 = threshold(gamepad.axes[0]);
    const y1 = threshold(gamepad.axes[1]);
    const x2 = threshold(gamepad.axes[2]);
    const y2 = threshold(gamepad.axes[3]);
    scene.translateTargetOnAxis(0, -y2, x2, 0.025);
    scene.translateTargetOnAxis(y1, 0, x1, 0.025);

    inUse = x1 !== x1Prev || y1 !== y1Prev || x2 !== x2Prev || y2 !== y2Prev;
    x1Prev = x1;
    y1Prev = y1;
    x2Prev = x2;
    y2Prev = y2;

    for (let i = 0; i < gamepad.buttons.length; i++) {
      const button = gamepad.buttons[i];
      if (!button.pressed) continue;
      inUse = true;

      switch (i) {
        case 10:
          scene.setTarget(TARGET_R);
          break;
        case 11:
          scene.setTarget(TARGET_L);
          break;

        case 12:
          keydown("ArrowUp", true);
          break;
        case 13:
          keydown("ArrowDown", true);
          break;
        case 14:
          keydown("ArrowLeft", true);
          break;
        case 15:
          keydown("ArrowRight", true);
          break;
        case 4:
          wheel(-1 / 2);
          break;
        case 5:
          wheel(1 / 2);
          break;
        case 1:
          scene.resetCamera();
          break;

        case 0:
          scene.resetTargets();
          break;

        case 6:
          scene.handGrabRight(button.value);
          break;
        case 7:
          scene.handGrabLeft(button.value);
          break;

        default:
          console.log(`Button pressed: ${i}`);
      }
    }

    if (inUse !== inUsePrev) onUseChange?.();
    inUsePrev = inUse;
  };

  const stop = () => {
    onControlLoop = undefined;
    inUse = false;
  };

  return stop;
}

function loop() {
  if (!onControlLoop || !onKeyboardMapLoop) return;

  const gamepads = navigator.getGamepads();
  const gamepad = gamepads.find(Boolean);

  onControlLoop?.(gamepad);
  onKeyboardMapLoop?.(gamepad);

  animationFrameRequest = requestAnimationFrame(loop);
}

function threshold(axis) {
  return Math.abs(axis) >= 0.06 ? axis : 0;
}

window.addEventListener("gamepadconnected", (e) => {
  console.log(
    "Gamepad connected at index %d: %s. %d buttons, %d axes.",
    e.gamepad.index,
    e.gamepad.id,
    e.gamepad.buttons.length,
    e.gamepad.axes.length
  );

  animationFrameRequest || loop();
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log(
    "Gamepad disconnected from index %d: %s",
    e.gamepad.index,
    e.gamepad.id
  );

  cancelAnimationFrame(animationFrameRequest);
  animationFrameRequest = null;
});
