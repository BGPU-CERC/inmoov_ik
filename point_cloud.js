import * as THREE from "three";
import { refs } from "./refs.js";

export const JointType = {
  Head: 0,
  ShoulderSpine: 1,
  LeftShoulder: 2,
  LeftElbow: 3,
  LeftHand: 4,
  RightShoulder: 5,
  RightElbow: 6,
  RightHand: 7,
  MidSpine: 8,
  BaseSpine: 9,
  LeftHip: 10,
  LeftKnee: 11,
  LeftFoot: 12,
  RightHip: 13,
  RightKnee: 14,
  RightFoot: 15,
  LeftWrist: 16,
  RightWrist: 17,
  Neck: 18,
  Unknown: 25,
};

const joint_pairs = {
  [JointType.BaseSpine]: JointType.MidSpine,
  [JointType.MidSpine]: JointType.ShoulderSpine,
  [JointType.ShoulderSpine]: JointType.Head,

  [JointType.LeftShoulder]: JointType.LeftElbow,
  [JointType.LeftElbow]: JointType.LeftHand,

  [JointType.RightShoulder]: JointType.RightElbow,
  [JointType.RightElbow]: JointType.RightHand,
};

export const HandPose = {
  Unknown: 0,
  Grip: 1,
};

export const poses = { hand_l: HandPose.Unknown, hand_r: HandPose.Unknown };
const poseColor = (pose) => (pose ? 0x00ff00 : 0xff0000);

export function createPointCloud(points_count) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      Array(points_count * 3)
        .fill(0)
        .map(() => Math.random() - 0.5),
      3
    )
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      Array(points_count)
        .fill(0)
        .flatMap(() => [0, 0, 1]),
      3
    )
  );

  const material = new THREE.PointsMaterial({
    size: 3,
    sizeAttenuation: false,
    vertexColors: true,
  });

  const points = new THREE.Points(geometry, material);
  return points;
}

export function createJoints() {
  const joints = Array(10)
    .fill(0)
    .map((_, i) => createJoint(0.01, 0.1, 4));

  function createJoint(radius, height, radialSegments) {
    const geometry = new THREE.ConeGeometry(radius, height, radialSegments);
    geometry.rotateX(Math.PI * 0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  return joints;
}

export function listenPointsStream(websocket_url) {
  const { joints, points } = refs;

  const sizeof_coords = 3 * 4;
  const sizeof_color = 3;
  const joint_count = 10;

  let joint_index = 0;

  const p = points.geometry.attributes.position.array;
  let p_index = 0;

  const c = points.geometry.attributes.color.array;
  let c_index = 0;

  let request = [];
  let socket;
  createSocket();
  function createSocket() {
    socket = new WebSocket(websocket_url);
    socket.onopen = onOpen;
    socket.onmessage = onMessage;
    socket.onclose = onClose;
  }

  function onOpen() {
    points.visible = true;
    socket.send(request);
  }

  async function onMessage(event) {
    const buffer = await event.data.arrayBuffer();
    const view = new DataView(buffer);

    const point_count = view.getInt32(0, true);
    const coords_start = 4;
    const colors_start = coords_start + point_count * sizeof_coords;
    const joints_start = colors_start + point_count * sizeof_color;
    const poses_start = joints_start + joint_count * sizeof_coords;

    for (let j = coords_start; j < colors_start; j += sizeof_coords) {
      const x = view.getFloat32(j + 0, true) / 1000;
      const y = view.getFloat32(j + 4, true) / 1000;
      const z = view.getFloat32(j + 8, true) / 1000;

      p[p_index++] = x;
      p[p_index++] = y;
      p[p_index++] = z;

      p_index = p_index % p.length;
    }

    for (let j = colors_start; j < joints_start; j += sizeof_color) {
      const r = view.getUint8(j + 0).map(0, 255, 0, 1);
      const g = view.getUint8(j + 1).map(0, 255, 0, 1);
      const b = view.getUint8(j + 2).map(0, 255, 0, 1);

      c[c_index++] = r;
      c[c_index++] = g;
      c[c_index++] = b;

      c_index = c_index % c.length;
    }

    for (let j = joints_start; j < poses_start; j += sizeof_coords) {
      const x = view.getFloat32(j + 0, true) / 1000;
      const y = view.getFloat32(j + 4, true) / 1000;
      const z = view.getFloat32(j + 8, true) / 1000;

      const joint = joints[joint_index++];
      x && y && z && joint.position.set(x, y, z);

      joint_index = joint_index % joints.length;
    }

    for (const key in joint_pairs) {
      const tail = joints[key];
      const head = joints[joint_pairs[key]];
      tail.lookAt(head.position);
    }

    poses.hand_l = view.getUint8(poses_start);
    poses.hand_r = view.getUint8(poses_start + 1);
    joints[JointType.LeftHand].material.color.setHex(poseColor(poses.hand_l));
    joints[JointType.RightHand].material.color.setHex(poseColor(poses.hand_r));

    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
    socket.send(request);
  }

  async function onClose(event) {
    points.visible = false;
    if (event.wasClean) return;
    await new Promise((res) => setTimeout(res, 1000));
    createSocket();
  }
}
