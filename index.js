import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CCDIKSolver } from "three/addons/animation/CCDIKSolver.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc);
scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

const camera = new THREE.OrthographicCamera();
camera.position.set(0, 0, 10);
camera.zoom = 0.05;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const loader = new GLTFLoader();
const gltf = await loader.loadAsync("test.glb");
scene.add(gltf.scene);

let OOI = {};

gltf.scene.traverse((n) => {
  if (n.name === "Cube") {
    OOI.mesh = n;
  }

  if (n.name.endsWith("_target")) {
    OOI.target = n;
  }
});

const iks = [
  {
    target: 4,
    effector: 3,
    links: [
      {
        index: 2,
        rotationMin: new THREE.Vector3(0, 0, 0),
        rotationMax: new THREE.Vector3(0, 0, 1),
      },
      {
        index: 1,
        rotationMin: new THREE.Vector3(0, 0, 0),
        rotationMax: new THREE.Vector3(0, 0, 1),
      },
      {
        index: 0,
        rotationMin: new THREE.Vector3(0, 0, 0),
        rotationMax: new THREE.Vector3(0, 0, 1),
      },
    ],
  },
];

const ikSolver = new CCDIKSolver(OOI.mesh, iks);
const ikHelper = ikSolver.createHelper();
scene.add(ikHelper);

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.size = 0.75;
transformControls.showX = true;
transformControls.showY = true;
transformControls.showZ = true;
transformControls.space = "world";
transformControls.attach(OOI.target);
scene.add(transformControls);

// disable orbitControls while using transformControls
const setControls = (state) => (controls.enabled = state);
transformControls.addEventListener("mouseDown", () => setControls(false));
transformControls.addEventListener("mouseUp", () => setControls(true));

const light = new THREE.AmbientLight(0x404040);
scene.add(light);

const size = 20;
const divisions = 10;
const gridHelper = new THREE.GridHelper(size, divisions);
scene.add(gridHelper);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  ikSolver.update();
  renderer.render(scene, camera);
}

animate();
