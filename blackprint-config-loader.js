let fs = require('fs');
let Path = require('path');
let chalk = require('chalk');
let chokidar = require('chokidar');
let yargs = require('yargs');
let extractDocs = require('./utils/_extractDocs.js');
let { hideBin } = require('yargs/helpers');
let argv = yargs(hideBin(process.argv)).argv;
let currentPath = process.cwd();

module.exports = function(SFC, Gulp){
	let resolvePath = require('path').resolve;
	let moduleList = {};

	let configWatch = chokidar.watch([
		currentPath+"/blackprint.config.js",
		currentPath+"/src/**/blackprint.config.js",
		currentPath+"/nodes/**/blackprint.config.js",
		currentPath+"/nodes-*/**/blackprint.config.js",
	], {
		ignoreInitial: false,
		ignored: (path => path.includes('node_modules') || path.includes('.git') || path.includes('turbo_modules'))
	});

	function convertCWD(paths, dirPath){
		dirPath += '/';

		if(paths.constructor === String){
			if(paths.includes('@cwd'))
				return paths.replace('@cwd', currentPath);
			if(paths.slice(0,1) === '!')
				return '!' + dirPath + paths.slice(1);
			return dirPath + paths;
		}
		else if(paths.constructor === Array){
			paths = JSON.parse(JSON.stringify(paths));

			for (var i = 0; i < paths.length; i++) {
				let temp = paths[i];
				if(temp.includes('@cwd'))
					paths[i] = temp.replace('@cwd', currentPath);
				else if(temp.slice(0,1) === '!')
					paths[i] =  '!' + dirPath + temp.slice(1);
				else
					paths[i] = dirPath + temp;
			}

			return paths;
		}
	}

    fs.mkdirSync(currentPath+'/dist', {recursive: true});

	let oldConfig = {};
	configWatch.on('all', function(event, path){
		path = path.split('\\').join('/');
		if(path.includes('/_template/')) return;

		if(event !== 'add' && event !== 'change' && event !== 'removed')
			return;

		let dirPath = path.slice(0, path.lastIndexOf('/')).replace(/\//g, Path.sep);
		let _path = path;
		let config = require(_path);
		delete require.cache[resolvePath(_path)];

		if(!config.name)
			throw new Error("Blackprint config must have a name, please use the template if you're creating new project.");

		if(config.js){
			config.js.filePath = config.js.file;

			if(config.js.combine){
				let temp = config.js.combine;
				if(temp.constructor === String)
					config.js.combine = [temp, '!blackprint.config.js', '!dist/**/*'];
				else
					temp.push('!blackprint.config.js', '!dist/**/*');
			}
		}

		if(config.ts){
			config.ts.filePath = config.ts.file;
		}

		let oldOnFinish = config.onFinish;
		config.onFinish = function(which, path, ext){
			let date = new Date();
			var h = date.getHours(), h = h < 10 ? '0'+h : h;
			var m = date.getMinutes(), m = m < 10 ? '0'+m : m;
			var s = date.getSeconds(), s = s < 10 ? '0'+s : s;
			console.log('['+chalk.gray(`${h}:${m}:${s}`)+`] Finished "${chalk.cyan(config.name)}" -> ${which} ${ext ? '.'+ext : ''}`);

			oldOnFinish && oldOnFinish.apply(this, arguments);
		};

		let oldOnStart = config.onStart;
		config.onStart = function(which, path, ext){
			let date = new Date();
			var h = date.getHours(), h = h < 10 ? '0'+h : h;
			var m = date.getMinutes(), m = m < 10 ? '0'+m : m;
			var s = date.getSeconds(), s = s < 10 ? '0'+s : s;
			console.log('['+chalk.gray(`${h}:${m}:${s}`)+`] Starting "${chalk.cyan(config.name)}" -> ${which}${ext ? ' .'+ext : ''}...`);

			oldOnStart && oldOnStart.apply(this, arguments);
		};

		['html', 'sf'].forEach(v => {
			let that = config[v];
			if(that){
				that.header = config.header;
				that.prefix = config.templatePrefix;
			}
		});

		let moduleUrl = '';
		['ts', 'js', 'scss', 'html', 'sf'].forEach(which => {
			let that = config[which];
			if(that){
				if(moduleUrl === '' || which === 'js'){
					moduleUrl = that.file.replace('@cwd', '');
					if(which === 'sf'){
						if(that.wrapped && that.wrapped.includes('mjs'))
							moduleUrl += '.mjs';
						else
							moduleUrl += '.js';
					}
				}

				that.header = config.header;
				that.file = convertCWD(that.file, dirPath);

				if(that.combine)
					that.combine = convertCWD(that.combine, dirPath);
			}
		});

		if(event === 'removed'){
			if(oldConfig[_path] === void 0) return;

			SFC.deleteConfig(oldConfig[_path]);
			console.log(`[Blackprint] "${config.name}" config was removed`);
			delete moduleList[config.name];
			return;
		}
		// else => When config updated/created

		if(event === 'add'){
			if(config.disabled) return;

			[config.js, config.sf].forEach(that => {
				if(that != null){
					// Extract JSDoc for Blackprint nodes if exist
					if(config.bpDocs != null){
						let dir = config.bpDocs;
						if(dir.includes('@cwd')) dir = dir.replace('@cwd', currentPath);

						let docs = {};
						that.onEvent = {
							fileCompiled(content, rawContent){
								that.onEvent.fileModify(rawContent || content);
							},
							fileModify(content, filePath){
								extractDocs(content, filePath, docs);
							},
							scanFinish(){
								fs.writeFileSync(dir, JSON.stringify(docs));
								SFC.socketSync?.('bp-docs-append', docs, "Blackprint docs updated");

								let filePath = that.filePath.replace('@cwd/', '');
								let host = argv.host;
								let moduleCachePath;

								if(argv.host){
									if(host.includes('://')) host = host.split('://')[1];
									host = host.split('/')[0].replace(':', '-').replace('..', '');
		
									moduleCachePath = `./.bp_cache/modules/${host}/${filePath}`;
									if(!fs.existsSync(moduleCachePath)) moduleCachePath = null;
								}
								else{
									// Check for default host
									for (let i=89; i <= 92; i++) {
										moduleCachePath = `./.bp_cache/modules/localhost-67${i}/${filePath}`;
										if(!fs.existsSync(moduleCachePath)) moduleCachePath = null;
										else break;
									}
								}

								if(moduleCachePath != null){
									fs.rmSync(moduleCachePath);
									console.log("[Blackprint] Module cache was removed");
								}
							}
						}
					}
				}
			});

			if(config.ts != null && config.ts.scanDocs){
				// Extract JSDoc for Blackprint nodes if exist
				if(config.bpDocs != null){
					let dir = config.bpDocs;
					if(dir.includes('@cwd'))
						dir = dir.replace('@cwd', currentPath);

					let initScan = setTimeout(()=> {
						console.log("Initial scan was longer than 1min:", config.ts.scanDocs);
					}, 60000);

					let save = 0;
					let docs = {};
					function onChange(file, stats){
						file = currentPath + '/' + file;
						extractDocs(fs.readFileSync(file, 'utf8'), file, docs);

						clearTimeout(save);
						save = setTimeout(onFinish, 3000);
					}

					function onFinish(){
						fs.writeFileSync(dir, JSON.stringify(docs));
						SFC.socketSync?.('bp-docs-append', docs, "Blackprint docs updated");

						let filePath = config.ts.filePath.replace('@cwd/', '');
						let host = argv.host;
						let moduleCachePath;

						if(argv.host){
							if(host.includes('://')) host = host.split('://')[1];
							host = host.split('/')[0].replace(':', '-').replace('..', '');
	
							moduleCachePath = `./.bp_cache/modules/${host}/${filePath}`;
							if(!fs.existsSync(moduleCachePath)) moduleCachePath = null;
						}
						else{
							// Check for default host
							for (let i=89; i <= 92; i++) {
								moduleCachePath = `./.bp_cache/modules/localhost-67${i}/${filePath}`;
								if(!fs.existsSync(moduleCachePath)) moduleCachePath = null;
								else break;
							}
						}

						if(moduleCachePath != null){
							fs.rmSync(moduleCachePath);
							console.log("[Blackprint] Module cache was removed");
						}
					}

					config._tsDocsWatch = chokidar.watch(config.ts.scanDocs, {
							cwd: currentPath,
							alwaysStat: false,
							ignored: (path => path.includes('node_modules') || path.includes('.git') || path.includes('turbo_modules'))
						})
						.on('add', onChange).on('change', onChange)
						.on('ready', () => clearTimeout(initScan))
						.on('error', console.error);
				}
			}

			SFC.importConfig(config.name, config);
			console.log(`[Blackprint] "${config.name}" config was added`);
			moduleList[config.name] = moduleUrl;
		}
		else { // on changed
			if(oldConfig[_path] === void 0){
				SFC.importConfig(config.name, config);
				moduleList[config.name] = moduleUrl;
				console.log(`[Blackprint] "${config.name}" config was enabled`);

				config._tsDocsWatch?.close();
			}
			else{
				let old = oldConfig[_path];
				SFC.deleteConfig(oldConfig[_path]);
				if(config.disabled){
					delete oldConfig[_path];
					delete moduleList[config.name];
					console.log(`[Blackprint] "${config.name}" config was disabled`);
					return;
				}

				SFC.importConfig(config.name, config);
				console.log(`[Blackprint] "${config.name}" config reloaded`);

				delete moduleList[old.name];
				moduleList[config.name] = moduleUrl;
			}
		}

		oldConfig[_path] = config;
	});

	return {
		moduleList
	};
}