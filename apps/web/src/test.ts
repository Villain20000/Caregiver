/**
 * apps/web/src/test.ts
 *
 * Angular unit test entry point — referenced by the karma builder's `main`
 * option in angular.json.
 *
 * Initializes the Angular testing environment (JIT compiler + browser DOM)
 * so TestBed-based unit tests can run in Karma.
 */
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
