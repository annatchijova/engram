/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, Types } from '@iwsdk/core';

// Mirrors MNEME's real custody_status vocabulary (server/app.py,
// CUSTODY_STATUS_MEANING) — never a client-invented category.
export const CustodyStatus = {
  CLEAN: 'CLEAN',
  TAINT_FLAGGED: 'TAINT_FLAGGED',
  QUARANTINED: 'QUARANTINED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export const MemoryNode = createComponent('MemoryNode', {
  memoryId: { type: Types.String, default: '' },
  custodyStatus: {
    type: Types.Enum,
    default: CustodyStatus.CLEAN,
    enum: CustodyStatus,
  },
});
