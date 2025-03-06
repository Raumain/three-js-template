import {
	Clock,
	Color,
	Mesh,
	PlaneGeometry,
	RepeatWrapping,
	type Scene,
	ShaderMaterial,
	TextureLoader,
	Vector2,
} from "three";

// Import or create your normal map texture
import normalMapTexture from "../../assets/textures/waternormals.jpg";
import fragmentShader from "../shaders/fragment.glsl";
import vertexShader from "../shaders/vertex.glsl";

class OceanRenderer {
	private scene: Scene;
	private oceanMesh: Mesh | undefined;
	private shaderMaterial: ShaderMaterial | undefined;
	private clock: Clock;

	constructor(scene: Scene) {
		this.scene = scene;
		this.clock = new Clock();

		this.initOcean();
	}

	private initOcean() {
		// Create ocean geometry (use a plane or custom geometry)
		const geometry = new PlaneGeometry(1000, 1000, 100, 100);
		geometry.rotateX(-Math.PI / 2); // Rotate to create horizontal plane

		// Load normal map texture
		const textureLoader = new TextureLoader();
		const normalMap = textureLoader.load(normalMapTexture);
		normalMap.wrapS = normalMap.wrapT = RepeatWrapping;

		// Create custom shader material
		this.shaderMaterial = new ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				waveAmplitude: { value: 5.0 },
				waveFrequency: { value: 0.2 },
				waveDirection: { value: new Vector2(1.0, 1.0) },
				deepColor: { value: new Color(0x0d4073) }, // Deeper blue for sunset reflection
				shallowColor: { value: new Color(0xff7e47) }, // Orange sunset reflection
				colorBlendFactor: { value: 0.7 },
				opacity: { value: 0.8 },
				normalMap: { value: normalMap },
			},
			vertexShader,
			fragmentShader,
			transparent: true,
		});

		// Create ocean mesh
		this.oceanMesh = new Mesh(geometry, this.shaderMaterial);
		this.scene.add(this.oceanMesh);
	}
	public getMesh(): Mesh | undefined {
		return this.oceanMesh;
	}

	public update() {
		// Update time uniform for animation
		if (this.shaderMaterial) {
			this.shaderMaterial.uniforms.time.value = this.clock.getElapsedTime();
		}
	}

	// Optional method to adjust ocean parameters
	public setWaveProperties(
		amplitude: number,
		frequency: number,
		direction: Vector2,
	) {
		if (this.shaderMaterial) {
			this.shaderMaterial.uniforms.waveAmplitude.value = amplitude;
			this.shaderMaterial.uniforms.waveFrequency.value = frequency;
			this.shaderMaterial.uniforms.waveDirection.value = direction;
		}
	}
}

export default OceanRenderer;
