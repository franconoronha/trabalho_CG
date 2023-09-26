"use strict";

const planeVS = `#version 300 es

in vec4 a_position;
in vec3 a_normal;
in vec2 a_texcoord;

uniform mat4 u_world;
uniform mat4 u_projection;
uniform mat4 u_view;

uniform vec3 u_viewWorldPosition;
uniform float u_lightPositionArray[15];

out vec3 v_normal;
out vec2 v_texcoord;
out vec3 v_surfaceToLightArray[5];

void main() {
  vec4 position = a_position + vec4(0, 15, 0, 0);
  gl_Position =  u_projection * u_view * position;
  v_normal = a_normal;
  v_texcoord = a_texcoord;

  for(int i = 0; i < 5; i++) {
    v_surfaceToLightArray[i] = vec3(u_lightPositionArray[i * 3] - a_position.x, u_lightPositionArray[i * 3 + 1] - a_position.y, u_lightPositionArray[i * 3 + 2] - a_position.z);
  }
}
`;

const planeFS = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_texcoord;
in vec3 v_surfaceToLightArray[5];

uniform vec3 u_lightDirection;
uniform sampler2D groundTexture;
uniform float u_kc;
uniform float u_kl;
uniform float u_kq;
uniform int u_activeBalls;

out vec4 outColor;

void main() {
  vec3 color = texture(groundTexture, v_texcoord).rgb;
  float ambient = 0.1;
  float diffuse = max(dot(v_normal, u_lightDirection), 0.0);

  for (int i = 0; i < u_activeBalls; i++) {
    float distance = length(v_surfaceToLightArray[i]);
    vec3 pointLightDirection = normalize(v_surfaceToLightArray[i]);
    float attenuation = 1.0 / (u_kc + u_kl * distance + u_kq * distance * distance);
    float pointDiffuse = max(dot(v_normal, pointLightDirection), 0.0);
    diffuse += pointDiffuse * attenuation;
  }

  float light = ambient + diffuse;
  outColor = vec4(color * light, 1.0);
}
`;

export { planeFS, planeVS };