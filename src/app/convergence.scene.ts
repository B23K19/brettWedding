import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWeave;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vec3 displaced = position;
    float looseness = (1.0 - uWeave) * 0.12;
    float waveA = sin(uv.x * 31.0 - uTime * 1.7 + uv.y * 5.0);
    float waveB = cos(uv.x * 17.0 + uTime * 1.05);
    displaced += normal * (waveA * looseness + waveB * looseness * 0.28);

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDraw;
  uniform float uGold;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    if (vUv.x > uDraw) discard;

    vec3 normal = normalize(vNormalView);
    vec3 viewDirection = normalize(vViewDirection);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4);

    vec3 copper = vec3(0.45, 0.20, 0.105);
    vec3 champagne = vec3(0.88, 0.66, 0.37);
    vec3 ivory = vec3(1.0, 0.91, 0.72);
    vec3 base = mix(copper, champagne, uGold);

    float brushed = 0.82 + 0.18 * sin(vUv.x * 190.0 + vUv.y * 16.0 + uTime * 0.7);
    float movingHighlight = exp(-pow((vUv.x - mod(uTime * 0.095, 1.15)), 2.0) * 210.0);
    float edgeLight = smoothstep(0.1, 0.95, fresnel);

    vec3 colour = base * brushed;
    colour += ivory * (edgeLight * (0.25 + 0.65 * uGold));
    colour += champagne * movingHighlight * 0.72;

    float alpha = uOpacity * (0.72 + 0.28 * fresnel);
    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function ringPoint(t: number, phase: number): THREE.Vector3 {
  const radial = 1.08 + 0.23 * Math.cos(5.0 * t + phase);
  return new THREE.Vector3(
    radial * Math.cos(t),
    radial * Math.sin(t) * 0.72,
    0.31 * Math.sin(5.0 * t + phase),
  );
}

function createFilamentCurve(phase: number, side: number): THREE.CatmullRomCurve3 {
  const end = ringPoint(0, phase);
  const entrance = new THREE.CubicBezierCurve3(
    new THREE.Vector3(side * 7.7, side * 2.4, -1.2),
    new THREE.Vector3(side * 5.0, side * 3.0, 0.85),
    new THREE.Vector3(side * 2.2, -1.9, 0.35),
    end,
  );

  const points = entrance.getPoints(88);
  for (let index = 1; index <= 360; index += 1) {
    points.push(ringPoint((index / 360) * Math.PI * 2, phase));
  }

  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
}

export class ConvergenceScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  private readonly composition = new THREE.Group();
  private readonly filamentMaterials: THREE.ShaderMaterial[] = [];
  private readonly particles: THREE.Points;
  private openingTimeline?: gsap.core.Timeline;
  private scrollContext?: gsap.Context;
  private animationTime = 0;
  private previousFrame = 0;
  private disposed = false;
  private readonly coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !this.coarsePointer,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.coarsePointer ? 1.35 : 1.7));
    this.renderer.setClearColor(0x000000, 0);

    this.camera.position.set(0, 0, 9.4);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffd5a0, 0.65));
    const keyLight = new THREE.PointLight(0xffc77d, 22, 26, 2);
    keyLight.position.set(-3.8, 3.5, 5);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x9d4e35, 16, 24, 2);
    rimLight.position.set(4, -2, -3);
    this.scene.add(rimLight);

    this.buildFilaments();
    this.buildOrnament();
    this.particles = this.buildParticles();
    this.scene.add(this.particles);
    this.scene.add(this.composition);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.renderer.setAnimationLoop((time) => this.render(time));
  }

  private buildFilaments(): void {
    const strands: ReadonlyArray<readonly [number, number, number]> = [
      [0, -1, 0.045],
      [Math.PI, 1, 0.043],
      [Math.PI * 0.5, -1, 0.019],
    ];

    for (const [phase, side, radius] of strands) {
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uDraw: { value: 0.075 },
          uWeave: { value: 0.08 },
          uGold: { value: 0.05 },
          uOpacity: { value: 0.88 },
        },
      }) as THREE.ShaderMaterial;

      const geometry = new THREE.TubeGeometry(createFilamentCurve(phase, side), 760, radius, 10, false);
      const strand = new THREE.Mesh(geometry, material);
      strand.frustumCulled = false;
      this.composition.add(strand);
      this.filamentMaterials.push(material);
    }
  }

  private buildOrnament(): void {
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.008, 8, 260),
      new THREE.MeshBasicMaterial({ color: 0xb98a51, transparent: true, opacity: 0.48 }),
    );
    outerRing.rotation.x = 0.18;
    this.composition.add(outerRing);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.008, 8, 90),
      new THREE.MeshBasicMaterial({ color: 0xf0d19a, transparent: true, opacity: 0.55 }),
    );
    innerRing.position.z = 0.28;
    this.composition.add(innerRing);

    const centre = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.055, 2),
      new THREE.MeshPhysicalMaterial({
        color: 0xf1d7a4,
        metalness: 0.88,
        roughness: 0.19,
        emissive: 0x5c321a,
        emissiveIntensity: 0.55,
        clearcoat: 1,
      }),
    );
    centre.position.z = 0.32;
    this.composition.add(centre);
  }

  private buildParticles(): THREE.Points {
    const count = this.coarsePointer ? 260 : 620;
    const positions = new Float32Array(count * 3);
    let seed = 734_211;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return seed / 4_294_967_296;
    };

    for (let index = 0; index < count; index += 1) {
      const radius = 2.0 + random() * 5.0;
      const angle = random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = (random() - 0.5) * 6.5;
      positions[index * 3 + 2] = (random() - 0.5) * 5.0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xd9b77e,
      size: this.coarsePointer ? 0.022 : 0.028,
      transparent: true,
      opacity: 0.58,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(geometry, material);
  }

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 0.72 ? 48 : 42;
    this.camera.updateProjectionMatrix();

    const portraitScale = width / height < 0.72 ? 0.72 : 1;
    this.composition.scale.setScalar(portraitScale);
  }

  private render(time: number): void {
    if (this.disposed || document.hidden) return;
    const delta = this.previousFrame === 0 ? 0 : Math.min((time - this.previousFrame) / 1000, 0.04);
    this.previousFrame = time;
    this.animationTime += delta;

    for (const material of this.filamentMaterials) {
      material.uniforms['uTime'].value = this.animationTime;
    }

    if (!this.openingTimeline?.isActive()) {
      this.composition.rotation.y += delta * 0.035;
      this.composition.rotation.z = Math.sin(this.animationTime * 0.16) * 0.035;
    }

    this.particles.rotation.y = Math.sin(this.animationTime * 0.035) * 0.1;
    this.particles.rotation.x = Math.cos(this.animationTime * 0.027) * 0.035;
    this.renderer.render(this.scene, this.camera);
  }

  play(onComplete: () => void): void {
    this.openingTimeline?.kill();
    this.filamentMaterials.forEach((material) => {
      material.uniforms['uDraw'].value = 0.035;
      material.uniforms['uWeave'].value = 0.02;
      material.uniforms['uGold'].value = 0.08;
      material.uniforms['uOpacity'].value = 0.95;
    });

    this.camera.position.set(0, 0, 9.4);
    this.composition.rotation.set(0.25, -0.18, -0.08);
    this.composition.scale.setScalar(this.coarsePointer ? 0.72 : 1);

    const drawUniforms = this.filamentMaterials.map((material) => material.uniforms['uDraw']);
    const weaveUniforms = this.filamentMaterials.map((material) => material.uniforms['uWeave']);
    const goldUniforms = this.filamentMaterials.map((material) => material.uniforms['uGold']);

    this.openingTimeline = gsap.timeline({ onComplete })
      .to(drawUniforms, { value: 1, duration: 4.4, ease: 'power2.inOut', stagger: 0.26 }, 0.25)
      .to(this.camera.position, { z: 6.2, x: -0.22, duration: 4.8, ease: 'power1.inOut' }, 0.6)
      .to(weaveUniforms, { value: 1, duration: 3.0, ease: 'sine.inOut', stagger: 0.12 }, 2.35)
      .to(this.composition.rotation, { x: 0.04, y: 0.34, z: 0, duration: 3.8, ease: 'power2.inOut' }, 2.55)
      .to(goldUniforms, { value: 1, duration: 2.4, ease: 'power2.inOut' }, 4.7)
      .to(this.camera.position, { z: 2.45, duration: 1.9, ease: 'power3.in' }, 6.9)
      .to(this.filamentMaterials.map((material) => material.uniforms['uOpacity']), {
        value: 0.52,
        duration: 1.2,
        ease: 'power1.out',
      }, 8.0);
  }

  stop(): void {
    this.openingTimeline?.kill();
    this.openingTimeline = undefined;
    this.settle();
  }

  private settle(): void {
    this.filamentMaterials.forEach((material) => {
      material.uniforms['uDraw'].value = 1;
      material.uniforms['uWeave'].value = 1;
      material.uniforms['uGold'].value = 1;
      material.uniforms['uOpacity'].value = 0.48;
    });
    this.camera.position.set(0.2, 0, 7.2);
    this.composition.rotation.set(0.08, 0.18, 0);
    this.composition.scale.setScalar(this.coarsePointer ? 0.72 : 1);
  }

  bindScroll(container: HTMLElement): void {
    this.scrollContext?.revert();
    this.scrollContext = gsap.context(() => {
      gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.15,
        },
      })
        .to(this.composition.rotation, { y: 1.12, x: 0.52, ease: 'none' }, 0)
        .to(this.composition.position, { y: -0.48, ease: 'none' }, 0)
        .to(this.camera.position, { x: 0.7, z: 6.5, ease: 'none' }, 0);

      container.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 34 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: element,
              start: 'top 86%',
              once: true,
            },
          },
        );
      });
    }, container);

    ScrollTrigger.refresh();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.openingTimeline?.kill();
    this.scrollContext?.revert();
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);

    this.composition.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });

    this.particles.geometry.dispose();
    const particleMaterial = this.particles.material;
    if (Array.isArray(particleMaterial)) particleMaterial.forEach((material) => material.dispose());
    else particleMaterial.dispose();

    this.renderer.dispose();
  }
}
