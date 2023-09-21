const vs = `#version 300 es
in vec4 a_position;
in vec3 a_normal;
in vec3 a_tangent;
in vec2 a_texcoord;
in vec4 a_color;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform vec3 u_viewWorldPosition;
uniform float u_lightPositionArray[15];

out vec3 v_normal;
out vec3 v_tangent;
out vec3 v_surfaceToView;
out vec3 v_surfaceToLightArray[5];
out vec2 v_texcoord;
out vec4 v_color;

void main() {
  vec4 worldPosition = u_world * a_position;
  gl_Position = u_projection * u_view * worldPosition;
  v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

  mat3 normalMat = mat3(u_world);
  v_normal = normalize(normalMat * a_normal);
  v_tangent = normalize(normalMat * a_tangent);
  for(int i = 0; i < 5; i++) {
    v_surfaceToLightArray[i] = vec3(u_lightPositionArray[i * 3] - worldPosition.x, u_lightPositionArray[i * 3 + 1] - worldPosition.y, u_lightPositionArray[i * 3 + 2] - worldPosition.z);
  }

  v_texcoord = a_texcoord;
  v_color = a_color;
}
`;

const fs = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_tangent;
in vec3 v_surfaceToView;
in vec2 v_texcoord;
in vec3 v_surfaceToLightArray[5];
in vec4 v_color;

uniform vec3 diffuse;
uniform sampler2D diffuseMap;
uniform vec3 ambient;
uniform vec3 emissive;
uniform vec3 specular;
uniform sampler2D specularMap;
uniform float shininess;
uniform sampler2D normalMap;
uniform float opacity;
uniform vec3 u_lightDirection;
uniform vec3 u_ambientLight;
uniform int u_activeBalls;
uniform float u_kc;
uniform float u_kl;
uniform float u_kq;

out vec4 outColor;

void main () {
  vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
  vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
  vec3 bitangent = normalize(cross(normal, tangent));

  mat3 tbn = mat3(tangent, bitangent, normal);
  normal = texture(normalMap, v_texcoord).rgb * 2. - 1.;
  normal = normalize(tbn * normal);

  vec3 surfaceToViewDirection = normalize(v_surfaceToView);
  vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

  float diffuseLight = dot(u_lightDirection, normal) * .5 + .5;
  float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
  vec4 specularMapColor = texture(specularMap, v_texcoord);
  vec3 effectiveSpecular = specular * specularMapColor.rgb;
  float specularFactor = pow(specularLight, shininess);
  vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
  vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
  float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

  for (int i = 0; i < u_activeBalls; i++) {
    float distance = length(v_surfaceToLightArray[i]);
    vec3 pointLightDirection = normalize(v_surfaceToLightArray[i]);
    float attenuation = 1.0 / (u_kc + u_kl * distance + u_kq * distance * distance);
    float pointDiffuse = max(dot(normal, pointLightDirection), 0.0);
    diffuseLight += pointDiffuse * attenuation;

    vec3 pointHalfVector = normalize(pointLightDirection + v_surfaceToView);
    float pointSpecular = clamp(dot(normal, pointHalfVector), 0.0, 1.0);
    specularFactor += pow(pointSpecular, shininess) * attenuation;
  }

  outColor = vec4(
      emissive +
      ambient * u_ambientLight +
      effectiveDiffuse * diffuseLight +
      effectiveSpecular * specularFactor,
      effectiveOpacity);
}
`;

export { fs, vs };