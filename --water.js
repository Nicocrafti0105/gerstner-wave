import {getShader} from './tools.js'
import * as THREE from 'three'

export class Water {
    /**
     * Water class
     *
     * @param {THREE.Camera} camera - Scene Camera
     * @param {THREE.Scene} scene - Current Scene
     * @param {THREE.DirectionalLight} dirlight
     * @param {THREE.WebGLRenderer} renderer - Current renderer
     * @param {Object} [options] - Water Config
     * @param {number} [options.windSpeed=20] - Wind speed in m/s
     * @param {THREE.Vector2} [options.windDirection=new THREE.Vector2(1, 0)] - Wind direction as a unit vector
     * @param {number} [options.size=1000] - Physical size of the simulation domain (in meters)
     * @param {number} [options.resolution=256] - Resolution of the grid (N x N)
     */
    constructor(camera, scene,dirlight,renderer, options = {}) {
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer || new THREE.WebGLRenderer();
        this.dirLight = dirlight || new THREE.DirectionalLight()


        this.GRAVITY = 9.81;
        this.DEFAULT_WIND_SPEED = 20;
        this.DEFAULT_DOMAIN_SIZE = 1000;
        this.DEFAULT_RESOLUTION = 256;


        this.windSpeed = options.windSpeed || this.DEFAULT_WIND_SPEED;
        this.windDir = (options.windDirection || new THREE.Vector2(1, 0)).normalize();
        this.size = options.size || this.DEFAULT_DOMAIN_SIZE;
        this.resolution = options.resolution || this.DEFAULT_RESOLUTION;

        this.waterMat = null;
        this.waterMesh = null;
    }

    async initialize() {
        await this.solveSWE();
        await this.createShaderMaterial();
        this.createMesh();
        this.scene.add(this.waterMesh);
    }


    async createShaderMaterial() {
        const vert = await getShader('./shaders/water.vert');
        const frag = await getShader('./shaders/water.frag');

        this.waterMat = new THREE.RawShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms: {
                uDisplacementMap: { value: this.swe.texture },
                uNormalMap: { value: undefined },
                uTime: { value: 0.0 },
                uResolution: { value: this.resolution },
                uSize : { value: this.size },
                uGravity: { value: this.GRAVITY },
                uLightDir: {value: this.dirLight.position}
            },
            side: THREE.DoubleSide,
            transparent: false,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending,
            
        });
    }

    createMesh() {
        const geo = new THREE.PlaneGeometry(this.size, this.size, this.resolution , this.resolution);
        geo.rotateX(-Math.PI / 2);

        this.waterMesh = new THREE.Mesh(geo, this.waterMat);
        this.waterMesh.renderOrder = 1;

        this.scene.add(this.waterMesh)
    }


    update(t) { if (this.waterMat) { this.waterMat.uniforms.uTime.value = t; this.waterMat.uniforms.uDisplacementMap = this.swe.texture } }
    
    async solveSWE() {
        this.swe = new THREE.WebGLRenderTarget(this.resolution, this.resolution, {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter
        });

    
        this.sweMat = new THREE.RawShaderMaterial({
            fragmentShader: await getShader("./shaders/swe.frag"),
            vertexShader: `
                precision mediump float;
                attribute vec3 position;
                attribute vec2 uv;
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                varying vec2 vUv;
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    vUv = uv;
                }
            `,
            uniforms: {
                uResolution: { value: this.resolution },
            }
        });


        const geo = new THREE.PlaneGeometry(2, 2);

        this.quad = new THREE.Mesh(geo, this.sweMat);

        this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.qcam.position.z = 1;

        this.renderer.setRenderTarget(this.swe);
        this.renderer.render(this.quad, this.qcam);
        this.renderer.setRenderTarget(null);

        

        const planeGeometry = new THREE.PlaneGeometry(50, 50);
        const material = new THREE.MeshBasicMaterial({ map: this.swe.texture, side: THREE.DoubleSide });
        const quad = new THREE.Mesh(planeGeometry, material);
        quad.position.set(0, 1950);
        quad.rotation.x = -Math.PI / 2;
        this.scene.add(quad);

        this.minimapCamera = new THREE.OrthographicCamera(-25, 25, 25, -25, 0.1, 1000);
        this.minimapCamera.position.set(0, 2000, 0);
        this.minimapCamera.lookAt(0, 0, 0);

        this.renderMinimap = () => {
            const renderer = this.renderer;
            const size = renderer.getSize(new THREE.Vector2());
            const width = size.x;
            const height = size.y;

            const mapSize = 256;
            const padding = 10;
            const x = width - mapSize - padding;
            const y = padding;

            renderer.clearDepth();

            renderer.setViewport(x, y, mapSize, mapSize);
            renderer.setScissor(x, y, mapSize, mapSize);
            renderer.setScissorTest(true);
            renderer.render(this.scene, this.minimapCamera);

            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, width, height);
        };

    

    }
}

