precision highp float;

attribute vec3 position;
attribute vec3 original;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;

uniform vec2  uWaveDirs[3];
uniform float uWaveAmps[3];
uniform float uWaveFreqs[3];
uniform float uWavePhaseSpeeds[3];

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vSlope;
varying float vSpeed;
varying float vTime;

vec3 mod289_vec3(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec2 mod289_vec2(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec3 permute(vec3 x){ return mod289_vec3((x*34.0 + 1.0)*x); }

float snoise(vec2 v){
    const float C = 0.211324865405187;
    const float D = 0.366025403784439;
    vec2 i = floor(v + (v.x+v.y)*D);
    vec2 x0 = v - i + (i.x+i.y)*C;
    vec2 i1 = (x0.x>x0.y)? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec2 x1 = x0 - i1 + C;
    vec2 x2 = x0 + (2.0*C - 1.0);
    i = mod289_vec2(i);
    vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0*fract(p*(1.0/41.0)) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    return 0.5 + 0.5*dot(m, a0*vec3(x0.x,x1.x,x2.x) + h*vec3(x0.y,x1.y,x2.y));
}

void main(){

    vec3 P = original;
    float height = 0.0;
    float dHdX = 0.0;
    float dHdZ = 0.0;
    float speedAcc = 0.0;

    for(int i = 0; i < 3; i++){
        float phase = uWaveFreqs[i] * dot(uWaveDirs[i], P.xz) + uWavePhaseSpeeds[i] * uTime;
        float s = sin(phase);
        float c = cos(phase);

        height += uWaveAmps[i] * s;

        dHdX += uWaveAmps[i] * c * uWaveFreqs[i] * uWaveDirs[i].x;
        dHdZ += uWaveAmps[i] * c * uWaveFreqs[i] * uWaveDirs[i].y;

        speedAcc += abs(uWaveAmps[i] * c * uWavePhaseSpeeds[i]);
    }

    height += snoise(P.xz * 0.15 + uTime*0.1) * 0.25;
    height += 0.03 * sin(40.0 * P.x + 40.0 * P.z + uTime*10.0);

    P.y = height;

    vec3 N = normalize(vec3(-dHdX, 1.0, -dHdZ));

    vNormal = N;
    vWorldPos = P;
    vUv = position.xz;
    vSlope = 1.0 - N.y;
    vSpeed = speedAcc;
    vTime = uTime;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(P,1.0);
}
