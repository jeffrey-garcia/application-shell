/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var gulp = require('gulp');
var del = require('del');
var runSequence = require('run-sequence');
var eslint = require('gulp-eslint');
var path = require('path');
var glob = require('glob');
var browserify = require('browserify');
var babelify = require('babelify');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var streamify = require('gulp-streamify');
var replace = require('gulp-replace');
var license = require('gulp-license');

gulp.task('scripts:watch', function() {
  gulp.watch(GLOBAL.config.src + '/**/*.es6.js', ['scripts:es6']);
});

// Takes a set of objects defining inputs of javascript files
// to run through browserify and babelify
function compileES6Bundles(browserifyBundles, minify) {
  browserifyBundles.forEach(function(bundle) {
    var browserifyBundle = browserify({
        entries: [bundle.srcPath],
      })
      .transform(babelify);

    return browserifyBundle.bundle()
      .on('log', gutil.log.bind(gutil, 'Browserify Log'))
      .on('error', gutil.log.bind(gutil, 'Browserify Error'))
      .pipe(source(bundle.outputFilename))
      .pipe(replace(/@VERSION@/g, GLOBAL.config.version))

      // If this is a production build - minify JS
      .pipe(gulpif(GLOBAL.config.env == 'prod', streamify(uglify())))
      .pipe(license(GLOBAL.config.license, GLOBAL.config.licenseOptions))
      .pipe(gulp.dest(bundle.dest));
  });
}

// This takes a source path and finds all files ending
// with .es6.js and creates the bundles to run through browserify
// and babelify
function generateES6Bundles(srcPath) {
  if (!srcPath) {
    throw new Error('Invalid source path given to generateES6Bundles');
  }

  var es6Filepaths = glob.sync(srcPath + '/**/*.es6.js');

  var browserifyBundles = [];
  es6Filepaths.forEach(function(filepath) {
    var filename = path.basename(filepath);
    var directoryOfFile = path.dirname(filepath);
    var relativeDirectory = path.relative(
      srcPath,
      directoryOfFile);

    // Replace .es6.js with .js for the final output
    var outputFilename =
      filename.substring(0, filename.length - '.es6.js'.length) + '.js';

    browserifyBundles.push({
      srcPath: './' + filepath,
      outputFilename: outputFilename,
      dest: path.join(GLOBAL.config.dest, relativeDirectory),
    });
  });

  compileES6Bundles(browserifyBundles);
}

gulp.task('scripts:eslint', function() {
  return gulp.src([GLOBAL.config.src + '/**/*.es6.js'])

    // eslint() attaches the lint output to the eslint property
    // of the file object so it can be used by other modules.
    .pipe(eslint())

    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe(eslint.format())

    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failOnError last.
    .pipe(eslint.failOnError());
});

gulp.task('scripts:es6', ['scripts:eslint'], function(cb) {
  generateES6Bundles(GLOBAL.config.src);

  cb();
});

// Delete any files currently in the scripts destination path
gulp.task('scripts:clean', function(cb) {
  del([GLOBAL.config.dest + '/**/*.js'], {dot: true})
    .then(function() {
      cb();
    });
});

gulp.task('scripts', function(cb) {
  runSequence(
    'scripts:clean',
    ['scripts:es6'],
    cb
  );
});