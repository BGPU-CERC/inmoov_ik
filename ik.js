import * as THREE from "three";
import {
  CCDIKHelper,
  CCDIKSolver,
} from "three/addons/animation/CCDIKSolver.js";
import { PI, mapLinear } from "./constants.js";
import { refs } from "./refs.js";

const boundsOf = (part, from = 0, to = 1) => {
  return { part, from, to };
};

const indexOfBone = (regex) => {
  return refs.inmoov.skeleton.bones.findIndex((bone) => bone.name.match(regex));
};

export const links = {};
const createLinks = () => ({
  head: {
    index: indexOfBone(/head/i),
    rotationMin: new THREE.Vector3(-0.34, -0.78, -0.17),
    rotationMax: new THREE.Vector3(0.34, 0.78, 0.17),
    rotationMap: {
      x: boundsOf("neck"),
      y: boundsOf("rothead", 1, 0),
      z: boundsOf("rollneck", 0, 1),
    },
  },
  topstom: {
    index: indexOfBone(/topstom/i),
    rotationMin: new THREE.Vector3(0, 0, -0.3),
    rotationMax: new THREE.Vector3(0, 0, 0.3),
    rotationMap: { z: boundsOf("topstom", 1, 0) },
  },
  midstom: {
    index: indexOfBone(/midstom/i),
    rotationMin: new THREE.Vector3(0, -Math.PI / 6, 0),
    rotationMax: new THREE.Vector3(0, Math.PI / 6, 0),
    rotationMap: { y: boundsOf("midstom") },
  },

  hand_l: {
    index: indexOfBone(/hand_l/i),
    rotationMin: new THREE.Vector3(0, 0, 0),
    rotationMax: new THREE.Vector3(0, Math.PI / 2, 0),
    rotationMap: { y: boundsOf("wrist_l") },
  },
  forearm_l: {
    index: indexOfBone(/forearm_l/i),
    rotationMin: new THREE.Vector3(0.4, 0, 0),
    rotationMax: new THREE.Vector3(1.2, 0, 0),
    rotationMap: { x: boundsOf("bicep_l", 1, 0) },
  },
  rotate_l: {
    index: indexOfBone(/rotate_l/i),
    rotationMin: new THREE.Vector3(-PI / 2, 0, -PI / 2),
    rotationMax: new THREE.Vector3(1.5, 0, -PI / 2),
    rotationMap: { x: boundsOf("rotate_l", 1, 0) },
  },
  shoulder_l: {
    index: indexOfBone(/shoulder_l/i),
    rotationMin: new THREE.Vector3(0, 0, PI / 2),
    rotationMax: new THREE.Vector3((5 * PI) / 6, 0, PI / 2),
    rotationMap: { x: boundsOf("shoulder_l", 1, 0) },
  },
  omoplate_l: {
    index: indexOfBone(/omoplate_l/i),
    rotationMin: new THREE.Vector3(0, 0, -PI),
    rotationMinThreshold: new THREE.Vector3(0, 0, -PI + 0.1),
    rotationMax: new THREE.Vector3(0, 0, -(2 * PI) / 3),
    rotationMap: { z: boundsOf("omoplate_l", 0, 1) },
  },

  hand_r: {
    index: indexOfBone(/hand_r/i),
    rotationMin: new THREE.Vector3(0, -Math.PI / 2, 0),
    rotationMax: new THREE.Vector3(0, 0, 0),
    rotationMap: { y: boundsOf("wrist_r", 1, 0) },
  },
  forearm_r: {
    index: indexOfBone(/forearm_r/i),
    rotationMin: new THREE.Vector3(0.4, 0, 0),
    rotationMax: new THREE.Vector3(1.2, 0, 0),
    rotationMap: { x: boundsOf("bicep_r", 1, 0) },
  },
  rotate_r: {
    index: indexOfBone(/rotate_r/i),
    rotationMin: new THREE.Vector3(-PI / 2, 0, PI / 2),
    rotationMax: new THREE.Vector3(1.5, 0, PI / 2),
    rotationMap: { x: boundsOf("rotate_r", 1, 0) },
  },
  shoulder_r: {
    index: indexOfBone(/shoulder_r/i),
    rotationMin: new THREE.Vector3(0, 0, -PI / 2),
    rotationMax: new THREE.Vector3((5 * PI) / 6, 0, -PI / 2),
    rotationMap: { x: boundsOf("shoulder_r", 1, 0) },
  },
  omoplate_r: {
    index: indexOfBone(/omoplate_r/i),
    rotationMin: new THREE.Vector3(0, 0, (2 * PI) / 3),
    rotationMax: new THREE.Vector3(0, 0, PI),
    rotationMaxThreshold: new THREE.Vector3(0, 0, PI - 0.1),
    rotationMap: { z: boundsOf("omoplate_r", 1, 0) },
  },
});

export function createIKSolver() {
  Object.assign(links, createLinks());

  const iks = [
    {
      target: indexOfBone(/target_l/i),
      effector: indexOfBone(/hand_effector_l/i),
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
      target: indexOfBone(/target_r/i),
      effector: indexOfBone(/hand_effector_r/i),
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
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion();

  function updateIK() {
    ikSolver.update();

    q0.copy(refs.head.quaternion);
    refs.target.getWorldPosition(target);
    refs.head.lookAt(target);
    refs.head.rotation.clamp(links.head.rotationMin, links.head.rotationMax);
    q1.copy(refs.head.quaternion);
    refs.head.quaternion.slerpQuaternions(q0, q1, 0.1); // fixme: infinite slerp

    refs.neck_plate_bottom.rotation.copy(refs.head.rotation);
    refs.neck_plate_bottom.rotation.y = 0;

    refs.omoplate_l.rotation.clamp(
      links.omoplate_l.rotationMinThreshold,
      links.omoplate_l.rotationMax
    );
    refs.omoplate_r.rotation.clamp(
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
