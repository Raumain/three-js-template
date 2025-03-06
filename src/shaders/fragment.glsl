uniform float time;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform float colorBlendFactor;
uniform float opacity;
uniform sampler2D normalMap;

varying vec2 vUv;
varying float displacement;

void main() {
    vec3 normalMapTexel = texture2D(normalMap, vUv + vec2(time * 0.02, time * 0.01)).xyz * 2.0 - 1.0;
    
    float colorBlend = smoothstep(-1.0, 1.0, displacement) * colorBlendFactor;
    vec3 finalColor = mix(deepColor, shallowColor, colorBlend);
    
    float specular = pow(max(0.0, normalMapTexel.z), 10.0);
    finalColor += vec3(specular) * 0.2;
    
    gl_FragColor = vec4(finalColor, opacity);
}