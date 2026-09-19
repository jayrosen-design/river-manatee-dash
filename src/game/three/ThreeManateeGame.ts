import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { COLS, FOOD_SCORE, JELLY_PENALTY, LIVES_START, SCORE, TILE } from "../constants";
import { levels } from "../data/levels";
import type { BoatRoute, FoodSpec, GateSpec, LevelData } from "../data/types";
import { bus } from "../eventBus";
import { audio } from "../systems/AudioSystem";
import { ScoreSystem } from "../systems/ScoreSystem";

type Dir = "up" | "down" | "left" | "right";

const UNIT = 1.15;
const PLAYER_SPEED = 5 * UNIT;
const DASH_MULTIPLIER = 1.75;
const DASH_DRAIN_PER_S = 0.55;
const DASH_REGEN_PER_S = 0.32;
/** Seconds between pickups that keep a combo chain alive. */
const COMBO_WINDOW = 1.7;
const CLOSE_CALL_BONUS = 50;
/** Boats speed up as the feast is cleared; this is the max extra speed. */
const BOAT_PRESSURE = 0.45;
const CAMERA_BASE = new THREE.Vector3(0, 25, 20);
const SUN_DIRECTION = new THREE.Vector3(-10, 24, 12).normalize();

const DIRS: Record<Dir, { dc: number; dr: number; angle: number }> = {
  up: { dc: 0, dr: -1, angle: 0 },
  right: { dc: 1, dr: 0, angle: -Math.PI / 2 },
  down: { dc: 0, dr: 1, angle: Math.PI },
  left: { dc: -1, dr: 0, angle: Math.PI / 2 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

interface Boat3D {
  route: BoatRoute;
  group: THREE.Group;
  segment: number;
  progress: number;
  wakeClock: number;
  bowFoam: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  prop: THREE.Mesh;
  beacon: THREE.MeshStandardMaterial;
  nearMissArmed: boolean;
  bobPhase: number;
  /** Zone the boat patrols; its speed ramps as that zone is cleared. */
  zone: number;
}

interface Gate3D {
  spec: GateSpec;
  group: THREE.Group;
  boom: THREE.Mesh;
  lights: THREE.MeshStandardMaterial;
  chain: THREE.Mesh[];
  /** 0 = closed, 1 = fully sunk out of the way. */
  openT: number;
  opening: boolean;
}

interface Popup {
  sprite: THREE.Sprite;
  age: number;
  life: number;
}

interface Fish {
  mesh: THREE.Mesh;
  cx: number;
  cz: number;
  radius: number;
  speed: number;
  phase: number;
}

interface PlayerParts {
  body: THREE.Mesh;
  tails: THREE.Mesh[];
  fins: THREE.Mesh[];
}

interface Food3D {
  spec: FoodSpec;
  group: THREE.Group;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  phase: number;
}

interface Jelly3D {
  group: THREE.Group;
  bell: THREE.Mesh;
  tentacles: THREE.Mesh[];
  x: number;
  z: number;
  drift: number;
  phase: number;
}

interface Ripple {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  duration: number;
  stretch: number;
}

interface Droplet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
}

const palette = {
  water: 0x1b8fc4,
  waterDeep: 0x083a63,
  foam: 0xd9fbff,
  sand: 0xb98a50,
  grass: 0x427c5b,
  grassLight: 0x6ca66f,
  rope: 0xd4a34f,
  ink: 0x102b3c,
  red: 0xef5261,
  blue: 0x36a7d6,
  yellow: 0xf0c94d,
};

function gridToWorld(c: number, r: number) {
  return {
    x: (c - 12) * UNIT,
    z: (r - 8) * UNIT,
  };
}

/**
 * Cross-sections of a small planing runabout, bow to stern. Boats face -z.
 * Local y is chosen so the waterline sits at about -0.54 (the boat group rides at 0.42
 * and the water surface is at -0.12), leaving a realistic freeboard above the surface.
 */
interface HullStation {
  z: number;
  w: number;
  keelY: number;
  gunY: number;
}
const HULL_STATIONS: HullStation[] = [
  { z: -1.0, w: 0.03, keelY: -0.4, gunY: -0.16 },
  { z: -0.75, w: 0.19, keelY: -0.56, gunY: -0.22 },
  { z: -0.45, w: 0.3, keelY: -0.63, gunY: -0.26 },
  { z: -0.1, w: 0.36, keelY: -0.66, gunY: -0.29 },
  { z: 0.3, w: 0.37, keelY: -0.66, gunY: -0.3 },
  { z: 0.7, w: 0.35, keelY: -0.64, gunY: -0.3 },
  { z: 0.92, w: 0.33, keelY: -0.62, gunY: -0.3 },
];
const COCKPIT_START_STATION = 3;
const COCKPIT_DEPTH = 0.14;

type Vec = [number, number, number];
let hullGeometryCache: {
  hull: THREE.BufferGeometry;
  foredeck: THREE.BufferGeometry;
  cockpit: THREE.BufferGeometry;
  rail: THREE.Vector3[];
} | null = null;

/** Builds (and caches) the shared hull, deck and rub-rail path for every boat. */
function buildHullGeometries() {
  if (hullGeometryCache) return hullGeometryCache;
  const hullPositions: number[] = [];
  const foredeckPositions: number[] = [];
  const deckPositions: number[] = [];
  const tri = (out: number[], a: Vec, b: Vec, c: Vec) => out.push(...a, ...b, ...c);
  const quad = (out: number[], a: Vec, b: Vec, c: Vec, d: Vec) => {
    tri(out, a, b, c);
    tri(out, a, c, d);
  };
  // Five points per station: gunwale L, chine L, keel, chine R, gunwale R.
  const outline = (s: HullStation): Vec[] => {
    const chineX = s.w * 0.85;
    const chineY = s.keelY + (s.gunY - s.keelY) * 0.3;
    return [
      [-s.w, s.gunY, s.z],
      [-chineX, chineY, s.z],
      [0, s.keelY, s.z],
      [chineX, chineY, s.z],
      [s.w, s.gunY, s.z],
    ];
  };
  const rings = HULL_STATIONS.map(outline);

  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      quad(hullPositions, rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]);
    }
  }
  // Flat transom closes the stern.
  const stern = rings[rings.length - 1];
  const sternStation = HULL_STATIONS[HULL_STATIONS.length - 1];
  const sternCenter: Vec = [0, (sternStation.keelY + sternStation.gunY) / 2, sternStation.z];
  for (let k = 0; k < 4; k++) tri(hullPositions, sternCenter, stern[k + 1], stern[k]);

  // Deck: closed foredeck forward, an open cockpit with a floor and inner walls aft.
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    const sa = HULL_STATIONS[i];
    const sb = HULL_STATIONS[i + 1];
    if (i < COCKPIT_START_STATION) {
      quad(foredeckPositions, a[0], a[4], b[4], b[0]);
      continue;
    }
    const inset = 0.06;
    const iaL: Vec = [-(sa.w - inset), sa.gunY - COCKPIT_DEPTH, sa.z];
    const iaR: Vec = [sa.w - inset, sa.gunY - COCKPIT_DEPTH, sa.z];
    const ibL: Vec = [-(sb.w - inset), sb.gunY - COCKPIT_DEPTH, sb.z];
    const ibR: Vec = [sb.w - inset, sb.gunY - COCKPIT_DEPTH, sb.z];
    quad(deckPositions, iaL, iaR, ibR, ibL); // floor
    quad(deckPositions, a[0], iaL, ibL, b[0]); // port inner wall + cap
    quad(deckPositions, a[4], b[4], ibR, iaR); // starboard inner wall + cap
    if (i === COCKPIT_START_STATION) quad(deckPositions, a[0], a[4], iaR, iaL); // bulkhead
    if (i === rings.length - 2) quad(deckPositions, b[0], ibL, ibR, b[4]); // transom inner
  }

  const toGeometry = (positions: number[], smooth: boolean) => {
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (smooth) geometry = mergeVertices(geometry);
    geometry.computeVertexNormals();
    return geometry;
  };

  // Rub rail follows the sheer line around the whole boat.
  const rail: THREE.Vector3[] = [];
  for (let i = 0; i < HULL_STATIONS.length; i++) {
    const s = HULL_STATIONS[i];
    rail.push(new THREE.Vector3(s.w, s.gunY + 0.005, s.z));
  }
  for (let i = HULL_STATIONS.length - 1; i > 0; i--) {
    const s = HULL_STATIONS[i];
    rail.push(new THREE.Vector3(-s.w, s.gunY + 0.005, s.z));
  }

  hullGeometryCache = {
    hull: toGeometry(hullPositions, true),
    foredeck: toGeometry(foredeckPositions, false),
    cockpit: toGeometry(deckPositions, false),
    rail,
  };
  return hullGeometryCache;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

export class ThreeManateeGame {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private world = new THREE.Group();
  private score = new ScoreSystem();
  private clock = new THREE.Clock();
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private waterMaterial!: THREE.ShaderMaterial;
  private environmentTexture!: THREE.Texture;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  // Camera follow / feedback
  private cameraLook = new THREE.Vector3();
  private cameraFocus: { x: number; z: number; until: number } | null = null;
  private shake = 0;
  private sun!: THREE.DirectionalLight;

  // Zones and gates: the river extends past the screen; each stretch unlocks the next.
  private gates: Gate3D[] = [];
  private unlockedGates = new Set<number>();
  private zoneRemaining: number[] = [];
  private zoneTotal: number[] = [];
  private currentZone = 0;
  private lockedNagAt = 0;

  // Fast-paced gameplay state
  private dashHeld = false;
  private stamina = 1;
  private lastEmittedStamina = -1;
  private combo = 0;
  private comboTimer = 0;
  private swimPhase = 0;
  private playerParts: PlayerParts | null = null;
  private popups: Popup[] = [];
  private fish: Fish[] = [];
  private bubbleClock = 0;

  private levelIndex = 0;
  private level: LevelData = levels[0];
  private levelStartScore = 0;
  private lives = LIVES_START;
  private paused = false;
  private gameOver = false;
  private invulnerableUntil = 0;
  private reducedMotion =
    typeof window !== "undefined" &&
    window.localStorage.getItem("riverManatee.reducedMotion") === "1";

  private player = new THREE.Group();
  private playerC = 1;
  private playerR = 1;
  private targetC = 1;
  private targetR = 1;
  private currentDir: Dir | null = null;
  private bufferedDir: Dir | null = null;
  private moving = false;
  private playerWakeClock = 0;

  private foods: Food3D[] = [];
  private foodTotal = 0;
  private boats: Boat3D[] = [];
  private propellers: { group: THREE.Group; c: number; r: number; radius: number }[] = [];
  private jellies: Jelly3D[] = [];
  private ripples: Ripple[] = [];
  private droplets: Droplet[] = [];
  private heldKeys = new Set<string>();
  private pointerStart: { x: number; y: number; time: number } | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(37, 4 / 3, 0.1, 100);
    this.camera.position.copy(CAMERA_BASE);
    this.camera.lookAt(0, 0, 0);

    // Bloom only lifts the brightest highlights: sun glints, foam, popups, beacons.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.45, 0.9);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.scene.background = new THREE.Color(0x0b3a2f);
    // Cool, slightly green haze reads as shaded forest air rather than steam.
    this.scene.fog = new THREE.FogExp2(0x4f8a70, 0.0065);
    this.scene.add(this.world);
    this.setupLighting();
    this.setupSky();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.bindControls();
    this.bindBus();
    this.startLevel(0, 0);
    this.animate();
  }

  private setupLighting() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environmentTexture;
    pmrem.dispose();

    // Blue sky light bouncing off a deep-green forest floor.
    this.scene.add(new THREE.HemisphereLight(0xbfe6ff, 0x1c4a2a, 2.4));
    const sun = new THREE.DirectionalLight(0xf3fbff, 4.0);
    sun.position.set(-10, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    // The sun (and its shadow frustum) rides along with the scrolling camera.
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  /** World-space extents of the current level's water grid. */
  private levelBounds() {
    const minX = (0 - 12 - 0.5) * UNIT;
    const maxX = (this.level.cols - 1 - 12 + 0.5) * UNIT;
    const minZ = (0 - 8 - 0.5) * UNIT;
    const maxZ = (this.level.rows - 1 - 8 + 0.5) * UNIT;
    return { minX, maxX, minZ, maxZ, centerX: (minX + maxX) / 2, width: maxX - minX };
  }

  /** How far the camera may pan right before the last screen of river is centered. */
  private maxCameraX() {
    return Math.max(0, (this.level.cols - COLS) * UNIT);
  }

  private setupSky() {
    const sky = new Sky();
    sky.scale.setScalar(100);
    const skyUniforms = sky.material.uniforms;
    // Crisp, low-haze sky: cold clear morning over a spring run.
    skyUniforms.turbidity.value = 2.4;
    skyUniforms.rayleigh.value = 2.3;
    skyUniforms.mieCoefficient.value = 0.004;
    skyUniforms.mieDirectionalG.value = 0.8;
    const sun = new THREE.Vector3();
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(212));
    skyUniforms.sunPosition.value.copy(sun);
    this.scene.add(sky);
  }

  /** Banks, forest and shelves sized to the current level so they run its full length. */
  private buildBackdrop() {
    const bounds = this.levelBounds();
    const backdrop = new THREE.Group();
    const spanX = bounds.width + 9;

    // Forest floor banks: dark mossy green running straight down to the water.
    const mossTexture = this.makeMottledTexture("#2f5b39", "#7fa84e", 190);
    mossTexture.repeat.set(Math.round(spanX / 5), 2);
    const bankMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a6b42,
      map: mossTexture,
      roughness: 0.95,
    });
    const bankGeometry = new THREE.BoxGeometry(spanX, 1.6, 4.5);
    for (const z of [-13.2, 13.2]) {
      const bank = new THREE.Mesh(bankGeometry, bankMaterial);
      bank.position.set(bounds.centerX, -0.1, z);
      bank.castShadow = true;
      bank.receiveShadow = true;
      backdrop.add(bank);
    }
    const sideBankGeometry = new THREE.BoxGeometry(4.5, 1.6, 23);
    const sideX = [bounds.minX - 3.8, bounds.maxX + 3.8];
    for (const x of sideX) {
      const bank = new THREE.Mesh(sideBankGeometry, bankMaterial);
      bank.position.set(x, -0.1, 0);
      bank.castShadow = true;
      bank.receiveShadow = true;
      backdrop.add(bank);
    }

    // Dense forest wall: a deep band of overlapping canopy behind the banks.
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x1f5031, roughness: 0.95 });
    const canopyFarMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b6a4a,
      roughness: 1,
    });
    const canopyGeometry = new THREE.SphereGeometry(1, 12, 9);
    const canopyCount = Math.ceil((spanX + 6) / 1.3);
    for (let i = 0; i < canopyCount; i++) {
      const t = i / (canopyCount - 1);
      for (const side of [-1, 1]) {
        const far = i % 3 === 0;
        const canopy = new THREE.Mesh(canopyGeometry, far ? canopyFarMaterial : canopyMaterial);
        const x = bounds.minX - 6 + t * (spanX + 6) + Math.sin(i * 2.3) * 0.6;
        const z = side * (far ? 17.8 : 15.6) + Math.cos(i * 1.7) * 0.7;
        const radius = far ? 2.6 + (i % 4) * 0.35 : 2 + (i % 3) * 0.3;
        canopy.position.set(x, (far ? 3.4 : 2.4) + (i % 2) * 0.35, z);
        canopy.scale.set(radius, radius * (far ? 1.15 : 0.95), radius);
        canopy.castShadow = !far;
        backdrop.add(canopy);
      }
    }
    for (const x of [bounds.minX - 6.2, bounds.maxX + 6.2]) {
      for (let i = 0; i < 12; i++) {
        const canopy = new THREE.Mesh(canopyGeometry, i % 2 ? canopyMaterial : canopyFarMaterial);
        canopy.position.set(
          x + Math.sign(x - bounds.centerX) * (i % 2) * 1.6,
          2.6 + (i % 3) * 0.4,
          -12 + i * 2.2,
        );
        const radius = 2.1 + (i % 3) * 0.3;
        canopy.scale.set(radius, radius, radius);
        backdrop.add(canopy);
      }
    }

    // Near shoreline: cypress, sabal palms and saw palmetto undergrowth along both banks.
    let index = 0;
    const plantTree = (x: number, z: number, kind: "cypress" | "palm") => {
      const scale = 0.9 + (index % 4) * 0.1;
      backdrop.add(
        kind === "palm" ? this.makePalm(x, z, scale, index) : this.makeCypress(x, z, scale, index),
      );
      // Palmetto clump at the foot of each tree, offset toward the water.
      const towardWater = Math.abs(z) > 9 ? -Math.sign(z) * 1.1 : 0;
      const towardWaterX = Math.abs(z) > 9 ? 0 : -Math.sign(x - bounds.centerX) * 1.1;
      backdrop.add(
        this.makePalmetto(x + towardWaterX + Math.sin(index) * 0.8, z + towardWater, index),
      );
      index += 1;
    };
    for (let x = bounds.minX - 2.5; x <= bounds.maxX + 2.5; x += 3.8) {
      const jitter = Math.sin(x * 1.3) * 0.5;
      plantTree(x + jitter, -11.2 - Math.abs(Math.cos(x)) * 0.5, index % 2 ? "palm" : "cypress");
      plantTree(x - jitter, 11.2 + Math.abs(Math.sin(x)) * 0.5, index % 2 ? "palm" : "cypress");
    }
    for (const x of [bounds.minX - 3.2, bounds.maxX + 3.2]) {
      for (const z of [-5.5, 0.5, 6]) plantTree(x, z, index % 2 ? "palm" : "cypress");
    }

    // Pale submerged limestone shelves are characteristic of Florida springs.
    const shelfMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xaad4dc,
      roughness: 0.75,
      transparent: true,
      opacity: 0.58,
    });
    for (let i = 0; i < 14; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.45 + (i % 3) * 0.16, 1),
        shelfMaterial,
      );
      const x = i % 2 ? bounds.minX - 0.4 - (i % 4) * 0.45 : bounds.maxX + 0.4 + (i % 4) * 0.45;
      rock.position.set(x, -0.3, -8 + ((i * 3.1) % 16));
      rock.scale.y = 0.38;
      backdrop.add(rock);
    }
    this.world.add(backdrop);
  }

  private makeCypress(x: number, z: number, scale: number, seed: number) {
    const tree = new THREE.Group();
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x5e4630,
      roughness: 0.92,
    });
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: seed % 2 ? 0x2f6b3f : 0x25583a,
      roughness: 0.88,
    });
    // Bald cypress: buttressed trunk, tall tapering feathery crown.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 4.2, 10), trunkMaterial);
    trunk.position.y = 2.05;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let i = 0; i < 6; i++) {
      const tier = new THREE.Mesh(new THREE.ConeGeometry(1.25 - i * 0.16, 1.3, 9), leafMaterial);
      tier.position.set(
        Math.sin(seed * 2.1 + i) * 0.12,
        2.3 + i * 0.62,
        Math.cos(seed * 1.7 + i) * 0.1,
      );
      tier.rotation.y = seed + i * 0.7;
      tier.castShadow = true;
      tree.add(tier);
    }
    // Cypress knees poking up around the base.
    for (let i = 0; i < 3; i++) {
      const knee = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 6), trunkMaterial);
      knee.position.set(Math.sin(seed + i * 2.1) * 0.7, 0.15, Math.cos(seed + i * 2.1) * 0.7);
      tree.add(knee);
    }
    tree.position.set(x, 0.3, z);
    tree.scale.setScalar(scale);
    return tree;
  }

  private makePalm(x: number, z: number, scale: number, seed: number) {
    const tree = new THREE.Group();
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x7c6a4e, roughness: 0.95 });
    const frondMaterial = new THREE.MeshStandardMaterial({
      color: seed % 2 ? 0x3e8a45 : 0x347a3f,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    // Sabal palm: slightly leaning trunk with a fan of fronds.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 3.6, 9), trunkMaterial);
    trunk.position.y = 1.8;
    trunk.rotation.z = Math.sin(seed) * 0.08;
    trunk.castShadow = true;
    tree.add(trunk);
    const frondGeometry = new THREE.SphereGeometry(0.55, 10, 6);
    for (let i = 0; i < 9; i++) {
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      const angle = (i / 9) * Math.PI * 2 + seed;
      frond.scale.set(0.35, 0.12, 1.4);
      frond.position.set(Math.cos(angle) * 0.62, 3.55 - (i % 2) * 0.12, Math.sin(angle) * 0.62);
      frond.rotation.y = -angle + Math.PI / 2;
      frond.rotation.x = -0.35 - (i % 3) * 0.12;
      frond.castShadow = true;
      tree.add(frond);
    }
    tree.position.set(x, 0.3, z);
    tree.scale.setScalar(scale);
    return tree;
  }

  private makePalmetto(x: number, z: number, seed: number) {
    const clump = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: seed % 3 ? 0x4b9a4c : 0x5aa65a,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const bladeGeometry = new THREE.ConeGeometry(0.22, 0.9, 5);
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(bladeGeometry, material);
      const angle = (i / 7) * Math.PI * 2 + seed * 0.7;
      blade.position.set(Math.cos(angle) * 0.3, 0.55, Math.sin(angle) * 0.3);
      blade.rotation.set(Math.sin(angle) * 0.55, 0, -Math.cos(angle) * 0.55);
      blade.scale.set(1.3, 1, 0.35);
      blade.castShadow = true;
      clump.add(blade);
    }
    clump.position.set(x, 0.3, z);
    clump.scale.setScalar(0.85 + (seed % 3) * 0.12);
    return clump;
  }

  private makeMottledTexture(base: string, accent: string, spots = 120) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = base;
    context.fillRect(0, 0, 128, 128);
    for (let i = 0; i < spots; i++) {
      const x = (i * 47) % 128;
      const y = (i * 83 + (i % 7) * 11) % 128;
      const radius = 1 + (i % 6);
      context.globalAlpha = 0.08 + (i % 4) * 0.035;
      context.fillStyle = accent;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  private startLevel(index: number, startingScore: number) {
    disposeObject(this.world);
    this.scene.remove(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.levelIndex = index;
    this.level = levels[index];
    this.levelStartScore = startingScore;
    this.score.reset();
    this.score.add(startingScore);
    this.lives = LIVES_START;
    this.gameOver = false;
    this.paused = false;
    this.invulnerableUntil = performance.now() + 1800;
    this.foods = [];
    this.boats = [];
    this.propellers = [];
    this.jellies = [];
    this.ripples = [];
    this.droplets = [];
    this.popups = [];
    this.fish = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.stamina = 1;
    this.lastEmittedStamina = -1;
    this.shake = 0;
    this.cameraFocus = null;
    this.gates = [];
    this.unlockedGates = new Set();
    this.lockedNagAt = 0;
    const spawnWorld = gridToWorld(this.level.playerSpawn.c, this.level.playerSpawn.r);
    this.cameraLook.set(THREE.MathUtils.clamp(spawnWorld.x, 0, this.maxCameraX()), 0, 0);
    this.currentZone = this.zoneOf(this.level.playerSpawn.c);
    this.buildBackdrop();
    this.buildWater();
    this.buildCourse();
    this.buildFood();
    this.buildGates();
    this.buildHazards();
    this.buildFish();
    this.buildPlayer();
    this.zoneTotal = this.level.zones.map(
      (zone) =>
        this.foods.filter((food) => food.spec.c >= zone.c0 && food.spec.c <= zone.c1).length,
    );
    this.zoneRemaining = [...this.zoneTotal];
    this.emitHud();
    bus.emit("combo", 1);
    bus.emit("dash", 1);
  }

  private zoneOf(c: number) {
    const index = this.level.zones.findIndex((zone) => c >= zone.c0 && c <= zone.c1);
    return index < 0 ? 0 : index;
  }

  private emitZone() {
    const zone = this.level.zones[this.currentZone];
    bus.emit("zone", {
      index: this.currentZone,
      count: this.level.zones.length,
      name: zone?.name ?? this.level.name,
      remaining: this.zoneRemaining[this.currentZone] ?? 0,
      unlocked:
        this.currentZone >= this.level.gates.length || this.unlockedGates.has(this.currentZone),
    });
  }

  /** Locked booms across the wall openings between zones. */
  private buildGates() {
    const stripes = this.makeStripeTexture("#e94b5a", "#f7f3e8");
    for (const spec of this.level.gates) {
      const group = new THREE.Group();
      const x = gridToWorld(spec.c, 0).x;
      const zStart = gridToWorld(spec.c, spec.rows[0]).z - UNIT * 0.5;
      const zEnd = gridToWorld(spec.c, spec.rows[spec.rows.length - 1]).z + UNIT * 0.5;
      const span = zEnd - zStart;
      const centerZ = (zStart + zEnd) / 2;

      const postMaterial = new THREE.MeshStandardMaterial({ color: 0x4e3a26, roughness: 0.9 });
      const lights = new THREE.MeshStandardMaterial({
        color: 0xff6b6b,
        emissive: 0xff2222,
        emissiveIntensity: 1.6,
        roughness: 0.35,
      });
      for (const z of [zStart, zEnd]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.5, 10), postMaterial);
        post.position.set(x, 0.35, z);
        post.castShadow = true;
        group.add(post);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), lights);
        lamp.position.set(x, 1.18, z);
        group.add(lamp);
      }

      const boomTexture = stripes.clone();
      boomTexture.needsUpdate = true;
      boomTexture.repeat.set(1, Math.round(span * 2));
      const boom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, span - 0.2, 14),
        new THREE.MeshPhysicalMaterial({
          map: boomTexture,
          roughness: 0.4,
          clearcoat: 0.5,
        }),
      );
      boom.rotation.x = Math.PI / 2;
      boom.position.set(x, 0.45, centerZ);
      boom.castShadow = true;
      group.add(boom);

      // Padlock-style chain sag hanging under the boom sells "locked".
      const chainMaterial = new THREE.MeshStandardMaterial({
        color: 0x8d949a,
        metalness: 0.7,
        roughness: 0.4,
      });
      const chain: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), chainMaterial);
        const t = (i + 0.5) / 5;
        link.position.set(x, 0.45 - Math.sin(t * Math.PI) * 0.22, zStart + 0.1 + t * (span - 0.2));
        link.rotation.y = Math.PI / 2;
        group.add(link);
        chain.push(link);
      }

      this.world.add(group);
      this.gates.push({ spec, group, boom, lights, chain, openT: 0, opening: false });
    }
  }

  private makeStripeTexture(colorA: string, colorB: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = colorA;
    context.fillRect(0, 0, 16, 64);
    context.fillStyle = colorB;
    context.fillRect(0, 0, 16, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /** Ambient schooling fish under the surface: pure decoration, adds life. */
  private buildFish() {
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb9d7d0,
      roughness: 0.35,
      metalness: 0.25,
      transparent: true,
      opacity: 0.62,
    });
    const geometry = new THREE.ConeGeometry(0.07, 0.34, 8);
    geometry.rotateX(Math.PI / 2);
    const bounds = this.levelBounds();
    const count = Math.round(16 * (bounds.width / 28));
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, bodyMaterial);
      mesh.scale.set(1, 0.7, 1);
      this.world.add(mesh);
      this.fish.push({
        mesh,
        cx: bounds.minX + 2 + ((i * 5.3) % (bounds.width - 4)),
        cz: ((i * 3.7) % 12) - 6,
        radius: 1.2 + (i % 4) * 0.55,
        speed: 0.5 + (i % 3) * 0.22,
        phase: i * 1.37,
      });
    }
  }

  private buildWater() {
    const bounds = this.levelBounds();
    const width = bounds.width + 8;
    const geometry = new THREE.PlaneGeometry(width, 23, Math.min(512, Math.round(width * 4)), 92);
    // The spring vent boils near the head of the first zone.
    const firstZone = this.level.zones[0];
    const vent = gridToWorld(Math.round((firstZone.c0 + firstZone.c1) / 2), 8);
    this.waterMaterial = new THREE.ShaderMaterial({
      transparent: false,
      uniforms: {
        time: { value: 0 },
        // First-magnitude spring: cold cobalt depths clearing to glass-blue shallows.
        deepColor: { value: new THREE.Color(0x0a3f6e) },
        springColor: { value: new THREE.Color(0x36bde8) },
        ventColor: { value: new THREE.Color(0x7de6ff) },
        ventPosition: { value: new THREE.Vector2(vent.x, vent.z) },
        sunColor: { value: new THREE.Color(0xd9f7ff) },
        sunDirection: { value: SUN_DIRECTION.clone() },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vWave;
        varying vec3 vWorldPosition;
        varying vec3 vNormalW;

        // Returns height and accumulates the analytic slope for lighting.
        float wave(vec2 p, vec2 direction, float frequency, float speed, float amplitude, inout vec2 slope) {
          float phase = dot(p, direction) * frequency + time * speed;
          slope += cos(phase) * amplitude * frequency * direction;
          return sin(phase) * amplitude;
        }

        void main() {
          vUv = uv;
          vec3 p = position;
          vec2 slope = vec2(0.0);
          float broad = wave(p.xy, normalize(vec2(1.0, 0.28)), 0.72, 0.72, 0.055, slope);
          float cross = wave(p.xy, normalize(vec2(-0.35, 1.0)), 1.7, -1.25, 0.032, slope);
          float ripple = wave(p.xy, normalize(vec2(0.75, -0.6)), 3.7, 2.2, 0.014, slope);
          float chop = wave(p.xy, normalize(vec2(-0.9, -0.4)), 6.5, 3.1, 0.006, slope);
          p.z += broad + cross + ripple + chop;
          vWave = broad + cross + ripple + chop;
          // Plane is rotated -90deg about X, so local (x, y) -> world (x, -z).
          vNormalW = normalize(vec3(-slope.x, 1.0, slope.y));
          vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 deepColor;
        uniform vec3 springColor;
        uniform vec3 ventColor;
        uniform vec2 ventPosition;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying float vWave;
        varying vec3 vWorldPosition;
        varying vec3 vNormalW;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
        }

        float caustics(vec2 uv) {
          vec2 p = uv * 15.0;
          float c1 = abs(sin(p.x + sin(p.y + time * 0.85)));
          float c2 = abs(sin(p.y * 1.18 + sin(p.x * 0.82 - time * 0.62)));
          float detail = noise(p * 1.9 + time * 0.18);
          return pow(1.0 - abs(c1 - c2), 9.0) * (0.55 + detail * 0.45);
        }

        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(viewDirection.y, 0.0), 3.2);
          // Patterns are sampled in world space so they never stretch on long rivers.
          vec2 wuv = vWorldPosition.xz / 32.0 + 0.5;
          float depthVariation = noise(wuv * 5.5) * 0.16 + (0.5 - vWorldPosition.z / 23.0) * 0.2;
          vec3 color = mix(deepColor, springColor, 0.42 + depthVariation + vWave * 1.7);
          float lightDance = caustics(wuv + vec2(time * 0.008, -time * 0.012));
          color += sunColor * lightDance * 0.24;
          // Spring vent "boil": a bright, cold blue upwelling near the head of the run.
          float vent = smoothstep(9.5, 0.0, distance(vWorldPosition.xz, ventPosition));
          vent *= 0.75 + 0.25 * noise(wuv * 14.0 + vec2(time * 0.05, -time * 0.03));
          color = mix(color, ventColor, vent * 0.42);
          color = mix(color, vec3(0.42, 0.78, 0.92), fresnel * 0.4);
          float crest = smoothstep(0.067, 0.095, vWave);
          color += sunColor * crest * 0.32;
          // Sun glints: sharp specular off the analytic wave normal (bloom picks these up).
          vec3 n = normalize(vNormalW);
          vec3 halfVector = normalize(sunDirection + viewDirection);
          float glint = pow(max(dot(n, halfVector), 0.0), 140.0);
          float sparkle = pow(max(dot(n, halfVector), 0.0), 900.0) * (0.6 + 0.4 * noise(wuv * 90.0 + time));
          color += vec3(1.0, 0.98, 0.9) * (glint * 0.42 + sparkle * 1.1);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const water = new THREE.Mesh(geometry, this.waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(bounds.centerX, -0.12, 0);
    water.receiveShadow = true;
    this.world.add(water);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 2, 25),
      new THREE.MeshStandardMaterial({ color: palette.waterDeep, roughness: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(bounds.centerX, -0.55, 0);
    this.world.add(floor);
  }

  private buildCourse() {
    const ropeCells: { c: number; r: number }[] = [];
    const boundaryCells: { c: number; r: number }[] = [];
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        if (this.level.grid[r][c] !== "rope") continue;
        ropeCells.push({ c, r });
        const neighbors = [
          this.level.grid[r - 1]?.[c],
          this.level.grid[r + 1]?.[c],
          this.level.grid[r]?.[c - 1],
          this.level.grid[r]?.[c + 1],
        ];
        if (neighbors.some((tile) => tile !== "rope")) boundaryCells.push({ c, r });
      }
    }

    // Blocked regions read as shallow, planted spring shelves rather than land.
    const shelfTexture = this.makeMottledTexture("#547c63", "#bdd88b", 155);
    shelfTexture.repeat.set(2, 2);
    const shelfGeometry = new THREE.BoxGeometry(UNIT * 0.95, 0.12, UNIT * 0.95);
    const shelfMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x547c63,
      map: shelfTexture,
      roughness: 0.88,
      transparent: true,
      opacity: 0.76,
    });
    const shelves = new THREE.InstancedMesh(shelfGeometry, shelfMaterial, ropeCells.length);
    shelves.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    ropeCells.forEach(({ c, r }, index) => {
      const p = gridToWorld(c, r);
      matrix.makeTranslation(p.x, -0.29, p.z);
      shelves.setMatrixAt(index, matrix);
    });
    this.world.add(shelves);

    const woodTexture = this.makeMottledTexture("#8b6037", "#e0a75d", 165);
    woodTexture.repeat.set(2, 2);
    const floatGeometry = new THREE.SphereGeometry(0.37, 20, 14);
    const floatMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8b6037,
      map: woodTexture,
      roughness: 0.77,
      clearcoat: 0.08,
    });
    const floats = new THREE.InstancedMesh(floatGeometry, floatMaterial, boundaryCells.length);
    floats.castShadow = true;
    boundaryCells.forEach(({ c, r }, index) => {
      const p = gridToWorld(c, r);
      matrix.compose(
        new THREE.Vector3(p.x, 0.08, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1.18, 0.42, 1.18),
      );
      floats.setMatrixAt(index, matrix);
    });
    this.world.add(floats);

    const ropeMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b3b24,
      roughness: 0.96,
    });
    const boundaryKeys = new Set(boundaryCells.map(({ c, r }) => `${c},${r}`));
    for (const { c, r } of boundaryCells) {
      const from = gridToWorld(c, r);
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
      ]) {
        if (!boundaryKeys.has(`${c + dc},${r + dr}`)) continue;
        const to = gridToWorld(c + dc, r + dr);
        this.world.add(
          this.makeConnector(
            new THREE.Vector3(from.x, 0.08, from.z),
            new THREE.Vector3(to.x, 0.08, to.z),
            ropeMaterial,
          ),
        );
      }
    }

    boundaryCells.forEach(({ c, r }) => {
      if ((c * 3 + r * 5) % 11 !== 0) return;
      const p = gridToWorld(c, r);
      const marker = this.makeChannelMarker();
      marker.position.set(p.x, 0.24, p.z);
      this.world.add(marker);
    });

    this.addSpringDecor();
  }

  private makeConnector(from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, direction.length(), 8),
      material,
    );
    connector.position.copy(from).add(to).multiplyScalar(0.5);
    connector.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    connector.castShadow = true;
    return connector;
  }

  private makeChannelMarker() {
    const marker = new THREE.Group();
    const colors = [0xef476f, 0xffffff, 0xef476f];
    colors.forEach((color, index) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.12, 14),
        new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.45,
          clearcoat: 0.4,
        }),
      );
      band.position.y = index * 0.11;
      band.castShadow = true;
      marker.add(band);
    });
    return marker;
  }

  private addSpringDecor() {
    const padMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x68ad5c,
      roughness: 0.7,
      clearcoat: 0.18,
    });
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d8568,
      roughness: 0.82,
    });
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x778c88,
      roughness: 0.9,
    });
    for (let r = 1; r < this.level.rows - 1; r++) {
      for (let c = 1; c < this.level.cols - 1; c++) {
        if (this.level.grid[r][c] !== "water") continue;
        const p = gridToWorld(c, r);
        const code = (c * 17 + r * 31 + this.levelIndex * 7) % 43;
        if (code === 4 || code === 21) {
          const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(0.21, 0.23, 0.025, 18),
            padMaterial,
          );
          pad.position.set(p.x + 0.27, 0.005, p.z - 0.2);
          pad.scale.z = 0.72;
          this.world.add(pad);
        } else if (code === 9) {
          const grass = new THREE.Group();
          for (let blade = 0; blade < 4; blade++) {
            const stem = new THREE.Mesh(
              new THREE.ConeGeometry(0.035, 0.5 + blade * 0.06, 6),
              grassMaterial,
            );
            stem.position.set((blade - 1.5) * 0.07, 0.08, Math.sin(blade) * 0.06);
            stem.rotation.z = (blade - 1.5) * 0.08;
            grass.add(stem);
          }
          grass.position.set(p.x - 0.25, -0.17, p.z + 0.2);
          this.world.add(grass);
        } else if (code === 14) {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 1), rockMaterial);
          rock.scale.y = 0.5;
          rock.position.set(p.x + 0.22, -0.1, p.z + 0.18);
          this.world.add(rock);
        }
      }
    }
  }

  private buildPlayer() {
    this.player = this.makeManatee(this.level.characterVariant);
    const spawn = this.level.playerSpawn;
    this.playerC = this.targetC = spawn.c;
    this.playerR = this.targetR = spawn.r;
    // Clear any motion carried over from the previous run so a restart starts at rest.
    this.moving = false;
    this.currentDir = null;
    this.bufferedDir = null;
    this.dashHeld = false;
    this.playerWakeClock = 0;
    this.bubbleClock = 0;
    const p = gridToWorld(spawn.c, spawn.r);
    this.player.position.set(p.x, 0.43, p.z);
    this.world.add(this.player);
  }

  private makeManatee(variant: LevelData["characterVariant"]) {
    const colors = {
      manny: [0x94aeb5, 0xd8e8e7],
      coral: [0xb69f96, 0xf2d8cc],
      sage: [0x82a69b, 0xd4ebe0],
    }[variant];
    const group = new THREE.Group();
    const skinTexture = this.makeMottledTexture(
      `#${colors[0].toString(16).padStart(6, "0")}`,
      "#e7f3ec",
      95,
    );
    skinTexture.repeat.set(2, 3);
    const skin = new THREE.MeshPhysicalMaterial({
      color: colors[0],
      map: skinTexture,
      roughness: 0.58,
      metalness: 0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.5,
    });
    const belly = new THREE.MeshPhysicalMaterial({
      color: colors[1],
      roughness: 0.62,
      clearcoat: 0.08,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 40, 28), skin);
    body.scale.set(0.8, 0.72, 1.42);
    body.castShadow = true;
    group.add(body);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.25, 28, 18), belly);
    snout.scale.set(1.15, 0.65, 0.85);
    snout.position.set(0, -0.02, -0.54);
    group.add(snout);

    // Flippers and tail flukes get pivots at their roots so they can paddle/beat.
    const finGeometry = new THREE.SphereGeometry(0.22, 24, 16);
    const fins: THREE.Mesh[] = [];
    const tails: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const finPivot = new THREE.Mesh(new THREE.BufferGeometry(), skin);
      finPivot.position.set(side * 0.3, -0.08, 0.02);
      const fin = new THREE.Mesh(finGeometry, skin);
      fin.scale.set(0.45, 0.22, 1.15);
      fin.position.set(side * 0.14, -0.02, 0);
      fin.rotation.z = side * 0.38;
      fin.castShadow = true;
      finPivot.add(fin);
      group.add(finPivot);
      fins.push(finPivot);

      const tailPivot = new THREE.Mesh(new THREE.BufferGeometry(), skin);
      tailPivot.position.set(0, 0, 0.5);
      const tail = new THREE.Mesh(finGeometry, skin);
      tail.scale.set(0.85, 0.18, 0.55);
      tail.position.set(side * 0.16, 0, 0.22);
      tail.rotation.y = side * 0.45;
      tail.castShadow = true;
      tailPivot.add(tail);
      group.add(tailPivot);
      tails.push(tailPivot);
    }
    this.playerParts = { body, tails, fins };

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x071e2b });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMaterial);
      eye.position.set(side * 0.17, 0.22, -0.43);
      group.add(eye);
    }
    const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x44595b, roughness: 0.75 });
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), noseMaterial);
      nostril.position.set(side * 0.072, 0.035, -0.742);
      group.add(nostril);
    }
    group.scale.setScalar(0.88);
    return group;
  }

  private buildFood() {
    for (const spec of this.level.foods) {
      const p = gridToWorld(spec.c, spec.r);
      const group = this.makeFood(spec);
      group.position.set(p.x, 0.24, p.z);
      const ring = this.makePersistentRing(p.x, p.z, spec.kind === "lettuce" ? 0x8ef15c : 0xf7d768);
      this.foods.push({ spec, group, ring, phase: Math.random() * Math.PI * 2 });
      this.world.add(group, ring);
    }
    this.foodTotal = this.foods.length;
  }

  private makeFood(spec: FoodSpec) {
    const group = new THREE.Group();
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.32, 0.055, 20),
      new THREE.MeshStandardMaterial({ color: 0x3d8a54, roughness: 0.8 }),
    );
    pad.castShadow = true;
    group.add(pad);

    const colors: Record<FoodSpec["kind"], number> = {
      lettuce: 0x91e35b,
      seaweed: 0x2fa875,
      shrimp: 0xff8a70,
      fish: 0xffce55,
    };
    const morselMaterial = new THREE.MeshPhysicalMaterial({
      color: colors[spec.kind],
      roughness: 0.5,
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
    });
    if (spec.kind === "lettuce") {
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), morselMaterial);
        const angle = (i / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(angle) * 0.11, 0.14 + (i % 2) * 0.025, Math.sin(angle) * 0.11);
        leaf.scale.set(1.15, 0.72, 0.85);
        leaf.castShadow = true;
        group.add(leaf);
      }
    } else {
      const morsel = new THREE.Mesh(new THREE.SphereGeometry(0.17, 22, 14), morselMaterial);
      morsel.position.y = 0.16;
      morsel.scale.set(spec.kind === "fish" ? 1.35 : 1, 0.75, spec.kind === "seaweed" ? 0.7 : 1);
      morsel.castShadow = true;
      group.add(morsel);
    }
    return group;
  }

  private makePersistentRing(x: number, z: number, color: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.275, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.015, z);
    return ring;
  }

  private buildHazards() {
    this.level.boats.forEach((route, index) => {
      const group = this.makeBoat(route.colorIndex);
      const p = gridToWorld(route.waypoints[0].c, route.waypoints[0].r);
      group.position.set(p.x, 0.42, p.z);
      this.world.add(group);
      this.boats.push({
        route,
        group,
        segment: 0,
        progress: 0,
        wakeClock: 0,
        bowFoam: group.userData.bowFoam,
        prop: group.userData.prop,
        beacon: group.userData.beacon,
        nearMissArmed: true,
        bobPhase: index * 1.9,
        zone: this.zoneOf(route.waypoints[0].c),
      });
    });

    this.level.propellers.forEach((spec) => {
      const p = gridToWorld(spec.c, spec.r);
      const group = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({
        color: 0xc4d0d4,
        metalness: 0.9,
        roughness: 0.2,
      });
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.62), metal);
        blade.position.z = -0.25;
        blade.rotation.y = (i / 3) * Math.PI * 2;
        group.add(blade);
      }
      group.position.set(p.x, 0.18, p.z);
      this.world.add(group);
      this.createRipple(p.x, p.z, 0xff725c, 1.8, 1.4);
      this.propellers.push({ group, c: spec.c, r: spec.r, radius: spec.radiusTiles * UNIT });
    });

    this.level.jellyfish.forEach((spec) => {
      const p = gridToWorld(spec.c, spec.r);
      const group = new THREE.Group();
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0xc984df,
          emissive: 0x743b94,
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.78,
        }),
      );
      group.add(bell);
      const tentacles: THREE.Mesh[] = [];
      for (let i = -2; i <= 2; i++) {
        const tentacle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.025, 0.38, 6),
          bell.material,
        );
        // Pivot at the top so the tentacle can sway from the bell rim.
        tentacle.geometry.translate(0, -0.19, 0);
        tentacle.position.set(i * 0.09, 0.01, 0);
        group.add(tentacle);
        tentacles.push(tentacle);
      }
      group.position.set(p.x, 0.25, p.z);
      this.world.add(group);
      this.jellies.push({
        group,
        bell,
        tentacles,
        x: p.x,
        z: p.z,
        drift: (spec.drift ?? 0) * UNIT,
        phase: Math.random() * Math.PI * 2,
      });
    });
  }

  private makeBoat(colorIndex: number) {
    const group = new THREE.Group();
    const hullColor = [palette.red, palette.blue, palette.yellow][colorIndex % 3];
    const hullTexture = this.makeMottledTexture(
      `#${hullColor.toString(16).padStart(6, "0")}`,
      "#ffffff",
      45,
    );
    hullTexture.repeat.set(2, 4);
    const hullMaterial = new THREE.MeshPhysicalMaterial({
      color: hullColor,
      map: hullTexture,
      roughness: 0.3,
      metalness: 0.08,
      clearcoat: 0.7,
      clearcoatRoughness: 0.22,
      side: THREE.DoubleSide,
    });
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3efe2,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c2226,
      roughness: 0.5,
      metalness: 0.3,
    });
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd3dde2,
      metalness: 0.85,
      roughness: 0.2,
    });

    // Planing V-hull with a flat transom, plus foredeck and open cockpit.
    const { hull: hullGeometry, foredeck, cockpit, rail } = buildHullGeometries();
    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    hull.castShadow = true;
    group.add(hull);
    // Foredeck carries the hull color so boats stay identifiable from above;
    // the cockpit is cream non-skid.
    const bow = new THREE.Mesh(
      foredeck,
      new THREE.MeshPhysicalMaterial({
        color: hullColor,
        roughness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    bow.castShadow = true;
    bow.receiveShadow = true;
    group.add(bow);
    const deck = new THREE.Mesh(cockpit, deckMaterial);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // Rub rail around the sheer line.
    const railCurve = new THREE.CatmullRomCurve3(rail, true, "centripetal", 0.6);
    const rubRail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 72, 0.022, 6, true),
      trimMaterial,
    );
    group.add(rubRail);

    // Foredeck hatch.
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.015, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xe4dfcf, roughness: 0.6 }),
    );
    hatch.position.set(0, -0.235, -0.5);
    group.add(hatch);

    // Center console with a raked windshield and a small grab rail.
    const floorY = HULL_STATIONS[COCKPIT_START_STATION].gunY - COCKPIT_DEPTH;
    const helmConsole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.24), deckMaterial);
    helmConsole.position.set(0, floorY + 0.13, 0.08);
    helmConsole.castShadow = true;
    group.add(helmConsole);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.1), trimMaterial);
    dash.position.set(0, floorY + 0.27, 0.02);
    group.add(dash);
    const windshield = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.17),
      new THREE.MeshPhysicalMaterial({
        color: 0x9fdcf0,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    windshield.position.set(0, floorY + 0.35, -0.04);
    windshield.rotation.x = -0.42;
    group.add(windshield);
    const grabRail = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.012, 6, 14, Math.PI),
      chromeMaterial,
    );
    grabRail.position.set(0, floorY + 0.29, -0.09);
    grabRail.rotation.z = Math.PI;
    grabRail.rotation.x = Math.PI / 2;
    group.add(grabRail);

    // Helm seat behind the console and a bench across the stern.
    // Upholstery picks up a lighter tint of the hull color.
    const cushionMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hullColor).lerp(new THREE.Color(0xffffff), 0.45),
      roughness: 0.85,
    });
    const helmSeat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.18), cushionMaterial);
    helmSeat.position.set(0, floorY + 0.09, 0.36);
    group.add(helmSeat);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.16), cushionMaterial);
    bench.position.set(0, floorY + 0.06, 0.72);
    group.add(bench);
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.04), cushionMaterial);
    backrest.position.set(0, floorY + 0.14, 0.81);
    group.add(backrest);

    // Outboard motor hung on the transom: cowling, lower unit, skeg and prop.
    const motorMaterial = new THREE.MeshStandardMaterial({
      color: 0x22292f,
      roughness: 0.4,
      metalness: 0.45,
    });
    const cowling = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.26), motorMaterial);
    cowling.position.set(0, -0.19, 1.04);
    cowling.castShadow = true;
    group.add(cowling);
    const cowlingCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.35 }),
    );
    cowlingCap.position.set(0, -0.06, 1.04);
    group.add(cowlingCap);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), trimMaterial);
    bracket.position.set(0, -0.32, 0.95);
    group.add(bracket);
    const lowerUnit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.12), motorMaterial);
    lowerUnit.position.set(0, -0.45, 1.06);
    group.add(lowerUnit);
    const skeg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.16), motorMaterial);
    skeg.position.set(0, -0.6, 1.08);
    group.add(skeg);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.015), chromeMaterial);
    prop.position.set(0, -0.53, 1.14);
    group.add(prop);
    group.userData.prop = prop;

    // Foam sheet pushed ahead of the bow; scaled by boat speed each frame.
    const bowFoam = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 22),
      new THREE.MeshBasicMaterial({
        color: 0xf2ffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    bowFoam.rotation.x = -Math.PI / 2;
    bowFoam.position.set(0, -0.5, -1.02);
    bowFoam.scale.set(1, 0.55, 1);
    group.add(bowFoam);
    group.userData.bowFoam = bowFoam;

    // All-round navigation light on a short mast; pulses red when closing on the player.
    const beaconMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5a5a,
      emissive: 0xff2b2b,
      emissiveIntensity: 0,
      roughness: 0.35,
    });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), chromeMaterial);
    mast.position.set(0.1, floorY + 0.36, 0.14);
    group.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), beaconMaterial);
    beacon.position.set(0.1, floorY + 0.46, 0.14);
    group.add(beacon);
    group.userData.beacon = beaconMaterial;
    return group;
  }

  private bindControls() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
  }

  private bindBus() {
    bus.on("cmd_pause", this.onPause);
    bus.on("cmd_resume", this.onResume);
    bus.on("cmd_restart", this.onRestart);
    bus.on("cmd_nextLevel", this.onNextLevel);
    bus.on("cmd_setMuted", this.onMuted);
    bus.on("cmd_setReducedMotion", this.onReducedMotion);
    bus.on("cmd_dir", this.onDirection);
    bus.on("cmd_dash", this.onDash);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault();
    }
    this.heldKeys.add(event.key.toLowerCase());
    if (event.key === " " || event.key === "Shift") {
      if (!this.dashHeld && this.stamina > 0.05) audio.play("dash");
      this.dashHeld = true;
    }
    const map: Record<string, Dir | undefined> = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };
    const direction = map[event.key.toLowerCase()];
    if (direction) this.queueDirection(direction);
    if (event.key === "Escape") this.setPaused(!this.paused);
    audio.unlock();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.key.toLowerCase());
    if (event.key === " " || event.key === "Shift") this.dashHeld = false;
  };

  private onDash = (held: boolean) => {
    if (held && !this.dashHeld && this.stamina > 0.05) audio.play("dash");
    this.dashHeld = held;
    audio.unlock();
  };

  private onPointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    audio.unlock();
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointerStart) return;
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    const elapsed = performance.now() - this.pointerStart.time;
    this.pointerStart = null;
    if (elapsed > 800 || Math.hypot(dx, dy) < 24) return;
    this.queueDirection(
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up",
    );
  };

  private onPause = () => this.setPaused(true);
  private onResume = () => this.setPaused(false);
  private onRestart = () => this.startLevel(this.levelIndex, this.levelStartScore);
  private onNextLevel = () =>
    this.startLevel(
      this.levelIndex === levels.length - 1 ? 0 : this.levelIndex + 1,
      this.levelIndex === levels.length - 1 ? 0 : this.score.score,
    );
  private onMuted = (muted: boolean) => audio.setMuted(muted);
  private onReducedMotion = (reduced: boolean) => {
    this.reducedMotion = reduced;
    window.localStorage.setItem("riverManatee.reducedMotion", reduced ? "1" : "0");
  };
  private onDirection = (direction: Dir) => this.queueDirection(direction);

  private queueDirection(direction: Dir) {
    if (this.paused || this.gameOver) return;
    if (this.moving && this.currentDir && direction === OPPOSITE[this.currentDir]) {
      // Instant reversal mid-tile: swap origin and target so the turn feels snappy.
      const c = this.playerC;
      const r = this.playerR;
      this.playerC = this.targetC;
      this.playerR = this.targetR;
      this.targetC = c;
      this.targetR = r;
      this.currentDir = direction;
      this.bufferedDir = null;
      this.player.rotation.y = DIRS[direction].angle;
      return;
    }
    if (!this.moving && this.canMove(direction)) {
      this.currentDir = direction;
      this.beginStep(direction);
    } else {
      this.bufferedDir = direction;
      if (!this.moving) this.nagIfLocked(direction);
    }
  }

  /** Bumping a locked boom tells the player what still needs eating. */
  private nagIfLocked(direction: Dir) {
    const d = DIRS[direction];
    const tile = this.level.grid[this.playerR + d.dr]?.[this.playerC + d.dc];
    if (tile !== "gate") return;
    const now = performance.now();
    if (now - this.lockedNagAt < 900) return;
    this.lockedNagAt = now;
    const remaining = this.zoneRemaining[this.currentZone] ?? 0;
    this.spawnPopup(
      this.player.position.x,
      this.player.position.z,
      `LOCKED · ${remaining} LEFT`,
      "#ff8a8a",
    );
    audio.play("locked");
    if (!this.reducedMotion) this.shake = Math.max(this.shake, 0.25);
  }

  private gateAt(c: number) {
    return this.level.gates.find((gate) => gate.c === c);
  }

  private canMove(direction: Dir) {
    const d = DIRS[direction];
    const c = this.playerC + d.dc;
    const r = this.playerR + d.dr;
    if (c < 0 || c >= this.level.cols || r < 0 || r >= this.level.rows) return false;
    const tile = this.level.grid[r][c];
    if (tile === "rope") return false;
    if (tile === "gate") {
      const gate = this.gateAt(c);
      return !!gate && this.unlockedGates.has(gate.index);
    }
    return true;
  }

  private beginStep(direction: Dir) {
    const d = DIRS[direction];
    this.targetC = this.playerC + d.dc;
    this.targetR = this.playerR + d.dr;
    this.player.rotation.y = d.angle;
    this.moving = true;
  }

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.04);
    const elapsed = this.clock.elapsedTime;
    if (!this.paused && !this.gameOver) this.update(dt, elapsed);
    this.updateFish(dt, elapsed);
    this.updateCamera(dt, elapsed);
    this.waterMaterial.uniforms.time.value = elapsed;
    this.composer.render();
  };

  private update(dt: number, elapsed: number) {
    this.updateCombo(dt);
    this.updatePlayer(dt, elapsed);
    this.updateBoats(dt, elapsed);
    this.updateHazards(dt, elapsed);
    this.updateGates(dt, elapsed);
    this.updateFood(elapsed);
    this.updateEffects(dt);
    this.updatePopups(dt);
    this.checkCollectibles();
    this.checkHazards();
  }

  private updateGates(dt: number, elapsed: number) {
    for (const gate of this.gates) {
      if (gate.opening && gate.openT < 1) {
        gate.openT = Math.min(1, gate.openT + dt / 1.1);
        const eased = 1 - Math.pow(1 - gate.openT, 3);
        const y = THREE.MathUtils.lerp(0.45, -0.75, eased);
        gate.boom.position.y = y;
        gate.boom.rotation.z = eased * 0.35;
        gate.chain.forEach((link, index) => {
          const t = (index + 0.5) / gate.chain.length;
          link.position.y = y - Math.sin(t * Math.PI) * 0.22;
        });
        if (gate.openT === 1) gate.opening = false;
      }
      if (this.unlockedGates.has(gate.spec.index)) {
        gate.lights.emissive.setHex(0x2bff7a);
        gate.lights.color.setHex(0x8affb8);
        gate.lights.emissiveIntensity = 1.4 + Math.sin(elapsed * 4) * 0.4;
      } else {
        gate.lights.emissiveIntensity = 1.2 + Math.sin(elapsed * 5 + gate.spec.index) * 0.8;
      }
    }
  }

  private unlockGate(index: number) {
    const gate = this.gates.find((g) => g.spec.index === index);
    if (!gate || this.unlockedGates.has(index)) return;
    this.unlockedGates.add(index);
    gate.opening = true;
    const x = gate.boom.position.x;
    const z = gate.boom.position.z;
    this.splash(x, z, 0xbdf6ff);
    this.splash(x, z - 0.6, 0xbdf6ff);
    this.splash(x, z + 0.6, 0xbdf6ff);
    audio.play("gate");
    this.spawnPopup(x, z, "CHANNEL OPEN →", "#8affb8");
    // Briefly swing the camera to show the opened boom, then return to the manatee.
    if (!this.reducedMotion) {
      this.cameraFocus = { x, z, until: performance.now() + 1400 };
    }
    this.emitZone();
  }

  /** True while the player is actively boosting (key held and stamina left). */
  private get dashing() {
    return this.dashHeld && this.stamina > 0 && this.moving;
  }

  private updateCombo(dt: number) {
    if (this.combo === 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.combo = 0;
      bus.emit("combo", 1);
    }
  }

  private get comboMultiplier() {
    return this.combo >= 9 ? 4 : this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1;
  }

  private updateCamera(dt: number, elapsed: number) {
    // The river runs past the screen: scroll horizontally with the manatee, leading the
    // swim direction slightly, and lean a little vertically so the course stays framed.
    const lead = this.currentDir === "left" ? -1.6 : this.currentDir === "right" ? 1.6 : 0;
    let targetX = THREE.MathUtils.clamp(this.player.position.x + lead, 0, this.maxCameraX());
    let targetZ = THREE.MathUtils.clamp(this.player.position.z * 0.22, -1.8, 1.8);
    let ease = 1 - Math.exp(-dt * 3.4);
    if (this.cameraFocus) {
      if (performance.now() < this.cameraFocus.until) {
        targetX = THREE.MathUtils.clamp(this.cameraFocus.x, 0, this.maxCameraX());
        targetZ = THREE.MathUtils.clamp(this.cameraFocus.z * 0.22, -1.8, 1.8);
        ease = 1 - Math.exp(-dt * 5);
      } else {
        this.cameraFocus = null;
      }
    }
    this.cameraLook.lerp(new THREE.Vector3(targetX, 0, targetZ), ease);

    // Keep the sun's shadow frustum centered on what the camera sees.
    this.sun.position.set(this.cameraLook.x - 10, 24, this.cameraLook.z + 12);
    this.sun.target.position.set(this.cameraLook.x, 0, this.cameraLook.z);
    this.sun.target.updateMatrixWorld();

    this.shake = Math.max(0, this.shake - dt * 1.9);
    const jitter = this.reducedMotion ? 0 : this.shake * this.shake * 0.45;
    const sx = Math.sin(elapsed * 61) * jitter;
    const sy = Math.cos(elapsed * 47) * jitter;

    this.camera.position.set(
      CAMERA_BASE.x + this.cameraLook.x + sx,
      CAMERA_BASE.y + sy,
      CAMERA_BASE.z + this.cameraLook.z,
    );
    this.camera.lookAt(this.cameraLook.x, 0, this.cameraLook.z);

    const targetFov = this.dashing ? 40.5 : 37;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-dt * 6));
      this.camera.updateProjectionMatrix();
    }
  }

  private updateFish(dt: number, elapsed: number) {
    for (const fish of this.fish) {
      const t = elapsed * fish.speed + fish.phase;
      const x = fish.cx + Math.cos(t) * fish.radius;
      const z = fish.cz + Math.sin(t) * fish.radius * 0.6;
      const nextX = fish.cx + Math.cos(t + 0.05) * fish.radius;
      const nextZ = fish.cz + Math.sin(t + 0.05) * fish.radius * 0.6;
      fish.mesh.position.set(x, -0.34 + Math.sin(t * 3) * 0.03, z);
      fish.mesh.lookAt(nextX, fish.mesh.position.y, nextZ);
      fish.mesh.rotation.z = Math.sin(t * 9) * 0.2;
    }
    void dt;
  }

  private updatePlayer(dt: number, elapsed: number) {
    const dashing = this.dashing;
    if (dashing) this.stamina = Math.max(0, this.stamina - DASH_DRAIN_PER_S * dt);
    else this.stamina = Math.min(1, this.stamina + DASH_REGEN_PER_S * dt);
    if (Math.abs(this.stamina - this.lastEmittedStamina) > 0.01) {
      this.lastEmittedStamina = this.stamina;
      bus.emit("dash", this.stamina);
    }

    // Swim cycle: tail beats and flipper paddles speed up with movement/dash.
    const cadence = this.moving ? (dashing ? 15 : 9.5) : 2.6;
    this.swimPhase += dt * cadence;
    if (this.playerParts && !this.reducedMotion) {
      const beat = Math.sin(this.swimPhase);
      this.playerParts.tails.forEach((tail) => {
        tail.rotation.x = beat * (this.moving ? 0.42 : 0.12);
      });
      this.playerParts.fins.forEach((fin, index) => {
        const side = index === 0 ? -1 : 1;
        fin.rotation.x = Math.sin(this.swimPhase + Math.PI / 2) * (this.moving ? 0.35 : 0.1);
        fin.rotation.z = side * 0.1 * Math.sin(this.swimPhase * 0.5);
      });
      this.playerParts.body.rotation.x = this.moving ? -0.06 + beat * 0.03 : 0;
    }

    this.player.position.y = 0.42 + Math.sin(elapsed * 3.3) * 0.035;
    if (!this.moving || !this.currentDir) return;
    const target = gridToWorld(this.targetC, this.targetR);
    const dx = target.x - this.player.position.x;
    const dz = target.z - this.player.position.z;
    const distance = Math.hypot(dx, dz);
    const step = PLAYER_SPEED * (dashing ? DASH_MULTIPLIER : 1) * dt;

    if (dashing && !this.reducedMotion) {
      this.bubbleClock -= dt;
      if (this.bubbleClock <= 0) {
        this.bubbleClock = 0.05;
        this.spawnBubble(this.player.position.x, this.player.position.z);
      }
    }
    if (distance <= step) {
      this.player.position.x = target.x;
      this.player.position.z = target.z;
      this.playerC = this.targetC;
      this.playerR = this.targetR;
      this.moving = false;
      this.trackZone();
      const next = this.bufferedDir ?? this.currentDir;
      this.bufferedDir = null;
      if (next && this.canMove(next)) {
        this.currentDir = next;
        this.beginStep(next);
      } else {
        this.currentDir = null;
      }
    } else {
      this.player.position.x += (dx / distance) * step;
      this.player.position.z += (dz / distance) * step;
      this.player.rotation.z = Math.sin(elapsed * 7) * 0.055;
      this.playerWakeClock -= dt;
      if (this.playerWakeClock <= 0 && !this.reducedMotion) {
        this.playerWakeClock = dashing ? 0.07 : 0.13;
        const d = DIRS[this.currentDir];
        this.createRipple(
          this.player.position.x - d.dc * 0.35,
          this.player.position.z - d.dr * 0.35,
          palette.foam,
          dashing ? 0.55 : 0.75,
          dashing ? 2.4 : 1.5,
        );
      }
    }
    const flashing = performance.now() < this.invulnerableUntil;
    this.player.visible = !flashing || Math.floor(performance.now() / 100) % 2 === 0;
  }

  /** Announce entering a new stretch of river. */
  private trackZone() {
    const zone = this.zoneOf(this.playerC);
    if (zone === this.currentZone) return;
    this.currentZone = zone;
    const spec = this.level.zones[zone];
    this.spawnPopup(
      this.player.position.x,
      this.player.position.z,
      `ZONE ${zone + 1}: ${spec.name.toUpperCase()}`,
      "#bdf6ff",
    );
    this.emitZone();
  }

  private updateBoats(dt: number, elapsed: number) {
    for (const boat of this.boats) {
      // Traffic in a zone gets faster as that zone is cleared: classic maze-chaser pressure.
      const total = this.zoneTotal[boat.zone] || 1;
      const cleared = 1 - (this.zoneRemaining[boat.zone] ?? total) / total;
      const pressure = 1 + BOAT_PRESSURE * cleared;
      const points = boat.route.waypoints;
      const from = points[boat.segment];
      const to = points[(boat.segment + 1) % points.length];
      const a = gridToWorld(from.c, from.r);
      const b = gridToWorld(to.c, to.r);
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const speed = (boat.route.speed / TILE) * UNIT * pressure;
      boat.progress += (speed * dt) / length;
      if (boat.progress >= 1) {
        boat.progress -= 1;
        boat.segment = (boat.segment + 1) % points.length;
      }
      boat.group.position.x = THREE.MathUtils.lerp(a.x, b.x, boat.progress);
      boat.group.position.z = THREE.MathUtils.lerp(a.z, b.z, boat.progress);
      boat.group.rotation.y = Math.atan2(-(b.x - a.x), -(b.z - a.z));

      // Hull bob/roll, prop spin and bow foam scaled by speed.
      const bob = elapsed * 2.4 + boat.bobPhase;
      boat.group.position.y = 0.42 + Math.sin(bob) * 0.022;
      boat.group.rotation.z = Math.sin(bob * 0.7) * 0.035;
      boat.group.rotation.x = Math.sin(bob * 1.3) * 0.02 - speed * 0.012;
      boat.prop.rotation.z += dt * speed * 9;
      const foamPulse = 0.85 + Math.sin(elapsed * 14 + boat.bobPhase) * 0.12;
      boat.bowFoam.scale.set((0.7 + speed * 0.12) * foamPulse, (0.4 + speed * 0.08) * foamPulse, 1);
      boat.bowFoam.material.opacity = this.reducedMotion ? 0.3 : 0.45 + speed * 0.05;

      // Beacon pulses red as the boat closes in on the manatee.
      const toPlayer = Math.hypot(
        boat.group.position.x - this.player.position.x,
        boat.group.position.z - this.player.position.z,
      );
      const threat = THREE.MathUtils.clamp(1 - (toPlayer - UNIT * 0.9) / (UNIT * 3.2), 0, 1);
      boat.beacon.emissiveIntensity =
        threat * (this.reducedMotion ? 1.6 : 1.4 + Math.sin(elapsed * 16) * 1.2);

      // Close-call bonus: skim past a boat without touching it.
      if (boat.nearMissArmed && this.moving && toPlayer < UNIT * 1.05 && toPlayer >= UNIT * 0.68) {
        boat.nearMissArmed = false;
        this.awardCloseCall();
      } else if (!boat.nearMissArmed && toPlayer > UNIT * 1.9) {
        boat.nearMissArmed = true;
      }

      boat.wakeClock -= dt;
      if (boat.wakeClock <= 0 && !this.reducedMotion) {
        boat.wakeClock = 0.1 / Math.max(0.6, pressure);
        const heading = new THREE.Vector2(b.x - a.x, b.z - a.z).normalize();
        this.createRipple(
          boat.group.position.x - heading.x * 0.72,
          boat.group.position.z - heading.y * 0.72,
          palette.foam,
          0.7,
          2.4 + speed * 0.1,
        );
      }
    }
  }

  private awardCloseCall() {
    const points = CLOSE_CALL_BONUS * this.comboMultiplier;
    this.score.add(points);
    bus.emit("score", this.score.score);
    audio.play("closeCall");
    this.spawnPopup(
      this.player.position.x,
      this.player.position.z,
      `CLOSE CALL +${points}`,
      "#ffd166",
    );
    if (!this.reducedMotion) this.shake = Math.max(this.shake, 0.35);
  }

  private updateHazards(dt: number, elapsed: number) {
    this.propellers.forEach((propeller) => {
      propeller.group.rotation.y += dt * 7;
    });
    this.jellies.forEach((jelly) => {
      const t = elapsed * 2 + jelly.phase;
      jelly.group.position.x = jelly.x + Math.sin(elapsed * 0.8 + jelly.phase) * jelly.drift;
      jelly.group.position.y = 0.25 + Math.sin(t) * 0.08;
      // Bell contracts as it rises, relaxes as it sinks; tentacles trail behind.
      const pulse = 1 + Math.sin(t + Math.PI / 2) * 0.14;
      jelly.bell.scale.set(pulse, 1.1 - (pulse - 1) * 1.3, pulse);
      jelly.tentacles.forEach((tentacle, index) => {
        tentacle.rotation.z = Math.sin(t * 1.2 + index * 0.9) * 0.22;
        tentacle.rotation.x = Math.cos(t * 0.9 + index * 0.6) * 0.16;
      });
    });
  }

  private updatePopups(dt: number) {
    this.popups = this.popups.filter((popup) => {
      popup.age += dt;
      const t = popup.age / popup.life;
      popup.sprite.position.y += dt * 0.95;
      const material = popup.sprite.material;
      material.opacity = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
      const pop = 1 + Math.max(0, 0.18 - popup.age) * 3.2;
      popup.sprite.scale.set(1.9 * pop, 0.5 * pop, 1);
      if (t < 1) return true;
      this.world.remove(popup.sprite);
      material.map?.dispose();
      material.dispose();
      return false;
    });
  }

  private spawnPopup(x: number, z: number, text: string, color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.font = "900 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 10;
    context.strokeStyle = "rgba(6, 30, 44, 0.9)";
    context.strokeText(text, 192, 50);
    context.fillStyle = color;
    context.fillText(text, 192, 50);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    sprite.position.set(x, 1.05, z);
    sprite.scale.set(1.9, 0.5, 1);
    sprite.renderOrder = 10;
    this.world.add(sprite);
    this.popups.push({ sprite, age: 0, life: 0.95 });
  }

  private spawnBubble(x: number, z: number) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + Math.random() * 0.025, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xe6ffff, transparent: true, opacity: 0.7 }),
    );
    mesh.position.set(x + (Math.random() - 0.5) * 0.3, 0.05, z + (Math.random() - 0.5) * 0.3);
    this.world.add(mesh);
    // Bubbles reuse the droplet pool with a gentle upward drift and no gravity pull.
    this.droplets.push({
      mesh,
      age: 0.2,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.3, (Math.random() - 0.5) * 0.3),
    });
  }

  private updateFood(elapsed: number) {
    this.foods.forEach((food) => {
      const wave = (elapsed * 0.75 + food.phase) % 1;
      food.group.position.y = 0.24 + Math.sin(elapsed * 2.2 + food.phase) * 0.045;
      food.group.rotation.y = Math.sin(elapsed * 0.7 + food.phase) * 0.16;
      food.ring.scale.setScalar(0.85 + wave * 1.35);
      food.ring.material.opacity = 0.3 * (1 - wave);
    });
  }

  private updateEffects(dt: number) {
    this.ripples = this.ripples.filter((ripple) => {
      ripple.age += dt;
      const t = ripple.age / ripple.duration;
      ripple.mesh.scale.set(1 + t * ripple.stretch, 1 + t * ripple.stretch, 1);
      ripple.mesh.material.opacity = Math.max(0, (1 - t) * 0.55);
      if (t < 1) return true;
      this.world.remove(ripple.mesh);
      ripple.mesh.geometry.dispose();
      ripple.mesh.material.dispose();
      return false;
    });
    this.droplets = this.droplets.filter((drop) => {
      drop.age += dt;
      drop.velocity.y -= 3.8 * dt;
      drop.mesh.position.addScaledVector(drop.velocity, dt);
      drop.mesh.scale.setScalar(Math.max(0.05, 1 - drop.age * 1.4));
      if (drop.age < 0.72 && drop.mesh.position.y > -0.05) return true;
      this.world.remove(drop.mesh);
      drop.mesh.geometry.dispose();
      (drop.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  private createRipple(x: number, z: number, color: number, duration = 0.8, stretch = 1.8) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.22, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.025, z);
    this.world.add(mesh);
    this.ripples.push({ mesh, age: 0, duration, stretch });
  }

  private splash(x: number, z: number, color = palette.foam) {
    this.createRipple(x, z, color, 0.9, 3.2);
    this.createRipple(x, z, color, 0.6, 2);
    if (this.reducedMotion) return;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(x, 0.14, z);
      this.world.add(mesh);
      this.droplets.push({
        mesh,
        age: 0,
        velocity: new THREE.Vector3(
          Math.cos(angle) * (0.55 + Math.random() * 0.4),
          1.05 + Math.random() * 0.65,
          Math.sin(angle) * (0.55 + Math.random() * 0.4),
        ),
      });
    }
  }

  private checkCollectibles() {
    for (let index = this.foods.length - 1; index >= 0; index--) {
      const food = this.foods[index];
      const distance = Math.hypot(
        food.group.position.x - this.player.position.x,
        food.group.position.z - this.player.position.z,
      );
      if (distance > UNIT * 0.5) continue;
      this.splash(food.group.position.x, food.group.position.z, 0xbaff82);
      this.world.remove(food.group, food.ring);
      disposeObject(food.group);
      food.ring.geometry.dispose();
      food.ring.material.dispose();
      this.foods.splice(index, 1);

      // Chain pickups quickly to build a multiplier; pitch climbs with the chain.
      this.combo += 1;
      this.comboTimer = COMBO_WINDOW;
      const multiplier = this.comboMultiplier;
      const points = FOOD_SCORE[food.spec.kind] * multiplier;
      this.score.add(points);
      audio.play("pickup", 1 + Math.min(this.combo, 12) * 0.06);
      this.spawnPopup(
        food.group.position.x,
        food.group.position.z,
        multiplier > 1 ? `+${points}  x${multiplier}` : `+${points}`,
        multiplier >= 4 ? "#ff8ad4" : multiplier >= 2 ? "#ffd166" : "#c9ff8a",
      );
      bus.emit("combo", multiplier);
      bus.emit("score", this.score.score);
      bus.emit("lettuceRemaining", this.foods.length);

      // Zone bookkeeping: clearing a stretch unlocks the boom downstream.
      const zone = this.zoneOf(food.spec.c);
      this.zoneRemaining[zone] = Math.max(0, (this.zoneRemaining[zone] ?? 1) - 1);
      if (this.zoneRemaining[zone] === 0 && zone < this.level.gates.length) {
        this.unlockGate(zone);
      } else if (zone === this.currentZone) {
        this.emitZone();
      }
      if (this.foods.length === 0) this.completeLevel();
    }
  }

  private checkHazards() {
    if (performance.now() < this.invulnerableUntil) return;
    for (const boat of this.boats) {
      if (
        Math.hypot(
          boat.group.position.x - this.player.position.x,
          boat.group.position.z - this.player.position.z,
        ) <
        UNIT * 0.68
      ) {
        this.fatalBoatHit();
        return;
      }
    }
    for (const propeller of this.propellers) {
      const p = gridToWorld(propeller.c, propeller.r);
      if (
        Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z) <
        propeller.radius * 0.68
      ) {
        this.takeHit();
        return;
      }
    }
    for (const jelly of this.jellies) {
      if (
        Math.hypot(
          jelly.group.position.x - this.player.position.x,
          jelly.group.position.z - this.player.position.z,
        ) <
        UNIT * 0.52
      ) {
        this.score.add(-JELLY_PENALTY);
        this.breakCombo();
        bus.emit("score", this.score.score);
        this.invulnerableUntil = performance.now() + 1200;
        this.splash(jelly.group.position.x, jelly.group.position.z, 0xdd9aff);
        this.spawnPopup(
          this.player.position.x,
          this.player.position.z,
          `-${JELLY_PENALTY}`,
          "#e0a2ff",
        );
        this.shake = Math.max(this.shake, 0.4);
        audio.play("warn");
        return;
      }
    }
  }

  private breakCombo() {
    if (this.combo === 0) return;
    this.combo = 0;
    this.comboTimer = 0;
    bus.emit("combo", 1);
  }

  private takeHit() {
    this.lives -= 1;
    this.breakCombo();
    this.shake = 0.8;
    bus.emit("lives", Math.max(0, this.lives));
    this.splash(this.player.position.x, this.player.position.z);
    audio.play("splash");
    if (this.lives <= 0) {
      this.endGame();
      return;
    }
    // Respawn at the entrance of the current zone rather than all the way upstream.
    const entryGate = this.level.gates.find((gate) => gate.index === this.currentZone - 1);
    const spawn = entryGate
      ? { c: entryGate.c + 1, r: entryGate.rows[Math.floor(entryGate.rows.length / 2)] }
      : this.level.playerSpawn;
    const p = gridToWorld(spawn.c, spawn.r);
    this.playerC = this.targetC = spawn.c;
    this.playerR = this.targetR = spawn.r;
    this.player.position.set(p.x, 0.43, p.z);
    this.currentDir = null;
    this.bufferedDir = null;
    this.moving = false;
    this.invulnerableUntil = performance.now() + 2100;
  }

  private fatalBoatHit() {
    this.lives = 0;
    this.breakCombo();
    this.shake = 1;
    bus.emit("lives", 0);
    this.splash(this.player.position.x, this.player.position.z);
    this.splash(this.player.position.x + 0.3, this.player.position.z - 0.2, 0xff8f7a);
    this.player.rotation.x = Math.PI / 2;
    this.player.scale.set(0.9, 0.18, 0.9);
    this.player.visible = false;
    audio.play("gameover");
    this.endGame();
  }

  private endGame() {
    this.gameOver = true;
    this.score.commitHigh();
    bus.emit("highScore", this.score.high);
    bus.emit("gameOver", {
      score: this.score.score,
      highScore: this.score.high,
      lettuceCollected: this.foodTotal - this.foods.length,
    });
  }

  private completeLevel() {
    this.gameOver = true;
    const livesRemaining = Math.max(0, this.lives);
    const bonus = SCORE.LEVEL_COMPLETE + livesRemaining * SCORE.LIFE_BONUS;
    this.score.add(bonus);
    this.score.commitHigh();
    audio.play("complete");
    bus.emit("score", this.score.score);
    bus.emit("highScore", this.score.high);
    bus.emit("levelComplete", {
      score: this.score.score,
      lettuceCollected: this.foodTotal,
      livesRemaining,
      completionBonus: bonus,
      highScore: this.score.high,
      levelIndex: this.levelIndex,
      levelCount: levels.length,
      levelName: this.level.name,
      nextLevelName: levels[this.levelIndex + 1]?.name,
    });
  }

  private emitHud() {
    bus.emit("score", this.score.score);
    bus.emit("highScore", this.score.high);
    bus.emit("lives", this.lives);
    bus.emit("lettuceTotal", this.foodTotal);
    bus.emit("lettuceRemaining", this.foods.length);
    bus.emit("levelInfo", {
      index: this.levelIndex,
      count: levels.length,
      name: this.level.name,
      subtitle: this.level.subtitle,
    });
    this.emitZone();
    bus.emit("paused", false);
    bus.emit("ready");
  }

  private setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) audio.suspend();
    else audio.resume();
    bus.emit("paused", paused);
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    const ratio = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width * ratio * 0.5, height * ratio * 0.5);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  destroy(removeCanvas = true) {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    bus.off("cmd_pause", this.onPause);
    bus.off("cmd_resume", this.onResume);
    bus.off("cmd_restart", this.onRestart);
    bus.off("cmd_nextLevel", this.onNextLevel);
    bus.off("cmd_setMuted", this.onMuted);
    bus.off("cmd_setReducedMotion", this.onReducedMotion);
    bus.off("cmd_dir", this.onDirection);
    bus.off("cmd_dash", this.onDash);
    disposeObject(this.world);
    this.environmentTexture.dispose();
    this.bloomPass.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    if (removeCanvas) this.renderer.domElement.remove();
  }
}
