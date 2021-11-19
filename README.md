# Blackprint CLI
This CLI contains tools for compiling/building nodes for Blackprint.

You can install this globally
```sh
$ npm i -g @blackprint/cli-tools
```

## Build command
The `build` command will watch for `blackprint.config.js` from current working directory and search deeper inside of `nodes` directory. So.. make sure you're not putting `node_modules` inside of `nodes` directory, or it will fill up your computer memory 😅

To use it, you can execute this command on the root of your project.
```sh
$ blackprint build
```

To minify the files for production, you can use `production` or `prod`.
```sh
$ blackprint build prod
```

---

If you installed this with `package.json` on your project, you can use npx.
```sh
$ npx blackprint build
```