/**
 * Vitest global test setup for IsoVis frontend.
 *
 * - Extends matchers with @testing-library/jest-dom
 * - Mocks WebGL context for Three.js / R3F tests
 * - Mocks ResizeObserver (not available in jsdom)
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mock WebGL context — Three.js attempts to create a WebGL canvas on import.
// jsdom does not support WebGL, so we provide a stub.
// ---------------------------------------------------------------------------

class WebGLRenderingContextStub {
  canvas = document.createElement('canvas');
  drawingBufferWidth = 1024;
  drawingBufferHeight = 768;

  getExtension() {
    return null;
  }
  getParameter(pname: number) {
    // GL_MAX_TEXTURE_SIZE
    if (pname === 0x0d33) return 4096;
    // GL_MAX_VERTEX_ATTRIBS
    if (pname === 0x8869) return 16;
    // GL_MAX_TEXTURE_IMAGE_UNITS
    if (pname === 0x8872) return 16;
    // GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS
    if (pname === 0x8b4d) return 32;
    // GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS
    if (pname === 0x8b4c) return 16;
    // GL_SHADING_LANGUAGE_VERSION
    if (pname === 0x8b8c) return 'WebGL GLSL ES 1.0';
    // GL_VERSION
    if (pname === 0x1f02) return 'WebGL 1.0 (Mock)';
    // GL_VENDOR / GL_RENDERER
    if (pname === 0x1f00 || pname === 0x1f01) return 'Vitest Mock';
    return 0;
  }
  getShaderPrecisionFormat() {
    return { rangeMin: 127, rangeMax: 127, precision: 23 };
  }
  createBuffer() { return {}; }
  createFramebuffer() { return {}; }
  createProgram() { return {}; }
  createRenderbuffer() { return {}; }
  createShader() { return {}; }
  createTexture() { return {}; }
  bindBuffer() {}
  bindFramebuffer() {}
  bindRenderbuffer() {}
  bindTexture() {}
  blendEquation() {}
  blendFunc() {}
  bufferData() {}
  clear() {}
  clearColor() {}
  clearDepth() {}
  clearStencil() {}
  colorMask() {}
  compileShader() {}
  deleteBuffer() {}
  deleteFramebuffer() {}
  deleteProgram() {}
  deleteRenderbuffer() {}
  deleteShader() {}
  deleteTexture() {}
  depthFunc() {}
  depthMask() {}
  disable() {}
  drawArrays() {}
  drawElements() {}
  enable() {}
  enableVertexAttribArray() {}
  framebufferRenderbuffer() {}
  framebufferTexture2D() {}
  frontFace() {}
  generateMipmap() {}
  getAttribLocation() { return 0; }
  getProgramParameter() { return true; }
  getProgramInfoLog() { return ''; }
  getShaderParameter() { return true; }
  getShaderInfoLog() { return ''; }
  getUniformLocation() { return {}; }
  isContextLost() { return false; }
  lineWidth() {}
  linkProgram() {}
  pixelStorei() {}
  renderbufferStorage() {}
  scissor() {}
  shaderSource() {}
  stencilFunc() {}
  stencilMask() {}
  stencilOp() {}
  texParameteri() {}
  texImage2D() {}
  uniform1f() {}
  uniform1fv() {}
  uniform1i() {}
  uniform2f() {}
  uniform2fv() {}
  uniform3f() {}
  uniform3fv() {}
  uniform4f() {}
  uniform4fv() {}
  uniformMatrix3fv() {}
  uniformMatrix4fv() {}
  useProgram() {}
  vertexAttribPointer() {}
  viewport() {}
  attachShader() {}
  checkFramebufferStatus() { return 0x8cd5; /* FRAMEBUFFER_COMPLETE */ }
  activeTexture() {}
  cullFace() {}
  blendEquationSeparate() {}
  blendFuncSeparate() {}
  stencilFuncSeparate() {}
  stencilMaskSeparate() {}
  stencilOpSeparate() {}
  disableVertexAttribArray() {}
  getSupportedExtensions() { return []; }
}

// Patch HTMLCanvasElement to return our stub WebGL context
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
  if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
    return new WebGLRenderingContextStub() as unknown as RenderingContext;
  }
  // Return a basic 2d context stub for canvas-based tests
  if (contextId === '2d') {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => []),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      canvas: this,
    } as unknown as RenderingContext;
  }
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;

// ---------------------------------------------------------------------------
// Mock ResizeObserver — not available in jsdom
// ---------------------------------------------------------------------------

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// ---------------------------------------------------------------------------
// Suppress console.warn noise from Three.js during tests
// ---------------------------------------------------------------------------

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  // Suppress Three.js WebGL capability warnings in test output
  if (msg.includes('THREE') || msg.includes('WebGL')) return;
  originalWarn(...args);
};
