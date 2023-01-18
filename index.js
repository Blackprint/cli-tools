module.exports = {
	esbuildPlugin: {
		init(getConfig){
			return {
				name: 'bp-plugin-init',
				setup(build){
					let config = getConfig();
					let filter = createRegExp([
						'@blackprint/sketch',
						'@blackprint/engine',
						'@_bp_internal'
					]);

					build.onResolve({ filter }, val => ({
						path: val.path, namespace: "bp-plugins"
					}));

					build.onLoad({ filter, namespace: "bp-plugins" }, async val => {
						if(val.path === '@_bp_internal'){
							let hasInterface = !!config.sf;
							let hasDocs = !!config.bpDocs;

							return {
								loader: 'ts', contents: `
								export let Blackprint = globalThis.Blackprint.loadScope({
									url: import.meta.url,
									hasInterface: ${hasInterface},
									hasDocs: ${hasDocs},
								}) as typeof import("@blackprint/engine");

								let sf = globalThis.sf;
								export async function _imports_(moduleName: string, url: string){
									let loadFromURL = globalThis.Blackprint.Environment.loadFromURL;
									if(loadFromURL && sf?.loader != null){
										return (await sf.loader.mjs([url]))[0];
									}

									return await import(loadFromURL ? moduleName : url);
								};`,
							}
						}

						return {
							loader: 'ts', contents: `
							import { Blackprint } from "@_bp_internal";
							export default Blackprint;`,
						}
					});
				}
			}
		},
		preferCDN(srcRoot, resolves) {
			let keys = Object.keys(resolves);
			if(keys.length === 0)
				throw new Error("Module name and URL need to be specified when using 'preferCDN' plugin");

			let filter = createRegExp(keys);
			return {
				name: "bp-prefer-cdn",
				setup(build) {
					build.onResolve({ filter }, val => ({
						path: val.path, namespace: "bp-plugins"
					}));

					build.onLoad({ filter, namespace: "bp-plugins"}, async val => {
						let url = resolves[val.path];
						let globall = '';

						if(url.constructor === Object){
							globall = url.globalVar;
							url = url.url;
						}

						let append = `await _imports_(${JSON.stringify(val.path)}, ${JSON.stringify(url)})`;

						if(globall){
							append = `(globall[${JSON.stringify(globall)}] || ${append})`;
						}

						return {
							resolveDir: srcRoot, loader: "ts", contents: `
							import { _imports_ } from "@_bp_internal";
							let globall = typeof window !== 'undefined' ? window : globalThis;
							export default ${append};`,
						};
					});
				},
			};
		}
	}
};

function createRegExp(strings){
	let escape = val => val.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	return new RegExp(strings.map(val => `^${escape(val)}$`).join("|"));
}