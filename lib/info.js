/* show information of the package */

var color = require('colorful').color;
var iduri = require('./sdk/iduri');
var yuan = require('./sdk/yuan');
var log = require('./utils/log');


module.exports = function(options) {
  var data = iduri.resolve(options.query);
  yuan(options).info(data, function(err, res, body) {
    if (err) {
      console.log('  ' + color.cyan(data.family + '/' + data.name));
      console.log('  ' + color.red(err));
    } else if (res.statusCode !== 200) {
      console.log('  ' + color.cyan(data.family + '/' + data.name));
      console.log('  ' + color.red(body.message));
    } else {
      print(body);
    }
    console.log();
  });
};


function print(data) {
  var title = data.family + '/' + data.name;
  console.log('  ' + color.cyan(title));
  if (data.tag) {
    var text = color.magenta(data.version) + ' ~ ' + color.blue(data.tag);
    if (data.private) {
      text = text + ' ~ ' + color.yellow('private');
    }
    console.log('  ' + text);
  }
  if (data.versions) {
    var versions = Object.keys(data.versions);
    var lines = Math.ceil(versions.length / 5);
    console.log('  vers:', color.magenta(versions.slice(0, 5).join('  ')));
    for (var i = 1; i < lines; i++) {
      console.log('        ' + color.magenta(versions.slice(i * 5, i * 5 + 5).join('  ')));
    }
  }
  if (data.description) {
    console.log('  desc:', color.grey(data.description));
  }
  if (data.homepage) {
    if (typeof data.homepage === 'string') {
      console.log('  link:', color.underline(data.homepage));
    } else if (data.homepage.url) {
      console.log('  link:', color.underline(data.homepage.url));
    }
  }
  if (data.repository) {
    if (typeof data.repository === 'string') {
      console.log('  repo:', color.underline(data.repository));
    } else if (data.repository.url) {
      console.log('  repo:', color.underline(data.repository.url));
    }
  }
}
