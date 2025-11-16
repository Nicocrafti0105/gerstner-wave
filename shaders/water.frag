precision mediump float;

uniform vec3 uLightDir;
uniform sampler2D uTerrainHeightMap;
uniform vec3 cameraPosition;
uniform float uMaxDepth;
uniform samplerCube uEnvMap;

uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uCameraNear;
uniform float uCameraFar;


varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vSlope;
varying float vSpeed;
varying float vTime;


float getFogFactor(vec3 worldPos) {
    float distance = length(cameraPosition - worldPos);
    // Exponential fog (like FogExp2)
    float f = 1.0 - exp(-distance * uFogDensity);
    return clamp(f, 0.0, 1.0);
}


float getDepth(float waterY, float terrainY, float maxDepth) {
    return clamp((waterY - terrainY) / maxDepth, 0.0, 1.0);
}

vec3 waterColor(float depth) {
    vec3 shallow = vec3(0.0, 0.4, 0.7);
    vec3 deep    = vec3(0.0, 0.0, 0.2);
    return mix(shallow, deep, depth);
}

vec3 specularHighlight(vec3 N, vec3 L, vec3 V, float shininess) {
    vec3 H = normalize(L + V);
    float s = pow(max(dot(N, H), 0.0), shininess);
    return vec3(s);
}

float fresnelSchlick(vec3 V, vec3 N, float F0) {
    float cosTheta = max(dot(V, N), 0.0);
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

vec3 envRefraction(vec3 V, vec3 N, float etaR, float etaG, float etaB) {
    vec3 r;
    r.r = textureCube(uEnvMap, refract(-V, N, etaR)).r;
    r.g = textureCube(uEnvMap, refract(-V, N, etaG)).g;
    r.b = textureCube(uEnvMap, refract(-V, N, etaB)).b;
    return r;
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float bubbles(vec2 uv, float speed, float slope) {
    float sc = 12.0;
    vec2 u = uv * sc + vec2(vTime * 0.5);
    float h = hash21(floor(u));
    float px = fract(u.x) - 0.5;
    float py = fract(u.y) - 0.5;
    float r = sqrt(px*px + py*py);
    float spot = smoothstep(0.12, 0.0, r);
    float life = smoothstep(0.2, 0.6, speed);
    float mask = smoothstep(0.25, 0.6, slope);
    return spot * h * life * mask;
}

float foamMask(float slope, float speed) {
    float m1 = smoothstep(0.15, 0.3, slope);
    float m2 = smoothstep(0.2, 0.6, speed);
    float pulse = 0.5 + 0.5 * sin(vTime * 6.0);
    return clamp(m1 * m2 * pulse, 0.0, 1.0);
}

void main() {

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    float depth = getDepth(vWorldPos.y, texture2D(uTerrainHeightMap, vUv).r, uMaxDepth);

    vec3 base = waterColor(depth);

    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = base * (0.25 + 0.75 * NdotL);
    vec3 specular = specularHighlight(N, L, V, 64.0);
    vec3 lighting = diffuse + specular;

    vec3 reflection = textureCube(uEnvMap, reflect(-V, N)).rgb;

    float eta = 1.0 / 1.333;
    vec3 refraction = envRefraction(V, N, eta*1.001, eta*1.006, eta*1.012);
    vec3 transmission = mix(base, refraction, 1.0 - depth * 0.8);

    float F0 = 0.02;
    float F = fresnelSchlick(V, N, F0);

    float foam = foamMask(vSlope, vSpeed);
    float bubble = bubbles(vUv, vSpeed, vSlope);

    vec3 color = mix(transmission, reflection, F);
    color = mix(lighting, color, 0.7);
    vec3 foamColor = vec3(1.0);
    color = mix(color, foamColor, foam*0.8 + bubble*0.6);

    vec3 fogColor = uFogColor;
    float fogFactor = getFogFactor(vWorldPos);
    color = mix(color, fogColor, fogFactor);


    gl_FragColor = vec4(color, 0.9);
}
