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
const { ikHelper, ikSolver } = createIKSolver(refs.inmoov);

[refs.target_l].forEach((target) => {
  const controls = createTargetControls(target, cameraControls);
  scene.add(controls);
});

scene.add(ikHelper);
document.body.appendChild(renderer.domElement);
renderer.setAnimationLoop(animate);

function createIKSolver(mesh) {
  const indexOfLink = (regex) =>
    mesh.skeleton.bones.findIndex((bone) => bone.name.match(regex));

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
        {
          index: indexOfLink(/topstom/i),
          rotationMin: new THREE.Vector3(0, 0, -Math.PI / 6),
          rotationMax: new THREE.Vector3(0, 0, Math.PI / 6),
        },
        {
          index: indexOfLink(/midstom/i),
          rotationMin: new THREE.Vector3(0, -Math.PI / 6, 0),
          rotationMax: new THREE.Vector3(0, Math.PI / 6, 0),
        },
      ],
    },
  ];

  const ikSolver = new CCDIKSolver(mesh, iks);
  const ikHelper = new CCDIKHelper(mesh, iks, 0.01);

  return { ikHelper, ikSolver };
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
    if (n.isSkinnedMesh && n.name.match(/shoulder_l/i)) {
      refs.inmoov = n;
    }

    if (n.isBone && n.name.match(/target_l/i)) {
      refs.target_l = n;
    }
  });

  return { scene, refs };
}

function createCamera(renderer) {
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 0, 10);
  camera.zoom = 0.5;
  camera.updateProjectionMatrix();

  const cameraControls = new OrbitControls(camera, renderer.domElement);
  cameraControls.update();

  return { camera, cameraControls };
}

function createTargetControls(target, cameraControls) {
  const targetControls = new TransformControls(camera, renderer.domElement);
  targetControls.size = 0.75;
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
  cameraControls.update();
  ikSolver.update();
  renderer.render(scene, camera);
}
