#!/usr/bin/env node
var currentPath = process.cwd();

// Command list
var command = {
	build: {
		shortDesc: "Compile Blackprint nodes for current project (JavaScript)",
		longDesc: "Example command:\nblackprint build production",
		call(env='development'){
			process.stdout.write("Loading scarletsframe-compiler\r");
			let isProduction = process.env.production === 'true' || env === 'prod' || env === 'production';

			let Gulp = require('gulp');
			let SFC = require("scarletsframe-compiler")({
				// Start the server
				browserSync: !isProduction && {
					port: process.env.PORT || 6791, // Accessible-> http://localhost:6789
					ghostMode: false, // Use synchronization between browser?
					ui: false,
					open: false,

					// Standalone server with BrowserSync
					server:{
						baseDir:'./'
					}
				},

				// Transpile + Minify
				_compiling: isProduction,

				includeSourceMap: true,
				startupCompile: true,
				hotReload:{
					html: true,
					sf: true,
					js: true,
					scss: true
				},
				path: {}
			}, Gulp);

			require('./blackprint-config-loader.js')(SFC, Gulp);
			Gulp.task('default')();
		}
	}
};

// No need to modify below
var args = process.argv.slice(2);
if(args[0] === void 0 || /-h|--h|\/h|\/help|help/.test(args)){
	console.log("Available commands:");

	for(let key in command)
		console.log(' - '+key+': '+command[key].shortDesc);
}
else if(command[args[0]]){
	if(/-h|--h|\/h|\/help|help/.test(args[1])){
		console.log(command[args[0]].longDesc);
		return;
	}

	command[args[0]].call(args[1]);
}
else {
	console.log("Command not found: ", args[0]);
}