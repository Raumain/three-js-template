import type * as CANNON from "cannon";
import {
	Audio,
	AudioListener,
	AudioLoader,
	DirectionalLight,
	Frustum,
	HalfFloatType,
	Matrix4,
	Mesh,
	PMREMGenerator,
	type PerspectiveCamera,
	Scene,
	Vector2,
	Vector3,
	type WebGLRenderer,
} from "three";

import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

import { GLTFLoader } from "three/examples/jsm/Addons.js";
import type { Clock, Lifecycle, Viewport } from "~/core";
import island from "../../assets/models/island.glb";
import sound from "../../assets/sounds/ambiance.mp3";
import sky from "../../assets/textures/sunset.hdr";
import OceanRenderer from "../materials/OceanRenderer";
import { Ball } from "../objects/Ball";
import { Seagull } from "../objects/Seagull";
import { PhysicsWorld } from "../physics/PhysicsWorld";

export interface MainSceneParamaters {
	clock: Clock;
	camera: PerspectiveCamera;
	viewport: Viewport;
	renderer: WebGLRenderer;
}

export class ExampleScene extends Scene implements Lifecycle {
	public clock: Clock;
	public camera: PerspectiveCamera;
	public viewport: Viewport;
	private gltfLoader: GLTFLoader;
	private sunLight: DirectionalLight;

	private pmremGenerator: PMREMGenerator;

	private frustum = new Frustum();
	private projScreenMatrix = new Matrix4();

	private oceanRenderer: OceanRenderer;

	private audioListener: AudioListener;
	public ambientSound: Audio;

	public seagulls: Seagull[] = [];
	private readonly NUM_SEAGULLS = 5;
	private remainingSeagulls = 0;
	private winScreen: HTMLDivElement | null = null;

	// Physics-related properties
	private physicsWorld: PhysicsWorld;
	private balls: Ball[] = [];

	public constructor({
		clock,
		camera,
		viewport,
		renderer,
	}: MainSceneParamaters) {
		super();

		this.clock = clock;
		this.camera = camera;
		this.viewport = viewport;

		this.sunLight = new DirectionalLight(0xfff6cf, 2);
		this.sunLight.position.set(5, 5, 7.5);
		this.sunLight.castShadow = true;

		this.add(this.sunLight);
		this.gltfLoader = new GLTFLoader();

		this.oceanRenderer = new OceanRenderer(this);
		this.oceanRenderer.setWaveProperties(5.0, 0.2, new Vector2(1.0, 1.0));

		this.pmremGenerator = new PMREMGenerator(renderer);
		this.pmremGenerator.compileEquirectangularShader();

		const hdrLoader = new RGBELoader().setDataType(HalfFloatType);

		hdrLoader.load(
			sky,
			(texture) => {
				this.pmremGenerator.compileEquirectangularShader();
				const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;

				this.background = envMap;
				this.environment = envMap;

				texture.dispose();
				this.pmremGenerator.dispose();
			},
			undefined,
			(error) => {
				console.error("Error loading HDR background:", error);
			},
		);

		this.audioListener = new AudioListener();
		this.camera.add(this.audioListener);

		this.ambientSound = new Audio(this.audioListener);
		const audioLoader = new AudioLoader();
		audioLoader.load(
			sound,
			(buffer) => {
				this.ambientSound.setBuffer(buffer);
				this.ambientSound.setLoop(true);
				this.ambientSound.setVolume(0.5);
			},
			undefined,
			(error) => {
				console.error("Error loading ambient sound:", error);
			},
		);

		this.initSeagulls();

		// Initialize physics world
		this.physicsWorld = new PhysicsWorld();
	}

	// Add method to throw balls with physics
	public throwBall(position: Vector3, velocity: Vector3): void {
		// Create a ball with physics
		const ball = new Ball(position, velocity, this.onBallCollide.bind(this));

		// Add ball's physics body to the world
		this.physicsWorld.addBody(ball.getBody());

		// Add ball's mesh to the scene
		this.add(ball.getMesh());

		// Track the ball
		this.balls.push(ball);
	}

	// Handle ball collisions with physics

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private onBallCollide(event: any): void {
		if (!event || !event.body) return;

		// Get the body that the ball collided with
		const collidedBody: CANNON.Body & {
			userData: { isSeagull: boolean; seagullInstance: Seagull };
		} = event.body;
		// Check if it's a seagull body
		if (collidedBody.userData?.isSeagull) {
			// Get the seagull instance
			const seagull = collidedBody.userData.seagullInstance;
			if (seagull && !seagull.isHit) {
				// Hit the seagull
				seagull.hit();
			}
		}
	}

	private initSeagulls(): void {
		this.remainingSeagulls = this.NUM_SEAGULLS;

		// Create multiple seagulls
		for (let i = 0; i < this.NUM_SEAGULLS; i++) {
			const seagull = new Seagull(() => this.handleSeagullHit());

			// Set flight bounds to a much wider area around the island
			seagull.setBounds(
				new Vector3(-50, 15, -50), // Minimum coordinates
				new Vector3(50, 35, 50), // Maximum coordinates
			);

			// Add the seagull model to the scene after a delay to ensure model loading
			setTimeout(() => {
				const model = seagull.getModel();
				if (model) {
					this.add(model);
					console.log("Seagull added to scene", model.position);
				} else {
					console.log("Seagull model not yet loaded after timeout");
					// Try again after more time
					setTimeout(() => {
						const retryModel = seagull.getModel();
						if (retryModel) {
							this.add(retryModel);
							console.log(
								"Seagull added on second attempt",
								retryModel.position,
							);
						}
					}, 1000);
				}
			}, 500);

			this.seagulls.push(seagull);
		}

		// Add physics bodies for seagulls after they're created
		setTimeout(() => {
			for (const seagull of this.seagulls) {
				const physicsBody = seagull.getPhysicsBody();
				if (physicsBody) {
					this.physicsWorld.addBody(physicsBody);
				}
			}
		}, 1000); // Give time for seagulls to initialize

		// Create win screen (hidden initially)
		this.createWinScreen();
	}

	private handleSeagullHit(): void {
		this.remainingSeagulls--;
		console.log(`Seagull hit! ${this.remainingSeagulls} remaining`);

		if (this.remainingSeagulls <= 0) {
			this.showWinScreen();
		}
	}

	private createWinScreen(): void {
		// Create win screen element
		this.winScreen = document.createElement("div");

		// Style the win screen
		Object.assign(this.winScreen.style, {
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			padding: "2rem",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			color: "white",
			textAlign: "center",
			borderRadius: "10px",
			fontFamily: "Arial, sans-serif",
			fontSize: "2rem",
			display: "none",
			zIndex: "1000",
		});

		// Set content
		this.winScreen.innerHTML =
			"<h1>You Win!</h1><p>All seagulls eliminated!</p>";

		// Add play again button
		const button = document.createElement("button");
		button.textContent = "Play Again";
		Object.assign(button.style, {
			padding: "0.5rem 1rem",
			fontSize: "1.2rem",
			backgroundColor: "#4CAF50",
			color: "white",
			border: "none",
			borderRadius: "5px",
			cursor: "pointer",
			marginTop: "1rem",
		});

		button.addEventListener("click", () => {
			// Hide win screen
			if (this.winScreen) {
				this.winScreen.style.display = "none";
			}

			// Reset game (recreate seagulls)
			this.resetGame();
		});

		this.winScreen.appendChild(button);

		// Add to DOM
		document.body.appendChild(this.winScreen);
	}

	private showWinScreen(): void {
		if (this.winScreen) {
			this.winScreen.style.display = "block";
		}
	}

	private resetGame(): void {
		// Clear any remaining seagulls
		for (const seagull of this.seagulls) {
			const model = seagull.getModel();
			if (model?.parent) {
				model.parent.remove(model);
			}
		}
		this.seagulls = [];

		// Create new seagulls
		this.initSeagulls();
	}

	public async load(): Promise<void> {
		this.gltfLoader.load(
			island,
			(gltf) => {
				gltf.scene.position.set(0, 8, 0);
				gltf.scene.traverse((child) => {
					if (child instanceof Mesh) {
						child.castShadow = true;
						child.receiveShadow = true;

						if (child.material) {
							child.material.precision = "mediump";
							child.material.dithering = false;

							if (child.material.envMapIntensity !== undefined) {
								child.material.envMapIntensity = 0.8;
							}
						}
					}
				});
				this.add(gltf.scene);
			},
			(xhr) => {
				console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
			},
			(error) => {
				console.error("An error happened", error);
			},
		);
	}

	public update(): void {
		const deltaTime = this.clock.delta;

		// Update physics world
		this.physicsWorld.update(deltaTime);

		// Update ocean
		this.oceanRenderer.update();

		// Update seagulls
		for (const seagull of this.seagulls) {
			seagull.update();
		}

		// Update and clean up balls
		for (let i = this.balls.length - 1; i >= 0; i--) {
			const ball = this.balls[i];
			const isAlive = ball.update();

			// If ball is dead, remove it
			if (!isAlive) {
				this.remove(ball.getMesh());
				this.physicsWorld.removeBody(ball.getBody());
				ball.dispose();
				this.balls.splice(i, 1);
			}
		}

		this.projScreenMatrix.multiplyMatrices(
			this.camera.projectionMatrix,
			this.camera.matrixWorldInverse,
		);
		this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
		this.traverse((object) => {
			if (object instanceof Mesh && object !== this.oceanRenderer.getMesh()) {
				if (object.position.distanceToSquared(this.camera.position) > 5000) {
					object.visible = false;
				} else {
					object.visible = this.frustum.intersectsObject(object);
				}
			}
		});
	}

	public resize(): void {
		this.camera.aspect = this.viewport.ratio;
		this.camera.far = 1000;
		this.camera.updateProjectionMatrix();
	}

	public dispose(): void {
		if (this.ambientSound?.isPlaying) {
			this.ambientSound.stop();
		}

		for (const seagull of this.seagulls) {
			const model = seagull.getModel();
			if (model) {
				this.remove(model);
			}
		}
		this.seagulls = [];

		// Clean up physics bodies
		for (const ball of this.balls) {
			this.physicsWorld.removeBody(ball.getBody());
			ball.dispose();
		}
		this.balls = [];

		// Clean up seagull physics bodies
		for (const seagull of this.seagulls) {
			const physicsBody = seagull.getPhysicsBody();
			if (physicsBody) {
				this.physicsWorld.removeBody(physicsBody);
			}
		}

		// Remove win screen if it exists
		if (this.winScreen?.parentNode) {
			this.winScreen.parentNode.removeChild(this.winScreen);
		}
	}
}
