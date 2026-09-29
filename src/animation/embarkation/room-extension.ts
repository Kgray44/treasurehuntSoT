/** Existing clean continuation, registered to the accepted 1536x1024 room.
 * Keep the measured registration with its texture. The later delta2 texture
 * had only 56 upper pixels and ran out above the still-hidden application bar.
 * This earlier clean backing has 125 pixels and contains no duplicate hero
 * lantern. It is used only beyond the painting, never to replace the room.
 */
export const ROOM_EXTENSION = {
  url: "/images/embarkation/derived/room-overscan.webp",
  width: 1586,
  height: 992,
  sourceScale: 0.807,
  left: 175,
  top: 125,
} as const;

// The closest lamp hangs BELOW the ceiling, toward the eye. The former -1782
// plane put its upper half behind the reconstructed ceiling and exposed it in
// one frame when the resting room replaced the spatial layers.
export const NEAR_ROOM_LANTERN_Z = 490;

export const roomExtensionTransform = [
  (1536 * ROOM_EXTENSION.sourceScale) / ROOM_EXTENSION.width,
  (1024 * ROOM_EXTENSION.sourceScale) / ROOM_EXTENSION.height,
  ROOM_EXTENSION.left / ROOM_EXTENSION.width,
  1 - (ROOM_EXTENSION.top + 1024 * ROOM_EXTENSION.sourceScale) / ROOM_EXTENSION.height,
] as const;

/** Both source and texture UV are bottom-up, as in the matte projector. */
export function roomExtensionUV(source: readonly number[]) {
  return [
    source[0] * roomExtensionTransform[0] + roomExtensionTransform[2],
    source[1] * roomExtensionTransform[1] + roomExtensionTransform[3],
  ];
}

export const roomExtensionGLSL = `
vec2 roomExtensionUV(vec2 p){return p*vec2(${roomExtensionTransform[0]},${roomExtensionTransform[1]})+vec2(${roomExtensionTransform[2]},${roomExtensionTransform[3]});}
`;
