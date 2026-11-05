import * as THREE from 'three';
import gsap from 'gsap';

const VERT = `
uniform float uTime; uniform float uWeave;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vec3 p = position;
  float loose = (1.0 - uWeave) * 0.14;           // free threads wobble, woven ones settle
  p += normal * sin(uv.x * 60.0 - uTime * 2.0) * loose * 0.3;
  p.y += sin(uv.x * 18.0 - uTime * 1.4) * loose;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform float uDraw; uniform float uGold; uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  if (vUv.x > uDraw) discard;                    // thread is drawn from its tail to its head
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  vec3 copper = vec3(0.74, 0.51, 0.31);
  vec3 champ  = vec3(0.95, 0.85, 0.62);
  vec3 tint   = mix(copper, champ, uGold);
  float band  = 0.5 + 0.5 * sin(vUv.x * 140.0 + uTime * 1.5);
  vec3 col = mix(copper * 0.5, champ, uGold) * (0.55 + 0.45 * band) + fres * tint * 1.3;
  float head = smoothstep(0.05, 0.0, uDraw - vUv.x) * step(uDraw, 0.999);
  col += head * vec3(1.0, 0.9, 0.7) * 1.6;       // bright tip while travelling
  gl_FragColor = vec4(col, 1.0);
}`;

const R = 1.6, r = 0.38, TWISTS = 5; // ring radius, strand offset, twists around the ring

function ringPoint(t: number, phase: number): THREE.Vector3 {
  const k = R + r * Math.cos(TWISTS * t + phase);
  return new THREE.Vector3(k * Math.cos(t), k * Math.sin(t), r * Math.sin(TWISTS * t + phase));
}

// One strand = a Bezier approach from off-screen, then it wraps the ring.
function strand(phase: number, side: number): THREE.CatmullRomCurve3 {
  const end = ringPoint(0, phase);
  const bez = new THREE.CubicBezierCurve3(
    new THREE.Vector3(side * 9, -side * 3 + 1, -4),
    new THREE.Vector3(side * 5, -side * 4, -2),
    end.clone().add(new THREE.Vector3(0, -3, 0)),
    end,
  );
  const pts = bez.getPoints(40);
  for (let i = 1; i <= 240; i++) pts.push(ringPoint((i / 240) * Math.PI * 2, phase));
  return new THREE.CatmullRomCurve3(pts);
}

export class ConvergenceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  private group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];
  private tl?: gsap.core.Timeline;
  private time = { v: 0 };
  private onResize = () => this.resize();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2)); // cap GPU work on phones
    this.camera.position.set(0, 0, 9);
    this.group.rotation.x = 0.45;

    [[0, -1], [Math.PI, 1]].forEach(([phase, side]) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uDraw: { value: 0 }, uWeave: { value: 0 }, uGold: { value: 0 } },
      });
      this.mats.push(mat);
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(strand(phase, side), 700, 0.045, 10, false), mat));
    });
    this.scene.add(this.group);
    addEventListener('resize', this.onResize);
    this.resize();
    this.renderer.setAnimationLoop((t) => {
      this.mats.forEach((m) => (m.uniforms['uTime'].value = t / 1000));
      this.group.rotation.z += 0.0015;
      this.renderer.render(this.scene, this.camera);
    });
  }

  private resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.group.scale.setScalar(w / h < 1 ? 0.62 : 1); // keep the ring inside portrait screens
  }

  /** The opening: threads travel, weave, turn gold, then the camera passes through the ring. */
  play(done: () => void) {
    const u = (i: number) => this.mats[i].uniforms;
    this.tl = gsap.timeline({ onComplete: () => { this.settle(); done(); } })
      .to(u(0)['uDraw'], { value: 1, duration: 4.2, ease: 'power2.inOut' }, 0.3)
      .to(u(1)['uDraw'], { value: 1, duration: 4.2, ease: 'power2.inOut' }, 0.85)
      .to(this.camera.position, { z: 5.4, duration: 4, ease: 'power1.inOut' }, 1.5)
      .to([u(0)['uWeave'], u(1)['uWeave']], { value: 1, duration: 3 }, 2.6)
      .to(this.group.rotation, { x: 0, duration: 3, ease: 'power2.inOut' }, 3)
      .to([u(0)['uGold'], u(1)['uGold']], { value: 1, duration: 2.2 }, 4.8)
      .to(this.camera.position, { z: -1.5, duration: 1.8, ease: 'power3.in' }, 6.6);
  }

  /** Finished state used as the quiet backdrop behind the invitation. */
  settle() {
    this.mats.forEach((m) => {
      m.uniforms['uDraw'].value = 1; m.uniforms['uWeave'].value = 1; m.uniforms['uGold'].value = 1;
    });
    this.camera.position.z = 8;
    this.group.rotation.x = 0.3;
  }

  stop() { this.tl?.kill(); this.settle(); }

  dispose() {
    this.tl?.kill();
    removeEventListener('resize', this.onResize);
    this.renderer.setAnimationLoop(null);
    this.group.children.forEach((c) => (c as THREE.Mesh).geometry.dispose());
    this.mats.forEach((m) => m.dispose());
    this.renderer.dispose();
  }
}
