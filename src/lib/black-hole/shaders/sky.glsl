vec3 starField(vec3 direction) {
  // Cube projection avoids the singular density of a latitude-longitude star grid.
  vec3 absolute = abs(direction);
  vec2 face;
  float faceId;
  if (absolute.x > absolute.y && absolute.x > absolute.z) {
    face = direction.yz / absolute.x;
    faceId = direction.x > 0.0 ? 0.0 : 1.0;
  } else if (absolute.y > absolute.z) {
    face = direction.xz / absolute.y;
    faceId = direction.y > 0.0 ? 2.0 : 3.0;
  } else {
    face = direction.xy / absolute.z;
    faceId = direction.z > 0.0 ? 4.0 : 5.0;
  }
  vec2 grid = face * 165.0;
  vec2 cell = floor(grid);
  vec3 light = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = cell + vec2(float(x), float(y));
      vec2 id = neighbor + faceId * 317.0;
      float random = hash21(id + 83.1);
      if (random < 1.0 - 0.015 * uStarDensity) continue;
      vec2 center = neighbor + vec2(hash21(id), hash21(id + 19.7)) * 0.7 + 0.15;
      float rarity = pow(hash21(id + 17.0), 5.0);
      float size = uStarSize * mix(1.0, 0.55 + rarity * 3.0, uStarVariation);
      float distanceSquared = dot(grid - center, grid - center);
      float width = 0.05 * size;
      float core = exp(-distanceSquared / (width * width));
      float halo = exp(-distanceSquared / (width * width * 9.0)) * rarity * 0.12 * uStarVariation;
      vec3 tint = mix(vec3(0.35, 0.58, 1.0), vec3(1.0, 0.48, 0.2), hash21(id + 8.0));
      tint = mix(vec3(1.0), tint, uStarVariation);
      light += tint * (core + halo) * mix(1.2, 0.6 + rarity * 6.0, uStarVariation);
    }
  }
  return light;
}
