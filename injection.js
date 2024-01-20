import { Euler, Vector3 } from "three";

const v0 = new Vector3();

Euler.prototype.clamp = function (min, max) {
  this.setFromVector3(v0.setFromEuler(this).clamp(min, max));
};

Number.prototype.map = function (in_min, in_max, out_min, out_max) {
  return ((this - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
};

Number.prototype.clamp = function (min, max) {
  return Math.min(Math.max(this, Math.min(min, max)), Math.max(min, max));
};
