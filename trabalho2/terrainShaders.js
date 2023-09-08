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
  v_texcoord = a_texcoord;
  float displacementScale = 8.0;
  float displacement = texture(displacementMap, a_texcoord).r * displacementScale;
  vec4 displaced_position = a_position + vec4(0, displacement, 0, 0);
  v_worldPosition = (u_world * displaced_position).xyz;
  gl_Position =  u_projection * u_view * u_world * displaced_position;

  v_surfaceToView = u_viewWorldPosition - v_worldPosition;
}
`;

const terrainFS = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_surfaceToView;
in vec2 v_texcoord;

uniform vec3 u_lightDirection;

out vec4 outColor;

uniform sampler2D displacementMap;

void main() {
  // should make this a uniform so it's shared
  float displacementScale = 10.0;
  
  // I'm sure there is a better way to compute
  // what this offset should be
  float offset = 0.01;
  
  vec2 uv0 = v_texcoord;
  vec2 uv1 = v_texcoord + vec2(offset, 0);
  vec2 uv2 = v_texcoord + vec2(0, offset);
  
  float h0 = texture(displacementMap, uv0).r;
  float h1 = texture(displacementMap, uv1).r;
  float h2 = texture(displacementMap, uv2).r;
  
  vec3 p0 = vec3(uv0, h0 * displacementScale);
  vec3 p1 = vec3(uv1, h1 * displacementScale);
  vec3 p2 = vec3(uv2, h2 * displacementScale);
  
  vec3 v0 = p1 - p0;
  vec3 v1 = p2 - p0;
  
  vec3 normal = normalize(cross(v1, v0));

  vec3 color = vec3(0.0, 1.0, 0.0);
  float light = dot(u_lightDirection, normal);

  outColor = vec4(color * light, 1.0);
}
`;

export { terrainFS, terrainVS };