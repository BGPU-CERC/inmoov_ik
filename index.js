import * as THREE from "three";
import {
  CCDIKHelper,
  CCDIKSolver,
} from "three/addons/animation/CCDIKSolver.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc);
scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

const camera = new THREE.OrthographicCamera();
camera.position.set(0, 0, 10);
camera.zoom = 0.5;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const loader = new GLTFLoader();
const gltf = await loader.loadAsync("inmoov.glb");
scene.add(gltf.scene);

let refs = {};

gltf.scene.traverse((n) => {
  if (n.isSkinnedMesh && n.name.match(/shoulder_l/i)) {
    refs.mesh = n;
  }

  if (n.isBone && n.name.match(/target_l/i)) {
    refs.target = n;
  }
});

const indexOfLink = (regex) =>
  refs.mesh.skeleton.bones.findIndex((bone) => bone.name.match(regex));

const iks = [
  {
    target: indexOfLink(/target_l/i),
    effector: indexOfLink(/hand_l/i),
    links: [
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
    ],
  },
];

const ikSolver = new CCDIKSolver(refs.mesh, iks);
const ikHelper = new CCDIKHelper(refs.mesh, iks, 0.01);
scene.add(ikHelper);

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.size = 0.75;
transformControls.showX = true;
transformControls.showY = true;
transformControls.showZ = true;
transformControls.space = "world";
transformControls.attach(refs.target);
scene.add(transformControls);

// disable orbitControls while using transformControls
const setControls = (state) => (controls.enabled = state);
transformControls.addEventListener("mouseDown", () => setControls(false));
transformControls.addEventListener("mouseUp", () => setControls(true));

const light = new THREE.AmbientLight(0xffffff, 5);
scene.add(light);

const size = 20;
const divisions = 10;
const gridHelper = new THREE.GridHelper(size, divisions);
scene.add(gridHelper);

function animate() {
  controls.update();
  ikSolver.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
