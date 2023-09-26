"use strict";

const terrainVS = `#version 300 es

in vec4 a_position;
in vec3 a_normal;
in vec2 a_texcoord;

uniform mat4 u_world;
uniform mat4 u_projection;
uniform mat4 u_view;

uniform vec3 u_viewWorldPosition;
uniform float u_lightPositionArray[15];
uniform sampler2D displacementMap;

out vec2 v_texcoord;
out vec3 v_surfaceToView;
out vec3 v_worldPosition;
out vec3 v_surfaceToLightArray[5];
out vec3 v_normal;

void main() {
  float displacementScale = 200.0;
  float displacement = texture(displacementMap, a_texcoord).r * displacementScale;
  vec4 displaced_position = a_position + vec4(0, displacement, 0, 0);

  gl_Position =  u_projection * u_view * u_world * displaced_position;
  
  vec3 surfaceWorldPosition = (u_world * displaced_position).xyz;
  
  for(int i = 0; i < 5; i++) {
    v_surfaceToLightArray[i] = vec3(u_lightPositionArray[i * 3] - surfaceWorldPosition.x, u_lightPositionArray[i * 3 + 1] - surfaceWorldPosition.y, u_lightPositionArray[i * 3 + 2] - surfaceWorldPosition.z);
  }
  
  v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
  v_worldPosition = surfaceWorldPosition;
  v_normal = a_normal;
  v_texcoord = a_texcoord;
}
`;

const terrainFS = `#version 300 es
precision highp float;

in vec3 v_surfaceToView;
in vec3 v_surfaceToLightArray[5];
in vec2 v_texcoord;
in vec3 v_normal;

in vec3 v_worldPosition;

uniform vec3 u_lightDirection;
uniform sampler2D groundTexture;
uniform float u_kc;
uniform float u_kl;
uniform float u_kq;
uniform int u_activeBalls;

out vec4 outColor;

//const float kc = 0.3;
//const float kl = 0.001;
//const float kq = 0.0001;
const float shininess = 5000.0;

void main() {
  vec3 normal = v_normal;

  vec3 color = texture(groundTexture, v_texcoord).rgb;

  float ambient = 0.1;
  vec3 lightDirection = normalize(u_lightDirection);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  
  vec3 halfVector = normalize(-u_lightDirection + v_surfaceToView);
  float specular = clamp(dot(normal, halfVector), 0.0, 1.0);
  float specularFactor = pow(specular, shininess);

  for (int i = 0; i < u_activeBalls; i++) {
    float distance = length(v_surfaceToLightArray[i]);
    vec3 pointLightDirection = normalize(v_surfaceToLightArray[i]);
    float attenuation = 1.0 / (u_kc + u_kl * distance + u_kq * distance * distance);
    float pointDiffuse = max(dot(normal, pointLightDirection), 0.0);
    diffuse += pointDiffuse * attenuation;

    vec3 pointHalfVector = normalize(pointLightDirection + v_surfaceToView);
    float pointSpecular = clamp(dot(normal, pointHalfVector), 0.0, 1.0);
    specularFactor += pow(pointSpecular, shininess) * attenuation;
  }

  vec3 specularColor = vec3(1.0, 1.0, 1.0);
  vec3 effectiveSpecular = specularColor * specularFactor;

  float light = ambient + diffuse;
  outColor = vec4(color * light + effectiveSpecular, 1.0);
}
`;

export { terrainFS, terrainVS };