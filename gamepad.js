import { TARGET_L, TARGET_R } from "./index.js";
import { keydown } from "./keyboard.js";
import { wheel, dispatchTo as wheelDispatchTo } from "./mouse.js";

let onloop = undefined;
let animationFrameRequest = null;

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

function loop() {
  if (!onloop) return;

  const gamepads = navigator.getGamepads();
  const gamepad = gamepads[0];

  onloop(gamepad);

  animationFrameRequest = requestAnimationFrame(loop);
}

function threshold(axis) {
  return Math.abs(axis) >= 0.06 ? axis : 0;
}

export function controlScene(scene) {
  wheelDispatchTo(scene.domElement);

  onloop = (gamepad) => {
    const x1 = threshold(gamepad.axes[0]);
    const y1 = threshold(gamepad.axes[1]);
    const x2 = threshold(gamepad.axes[2]);
    const y2 = threshold(gamepad.axes[3]);
    scene.translateTargetOnAxis(x1, 0, -y1, 0.025);
    scene.translateTargetOnAxis(x2, -y2, 0, 0.025);

    for (let i = 0; i < gamepad.buttons.length; i++) {
      const button = gamepad.buttons[i];
      if (!button.pressed) continue;

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
        case 6:
          wheel(-1 / 2);
          break;
        case 7:
          wheel(1);
          break;
        case 1:
          scene.resetCamera();
          break;

        case 0:
          scene.resetTargets();
          break;
        default:
          console.log(`Button pressed: ${i}`);
      }
    }
  };
}
