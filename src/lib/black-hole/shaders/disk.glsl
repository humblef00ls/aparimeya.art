// An optically thin, artist-directed emissivity model. Distances use r_s = 1.
vec4 diskEmission(vec3 position, vec3 rayDirection, float footprint) {
  float radius = length(position.xz);
  float angle = atan(position.z, position.x);
  float orbitalPhase = angle - uTime * 1.8 / pow(radius, 1.5);
  // Periodic coordinates avoid a seam at atan's branch cut.
  vec2 flow = vec2(cos(orbitalPhase), sin(orbitalPhase));
  float textureRadius = radius * uDiskScale;
  float filaments = turbulence(flow * 4.0 + vec2(textureRadius * 7.0, textureRadius * 0.8));
  float bands = 0.5 + 0.5 * sin(textureRadius * 22.0 + filaments * 7.0) * exp(-pow(footprint * uDiskScale * 22.0, 2.0));
  float fineBands = 0.5 + 0.5 * sin(textureRadius * 63.0 + filaments * 4.0) * exp(-pow(footprint * uDiskScale * 63.0, 2.0));
  float detail = 0.35 + 0.8 * filaments + 0.4 * bands + 0.12 * fineBands;
  float structure = mix(1.0, detail, uDiskTexture * exp(-footprint * 3.0));

  float innerFade = smoothstep(uDiskInner, uDiskInner + 0.5, radius);
  float outerFade = 1.0 - smoothstep(uDiskOuter * 0.68, uDiskOuter, radius);
  float heat = pow(uDiskInner / max(radius, uDiskInner), 1.4);
  vec3 color = mix(uDiskColor * 0.4, uDiskColor, heat);
  color = mix(color, vec3(1.0), pow(heat, 2.0) * 0.7);

  vec3 tangent = normalize(vec3(-position.z, 0.0, position.x));
  float beta = sqrt(0.5 / max(radius - 1.0, 1.0));
  float doppler = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(tangent, -normalize(rayDirection)));
  float shift = mix(1.0, doppler * sqrt(1.0 - 1.0 / radius), uDoppler);
  color *= mix(vec3(1.0), vec3(1.0, clamp(shift, 0.65, 1.3), clamp(shift * shift, 0.45, 1.5)), uDoppler);
  float intensity = 4.5 * uDiskBrightness * heat * structure * pow(shift, 3.0);
  return vec4(color * intensity * innerFade * outerFade, innerFade * outerFade * 0.85);
}
