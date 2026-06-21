/**
 * apps/web/src/main.ts
 *
 * Angular 17+ application entry point.
 *
 * Uses the standalone bootstrap API (no NgModule needed).
 * Imports the root AppComponent and configures global providers
 * (HttpClient, router, animations).
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component.js';
import { APP_ROUTES } from './app/app.routes.js';
import { authInterceptor } from './app/interceptors/auth.interceptor.js';

// Bootstrap the standalone Angular application.
bootstrapApplication(AppComponent, {
  providers: [
    // HTTP client with auth interceptor (attaches JWT to all requests).
    provideHttpClient(withInterceptors([authInterceptor])),
    // Router with lazy-loaded routes and preloading for faster navigation.
    provideRouter(APP_ROUTES, withPreloading(PreloadAllModules)),
    // Angular animations (for Material/CDK transitions).
    provideAnimations(),
  ],
}).catch((err) => console.error(err));
