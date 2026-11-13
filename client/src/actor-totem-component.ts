/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, Types } from '@iwsdk/core';

// Mirrors MNEME's real actor vocabulary as the adapter returns it
// (GET /api/v1/actors: actor_id, kind, status) — never client-invented.
export const ActorTotem = createComponent('ActorTotem', {
  actorId: { type: Types.String, default: '' },
  displayName: { type: Types.String, default: '' },
  kind: { type: Types.String, default: '' },
  status: { type: Types.String, default: '' },
  // Shelf slot this totem belongs to, so releasing it anywhere that is not
  // the intervention cradle returns it home instead of losing it in the room.
  homeX: { type: Types.Float32, default: 0 },
  homeY: { type: Types.Float32, default: 0 },
  homeZ: { type: Types.Float32, default: 0 },
});
