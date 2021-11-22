#!/usr/bin/env node
var currentPath = process.cwd();
let fs = require('fs');

// Command list
var command = {
	build: {
		shortDesc: "Compile Blackprint modules for current project (JavaScript)",
		longDesc: "Example command:\nblackprint build production",
		call(env='development'){
			let isProduction = process.env.production === 'true' || env === 'prod' || env === 'production';

			// env = @serve, for internal use only

			if(!fs.existsSync(`${currentPath}/blackprint.config.js`)
			   && !fs.existsSync(`${currentPath}/nodes/`)){
				console.error("Config file (./blackprint.config.js) or modules folder was not found (nodes/**/blackprint.config.js)");
				process.exit(1);
			}

			process.stdout.write("Loading Gulp\r");
			let Gulp = require('gulp');

			process.stdout.write("Loading scarletsframe-compiler\r");
			let SFC = require("scarletsframe-compiler")({
				// Start the server
				browserSync: env === '@serve' && {
					port: process.env.PORT || 6791, // Accessible-> http://localhost:6789
					ghostMode: false, // Use synchronization between browser?
					ui: false,
					open: false,

					// Standalone server with BrowserSync
					cors: true,
					server:{ baseDir:'./dist' },
					serveStatic: [{
						route: '/dist',
						dir: 'dist'
					}],
					middleware: [{
						route: "/api/module-list",
						handle(req, res, next){
							res.end(JSON.stringify(configLoader.moduleList));
							next();
						}
					}]
				},

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

			let configLoader = require('./blackprint-config-loader.js')(SFC, Gulp);

			if(isProduction)
				Gulp.task('compile')(); // Transpile + Minify
			else Gulp.task('default')();
		}
	},
	serve: {
		shortDesc: "Create a server for compiled Blackprint modules",
		longDesc: "Example command:\nblackprint serve",
		call(){
			command.build.call('@serve');
		}
	}
};

// No need to modify below
var args = process.argv.slice(2);
if(args[0] === void 0 || /-h|--h|\/h|\/help|help/.test(args[0])){
	console.log("Available commands:");

	for(let key in command)
		console.log(' - '+key+': '+command[key].shortDesc);
}
else if(command[args[0]] !== void 0){
	if(/-h|--h|\/h|\/help|help/.test(args[1])){
		console.log(command[args[0]].longDesc);
		return;
	}

	command[args[0]].call(args[1]);
}
else {
	console.log("Command not found: ", args[0]);
}