import * as THREE from "three";
import { debounce } from "./debounce.js";
import {
  CCDIKHelper,
  CCDIKSolver,
} from "three/addons/animation/CCDIKSolver.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PI = Math.PI;

export const mapLinear = THREE.MathUtils.mapLinear;
export const TARGET_L = 0;
export const TARGET_R = 1;

export async function init(sceneContainerSelector, modelPath) {
  const renderer = createRenderer();
  const { scene, refs, resetTargets } = await createScene(modelPath);
  const { camera, cameraControls } = createCamera(renderer);
  const { ikHelper, updateIK, getRotationMap } = createIKSolver(refs);
  scene.add(ikHelper);

  [refs.target_l, refs.target_r].forEach((target) => {
    const args = [target, renderer, camera, cameraControls];
    const controls = createTargetControls(...args);
    controls.addEventListener("mouseDown", () => (refs.target = target));
    controls.addEventListener("objectChange", () => clamp(target));
    scene.add(controls);
  });

  renderer.setAnimationLoop(function animate() {
    updateIK();
    cameraControls.update();
    renderer.render(scene, camera);
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
    cameraControls.update();
    renderer.render(scene, camera);
  });

  const targetPosMin = new THREE.Vector3(-5, -2, -5);
  const targetPosMax = new THREE.Vector3(5, 5, 5);
  function clamp(object) {
    object.position.clamp(targetPosMin, targetPosMax);
  }

  const translateAxis = new THREE.Vector3();
  function translateOnAxis(object, x, y, z, distance) {
    translateAxis.set(z, y, x);
    object.translateOnAxis(translateAxis, distance);
    clamp(object);
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

  function idleTick() {
    const rand = () => (Math.random() - 0.5) / 2.5;
    translateOnAxis(refs.target_l, rand(), rand(), rand(), rand());
    translateOnAxis(refs.target_r, rand(), rand(), rand(), rand());
    translateOnAxis(refs.target_head, rand(), rand(), rand(), rand());
  }

  let idleInterval = null;
  let toggleIdle = debounce(() => {
    if (idleInterval) {
      clearInterval(idleInterval);
      idleInterval = null;
    } else {
      idleInterval = setInterval(idleTick, 0.8 * 1000);
    }
  }, 0.5 * 1000);

  function handGrab(hand, target, value) {
    value = Number(value.toFixed(2));
    for (const part in hand.parts) {
      const finger = hand.parts[part];
      finger.rotationValue = value;
      for (const phalanx of finger) {
        const { from, to, axis } = phalanx.rotationMap;
        const rotation = mapLinear(value, 0, 1, from, to);
        phalanx.rotation[axis] = rotation;
      }
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

  return {
    domElement: renderer.domElement,

    getRotationMap,
    translateOnAxis,
    translateTargetOnAxis,
    setTarget,
    resetTargets,
    resetCamera: cameraControls.reset,

    toggleIdle,

    target_head: refs.target_head,
    target_l: refs.target_l,
    target_r: refs.target_r,

    handGrabLeft,
    handGrabRight,
  };
}

function createIKSolver(refs) {
  const indexOfLink = (regex) =>
    refs.inmoov.skeleton.bones.findIndex((bone) => bone.name.match(regex));

  const rotationMapOf = (part, from = 0, to = 1) => ({ part, from, to });

  const links = {
    head: {
      index: indexOfLink(/head/i),
      rotationMin: new THREE.Vector3(-0.5, -1.1, -0.5),
      rotationMax: new THREE.Vector3(0.5, 1.1, 0.5),
      rotationMap: {
        x: rotationMapOf("neck"),
        y: rotationMapOf("rothead", 1, 0),
        z: rotationMapOf("rollneck", 0, 1),
      },
    },
    topstom: {
      index: indexOfLink(/topstom/i),
      rotationMin: new THREE.Vector3(0, 0, -0.3),
      rotationMax: new THREE.Vector3(0, 0, 0.3),
      rotationMap: { z: rotationMapOf("topstom", 1, 0) },
    },
    midstom: {
      index: indexOfLink(/midstom/i),
      rotationMin: new THREE.Vector3(0, -Math.PI / 6, 0),
      rotationMax: new THREE.Vector3(0, Math.PI / 6, 0),
      rotationMap: { y: rotationMapOf("midstom") },
    },

    hand_l: {
      index: indexOfLink(/hand_l/i),
      rotationMin: new THREE.Vector3(0, 0, 0),
      rotationMax: new THREE.Vector3(0, Math.PI / 2, 0),
      rotationMap: { y: rotationMapOf("wrist_l") },
    },
    forearm_l: {
      index: indexOfLink(/forearm_l/i),
      rotationMin: new THREE.Vector3(0.4, 0, 0),
      rotationMax: new THREE.Vector3(1.2, 0, 0),
      rotationMap: { x: rotationMapOf("bicep_l", 1, 0) },
    },
    rotate_l: {
      index: indexOfLink(/rotate_l/i),
      rotationMin: new THREE.Vector3(-PI / 2, 0, -PI / 2),
      rotationMax: new THREE.Vector3(1.5, 0, -PI / 2),
      rotationMap: { x: rotationMapOf("rotate_l", 1, 0) },
    },
    shoulder_l: {
      index: indexOfLink(/shoulder_l/i),
      rotationMin: new THREE.Vector3(0, 0, PI / 2),
      rotationMax: new THREE.Vector3((5 * PI) / 6, 0, PI / 2),
      rotationMap: { x: rotationMapOf("shoulder_l", 1, 0) },
    },
    omoplate_l: {
      index: indexOfLink(/omoplate_l/i),
      rotationMin: new THREE.Vector3(0, 0, -PI),
      rotationMinThreshold: new THREE.Vector3(0, 0, -PI + 0.1),
      rotationMax: new THREE.Vector3(0, 0, -(2 * PI) / 3),
      rotationMap: { z: rotationMapOf("omoplate_l", 0, 1) },
    },

    hand_r: {
      index: indexOfLink(/hand_r/i),
      rotationMin: new THREE.Vector3(0, -Math.PI / 2, 0),
      rotationMax: new THREE.Vector3(0, 0, 0),
      rotationMap: { y: rotationMapOf("wrist_r", 1, 0) },
    },
    forearm_r: {
      index: indexOfLink(/forearm_r/i),
      rotationMin: new THREE.Vector3(0.4, 0, 0),
      rotationMax: new THREE.Vector3(1.2, 0, 0),
      rotationMap: { x: rotationMapOf("bicep_r", 1, 0) },
    },
    rotate_r: {
      index: indexOfLink(/rotate_r/i),
      rotationMin: new THREE.Vector3(-PI / 2, 0, PI / 2),
      rotationMax: new THREE.Vector3(1.5, 0, PI / 2),
      rotationMap: { x: rotationMapOf("rotate_r", 1, 0) },
    },
    shoulder_r: {
      index: indexOfLink(/shoulder_r/i),
      rotationMin: new THREE.Vector3(0, 0, -PI / 2),
      rotationMax: new THREE.Vector3((5 * PI) / 6, 0, -PI / 2),
      rotationMap: { x: rotationMapOf("shoulder_r", 1, 0) },
    },
    omoplate_r: {
      index: indexOfLink(/omoplate_r/i),
      rotationMin: new THREE.Vector3(0, 0, (2 * PI) / 3),
      rotationMax: new THREE.Vector3(0, 0, PI),
      rotationMaxThreshold: new THREE.Vector3(0, 0, PI - 0.1),
      rotationMap: { z: rotationMapOf("omoplate_r", 1, 0) },
    },
  };

  const iks = [
    {
      target: indexOfLink(/target_l/i),
      effector: indexOfLink(/hand_effector_l/i),
      links: [
        links.hand_l,
        links.forearm_l,
        links.rotate_l,
        links.shoulder_l,
        links.omoplate_l,
        links.topstom,
        links.midstom,
      ],
    },
    {
      target: indexOfLink(/target_r/i),
      effector: indexOfLink(/hand_effector_r/i),
      links: [
        links.hand_r,
        links.forearm_r,
        links.rotate_r,
        links.shoulder_r,
        links.omoplate_r,
        links.topstom,
        links.midstom,
      ],
    },
  ];

  const ikSolver = new CCDIKSolver(refs.inmoov, iks);
  const ikHelper = new CCDIKHelper(refs.inmoov, iks, 0.01);

  const target = new THREE.Vector3();
  const v0 = new THREE.Vector3();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion();

  function clamp(euler, min, max) {
    euler.setFromVector3(v0.setFromEuler(euler).clamp(min, max));
  }

  function updateIK() {
    ikSolver.update();

    q0.copy(refs.head.quaternion);
    refs.target.getWorldPosition(target);
    refs.head.lookAt(target);
    clamp(refs.head.rotation, links.head.rotationMin, links.head.rotationMax);
    q1.copy(refs.head.quaternion);
    refs.head.quaternion.slerpQuaternions(q0, q1, 0.1); // fixme: infinite slerp

    clamp(
      refs.omoplate_l.rotation,
      links.omoplate_l.rotationMinThreshold,
      links.omoplate_l.rotationMax
    );
    clamp(
      refs.omoplate_r.rotation,
      links.omoplate_r.rotationMin,
      links.omoplate_r.rotationMaxThreshold
    );
  }

  const rotationMap = {};
  function getRotationMap() {
    for (const key in links) {
      const link = links[key];
      const bone = refs.inmoov.skeleton.bones[link.index];
      for (const axis in link.rotationMap) {
        const { part, from, to } = link.rotationMap[axis];
        rotationMap[part] = Number(
          mapLinear(
            bone.rotation[axis],
            link.rotationMin[axis],
            link.rotationMax[axis],
            from,
            to
          ).toFixed(2)
        );
      }
    }

    for (const side in refs.hands) {
      const hand = refs.hands[side];
      for (const part_name in hand.parts) {
        const part = hand.parts[part_name];
        rotationMap[part_name] = part.rotationValue;
      }
    }

    return rotationMap;
  }

  return { ikHelper, ikSolver, updateIK, getRotationMap };
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
      l: { parts: {} },
      r: { parts: {} },
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
    } else if ((match = n.name.match(/^f_(\w+)_(\d)_(l|r)$/)) !== null) {
      const [phalanx, finger, phalanx_number, side] = match;
      const hand = refs.hands[side];
      const part = `${finger}_${side}`;
      hand.parts[part] =
        hand.parts[part] || Object.assign([], { rotationValue: 0 });
      hand.parts[part][phalanx_number] = n;
      hand.parts[part][phalanx_number].rotationMap = {
        axis: "x",
        from: 0,
        to: -PI / 2,
      };

      if (n.name.match(/thumb_0/)) {
        Object.assign(hand.parts[part][phalanx_number].rotationMap, {
          axis: "y",
          from: PI / 4,
          to: -PI / 12,
        });
      } else if (n.name.match(/thumb_1/)) {
        Object.assign(hand.parts[part][phalanx_number].rotationMap, {
          from: 0,
          to: PI / 2,
        });
      }
    }
  });

  refs.target_head = new THREE.Object3D();
  refs.target_head.position.set(0, 0.55, 1);
  refs.target = refs.target_head;

  [refs.target_l, refs.target_r].forEach(
    (target) => (target.rest = new THREE.Vector3().copy(target.position))
  );

  function resetTargets() {
    refs.target = refs.target_head;
    [refs.target_l, refs.target_r].forEach((target) =>
      target.position.copy(target.rest)
    );
  }

  return { scene, refs, resetTargets };
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
  document.addEventListener("mousedown", () => {
    cameraControls.rotateSpeed = 1;
    cameraControls.zoomSpeed = 1;
  });
  document.addEventListener("mouseup", () => {
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
