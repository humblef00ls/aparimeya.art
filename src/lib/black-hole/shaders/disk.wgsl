// An optically thin, artist-directed emissivity model. Distances use r_s = 1.
fn diskEmission(position: vec3f, rayDirection: vec3f, footprint: f32) -> vec4f {
  var radius: f32 = length(position.xz);
  var angle: f32 = atan2(position.z, position.x);
  var orbitalPhase: f32 = angle - u.time * 1.8 / pow(radius, 1.5);
  // Periodic coordinates avoid a seam at atan's branch cut.
  var flow: vec2f = vec2f(cos(orbitalPhase), sin(orbitalPhase));
  var textureRadius: f32 = radius * u.textureScale;
  var filaments: f32 = turbulence(flow * 4.0 + vec2f(textureRadius * 7.0, textureRadius * 0.8));
  var bands: f32 = 0.5 + 0.5 * sin(textureRadius * 22.0 + filaments * 7.0) * exp(-pow(footprint * u.textureScale * 22.0, 2.0));
  var fineBands: f32 = 0.5 + 0.5 * sin(textureRadius * 63.0 + filaments * 4.0) * exp(-pow(footprint * u.textureScale * 63.0, 2.0));
  // Large advected knots survive low-resolution rendering; fine filaments add detail
  // at closer views. Integer angular frequencies keep the pattern seamless.
  var knots: f32 = turbulence(flow * 2.4 + vec2f(textureRadius * 0.75, textureRadius * 0.18));
  var spiralPhase: f32 = textureRadius * 9.0 - orbitalPhase * 3.0 + knots * 9.0;
  var spiralFilter: f32 = exp(-pow(footprint * u.textureScale * 9.0, 2.0));
  var ridges: f32 = 0.5 + 0.5 * sin(spiralPhase) * spiralFilter;
  var density: f32 = smoothstep(0.2, 0.8, knots);
  var detail: f32 = 0.2 + 1.3 * density + 0.55 * ridges + 0.25 * bands + 0.12 * fineBands;
  var textureWeight: f32 = u.textureStrength * exp(-footprint * 0.6);
  var structure: f32 = max(0.08, mix(1.0, detail, textureWeight));
  // Shading across the flowing ridges suggests raised, illuminated gas. This is
  // an emissivity approximation on the disk plane, not a volumetric fluid solver.
  var relief: f32 = mix(1.0, 0.72 + 0.38 * cos(spiralPhase - 0.65) * spiralFilter,
                     clamp(textureWeight, 0.0, 1.0));

  var innerFade: f32 = smoothstep(u.diskInner, u.diskInner + 0.5, radius);
  var outerFade: f32 = 1.0 - smoothstep(u.diskOuter * 0.68, u.diskOuter, radius);
  var heat: f32 = pow(u.diskInner / max(radius, u.diskInner), 1.4);
  var color: vec3f = mix(u.diskColor * 0.4, u.diskColor, heat);
  color = mix(color, vec3f(1.0), pow(heat, 2.0) * 0.7);

  var tangent: vec3f = normalize(vec3f(-position.z, 0.0, position.x));
  var beta: f32 = sqrt(0.5 / max(radius - 1.0, 1.0));
  var doppler: f32 = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(tangent, -normalize(rayDirection)));
  var shift: f32 = mix(1.0, doppler * sqrt(1.0 - 1.0 / radius), u.doppler);
  color *= mix(vec3f(1.0), vec3f(1.0, clamp(shift, 0.65, 1.3), clamp(shift * shift, 0.45, 1.5)), u.doppler);
  color *= mix(vec3f(1.0), mix(u.diskColor * 0.55, vec3f(1.0), density), clamp(textureWeight * 0.45, 0.0, 0.65));
  var intensity: f32 = 4.5 * u.diskBrightness * heat * structure * relief * pow(shift, 3.0);
  return vec4f(color * intensity * innerFade * outerFade, innerFade * outerFade * mix(0.85, clamp(0.45 + density * 0.6, 0.0, 1.0), clamp(textureWeight, 0.0, 1.0)));
}
