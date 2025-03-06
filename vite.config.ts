import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	assetsInclude: [
		"**/*.gltf",
		"**/*.glb",
		"**/*.obj",
		"**/*.mtl",
		"**/*.hdr",
		"assets/**",
	],
	plugins: [
		tsconfigPaths(),
		glsl({
			compress: process.env.NODE_ENV === "production",
			root: "/node_modules",
		}),
		viteStaticCopy({
			targets: [
				{
					src: "node_modules/three/examples/jsm/libs/draco",
					dest: "libs",
				},
				{
					src: "node_modules/three/examples/jsm/libs/basis",
					dest: "libs",
				},
			],
		}),
	],
});
