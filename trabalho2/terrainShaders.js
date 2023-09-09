"use strict";

const terrainVS = `#version 300 es

in vec4 a_position;
in vec2 a_texcoord;

uniform mat4 u_world;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform vec3 u_viewWorldPosition;

uniform sampler2D displacementMap;

out vec2 v_texcoord;
out vec3 v_surfaceToView;
out vec3 v_worldPosition;

void main() {
  float displacementScale = 8.0;
  float displacement = texture(displacementMap, a_texcoord).r * displacementScale;
  vec4 displaced_position = a_position + vec4(0, displacement, 0, 0);

  gl_Position =  u_projection * u_view * u_world * displaced_position;
  
  v_worldPosition = (u_world * displaced_position).xyz;
  v_texcoord = a_texcoord;
  v_surfaceToView = u_viewWorldPosition - v_worldPosition;
}
`;

const terrainFS = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_surfaceToView;
in vec2 v_texcoord;

uniform vec3 u_lightDirection;
uniform sampler2D normalMap;

out vec4 outColor;

void main() {
  //vec3 dx = dFdx(v_worldPosition);
  //vec3 dy = dFdy(v_worldPosition);
  //vec3 normal = normalize(cross(dy, dx));
  vec3 normal = normalize(texture(normalMap, v_texcoord).rgb * 2. - 1.);

  vec3 color = vec3(0.0, 1.0, 0.0);
  float light = dot(u_lightDirection, normal) * .5 + 0.5;

  outColor = vec4(color * light, 1.0);
}
`;

export { terrainFS, terrainVS };