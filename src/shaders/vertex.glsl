uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform vec2 waveDirection;

varying vec2 vUv;
varying float displacement;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 randomGradient(vec2 p) {
  
    float angle = random(p) * 20.0 * 3.14159;
    return vec2(cos(angle), sin(angle));
}

float smoothInterpolation(float a, float b, float t) {
    float smoothT = t * t * (3.0 - 2.0 * t);
    return mix(a, b, smoothT);
}

float perlinNoise(vec2 p) {
  
    vec2 gridCell = floor(p);
    vec2 localCoord = fract(p);

  
    vec2 grad00 = randomGradient(gridCell);
    vec2 grad10 = randomGradient(gridCell + vec2(1.0, 0.0));
    vec2 grad01 = randomGradient(gridCell + vec2(0.0, 1.0));
    vec2 grad11 = randomGradient(gridCell + vec2(1.0, 1.0));

  
    float dot00 = dot(grad00, localCoord);
    float dot10 = dot(grad10, localCoord - vec2(1.0, 0.0));
    float dot01 = dot(grad01, localCoord - vec2(0.0, 1.0));
    float dot11 = dot(grad11, localCoord - vec2(1.0, 1.0));

  
    float ux = smoothInterpolation(dot00, dot10, localCoord.x);
    float uy = smoothInterpolation(dot01, dot11, localCoord.x);
    
    return smoothInterpolation(ux, uy, localCoord.y);
}

float fbm(vec2 x) {
    float total = 0.0;
    float amplitude = 0.5;
    float frequency = 0.25;
    
    for (int i = 0; i < 6; i++) {
        total += perlinNoise(x * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return total;
}

void main() {
    vUv = uv;
    
  
    vec2 noiseCoord = position.xz * waveFrequency + 
                      waveDirection * time * 0.1;
    
  
    float noiseVal = fbm(noiseCoord) * waveAmplitude;
    
  
    vec3 newPosition = position + normal * noiseVal;
    
  
    displacement = noiseVal;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}