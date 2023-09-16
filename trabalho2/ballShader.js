"use strict";

const ballVS = `#version 300 es

in vec4 a_position;
in vec3 a_normal;

uniform mat4 u_world;
uniform mat4 u_projection;
uniform mat4 u_view;

uniform vec3 u_viewWorldPosition;
uniform vec3 u_lightWorldPosition;

out vec3 v_normal;
out vec3 v_surfaceToLight;
out vec3 v_surfaceToView;

void main() {
    gl_Position =  u_projection * u_view * u_world * a_position;
    mat3 normalMat = transpose(inverse(mat3(u_world)));
    v_normal = normalMat * a_normal;

    vec3 surfaceWorldPosition = (u_world * a_position).xyz;
    v_surfaceToLight = u_lightWorldPosition - surfaceWorldPosition;
    v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
}
`;

const ballFS = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToLight;
in vec3 v_surfaceToView;

uniform vec3 u_lightDirection;

out vec4 outColor;

void main() {
  vec3 color = vec3(0.8, 0, 0.8);
  vec3 normal = normalize(v_normal * 2. - 1.);
  float ambient = 0.1;
  //float pointLight = max(dot(normal, normalize(v_surfaceToLight)), 0.0);
  float diffuse = max(dot(normalize(normal), u_lightDirection), 0.0);
  float light = ambient + diffuse;
  outColor = vec4(color * light, 1.0);
}
`;

export { ballFS, ballVS };