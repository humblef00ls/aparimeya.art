import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		{
			name: 'wgsl-loader',
			transform(code, id) {
				if (id.endsWith('.wgsl')) {
					return {
						code: `export default ${JSON.stringify(code)};`,
						map: null
					};
				}
			}
		}
	],
	define: {
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
	}
});
