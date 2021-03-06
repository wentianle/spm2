/* module */

var util = require('util');
var cmd = require('cmd-util');
var log = require('../utils/log');
var grunt = require('./grunt');
var _ = grunt.util._;


exports.srcDependencies = function(src, pkg) {
  src = src || 'src';
  pkg = pkg || 'package.json';
  if (typeof pkg === 'string') {
    pkg = grunt.file.readJSON(pkg);
  }
  var code, parsed, deps = [];
  grunt.file.recurse(src, function(fpath) {
    if (/\.js$/.test(fpath)) {
      code = grunt.file.read(fpath);
      parsed = cmd.ast.parse(code);
      parsed.forEach(function(meta) {
        meta.dependencies.forEach(function(dep) {
          if (!_.contains(deps, dep)) {
            deps.push(cmd.iduri.parseAlias(pkg, dep));
          }
        });
      });
    }
  });
  return parseDependencies(deps);
};

exports.distDependencies = function(dist) {
  dist = dist || 'dist';
  var code, parsed, deps = [];
  grunt.file.recurse(dist, function(fpath) {
    if (/\.js$/.test(fpath)) {
      code = grunt.file.read(fpath);
      parsed = cmd.ast.parse(code);
      parsed.forEach(function(meta) {
        deps = _.union(deps, meta.dependencies);
      });
    }
  });
  return parseDependencies(deps);
};

function parseDependencies(data) {
  var deps = {};
  data.forEach(function(value) {
    var m = parseIdentify(value);
    if (!m) return;
    var key = m.family + '/' + m.name;
    if (deps.hasOwnProperty(key)) {
      if (!_.contains(deps[key], m.version)) {
        deps[key].push(m.version);
        log.warn('version', util.format('%s: %s', key, deps[key]));
      }
    } else {
      deps[key] = [m.version];
    }
  });
  return deps;
}
exports.parseDependencies = parseDependencies;


exports.plainDependencies = function(deps) {
  var packages = [];
  Object.keys(deps).forEach(function(key) {
    deps[key].forEach(function(v) {
      packages.push(key + '@' + v);
    });
  });
  return packages;
};

function parseIdentify(id) {
  var regex = /^((?:[a-z][a-z0-9\-]*\/)?[a-z][a-z0-9\-]*)\/(\d+\.\d+\.\d+)\/([a-z0-9\-\/]+)$/;
  var match = id.match(regex);
  if (!match) return null;
  var keys = match[1].split('/');
  var family, name, version, filename;
  if (keys.length === 2) {
    family = keys[0];
    name = keys[1];
  } else {
    family = name = keys[0];
  }
  version = match[2];
  filename = match[3];
  return {family: family, name: name, version: version, filename: filename};
}
exports.parseIdentify = parseIdentify;
