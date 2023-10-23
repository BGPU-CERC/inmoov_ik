import * as THREE from "three";
import {
  CCDIKHelper,
  CCDIKSolver,
} from "three/addons/animation/CCDIKSolver.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const renderer = createRenderer();
const { scene, refs } = await createScene("inmoov.glb");
const { camera, cameraControls } = createCamera(renderer);
const { ikHelper, updateIK } = createIKSolver(refs);

[refs.target_l, refs.target_r].forEach((target) => {
  const controls = createTargetControls(target, cameraControls);
  controls.addEventListener("mouseDown", () => (refs.target = target));
  scene.add(controls);
});

scene.add(ikHelper);
document.body.appendChild(renderer.domElement);
renderer.setAnimationLoop(animate);

function createIKSolver(refs) {
  const indexOfLink = (regex) =>
    refs.inmoov.skeleton.bones.findIndex((bone) => bone.name.match(regex));

  const links = {
    head: {
      index: indexOfLink(/head/i),
      rotationMin: new THREE.Vector3(-0.5, -0.5, -0.5),
      rotationMax: new THREE.Vector3(0.5, 0.5, 0.5),
    },
    topstom: {
      index: indexOfLink(/topstom/i),
      rotationMin: new THREE.Vector3(0, 0, -0.3),
      rotationMax: new THREE.Vector3(0, 0, 0.3),
    },
    midstom: {
      index: indexOfLink(/midstom/i),
      rotationMin: new THREE.Vector3(0, -Math.PI / 6, 0),
      rotationMax: new THREE.Vector3(0, Math.PI / 6, 0),
    },
  };

  const iks = [
    {
      target: indexOfLink(/target_l/i),
      effector: indexOfLink(/hand_effector_l/i),
      links: [
        {
          index: indexOfLink(/hand_l/i),
          rotationMin: new THREE.Vector3(0, 0, 0),
          rotationMax: new THREE.Vector3(0, Math.PI, 0),
        },
        {
          index: indexOfLink(/forearm_l/i),
          rotationMin: new THREE.Vector3(-Math.PI / 2, 0, 0),
          rotationMax: new THREE.Vector3(0, 0, 0),
        },
        {
          index: indexOfLink(/shoulder_l/i),
          rotationMin: new THREE.Vector3(0, 0, -Math.PI),
          rotationMax: new THREE.Vector3(Math.PI, Math.PI / 2, 0),
        },
        links.topstom,
        links.midstom,
      ],
    },
    {
      target: indexOfLink(/target_r/i),
      effector: indexOfLink(/hand_effector_r/i),
      links: [
        {
          index: indexOfLink(/hand_r/i),
          rotationMin: new THREE.Vector3(0, -Math.PI, 0),
          rotationMax: new THREE.Vector3(0, 0, 0),
        },
        {
          index: indexOfLink(/forearm_r/i),
          rotationMin: new THREE.Vector3(-Math.PI / 2, 0, 0),
          rotationMax: new THREE.Vector3(0, 0, 0),
        },
        {
          index: indexOfLink(/shoulder_r/i),
          rotationMin: new THREE.Vector3(0, -Math.PI / 2, 0),
          rotationMax: new THREE.Vector3(Math.PI, 0, Math.PI / 2),
        },
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
  function updateIK() {
    ikSolver.update();

    q0.copy(refs.head.quaternion);
    refs.target.getWorldPosition(target);
    refs.head.lookAt(target);
    refs.head.rotation.setFromVector3(
      v0.setFromEuler(refs.head.rotation).max(links.head.rotationMin)
    );
    refs.head.rotation.setFromVector3(
      v0.setFromEuler(refs.head.rotation).min(links.head.rotationMax)
    );
    q1.copy(refs.head.quaternion);
    refs.head.quaternion.slerpQuaternions(q0, q1, 0.1);
  }

  return { ikHelper, ikSolver, updateIK };
}

async function createScene(modelPath) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

  const loader = new GLTFLoader();
  const model = await loader.loadAsync(modelPath);
  scene.add(model.scene);

  const color = 0xffffff;
  const intensity = 3;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(-1, 2, 4);
  scene.add(light);

  const size = 20;
  const divisions = 10;
  const gridHelper = new THREE.GridHelper(size, divisions);
  scene.add(gridHelper);

  const refs = {};

  scene.traverse((n) => {
    if (n.isSkinnedMesh && n.name.match(/midstom/i)) {
      refs.inmoov = n;
    } else if (n.isBone && n.name.match(/target_l/i)) {
      refs.target_l = n;
    } else if (n.isBone && n.name.match(/target_r/i)) {
      refs.target_r = n;
    } else if (n.isBone && n.name.match(/head/i)) {
      refs.head = n;
    }
  });

  refs.target = refs.target_l;

  return { scene, refs };
}

function createCamera(renderer) {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(1, 1, 2);

  const cameraControls = new OrbitControls(camera, renderer.domElement);
  cameraControls.update();

  return { camera, cameraControls };
}

function createTargetControls(target, cameraControls) {
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
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}

function animate() {
  updateIK();
  cameraControls.update();
  renderer.render(scene, camera);
}
