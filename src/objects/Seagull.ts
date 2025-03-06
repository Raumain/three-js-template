import {
	AnimationMixer,
	Box3,
	CatmullRomCurve3,
	Clock,
	Group,
	Material,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	SphereGeometry,
	Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

export class Seagull {
	private model: Group | null = null;
	private mixer: AnimationMixer | null = null;
	private clock = new Clock();
	private path: CatmullRomCurve3;
	private progress = 0;
	private speed: number;
	private bounds = new Box3(
		new Vector3(-100, 0, -100),
		new Vector3(100, 50, 100),
	);
	private modelLoaded = false;
	private isHit = false;
	private onHitCallback: (() => void) | null = null;

	constructor(onHitCallback?: () => void) {
		// Create a random flight path within bounds
		this.path = this.createRandomPath();

		// Randomize speed for natural variation - slower speed for better visibility
		this.speed = 0.03 + Math.random() * 0.02;

		// Create fallback model in case the GLTF fails
		this.createFallbackModel();

		// Load the actual model
		this.loadModel();

		// Store the callback for when the seagull is hit
		this.onHitCallback = onHitCallback || null;
	}

	private createFallbackModel(): void {
		// Create a simple placeholder seagull as fallback
		const group = new Group();

		// Tag the fallback model as a seagull for collision detection
		group.userData.isSeagull = true;

		// Body
		const bodyGeometry = new SphereGeometry(1, 8, 8);
		const bodyMaterial = new MeshStandardMaterial({ color: 0xffffff });
		const body = new Mesh(bodyGeometry, bodyMaterial);
		body.scale.set(1, 0.5, 2);

		// Wings
		const wingGeometry = new SphereGeometry(1, 4, 4);
		wingGeometry.scale(2, 0.2, 1);
		const wingMaterial = new MeshStandardMaterial({ color: 0xdddddd });

		const leftWing = new Mesh(wingGeometry, wingMaterial);
		leftWing.position.set(-2, 0, 0);

		const rightWing = new Mesh(wingGeometry, wingMaterial);
		rightWing.position.set(2, 0, 0);

		// Assemble
		group.add(body);
		group.add(leftWing);
		group.add(rightWing);

		// Scale appropriately - make it larger for visibility
		group.scale.set(2, 2, 2);

		// Make sure our fallback model faces -Z direction (forward)
		// Add a small "head" to clearly show the direction
		const headGeometry = new SphereGeometry(0.5, 8, 8);
		const head = new Mesh(headGeometry, bodyMaterial);
		head.position.set(0, 0.3, -1); // Position at the front
		group.add(head);

		// Add a collision sphere that's slightly larger than the visual model
		// This makes it easier to hit the seagull
		const collisionSphere = new Mesh(
			new SphereGeometry(2, 8, 8),
			new MeshStandardMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.0, // Invisible
				wireframe: true, // Only visible in debug mode
			}),
		);
		group.add(collisionSphere);

		this.model = group;
		this.modelLoaded = true;
	}

	private loadModel(): void {
		console.log("Loading seagull model...");
		const loader = new GLTFLoader();
		loader.load(
			"/assets/models/seagull.glb",
			(gltf) => {
				// If we already have a fallback model, remove it from the scene
				const parent = this.model?.parent;
				if (parent && this.model) {
					parent.remove(this.model);
				}

				this.model = gltf.scene;
				console.log("Seagull model loaded successfully");

				// Tag the model as a seagull for collision detection
				this.model.userData.isSeagull = true;

				// Make the seagull larger for better visibility
				this.model.scale.set(2.5, 2.5, 2.5);

				// Rotate the model to ensure it's oriented correctly
				// The model might be facing +Z direction by default, but we need it to face -Z
				this.model.rotation.y = Math.PI; // Rotate 180 degrees to face forward

				// Set up animations if available
				if (gltf.animations?.length) {
					this.mixer = new AnimationMixer(this.model);
					console.log(`Found ${gltf.animations.length} animations for seagull`);

					// Play all animations
					for (const animation of gltf.animations) {
						const action = this.mixer.clipAction(animation);
						action.play();
					}
				} else {
					console.log("No animations found in seagull model");
				}

				// Enable shadows and make materials more visible
				this.model.traverse((child) => {
					if (child instanceof Mesh) {
						child.castShadow = true;
						child.receiveShadow = true;

						// Add collision detection to all meshes in the seagull
						child.userData.isSeagull = true;

						// Ensure materials are visible
						if (child.material) {
							// Make sure material isn't too dark
							if (child.material instanceof MeshStandardMaterial) {
								child.material.emissive.set(0x222222);
								child.material.emissiveIntensity = 0.3;
							}
						}
					}
				});

				// If the model was already in a scene, add it back
				if (parent) {
					parent.add(this.model);
				}

				this.modelLoaded = true;
			},
			// Progress callback
			(xhr) => {
				console.log(`Seagull model: ${(xhr.loaded / xhr.total) * 100}% loaded`);
			},
			// Error callback
			(error) => {
				console.error("Error loading seagull model:", error);
				// We keep the fallback model in this case
			},
		);
	}

	private createRandomPath(): CatmullRomCurve3 {
		// Create a curved path for the seagull to follow
		const points: Vector3[] = [];
		const numPoints = 5 + Math.floor(Math.random() * 3);

		for (let i = 0; i < numPoints; i++) {
			const x =
				this.bounds.min.x +
				Math.random() * (this.bounds.max.x - this.bounds.min.x);
			// Set y to be higher above the island for better visibility
			// Island is at y=8, so fly well above it
			const y = this.bounds.min.y + 5 + Math.random() * 15;
			const z =
				this.bounds.min.z +
				Math.random() * (this.bounds.max.z - this.bounds.min.z);
			points.push(new Vector3(x, y, z));
		}

		// Make the path loop
		return new CatmullRomCurve3(points, true);
	}

	public update(): void {
		if (!this.model || !this.modelLoaded) return;

		const delta = this.clock.getDelta();

		// Update animation mixer if exists
		if (this.mixer) {
			this.mixer.update(delta);
		}

		// Update position along path
		this.progress += this.speed * delta;
		if (this.progress > 1) this.progress -= 1;

		// Get current position and the next position for direction
		const currentPosition = this.path.getPoint(this.progress);

		// Look ahead a bit more to get smoother orientation changes
		// Increase the lookAhead value for smoother turns (0.05 instead of 0.01)
		const lookAheadValue = 0.05;
		const nextPosition = this.path.getPoint(
			(this.progress + lookAheadValue) % 1,
		);

		// Update the seagull's position
		this.model.position.copy(currentPosition);

		// Calculate the direction vector from current to next position
		const direction = nextPosition.clone().sub(currentPosition).normalize();

		// Set the model's orientation using the direction vector
		// We'll manually handle the rotation rather than using lookAt
		// This gives us more control over the orientation
		if (direction.length() > 0.001) {
			// Only update rotation if we have a meaningful direction
			// Calculate rotation to face the direction of travel
			const targetRotation = Math.atan2(direction.x, direction.z);

			// Apply rotation to the y-axis (heading)
			this.model.rotation.y = targetRotation;

			// Apply banking/roll based on turning
			// Calculate how much the bird is turning by looking at change in direction
			const turnIntensity = Math.abs(direction.x) * 0.5;
			const bankAngle = direction.x * -0.3; // Bank in the opposite direction of the turn

			// Apply a slight bank and pitch when turning
			this.model.rotation.z = bankAngle;

			// Add a slight upward pitch when gaining altitude, downward when descending
			const verticalAngle = direction.y * 0.5;
			this.model.rotation.x = verticalAngle;
		}
	}

	public getModel(): Group | null {
		return this.model;
	}

	public setBounds(min: Vector3, max: Vector3): void {
		this.bounds.set(min, max);
		// Create a new path within the new bounds
		this.path = this.createRandomPath();
	}

	// Add a method to check if this is a seagull (for collision detection)
	public static isSeagull(object: Object3D): boolean {
		return object.userData.isSeagull === true;
	}

	public hit(): void {
		if (this.isHit) return; // Prevent multiple hits

		this.isHit = true;
		console.log("Seagull was hit!");

		// Notify the scene that this seagull was hit
		if (this.onHitCallback) {
			this.onHitCallback();
		}

		// Remove the seagull from the scene
		if (this.model?.parent) {
			this.model.parent.remove(this.model);
		}

		// Clean up resources
		this.dispose();
	}

	public dispose(): void {
		// Clean up any resources
		if (this.mixer) {
			this.mixer.stopAllAction();
		}

		// Clean up geometry and materials
		if (this.model) {
			this.model.traverse((child) => {
				if (child instanceof Mesh) {
					child.geometry.dispose();
					if (child.material instanceof Material) {
						child.material.dispose();
					} else if (Array.isArray(child.material)) {
						for (const material of child.material) {
							material.dispose();
						}
					}
				}
			});
		}
	}
}
