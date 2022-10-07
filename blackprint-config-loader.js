let fs = require('fs');
let Path = require('path');
let chalk = require('chalk');
let chokidar = require('chokidar');
let yargs = require('yargs');
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

	function deepProperty(obj, path, value, onCreate){
		var temp;
		if(value !== void 0){
			for(var i = 0, n = path.length-1; i < n; i++){
				temp = path[i];
				if(obj[temp] === void 0){
					obj[temp] = {};
					onCreate && onCreate(obj[temp]);
				}
	
				obj = obj[temp];
			}
	
			obj[path[i]] = value;
			return;
		}
	
		for(var i = 0; i < path.length; i++){
			if((obj = obj[path[i]]) === void 0)
				return;
		}
	
		return obj;
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
		['js', 'scss', 'html', 'sf'].forEach(which => {
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

			if(config.js != null){
				// Extract JSDoc for Blackprint nodes if exist
				if(config.bpDocs != null){
					let dir = config.bpDocs;
					if(dir.includes('@cwd'))
						dir = dir.replace('@cwd', currentPath);

					let docs = {};
					let that = config.js;

					that.onEvent = {
						fileCompiled(content, rawContent){that.onEvent.fileModify(rawContent || content)},
						fileModify(content, filePath){
							let contents = [];
							content.replace(/\/\*\*.*?\*\//gs, function(full, index){
								if(!full.includes('* @blackprint')) return;
								contents.push(index);
							});

							for (let i=0; i < contents.length; i++)
								contents[i] = content.slice(contents[i], contents[i+1]);

							for (let i=0; i < contents.length; i++) {
								content = contents[i]; // this have a purposes, don't delete before checking
								content.replace(/\/\*\*(.*?)\*\//gs, function(full, match){
									// Only process if "@blackprint" was found in the file content
									if(!match.includes('@blackprint')) return;

									match = match
										.replace(/\t+/g, '')
										.replace(/^[ \t]+?\* /gm, '')
										.replace(/^@blackprint.*?$\b/gm, '')
										.trim();

									let output = {};
									let input = {};
									let hasIO = {input: false, output: false};
									let namespace = '';

									// Get the class content below the docs
									let slice = content.slice(content.indexOf(full)+full.length);
									slice.replace(/\bregisterNode\(['"`](.*?)['"`].*?^}/ms, function(full, match){
										namespace = match;
										full.replace(/static (input|output)(.*?)}(;|\n)/gms, function(full, which, content){
											// Obtain documentation for StructOf first
											content.replace(/^(\s+).*?(\S+):.*?\bStructOf\(.*?{(.*?)\1}/gms, function(full, s, rootName, content){
												content.replace(/\/\*\*(.*?)\*\/\s+(.*?):/gs, function(full, docs, portName){
													hasIO[which] = true;

													let obj = which === 'output' ? output : input;
													obj[rootName+portName] = {description: docs.replace(/^[ \t]+?\* /gm, '').trim()};
												});

												return full.replace(content, '');
											})
											.replace(/\/\*\*(.*?)\*\/\s+(.*?):/gs, function(full, docs, portName){
												hasIO[which] = true;

												let obj = which === 'output' ? output : input;
												obj[portName] = {description: docs.replace(/^[ \t]+?\* /gm, '').trim()};
											});
										});
									});

									if(namespace === '') return;

									let tags = {};
									let hasTags = false;
									let data = {
										description: match.replace(/^@(\w+) (.*?)$/gm, function(full, name, desc){
											hasTags = true;
											tags[name] = desc;
											return '';
										}).trim(),
									};

									if(hasTags) data.tags = tags;
									if(hasIO.input) data.input = input;
									if(hasIO.output) data.output = output;

									deepProperty(docs, namespace.split('/'), data);
								});
							}
						},
						scanFinish(){
							fs.writeFileSync(dir, JSON.stringify(docs));
							SFC.socketSync?.('bp-docs-append', docs, "Blackprint docs updated");

							let filePath = config.js.filePath.replace('@cwd/', '');
							let host = argv.host;
							let moduleCachePath;

							if(argv.host){
								if(host.includes('://')) host = host.split('://')[1];
								host = host.split('/')[0].replace(':', '-').replace('..', '');
	
								moduleCachePath = `./node_modules/bpModuleCache/${host}/${filePath}`;
								if(!fs.existsSync(moduleCachePath)) moduleCachePath = null;
							}
							else{
								// Check for default host
								for (let i=89; i <= 92; i++) {
									moduleCachePath = `./node_modules/bpModuleCache/localhost-67${i}/${filePath}`;
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

			SFC.importConfig(config.name, config);
			console.log(`[Blackprint] "${config.name}" config was added`);
			moduleList[config.name] = moduleUrl;
		}
		else { // on changed
			if(oldConfig[_path] === void 0){
				SFC.importConfig(config.name, config);
				moduleList[config.name] = moduleUrl;
				console.log(`[Blackprint] "${config.name}" config was enabled`);
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