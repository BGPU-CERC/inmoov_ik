import * as THREE from "three";

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
    size: 0.001,
    vertexColors: true,
  });

  const points = new THREE.Points(geometry, material);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.01, 0.01),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("red") })
  );

  points.add(cube);

  return points;
}

export function listenPointsStream(points, streamSocketUrl) {
  let i = 0;
  let socket;
  const request = [];
  const sizeof_vertex = 12;
  const positionArray = points.geometry.attributes.position.array;
  positionArray.closest = [0, 0, 0];

  createSocket();

  function createSocket() {
    socket = new WebSocket(streamSocketUrl);
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

    positionArray.closest[2] = 9999;

    for (let j = 0; j < buffer.byteLength; j += sizeof_vertex) {
      const z = view.getFloat32(j + 0, true) / 1000;
      const y = view.getFloat32(j + 4, true) / 1000;
      const x = view.getFloat32(j + 8, true) / 1000;

      if (z <= positionArray.closest[2]) {
        positionArray.closest[0] = x;
        positionArray.closest[1] = y;
        positionArray.closest[2] = z;

        const cube = points.children[0];
        cube.position.set(...positionArray.closest);
      }

      positionArray[i++] = x;
      positionArray[i++] = y;
      positionArray[i++] = z;

      i = i % positionArray.length;
    }

    // debugger;

    points.geometry.attributes.position.needsUpdate = true;
    socket.send(request);
  }

  async function onClose(event) {
    points.visible = false;
    if (event.wasClean) return;
    await new Promise((res) => setTimeout(res, 1000));
    createSocket();
  }
}
