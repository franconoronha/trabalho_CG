"use strict";

const simpleVS = `#version 300 es

in vec4 a_position;
in vec3 a_normal;

uniform mat4 u_world;
uniform mat4 u_projection;
uniform mat4 u_view;

out vec3 v_normal;

void main() {
  gl_Position =  u_projection * u_view * u_world * a_position;
  mat3 normalMat = transpose(inverse(mat3(u_world)));
  v_normal = normalMat * a_normal;
}
`;

const simpleFS = `#version 300 es
precision highp float;

in vec3 v_normal;

uniform vec3 u_lightDirection;

out vec4 outColor;

void main() {
  vec3 color = vec3(0.8, 0, 0.8);
  vec3 normal = v_normal * 2. - 1.;
  float ambient = 0.1;
  float diffuse = max(-dot(normalize(normal), u_lightDirection), 0.0);
  float light = ambient + diffuse;
  outColor = vec4(color * light, 1.0);
}
`;

export { simpleFS, simpleVS };