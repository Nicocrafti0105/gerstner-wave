// import * as THREE from './node_modules/three/src/Three.js';
// import { createNoise2D } from './node_modules/simplex-noise/simplex-noise.ts';
// import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
// import { EffectComposer } from './node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from './node_modules/three/examples/jsm/postprocessing/RenderPass.js';
// import { ShaderPass } from './node_modules/three/examples/jsm/postprocessing/ShaderPass.js';
// import Stats from './node_modules/stats.js/src/Stats.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/controls/OrbitControls.js';
import { EffectComposer } from 'three/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/postprocessing/ShaderPass.js';
import { createNoise2D } from 'simplex-noise';
import Stats from 'stats.js';


export const Loading = {
    manager: null,
    progress: 0,
    ready: false,
    callbacks: [],

    init() {
        this.manager = new THREE.LoadingManager();

        this.manager.onProgress = (url, loaded, total) => {
            this.progress = loaded / total;
            if (this.updateBar) this.updateBar(this.progress);
        };

        this.manager.onLoad = () => {
            this.ready = true;
            document.getElementById("loading-screen").classList.add("hidden");
            this.callbacks.forEach(cb => cb());
            this.callbacks.length = 0;
        };
    },

    onReady(fn) {
        if (this.ready) fn();
        else this.callbacks.push(fn);
    },

    updateBar: null,
};

Loading.init();

Loading.updateBar = (p) => {
    const text = document.getElementById("loading-text");
    
    if (text) text.textContent = "Loading ";
};






//////////////////////////// VARS /////////////////////////////////
const keys = {}

//////////////////////////// SETUP /////////////////////////////////

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 3000 );

const renderer = new THREE.WebGLRenderer({powerPreference: "high-performance",antialias: false});
renderer.capabilities.isWebGL2 = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild( renderer.domElement );

if (!renderer.capabilities.isWebGL2) {
    console.warn("WebGL2 not supported, PMREM might fail with HDR.");
}

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(50, 50, 50);

const stats = new Stats();
document.body.appendChild( stats.dom );

//////////////////////////// LIGHT /////////////////////////////////

let ambientLight = new THREE.AmbientLight(0xF2F2E1,0.5)
let directionalLight = new THREE.DirectionalLight(0xF2F2E1,0)
directionalLight.position.set(-100,100,-100)
directionalLight.lookAt(0,0,0)

scene.add(ambientLight,directionalLight)

//////////////////////////// EVENTS /////////////////////////////////

window.addEventListener("keydown", (e) => {keys[e.key.toLowerCase()] = true;});
window.addEventListener("keyup", (e) => {keys[e.key.toLowerCase()] = false;});
window.addEventListener("keyup", (e) => {
    let k = e.key.toLowerCase()
    if ( k == 'e') water.material.wireframe = !water.material.wireframe
    if ( k == 'r') ground.material.wireframe = !ground.material.wireframe
});

window.addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function keybinds() {}

//////////////////////////// GROUND /////////////////////////////////

const teres = 2048
const tesize = 512

let ground = new THREE.Mesh(
    new THREE.PlaneGeometry(teres,teres,tesize-1,tesize-1),
    new THREE.MeshStandardMaterial({color: 0xE6E465,side: THREE.DoubleSide})
);
ground.geometry.rotateX(-Math.PI/2);
ground.position.setY(-4); 

const seed = 12345;
function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}
const random = mulberry32(seed);
const simplex = createNoise2D(random);

const positions = ground.geometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    let noise = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let octave = 0; octave < 4; octave++) {
        noise += simplex(x / 20 * frequency, z / 20 * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    noise /= maxValue;
    positions.setY(i, noise * 2);
}

ground.geometry.computeVertexNormals();
scene.add(ground);


//////////////////////////// POST PROCESSING /////////////////////////////////

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const colorCorrectionShader = {
    uniforms: {
        tDiffuse: { value: null },
        uSaturation: { value: 1.2 },
        uContrast: { value: 1.1 },
        uBrightness: { value: 0.05 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uBrightness;
        varying vec2 vUv;

        
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            
            
            // Apply brightness
            color.rgb += uBrightness;
            
            // Apply contrast
            color.rgb = (color.rgb - 0.5) * uContrast + 0.5;
            
            // Apply saturation
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(gray), color.rgb, uSaturation);
            
            #ifdef USE_FOG
                float depth = gl_FragCoord.z / gl_FragCoord.w;
                float fogFactor = 1.0 - exp(-depth * depth * density);
                color.rgb = mix(color.rgb, fogColor, fogFactor);
            #endif


            gl_FragColor = color;
        }
    `
};

const colorPass = new ShaderPass(colorCorrectionShader);
composer.addPass(colorPass);

let fogcube = new THREE.Mesh(new THREE.BoxGeometry(2500,2500,2500),new THREE.MeshStandardMaterial({side:THREE.BackSide,color : 0xffffff,transparent : true,opacity : 0.7}))
scene.add(fogcube)
scene.fog = new THREE.FogExp2(0xffffff,0.05)

//////////////////////////// WATER /////////////////////////////////

const size = 2048;
const resolution = 1024;

const waves = [
    { dir: new THREE.Vector2(1, 0.3).normalize(), amplitude: 1.2, wavelength: 20, speed: 20, phase: Math.random() * Math.PI * 2 },
    { dir: new THREE.Vector2(-0.4, 1).normalize(), amplitude: 0.8, wavelength: 30, speed: 10, phase: Math.random() * Math.PI * 2 },
    { dir: new THREE.Vector2(0.2, -1).normalize(), amplitude: 0.5, wavelength: 25, speed: 13, phase: Math.random() * Math.PI * 2 },
].map(w => {
    w.frequency = (2 * Math.PI) / w.wavelength;
    w.phaseSpeed = w.speed * w.frequency;
    return w;
});

const vertShader = await (await fetch('shaders/water.vert')).text();
const fragShader = await (await fetch('shaders/water.frag')).text();

const waterGeo = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
const waterMat = new THREE.RawShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
        uFogColor: { value: new THREE.Color(0xffffff) },
        uFogDensity: { value: 0.0005 },
        uCameraNear: { value: camera.near },
        uCameraFar: { value: camera.far },
        uEnvMap: { value: null },
        uMaxDepth: { value: 10.0 },
        uLightDir: { value: directionalLight.position.clone().normalize() },
        uTerrainHeightMap : { value: ground.material.map },
        uRes: { value: resolution },
        uSize: { value: size },
        uTime: { value: 0 },
        uWaveDirs: { value: waves.map(w => new THREE.Vector2(w.dir.x, w.dir.y)) },
        uWaveAmps: { value: new Float32Array(waves.map(w => w.amplitude)) },
        uWaveFreqs: { value: new Float32Array(waves.map(w => w.frequency)) },
        uWavePhaseSpeeds: { value: new Float32Array(waves.map(w => w.phaseSpeed)) },
        uAgitation: { value: 0 },
    },
    vertexShader: vertShader,
    fragmentShader: fragShader,
    transparent: true,
});


const water = new THREE.Mesh(waterGeo, waterMat);
water.geometry.rotateX(-Math.PI/2);


const geo = water.geometry;
if (!geo.attributes.original) {
    const original = geo.attributes.position.array.slice();
    geo.setAttribute('original', new THREE.BufferAttribute(new Float32Array(original), 3));
}
scene.add(water);


//////////////////////////// ENV MAP /////////////////////////////////

const loader = new THREE.CubeTextureLoader(Loading.manager);

const envMap = loader.setPath('textures/cubemap/').load([
    'px.png','nx.png','py.png','ny.png','pz.png','nz.png'
]);

envMap.encoding = THREE.sRGBEncoding;
scene.environment = envMap;
scene.background = envMap;
water.material.uniforms.uEnvMap.value = envMap;


//////////////////////////// ANIMATE /////////////////////////////////

let lastTime = performance.now() / 1000;

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now()/1000;
    const dt = now - lastTime;
    lastTime = now;

    keybinds();
    stats.update();

    water.material.uniforms.uTime.value += dt;
    water.material.uniforms.uWaveDirs.value = waves.map(w => new THREE.Vector2(w.dir.x, w.dir.y));
    water.material.uniforms.uWaveAmps.value = new Float32Array(waves.map(w => w.amplitude));

    fogcube.position.copy(camera.position.clone())
    fogcube.rotation.copy(camera.rotation.clone())
    composer.render();
    controls.update();
    //renderer.render(scene, camera);

}


Loading.onReady(() => {
    animate();
});
