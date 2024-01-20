import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Gyroscope } from "three/addons/misc/Gyroscope.js";
import { PI } from "./constants.js";
import { handGrabLeft, handGrabRight } from "./grab.js";
import { createIKSolver } from "./ik.js";
import "./injection.js";
import {
  createJoints,
  createPointCloud,
  listenPointsStream,
} from "./point_cloud.js";
import { init_pose_mirror, mirrorPose } from "./pose_mirror.js";
import { refs } from "./refs.js";

export async function init(sceneContainerSelector, modelPath) {
  const renderer = createRenderer();
  const { scene, resetTargets } = await createScene(modelPath);
  const { camera, cameraControls, cameraPosDefault } = createCamera(renderer);
  const { ikHelper, updateIK, getRotationMap } = createIKSolver();

  [refs.target_l, refs.target_r].forEach((target) => {
    const args = [target, renderer, camera, cameraControls];
    const controls = createTargetControls(...args);
    controls.addEventListener("mouseDown", () => (refs.target = target));
    controls.addEventListener("objectChange", () => clamp(target));
    scene.add(controls);
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

  let animationFn = animateIk;
  renderer.setAnimationLoop(animationFn);
  window.removeEventListener("keydown", switchAnimationFn);
  window.addEventListener("keydown", switchAnimationFn);
  init_pose_mirror();

  function switchAnimationFn(e) {
    if (e.key !== "m") return;

    let nextAnimationFn;
    switch (animationFn) {
      case animateIk:
        nextAnimationFn = animateMirrorPose;
        camera.position.set(1, 2, -1.5);
        break;
      default:
        nextAnimationFn = animateIk;
        camera.position.set(...cameraPosDefault);
        break;
    }

    animationFn = nextAnimationFn;
    renderer.setAnimationLoop(animationFn);
  }

  function animateBase() {
    cameraControls.update();
    renderer.render(scene, camera);
  }

  function animateIk() {
    updateIK();
    animateBase();
  }

  function animateMirrorPose() {
    mirrorPose();
    animateBase();
  }

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

  return {
    domElement: renderer.domElement,

    getRotationMap,
    translateOnAxis,
    translateTargetOnAxis,
    setTarget,
    resetTargets,
    resetCamera: cameraControls.reset,

    target_head: refs.target_head,
    target_l: refs.target_l,
    target_r: refs.target_r,

    handGrabLeft,
    handGrabRight,

    listenPointsStream,
  };
}

async function createScene(modelPath) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd4e4ff);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

  const loader = new GLTFLoader();
  const model = await loader.loadAsync(modelPath);
  scene.add(model.scene);

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
    } else if (n.name.match(/^orbbec$/i)) {
      refs.orbbec = n;

      refs.gyro = new Gyroscope();
      refs.orbbec.add(refs.gyro);

      refs.points = createPointCloud(35_000);
      refs.points.visible = false;
      refs.gyro.add(refs.points);

      refs.joints = createJoints();
      refs.joints.forEach((joint) => refs.gyro.add(joint));
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

  [refs.target_l, refs.target_r].forEach((target) => {
    target.rest = new THREE.Vector3().copy(target.position);
  });

  function resetTargets() {
    refs.target = refs.target_head;
    [refs.target_l, refs.target_r].forEach((target) =>
      target.position.copy(target.rest)
    );
  }

  return { scene, resetTargets };
}

function createCamera(renderer) {
  const aspect = window.innerWidth / window.innerHeight;
  const cameraPosDefault = [0, 0.5, 1.3];
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(...cameraPosDefault);

  const cameraControls = new OrbitControls(camera, renderer.domElement);
  cameraControls.target.copy(new THREE.Vector3(0, 0.25, 0));
  cameraControls.update();
  cameraControls.listenToKeyEvents(window);
  cameraControls.saveState();

  const zoomSpeed = 0.5;
  cameraControls.zoomSpeed = zoomSpeed;
  const rotateSpeed = 5;
  cameraControls.rotateSpeed = rotateSpeed;
  // todo: remove old event listeners on each init
  document.addEventListener("mousedown", () => {
    cameraControls.rotateSpeed = 1;
    cameraControls.zoomSpeed = 1;
  });
  document.addEventListener("mouseup", () => {
    cameraControls.rotateSpeed = rotateSpeed;
    cameraControls.zoomSpeed = zoomSpeed;
  });

  return { camera, cameraControls, cameraPosDefault };
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
