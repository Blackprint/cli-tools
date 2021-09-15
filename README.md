# Blackprint CLI
This CLI contains tools for compiling/building nodes for Blackprint.

You will need to install this globally
```sh
$ npm i -g @blackprint/cli-tools
```

## Build command
The `build` command will search for `blackprint.config.js` from current working directory and search in deeper directory (excluding `node_modules`, `dist` or directory with dot `.` as the first character).

To use it, you can execute this command on the root of your project.
```sh
$ blackprint build
```

To minify the files for production, you can use `production` or `prod`.
```sh
$ blackprint build prod
```