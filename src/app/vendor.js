// Loads the bundled Three.js build and its post-processing files (vendor/three, MIT licence)
// as classic scripts, in order, since the extras attach themselves to the global THREE.
export const THREE_SCRIPTS = Object.freeze([
  'three.min.js', 'CopyShader.js', 'LuminosityHighPassShader.js', 'EffectComposer.js',
  'RenderPass.js', 'ShaderPass.js', 'MaskPass.js', 'UnrealBloomPass.js'
]);

export async function loadThree(baseUrl) {
  for (const name of THREE_SCRIPTS) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(name, baseUrl).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${name}`));
      document.head.append(script);
    });
  }
  if (!globalThis.THREE?.WebGLRenderer) throw new Error('Three.js did not start');
}
