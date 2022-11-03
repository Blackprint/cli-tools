let chalk = require('chalk');
let { execSync } = require('child_process');
let fs = require('fs');
let replace = require('replace-in-file');

module.exports = async function(){
	let inquirer = (await import('inquirer')).default;
	let answers = await inquirer.prompt([{
		name: 'UseCurrentFolder',
		type: 'confirm',
		message: 'Use current working directory as module directory?',
		default: false,
	}, {
		name: 'ModuleName',
		type: 'input',
		message: 'Type your module name (capitalized with no space or symbol):',
		default: 'Untitled',
	}, {
		name: 'SelectTemplate',
		message: 'Select a template to start working on your module:',
		type: 'rawlist',
		choices: [{
			name: 'ScarletsFrame - JavaScript', checked: true
		}],
		default: 0,
	}]);

	handleAnswers(answers);

	console.log(`
---

${chalk.bold('Module Name:')} ${chalk.cyanBright(answers.ModuleName)}
${chalk.bold('Namespaces:')}
 - ${chalk.bold('Node:')} ${chalk.cyanBright(answers.ModuleName+'/...')}
 - ${chalk.bold('Interface Component:')} ${chalk.cyanBright('BPIC/'+answers.ModuleName+'/...')}
 - ${chalk.bold('CSS rule set:')} ${chalk.cyanBright('bpic-'+answers.ModuleName+'-...')}

---

Use ${chalk.yellowBright('blackprint serve')} to start the module server
Then connect Blackprint Editor (on Development Mode) to the module server
`);
};

function handleAnswers(answers){
	if(/[\\/:*?"<>|]/.test(answers.ModuleName) || answers.ModuleName.startsWith('.'))
		throw new Error(`Module name contains invalid symbol: ${answers.ModuleName}`);

	if(answers.SelectTemplate === 'ScarletsFrame - JavaScript'){
		let path;
		if(answers.UseCurrentFolder) path = '.';
		else path = './nodes-'+answers.ModuleName;

		let repoLink = 'https://github.com/Blackprint/template-js';
		execSync(`git clone --depth 1 ${repoLink} ${path}`);
		fs.rmSync(`${path}/.git`, { recursive: true });

		let _moduleName = answers.ModuleName.toLowerCase();
		let replacement = {
			'LibraryName': answers.ModuleName,
			'libraryname': answers.ModuleName.toLowerCase(),
			'bp-your-module-name': 'nodes-'+_moduleName,
			'nodes-rename-me': 'nodes-'+_moduleName,
			'https://github.com/your/repository.git': 'https://github.com/YourUsernameHere/nodes-'+_moduleName+'.git',
			'/gh/blackprint/template-js@dist': '/gh/YourUsernameHere/nodes-'+_moduleName+'@dist',
		};

		let aa = replace.sync({
			files: [
				`${path}/**/*.md`,
				`${path}/**/*.js`,
				`${path}/**/*.css`,
				`${path}/**/*.sf`,
				`${path}/**/*.html`,
				`${path}/**/*.json`,
			],
			from: Object.keys(replacement).map(v => {
				return RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
			}),
			to: Object.values(replacement),
		});
	}
}