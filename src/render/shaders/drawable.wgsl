struct Uniforms {
  mvp: mat4x4f,   // P · V · M, column-major, uploaded as 16 floats
  normalMatrix: mat4x4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec4f,
};

@vertex
fn vs(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VSOut {
  var o: VSOut;
  o.position = u.mvp * vec4f(pos, 1.0);
  o.normal = u.normalMatrix * vec4f(normal, 0.0);
  return o;
}

@fragment
fn fs(i: VSOut) -> @location(0) vec4f {
  return toOutput(vec4f(vec3f(max(dot(normalize(i.normal.xyz), normalize(vec3f(0.0, 1.0, 1.0))), 0.1)), 1.0));
}
