import { TARGET_L, TARGET_R } from "./index.js";

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

export function controlScene(scene) {
  onloop = (gamepad) => {
    const [x1, y1, x2, y2] = gamepad.axes;
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
        case 0:
          location.reload();
          break;
        default:
          console.log(`Button pressed: ${i}`);
      }
    }
  };
}
