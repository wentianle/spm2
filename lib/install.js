/* install package from spmjs.org */

var fs = require('fs');
var path = require('path');
var format = require('util').format;
var request = require('request');
var async = require('async');
var color = require('colorful').color;
var semver = require('semver');
var ast = require('cmd-util').ast;
var _ = require('lodash');
var md5file = require('./utils').md5file;
var childexec = require('./utils').childexec;
var tar = require('./utils/tar');
var log = require('./utils/log');
var yuan = require('./sdk/yuan');
var iduri = require('./sdk/iduri');
var grunt = require('./sdk/grunt');
var mo = require('./sdk/module');
var spmrc = require('./sdk/spmrc');
var git = require('./sdk/git');

var _cache = {};
var _options = {
  dest: 'sea-modules',
  cache: path.join(process.env.HOME, '.spm', 'cache'),
  srcCache: path.join(process.env.HOME, '.spm', 'src'),
  parallel: 1
};

module.exports = function(options) {
  _options.parallel = options.parallel || _options.parallel;
  _options.dest = options.dest || _options.dest;
  _options.source = options.source;
  _options.force = options.force;

  var packages;
  if (options.query && options.query.charAt(0) !== '.') {
    packages = [options.query];
  } else {
    packages = parseDependencies('package.json');
  }

  queueInstall(packages, function() {
    console.log();
    var children = [];
    Object.keys(_cache).forEach(function(key) {
      children = _.union(children, _cache[key]);
    });
    Object.keys(_cache).forEach(function(key) {
      if (!_.contains(children, key)) {
        printTree(key);
      }
    });
    console.log();
  });
};

function queueInstall(tasks, callback) {
  var q = async.queue(function(task, callback) {
    if (typeof task === 'string') {
      task = iduri.resolve(task);
    }
    spmInstall(task, callback);
  }, _options.parallel);

  tasks.forEach(function(task) {
    q.push(task, function(err) {
      err && log.error('error', err);
    });
  });

  q.drain = callback;
}

function spmInstall(data, callback) {
  var pkg = data.family + '/' + data.name;
  if (data.version) {
    pkg = pkg + '@' + data.version;
  }
  if (grunt.util._.contains(Object.keys(_cache), pkg)) {
    log.debug('ignore', pkg);
    callback(null);
    return;
  }

  _cache[pkg] = _cache[pkg] || [];

  async.waterfall([
    function(callback) {
      console.log();
      log.info('install', color.magenta(pkg));
      callback(null, pkg);
    },
    fetch, build, copy
  ], function(err, result) {
    if (err) {
      callback(err);
      return;
    }
    var packages = parseDependencies(path.join(result, 'package.json'));
    if (packages.length) {
      log.info('depends', packages.join(', '));
    }
    _cache[pkg] = grunt.util._.union(_cache[pkg], packages);

    if (packages.length) {
      queueInstall(packages, callback);
    } else {
      callback(err, result);
    }
  });
}

function fetch(query, callback) {
  var force = _options.force;
  log.info('fetch', query);
  var data = iduri.resolve(query);
  yuan(_options).info(data, function(err, res, body) {
    if (err) {
      fetchCache(data, function(err, result) {
        if (err) {
          fetchGit(data, callback);
        } else {
          callback(null, result);
        }
      });
      return;
    }
    if (body.filename) {
      var filepath = path.join(
        body.family, body.name, body.version, body.filename
      );
      var dest = path.join(_options.cache, filepath);
      if (!force && grunt.file.exists(dest) && md5file(dest) === body.md5) {
        extract(dest, callback);
      } else {
        var urlpath = 'repository/' + filepath.replace(/\\/g, '/');
        fetchTarball(urlpath, dest, callback);
      }
    } else {
      fetchGit(body, callback);
    }
  });
}

function fetchTarball(urlpath, dest, callback) {
  grunt.file.mkdir(path.dirname(dest));
  log.info('download', urlpath);

  var data = {urlpath: urlpath, method: 'GET', encoding: null};
  yuan(_options).request(data, function(err, res, body) {
    fs.writeFile(dest, body, function(err) {
      if (err) {
        callback(err);
      } else {
        log.info('save', dest.replace(process.env.HOME, '~'));
        extract(dest, callback);
      }
    });
  });
}

function fetchCache(data, callback) {
  var fpath = path.join(_options.cache, data.family, data.name);
  if (!fs.existsSync(fpath))  {
    callback('not in cache');
    return;
  }
  log.info('found', fpath);
  if (!data.version) {
    var versions = fs.readdirSync(fpath).filter(semver.valid);
    versions = versions.sort(semver.compare).reverse();
    data.version = versions[0];
  }
  var filename = data.name + '-' + data.version + '.tar.gz';
  fpath = path.join(fpath, data.version, filename);
  if (fs.existsSync(fpath)) {
    extract(fpath, callback);
  } else {
    callback('not in cache');
  }
}

function fetchGit(pkg, callback) {
  var dest = path.join(_options.srcCache, pkg.family, pkg.name);
  var revision = pkg.revision || pkg.version || 'HEAD';
  log.debug('revision', revision);
  if (fs.existsSync(dest)) {
    git.pull({cwd: dest}, function(err) {
      err && log.warn('git', err);
      git.checkout(revision, {cwd: dest}, function(err) {
        err && log.warn('git', err);
        callback(null, dest);
      });
    });
    return;
  }
  var repo = pkg.repository;
  if (repo && _.isObject(repo)) {
    repo = repo.url;
  }
  if (!repo) {
    repo = format('git://github.com/%s/%s.git', pkg.family, pkg.name);
  }
  log.info('clone', repo);
  git.clone(repo, dest, function(err) {
    if (err) {
      callback(err);
      return;
    }
    git.checkout(revision, {cwd: dest}, function(err) {
      err && log.warn('git', err);
      callback(null, dest);
    });
  });
}

function build(src, callback) {
  if (fs.existsSync(path.join(src, 'dist'))) {
    log.info('found', 'dist in the package');
    callback(null, src);
    return;
  }
  childexec('spm build', {cwd: src}, function(err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, src);
  });
}

function copy(src, callback) {
  var pkg = grunt.file.readJSON(path.join(src, 'package.json'));
  var dest;
  var format = spmrc.get('install.format');
  var regex = /^\{\{\s*family\s*\}\}\/\{\{\s*name\s*\}\}\/\{\{\s*version\s*\}\}\/\{\{\s*filename\s*\}\}$/;
  if (format && /\{\{\s*filename\s*\}\}$/.test(format) && !regex.test(format)) {
    dest = path.join(_options.dest, iduri.idFromPackage(pkg, '', format));
  } else {
    dest = path.join(_options.dest, pkg.family, pkg.name, pkg.version);
    format = null;
  }
  var debugfile = spmrc.get('install.debugfile') || 'true';
  if (debugfile === 'false') {
    log.info('ignore', 'will not install debug file');
  }
  log.info('installed', dest);

  // fix windows path
  var dist = path.join(src, 'dist').replace(/\\/g, '/');
  grunt.file.recurse(dist, function(fpath) {
    if (debugfile === 'false' && /-debug\.\w{1,6}$/.test(fpath)) {
      return;
    }
    var fname = fpath.replace(dist, '').replace(/^\//, '');
    if (format && /\.js$/.test(fpath)) {
      var code = transform({
        code: grunt.file.read(fpath),
        filename: fname,
        pkg: pkg,
        format: format
      });
      grunt.file.write(path.join(dest, fname), code);
    } else {
      grunt.file.copy(fpath, path.join(dest, fname));
    }
  });
  callback(null, src);
}

function extract(src, callback) {
  var tmp = process.env.TMPDIR || process.env.TEMP || process.env.TMP;
  tmp = path.join(tmp, path.basename(src)).replace(/\.tar\.gz$/, '');
  if (grunt.file.exists(tmp)) {
    grunt.file.delete(tmp, {force: true});
  }
  log.info('extract', src.replace(process.env.HOME, '~'));
  log.debug('extract', tmp);
  tar.extract(src, tmp, callback);
}

function transform(obj) {
  log.debug('transform', obj.filename);
  var repl = function(id) {
    var m = mo.parseIdentify(id);
    if (!m) return id;
    return iduri.idFromPackage(m, obj.filename, obj.format);
  };
  var uglifyOptions = {comments: true};
  if (~obj.filename.indexOf('debug')) {
    uglifyOptions.beautify = true;
  }
  return ast.modify(obj.code, repl).print_to_string(uglifyOptions);
}

function parseDependencies(pkg) {
  if (typeof pkg === 'string') {
    pkg = grunt.file.readJSON(pkg);
  }
  var alias = (pkg.spm && pkg.spm.alias) || {};
  var deps = Object.keys(alias).map(function(key) {
    return alias[key];
  });
  return mo.plainDependencies(mo.parseDependencies(deps));
}

// print tree
var blank = new Array(18).join(' ');
function printTree(key, level) {
  level = level || 0;
  var icon = new Array(level + 1).join('  ') + (level === 0 ? '' : '|- ');
  console.log(blank + icon + key);
  if (_cache[key]) {
    _cache[key].forEach(function(child) {
      printTree(child, level + 1);
    });
  }
}
