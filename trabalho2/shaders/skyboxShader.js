"use strict";

const skyboxVS = `#version 300 es

in vec4 a_position;
out vec4 v_position;

void main() {
    v_position = a_position;
    gl_Position = vec4(a_position.xy, 1, 1);
}
`;

const skyboxFS = `#version 300 es
precision highp float;

uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;

in vec4 v_position;

out vec4 outColor;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_position;
    outColor = texture(u_skybox, normalize(t.xyz / t.w));
}
`;

export { skyboxFS, skyboxVS };