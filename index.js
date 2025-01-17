import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PI, TARGET_L, TARGET_R, mapLinear } from "./constants.js";
import { debounce } from "./debounce.js";
import { createIKSolver } from "./ik.js";

export async function init(sceneContainerSelector, modelPath) {
  const renderer = createRenderer();
  const { scene, refs } = await createScene(modelPath);
  const { camera, cameraControls } = createCamera(renderer);
  const { updateIK, getRotationMap } = createIKSolver(refs);

  [refs.target_l, refs.target_r].forEach((target) => {
    const args = [target, renderer, camera, cameraControls];
    const controls = createTargetControls(...args);
    controls.addEventListener("mouseDown", () => (refs.target = target));
    scene.add(controls.getHelper());
  });

  const sceneContainer = document.querySelector(sceneContainerSelector);
  sceneContainer.replaceChildren(renderer.domElement);

  const resizeObserver = new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    const height = Math.round(entry.contentRect.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  resizeObserver.observe(sceneContainer);

  renderer.setAnimationLoop(function animate() {
    updateIK();
    renderer.render(scene, camera);
  });

  const translateAxis = new THREE.Vector3();
  function translateOnAxis(object, x, y, z, distance) {
    translateAxis.set(z, y, x);
    object.translateOnAxis(translateAxis, distance);
  }

  function translateTargetOnAxis(x, y, z, distance) {
    translateOnAxis(refs.target, x, y, z, distance);
  }

  function setTarget(targetId) {
    switch (targetId) {
      case TARGET_L:
        refs.target = refs.target = refs.target_l;
        break;
      case TARGET_R:
        refs.target = refs.target = refs.target_r;
        break;
      default:
        console.log(targetId);
    }
  }

  function fingerGrab(hand, fingerIndex, value) {
    const finger = hand.fingers[fingerIndex];
    finger.rotationValue = value;
    for (const phalanx of finger) {
      const { from, to, axis } = phalanx.rotationMap;
      const rotation = mapLinear(value, 0, 1, from, to);
      phalanx.rotation[axis] = rotation;
    }
  }

  function handGrab(hand, target, value) {
    value = Number(value.toFixed(2));
    for (let i = 0; i < hand.fingers.length; i++) {
      fingerGrab(hand, i, value);
    }
    const target_scale = 1 - value / 3;
    target.scale.set(target_scale, target_scale, target_scale);
  }

  let handRelease = debounce(
    (hand, target) => handGrab(hand, target, 0),
    0.1 * 1000
  );

  function handGrabLeft(value) {
    handGrab(refs.hands.l, refs.target_l, value);
    handRelease(refs.hands.l, refs.target_l);
  }

  function handGrabRight(value) {
    handGrab(refs.hands.r, refs.target_r, value);
    handRelease(refs.hands.r, refs.target_r);
  }

  async function resetTargets() {
    cameraControls.reset();
    refs.target = refs.target_head;
    [refs.target_l, refs.target_r].forEach((target) => {
      target.position.copy(target.rest);
    });
    await new Promise((r) => setTimeout(r, 50));
    refs.inmoov.skeleton.bones.forEach((bone) => {
      bone.rotation.copy(bone.userData.rotation_default);
    });
  }

  return {
    domElement: renderer.domElement,
    renderer,
    refs,

    getRotationMap,
    translateOnAxis,
    translateTargetOnAxis,
    setTarget,
    resetTargets,

    resetCamera: cameraControls.reset,
    cameraControls,
    camera,

    target_head: refs.target_head,
    target_l: refs.target_l,
    target_r: refs.target_r,

    fingerGrab,
    handGrabLeft,
    handGrabRight,
  };
}

async function createScene(modelPath) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

  const loader = new GLTFLoader();
  const model = await loader.loadAsync(modelPath);
  scene.add(model.scene);

  scene.background = new THREE.Color(0xd4e4ff);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.set(-1, 1.75, 1);
  dirLight.position.multiplyScalar(30);
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
  hemiLight.color.setHSL(0.6, 1, 0.6);
  hemiLight.groundColor.setHSL(0.095, 1, 0.75);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const size = 20;
  const divisions = 10;
  const gridHelper = new THREE.GridHelper(size, divisions, 0x0000ff, 0xb0b0b0);
  gridHelper.position.y = -0.5;
  scene.add(gridHelper);

  const refs = {
    hands: {
      l: { fingers: [] },
      r: { fingers: [] },
    },
  };

  scene.traverse((n) => {
    let match;

    if (n.isSkinnedMesh && n.name.match(/midstom/i)) {
      refs.inmoov = n;
      n.visible = false;
    } else if (n.isBone && n.name.match(/target_l/i)) {
      refs.target_l = n;
    } else if (n.isBone && n.name.match(/target_r/i)) {
      refs.target_r = n;
    } else if (n.isBone && n.name.match(/head/i)) {
      refs.head = n;
    } else if (n.isBone && n.name.match(/omoplate_l/i)) {
      refs.omoplate_l = n;
    } else if (n.isBone && n.name.match(/omoplate_r/i)) {
      refs.omoplate_r = n;
    } else if (n.name.match(/neck_plate_bottom/i)) {
      refs.neck_plate_bottom = n;
    } else if ((match = n.name.match(/^f_(\w+)_(\d)_(l|r)$/)) !== null) {
      const [phalanx, fingerName, phalanx_number, side] = match;
      const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];
      const fingerIndex = fingerNames.indexOf(fingerName);
      const hand = refs.hands[side];

      hand.fingers[fingerIndex] =
        hand.fingers[fingerIndex] ||
        Object.assign([], {
          rotationValue: 0,
          fullname: fingerName + "_" + side,
        });

      hand.fingers[fingerIndex][phalanx_number] = n;
      hand.fingers[fingerIndex][phalanx_number].rotationMap = {
        axis: "x",
        from: 0,
        to: -PI / 2,
      };

      if (n.name.match(/thumb_0/)) {
        Object.assign(hand.fingers[fingerIndex][phalanx_number].rotationMap, {
          axis: "y",
          from: PI / 4,
          to: -PI / 12,
        });
      } else if (n.name.match(/thumb_1/)) {
        Object.assign(hand.fingers[fingerIndex][phalanx_number].rotationMap, {
          from: 0,
          to: PI / 2,
        });
      }
    }
  });

  refs.inmoov.skeleton.bones.forEach((bone) => {
    if (bone.name.match("forearm")) bone.rotation.x = 0.4;
    else if (bone.name.match("hand_r")) bone.rotation.y = -1;
    else if (bone.name.match("hand_l")) bone.rotation.y = 1;
    bone.userData.rotation_default = bone.rotation.clone();
  });

  refs.target_head = new THREE.Object3D();
  refs.target_head.position.set(0, 0.55, 1);
  refs.target = refs.target_head;

  [refs.target_l, refs.target_r].forEach(
    (target) => (target.rest = new THREE.Vector3().copy(target.position))
  );

  return { scene, refs };
}

function createCamera(renderer) {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(0, 0.5, 1.3);

  const cameraControls = new OrbitControls(camera, renderer.domElement);
  cameraControls.target.copy(new THREE.Vector3(0, 0.25, 0));
  cameraControls.update();
  cameraControls.listenToKeyEvents(window);
  cameraControls.saveState();

  const zoomSpeed = 0.5;
  cameraControls.zoomSpeed = zoomSpeed;
  const rotateSpeed = 5;
  cameraControls.rotateSpeed = rotateSpeed;
  document.addEventListener("pointerdown", () => {
    cameraControls.rotateSpeed = 1;
    cameraControls.zoomSpeed = 1;
  });
  document.addEventListener("pointerup", () => {
    cameraControls.rotateSpeed = rotateSpeed;
    cameraControls.zoomSpeed = zoomSpeed;
  });

  return { camera, cameraControls };
}

function createTargetControls(target, renderer, camera, cameraControls) {
  const targetControls = new TransformControls(camera, renderer.domElement);
  targetControls.size = 0.5;
  targetControls.showX = true;
  targetControls.showY = true;
  targetControls.showZ = true;
  targetControls.space = "world";
  targetControls.attach(target);

  const setCamEnabled = (state) => (state = cameraControls.enabled = state);
  targetControls.addEventListener("mouseDown", () => setCamEnabled(false));
  targetControls.addEventListener("mouseUp", () => setCamEnabled(true));

  return targetControls;
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}
