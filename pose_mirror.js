import * as THREE from "three";
import { handGrabLeft, handGrabRight } from "./grab.js";
import { links } from "./ik.js";
import { HandPose, JointType, poses } from "./point_cloud.js";
import { refs } from "./refs.js";

let joints;
let jointBaseSpine;
let config;
export function init_pose_mirror() {
  joints = refs.joints;
  jointBaseSpine = joints[JointType.BaseSpine];
  config = [
    [
      joints[JointType.LeftShoulder],
      joints[JointType.LeftElbow],
      joints[JointType.LeftHand],
      { link: links.omoplate_r, angle_min: 0.2, angle_max: 0.08 },
      { link: links.shoulder_r, angle_min: 0.6, angle_max: 2.8 },
      { link: links.rotate_r, angle_min: 2.8, angle_max: 0.5 },
      { link: links.forearm_r, angle_min: 2.6, angle_max: 1.8 },
      [0, 1],
      0.25,
    ],
    [
      joints[JointType.RightShoulder],
      joints[JointType.RightElbow],
      joints[JointType.RightHand],
      { link: links.omoplate_l, angle_min: 0.08, angle_max: 0.2 },
      { link: links.shoulder_l, angle_min: 0.6, angle_max: 2.8 },
      { link: links.rotate_l, angle_min: 0.5, angle_max: 2.8 },
      { link: links.forearm_l, angle_min: 2.6, angle_max: 1.8 },
      [1, 0],
      -0.25,
    ],
  ];
}

const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const getAngle = (a, b, base, axis) => {
  v0.copy(a).sub(base);
  v1.copy(b).sub(base);
  v0[axis] = 0;
  v1[axis] = 0;
  return v0.angleTo(v1);
};

let a;
let b;
let base;
let axis_from;
let axis_to;
let angle;
let part;
let bone;
export function mirrorPose() {
  config.forEach(
    ([
      jointShoulder,
      jointElbow,
      jointHand,
      partOmoplate,
      partShoulder,
      partRotate,
      partForearm,
      shoulderWeightRange,
      rotateOffset,
    ]) => {
      a = jointBaseSpine.position;
      b = jointElbow.position;
      base = jointShoulder.position;
      axis_from = "any";
      axis_to = "x";
      angle = getAngle(a, b, base, axis_from);
      part = partShoulder;
      bone = refs.inmoov.skeleton.bones[part.link.index];
      bone.rotation[axis_to] = angle.map(
        part.angle_min,
        part.angle_max,
        part.link.rotationMin[axis_to],
        part.link.rotationMax[axis_to]
      );

      a = new THREE.Vector3(0, 0, 1).add(jointShoulder.position);
      b = new THREE.Vector3(0, 0, 1).add(jointElbow.position);
      base = jointShoulder.position;
      axis_from = "y";
      axis_to = "z";
      angle = getAngle(a, b, base, axis_from);
      part = partOmoplate;
      bone = refs.inmoov.skeleton.bones[part.link.index];
      bone.rotation[axis_to] = angle.map(
        part.angle_min,
        part.angle_max,
        part.link.rotationMin[axis_to],
        part.link.rotationMax[axis_to]
      );

      const shoulderWeight = angle
        .map(
          part.angle_min,
          part.angle_max,
          shoulderWeightRange[0],
          shoulderWeightRange[1]
        )
        .clamp(shoulderWeightRange[0], shoulderWeightRange[1]);
      part = partShoulder;
      bone = refs.inmoov.skeleton.bones[part.link.index];
      bone.rotation["x"] *= shoulderWeight;

      a = jointShoulder.position;
      b = jointHand.position;
      base = jointElbow.position;
      axis_from = "any";
      axis_to = "x";
      angle = getAngle(a, b, base, axis_from);
      part = partForearm;
      bone = refs.inmoov.skeleton.bones[part.link.index];
      bone.rotation[axis_to] = angle.map(
        part.angle_min,
        part.angle_max,
        part.link.rotationMin[axis_to],
        part.link.rotationMax[axis_to]
      );

      let normal = new THREE.Vector3();
      let triangle = new THREE.Triangle(
        jointShoulder.position,
        jointElbow.position,
        jointHand.position
      );
      triangle.getNormal(normal);
      part = partShoulder;
      bone = refs.inmoov.skeleton.bones[part.link.index];
      angle =
        normal.angleTo(new THREE.Vector3(0, 0, 1).applyEuler(bone.rotation)) +
        rotateOffset;
      part = partRotate;
      bone = refs.inmoov.skeleton.bones[part.link.index];
      bone.rotation[axis_to] = angle.map(
        part.angle_min,
        part.angle_max,
        part.link.rotationMin[axis_to],
        part.link.rotationMax[axis_to]
      );
    }
  );

  a = joints[JointType.ShoulderSpine].position;
  b = new THREE.Vector3(1, 0, 0).add(joints[JointType.BaseSpine].position);
  base = joints[JointType.BaseSpine].position;
  axis_from = "z";
  axis_to = "z";
  angle = getAngle(a, b, base, axis_from);
  part = { link: links.topstom, angle_min: 1.2, angle_max: 1.8 };
  bone = refs.inmoov.skeleton.bones[part.link.index];
  bone.rotation[axis_to] = angle.map(
    part.angle_min,
    part.angle_max,
    part.link.rotationMin[axis_to],
    part.link.rotationMax[axis_to]
  );

  a = joints[JointType.Head].position;
  b = new THREE.Vector3(1, 0, 0).add(joints[JointType.ShoulderSpine].position);
  base = joints[JointType.ShoulderSpine].position;
  axis_from = "z";
  axis_to = "z";
  angle = getAngle(a, b, base, axis_from);
  part = { link: links.head, angle_min: 1.5, angle_max: 1.75 };
  bone = refs.inmoov.skeleton.bones[part.link.index];
  bone.rotation[axis_to] = angle.map(
    part.angle_min,
    part.angle_max,
    part.link.rotationMin[axis_to],
    part.link.rotationMax[axis_to]
  );

  a = joints[JointType.Head].position;
  b = new THREE.Vector3(0, 0, 1).add(joints[JointType.ShoulderSpine].position);
  base = joints[JointType.ShoulderSpine].position;
  axis_from = "x";
  axis_to = "x";
  angle = getAngle(a, b, base, axis_from);
  part = { link: links.head, angle_min: 1.3, angle_max: 1.75 };
  bone = refs.inmoov.skeleton.bones[part.link.index];
  bone.rotation[axis_to] = angle.map(
    part.angle_min,
    part.angle_max,
    part.link.rotationMin[axis_to],
    part.link.rotationMax[axis_to]
  );

  a = joints[JointType.LeftShoulder].position;
  b = new THREE.Vector3(0, 0, 1).add(joints[JointType.ShoulderSpine].position);
  base = joints[JointType.ShoulderSpine].position;
  axis_from = "y";
  axis_to = "y";
  angle = getAngle(a, b, base, axis_from);
  part = { link: links.head, angle_min: 3, angle_max: 0 };
  bone = refs.inmoov.skeleton.bones[part.link.index];
  bone.rotation[axis_to] = angle.map(
    part.angle_min,
    part.angle_max,
    part.link.rotationMin[axis_to],
    part.link.rotationMax[axis_to]
  );

  poses.hand_l === HandPose.Grip ? handGrabRight(1) : handGrabRight(0);
  poses.hand_r === HandPose.Grip ? handGrabLeft(1) : handGrabLeft(0);

  Object.values(links).forEach((link) => {
    const bone = refs.inmoov.skeleton.bones[link.index];
    bone.rotation.clamp(link.rotationMin, link.rotationMax);
  });
}
