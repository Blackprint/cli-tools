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
			let filter = createRegExp(Object.keys(resolves));

			return {
				name: "bp-prefer-cdn",
				setup(build) {
					build.onResolve({ filter }, val => ({
						path: val.path, namespace: "bp-plugins"
					}));

					build.onLoad({ filter, namespace: "bp-plugins"}, async val => {
						return {
							resolveDir: srcRoot, loader: "ts", contents: `
							import { _imports_ } from "@_bp_internal";
							export default await _imports_(${JSON.stringify(val.path)}, ${JSON.stringify(resolves[val.path])});`,
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