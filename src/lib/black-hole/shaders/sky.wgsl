fn starField(direction: vec3f) -> vec3f {
  // Cube projection avoids the singular density of a latitude-longitude star grid.
  var absolute: vec3f = abs(direction);
  var face: vec2f;
  var faceId: f32;
  if (absolute.x > absolute.y && absolute.x > absolute.z) {
    face = direction.yz / absolute.x;
    faceId = select(1.0, 0.0, direction.x > 0.0);
  } else if (absolute.y > absolute.z) {
    face = direction.xz / absolute.y;
    faceId = select(3.0, 2.0, direction.y > 0.0);
  } else {
    face = direction.xy / absolute.z;
    faceId = select(5.0, 4.0, direction.z > 0.0);
  }
  var grid: vec2f = face * 165.0;
  var cell: vec2f = floor(grid);
  var light: vec3f = vec3f(0.0);
  for (var y: i32 = -1; y <= 1; y++) {
    for (var x: i32 = -1; x <= 1; x++) {
      var neighbor: vec2f = cell + vec2f(f32(x), f32(y));
      var id: vec2f = neighbor + vec2f(faceId * 317.0);
      var random: f32 = hash21(id + vec2f(83.1));
      if (random < 1.0 - 0.015 * u.starDensity) { continue; }
      var center: vec2f = neighbor + vec2f(hash21(id), hash21(id + vec2f(19.7))) * 0.7 + vec2f(0.15);
      var rarity: f32 = pow(hash21(id + vec2f(17.0)), 5.0);
      var size: f32 = u.starSize * mix(1.0, 0.55 + rarity * 3.0, u.starVariation);
      var distanceSquared: f32 = dot(grid - center, grid - center);
      var width: f32 = 0.05 * size;
      var core: f32 = exp(-distanceSquared / (width * width));
      var halo: f32 = exp(-distanceSquared / (width * width * 9.0)) * rarity * 0.12 * u.starVariation;
      var tint: vec3f = mix(vec3f(0.35, 0.58, 1.0), vec3f(1.0, 0.48, 0.2), hash21(id + vec2f(8.0)));
      tint = mix(vec3f(1.0), tint, u.starVariation);
      light += tint * (core + halo) * mix(1.2, 0.6 + rarity * 6.0, u.starVariation);
    }
  }
  return light;
}
