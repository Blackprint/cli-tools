var fs = require('fs');
var Path = require('path');
var chalk = require('chalk');
var currentPath = process.cwd();

module.exports = function(SFC, Gulp){
	let resolvePath = require('path').resolve;
	let moduleList = {};
	let configWatch = Gulp.watch([
		"blackprint.config.js",
		"nodes/**/blackprint.config.js"
	], {ignoreInitial: false});

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
		path = currentPath+'/'+path.split('\\').join('/');
		if(path.includes('/_template/')) return;

		if(event !== 'add' && event !== 'change' && event !== 'removed')
			return;

		let dirPath = path.slice(0, path.lastIndexOf('/')).replace(/\//g, Path.sep);
		let _path = path;
		let config = require(_path);
		delete require.cache[resolvePath(_path)];

		if(!config.name)
			throw new Error("Blackprint config must have a name, please use the template if you're creating new project.");

		if(config.js && config.js.combine){
			let temp = config.js.combine;
			if(temp.constructor === String)
				config.js.combine = [temp, '!blackprint.config.js', '!dist/**/*'];
			else
				temp.push('!blackprint.config.js', '!dist/**/*');
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