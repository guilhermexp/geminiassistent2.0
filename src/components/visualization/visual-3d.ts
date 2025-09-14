/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from '../../services/audio/analyser';

// Three.js and postprocessing are loaded lazily inside init()
import {vs as sphereVS} from '../../shaders/sphere-shader';

/**
 * 3D live audio visual.
 */
@customElement('gdm-live-audio-visuals-3d')
export class GdmLiveAudioVisuals3D extends LitElement {
  // Lazy-loaded modules
  private THREE!: typeof import('three');
  private EXRLoader!: any;
  private EffectComposer!: any;
  private RenderPass!: any;
  private ShaderPass!: any;
  private UnrealBloomPass!: any;
  private FXAAShader!: any;
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;
  private camera!: any;
  private composer!: any;
  private renderer!: any;
  private sphere!: any;
  private prevTime = 0;
  private rotation: any;
  private smoothedScale = 1;
  private smoothedInput: any;
  private smoothedOutput: any;
  private pmremGenerator?: any;
  private resizeObserver?: ResizeObserver;
  private rafId: number | null = null;
  private isAnimating = false;
  private idleCheckTimer: number | null = null;
  private inactiveFrames = 0;
  private readonly INACTIVE_FRAMES_TO_PAUSE = 120; // ~2s @60fps

  private _outputNode!: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode!: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  private canvas!: HTMLCanvasElement;

  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
      image-rendering: pixelated;
      mix-blend-mode: screen;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
  }

  private async init() {
    // Dynamically import Three.js and helpers
    const THREE = (this.THREE = await import('three'));
    const {EXRLoader} = await import('three/examples/jsm/loaders/EXRLoader.js');
    const {EffectComposer} = await import(
      'three/examples/jsm/postprocessing/EffectComposer.js'
    );
    const {RenderPass} = await import(
      'three/examples/jsm/postprocessing/RenderPass.js'
    );
    const {ShaderPass} = await import(
      'three/examples/jsm/postprocessing/ShaderPass.js'
    );
    const {UnrealBloomPass} = await import(
      'three/examples/jsm/postprocessing/UnrealBloomPass.js'
    );
    const {FXAAShader} = await import('three/examples/jsm/shaders/FXAAShader.js');
    this.EXRLoader = EXRLoader;
    this.EffectComposer = EffectComposer;
    this.RenderPass = RenderPass;
    this.ShaderPass = ShaderPass;
    this.UnrealBloomPass = UnrealBloomPass;
    this.FXAAShader = FXAAShader;

    const scene = new THREE.Scene();

    // Heurística de qualidade para dispositivos modestos
    const hc = navigator.hardwareConcurrency || 8;
    const dm = (navigator as any).deviceMemory || 8;
    const lowTier = hc <= 4 || dm <= 4;

    const camera = new THREE.PerspectiveCamera(
      75,
      this.clientWidth / this.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(2, -2, 5);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !lowTier,
      alpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(this.clientWidth, this.clientHeight);
    // Cap DPR to reduce GPU load on high-DPI screens
    const dprCap = lowTier ? 1.0 : 1.5;
    renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
    this.renderer = renderer;

    const subdivisions = lowTier ? 6 : 10;
    const geometry = new THREE.IcosahedronGeometry(1, subdivisions);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    this.pmremGenerator = pmremGenerator;

    new this.EXRLoader().load('piz_compressed.exr', (texture: any) => {
      texture.mapping = this.THREE.EquirectangularReflectionMapping;
      const exrCubeRenderTarget = this.pmremGenerator!.fromEquirectangular(
        texture,
      );
      sphereMaterial.envMap = exrCubeRenderTarget.texture;
      sphere.visible = true;
    });

    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x000010,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x000010,
      emissiveIntensity: 1.5,
    });

    sphereMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = {value: 0};
      shader.uniforms.inputData = {value: new THREE.Vector4()};
      shader.uniforms.outputData = {value: new THREE.Vector4()};

      sphereMaterial.userData.shader = shader;

      shader.vertexShader = sphereVS;
    };

    const sphere = new THREE.Mesh(geometry, sphereMaterial);
    scene.add(sphere);
    sphere.visible = false;

    this.sphere = sphere;

    const renderPass = new this.RenderPass(scene, camera);

    const bloomStrength = lowTier ? 0.45 : 0.8;
    const bloomRadius = lowTier ? 0.3 : 0.5;
    const bloomThreshold = lowTier ? 0.2 : 0.1;
    const bloomPass = new this.UnrealBloomPass(
      new this.THREE.Vector2(this.clientWidth, this.clientHeight),
      bloomStrength,
      bloomRadius,
      bloomThreshold,
    );

    const fxaaPass = new this.ShaderPass(this.FXAAShader);

    const composer = new this.EffectComposer(renderer);
    composer.addPass(renderPass);
    // composer.addPass(fxaaPass);
    composer.addPass(bloomPass);

    this.composer = composer;
    // Initialize dynamic vectors
    this.rotation = new this.THREE.Vector3(0, 0, 0);
    this.smoothedInput = new this.THREE.Vector4();
    this.smoothedOutput = new this.THREE.Vector4();

    // This handler will be called when the component's size changes.
    const onResize = () => {
      const width = this.clientWidth;
      const height = this.clientHeight;

      // Avoid issues when the component is not yet in the DOM or has no size.
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);

      const dPR = renderer.getPixelRatio();
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (width * dPR),
        1 / (height * dPR),
      );
    };

    // Use ResizeObserver to react to container size changes.
    // This is more robust than listening to window.resize.
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(this);
    this.resizeObserver = resizeObserver;

    // Initial call to set the size correctly.
    onResize();

    // Start in idle mode; animate only on activity
    this.startIdleCheck();
  }

  private startAnimation() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const tick = () => {
      if (!this.isAnimating) return;
      this.rafId = requestAnimationFrame(tick);
      this.animationStep();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopAnimation() {
    this.isAnimating = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private animationStep() {
    if (document.visibilityState !== 'visible') {
      return; // Skip rendering while tab is hidden
    }

    this.inputAnalyser?.update();
    this.outputAnalyser?.update();

    const t = performance.now();
    const dt = (t - this.prevTime) / (1000 / 60);
    this.prevTime = t;
    const sphereMaterial = this.sphere.material as any;

    if (sphereMaterial.userData.shader) {
      // Use a damping factor for smoother transitions
      const damping = 0.1;

      // Smoothly update the sphere's scale
      const targetScale = 1 + (0.2 * this.outputAnalyser.data[1]) / 255;
      this.smoothedScale += (targetScale - this.smoothedScale) * damping;
      this.sphere.scale.setScalar(this.smoothedScale);

      // Camera rotation remains cumulative for a fluid motion
      const f = 0.001;
      this.rotation.x += (dt * f * 0.5 * this.outputAnalyser.data[1]) / 255;
      this.rotation.z += (dt * f * 0.5 * this.inputAnalyser.data[1]) / 255;
      this.rotation.y += (dt * f * 0.25 * this.inputAnalyser.data[2]) / 255;
      this.rotation.y += (dt * f * 0.25 * this.outputAnalyser.data[2]) / 255;

      const euler = new this.THREE.Euler(
        this.rotation.x,
        this.rotation.y,
        this.rotation.z,
      );
      const quaternion = new this.THREE.Quaternion().setFromEuler(euler);
      const vector = new this.THREE.Vector3(0, 0, 5);
      vector.applyQuaternion(quaternion);
      this.camera.position.copy(vector);
      this.camera.lookAt(this.sphere.position);

      // Smoothly update shader uniforms for less jarring distortion
      const targetInputData = new this.THREE.Vector4(
        (1 * this.inputAnalyser.data[0]) / 255,
        (0.1 * this.inputAnalyser.data[1]) / 255,
        (10 * this.inputAnalyser.data[2]) / 255,
        0,
      );
      this.smoothedInput.lerp(targetInputData, damping);

      const targetOutputData = new this.THREE.Vector4(
        (2 * this.outputAnalyser.data[0]) / 255,
        (0.1 * this.outputAnalyser.data[1]) / 255,
        (10 * this.outputAnalyser.data[2]) / 255,
        0,
      );
      this.smoothedOutput.lerp(targetOutputData, damping);

      sphereMaterial.userData.shader.uniforms.time.value +=
        (dt * 0.1 * this.outputAnalyser.data[0]) / 255;
      sphereMaterial.userData.shader.uniforms.inputData.value.copy(
        this.smoothedInput,
      );
      sphereMaterial.userData.shader.uniforms.outputData.value.copy(
        this.smoothedOutput,
      );
    }

    this.composer.render();

    // Auto-pause when no activity
    const level = this.getActivityLevel();
    if (level < 8) {
      this.inactiveFrames++;
      if (this.inactiveFrames >= this.INACTIVE_FRAMES_TO_PAUSE) {
        this.stopAnimation();
        this.startIdleCheck();
        this.inactiveFrames = 0;
      }
    } else {
      this.inactiveFrames = 0;
    }
  }

  private getActivityLevel(): number {
    if (!this.inputAnalyser || !this.outputAnalyser) return 0;
    // Use a few low/mid bins to estimate energy
    const bins = [0, 1, 2, 3];
    let sum = 0;
    for (const i of bins) {
      sum += (this.inputAnalyser.data[i] || 0) + (this.outputAnalyser.data[i] || 0);
    }
    return sum / (bins.length * 2); // 0..255 range
  }

  private startIdleCheck() {
    if (this.idleCheckTimer) return;
    this.idleCheckTimer = window.setInterval(() => {
      // Light sampling without full render loop
      this.inputAnalyser?.update();
      this.outputAnalyser?.update();
      const level = this.getActivityLevel();
      if (level >= 12) {
        this.stopIdleCheck();
        this.startAnimation();
      }
    }, 300);
  }

  private stopIdleCheck() {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    this.init();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopAnimation();
    this.stopIdleCheck();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    try {
      (this.sphere.geometry as any).dispose();
      (this.sphere.material as any).dispose();
    } catch {}
    try {
      this.composer?.dispose?.();
    } catch {}
    try {
      this.pmremGenerator?.dispose?.();
      this.pmremGenerator = undefined;
    } catch {}
    try {
      this.renderer?.dispose?.();
      // WebGL context is released by browser; renderer.dispose clears GL resources
    } catch {}
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}
