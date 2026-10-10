/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { ContainmentSystem } from './containment-system.js';
import { FieldSystem } from './field-system.js';
import { initLoginOverlay } from './login-overlay.js';
import { SelectionSystem } from './selection-system.js';

initLoginOverlay();

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(FieldSystem);
  world.registerSystem(SelectionSystem);
  world.registerSystem(ContainmentSystem);
});
