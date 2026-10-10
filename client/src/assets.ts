/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  'legend-panel': {
    url: publicAssetUrl('ui/legend.uikitml'),
    type: AssetType.UIKitML,
    name: 'Legend Panel',
  },
  'detail-panel': {
    url: publicAssetUrl('ui/detail.uikitml'),
    type: AssetType.UIKitML,
    name: 'Detail Panel',
  },
  'containment-panel': {
    url: publicAssetUrl('ui/containment.uikitml'),
    type: AssetType.UIKitML,
    name: 'Containment Panel',
  },
  'counterfactual-panel': {
    url: publicAssetUrl('ui/counterfactual.uikitml'),
    type: AssetType.UIKitML,
    name: 'Counterfactual Panel',
  },
  'portable-panel': {
    url: publicAssetUrl('ui/portable.uikitml'),
    type: AssetType.UIKitML,
    name: 'Portable Panel',
  },
});
