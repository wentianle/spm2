# spm

The API of spm.

-------

Get the interface of spm:

```js
var spm = require('spm')
```

## spm.version

The version of spm.

## spm.log

Always use `spm.log` in your program, never use `console`.

## spm.plugin

- spm.plugin.install
- spm.plugin.uninstall
- spm.plugin.show
- spm.plugin.plugins

## spm.config

Interact with `~/.spm/spmrc` config file.

- spm.config.config
- spm.config.remove
- spm.config.show

## spm.publish

Publish a package to spmjs.org.

## spm.install

Install packages from spmjs.org.


## spm.sdk

Low level API:

- `spm.sdk.spmrc`
- [`spm.sdk.ast`](https://github.com/spmjs/cmd-util/blob/master/docs/ast.md)
- `spm.sdk.iduri`
- `spm.sdk.yuan`
- `spm.sdk.grunt`
