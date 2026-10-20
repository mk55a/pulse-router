// Hosts one 3D scene inside a container. `load(factory)` gives the factory its own element and
// an abort signal; the scene object it returns is mounted, sized to the container (and kept
// sized as it changes), then updated and rendered from the game loop while not paused.
// A scene implements any of: mount, update, fixedUpdate, render, resize, pause, resume, dispose.
export function createSceneHost(container, { onError = console.error } = {}) {
  let scene = null, element = null, paused = false, loading = null;
  const size = () => ({ width: container.clientWidth, height: container.clientHeight, pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2) });
  const observer = new ResizeObserver(() => { try { scene?.resize?.(size()); } catch (error) { onError(error); } });
  observer.observe(container);

  async function load(factory) {
    if (loading) loading.abort();
    const controller = new AbortController(); loading = controller;
    const host = document.createElement('div');
    host.className = 'scene-host';
    host.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    container.prepend(host);
    try {
      const next = await factory({ container: host, signal: controller.signal });
      if (controller.signal.aborted) { next?.dispose?.(); host.remove(); return false; }
      scene?.dispose?.(); element?.remove();
      scene = next; element = host;
      scene.mount?.(); scene.resize?.(size());
      if (paused) scene.pause?.();
      return true;
    } catch (error) {
      host.remove();
      if (!controller.signal.aborted) throw error;
      return false;
    } finally { if (loading === controller) loading = null; }
  }
  return {
    load,
    update(dt) { if (scene && !paused) { scene.update?.(dt); scene.render?.(); } },
    fixedUpdate(dt) { if (scene && !paused) scene.fixedUpdate?.(dt); },
    setPaused(value) { if (paused === value) return; paused = value; if (paused) scene?.pause?.(); else scene?.resume?.(); },
    dispose() { loading?.abort(); observer.disconnect(); scene?.dispose?.(); element?.remove(); scene = null; }
  };
}
