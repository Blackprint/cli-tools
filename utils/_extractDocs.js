module.exports = function(content, filePath, docs){
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