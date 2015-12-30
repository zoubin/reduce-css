var test = require('tap').test
var reduce = require('..')
var path = require('path')
var mkdirp = require('mkdirp')
var fs = require('fs')
var os = require('os')

var tmpdir = path.join(
  (os.tmpdir || os.tmpDir)(), 'reduce-' + Math.random()
)
mkdirp.sync(tmpdir)
// /private/var  <--- soft link --- /var
tmpdir = fs.realpathSync(tmpdir)

var fixtures = path.resolve.bind(path, tmpdir)
var src = fixtures.bind(null, 'src')
var dest = fixtures.bind(null, 'build')
var pool = {}

mkdirp.sync(src())
mkdirp.sync(dest())

var write = function (file, n) {
  n = n || ''
  var base = path.basename(file, '.css')
  pool[base] = n
  var contents = base + n + '{}'
  if (base !== 'c') {
    contents = '@deps "./c";' + contents
  }
  fs.writeFileSync(file, contents)
}

function getExpectedContents(base) {
  return base + pool[base] + '{}'
}

function readDest(file) {
  return fs.readFileSync(dest(file), 'utf8')
}

write(src('c.css'))

var entries = [src('a.css'), src('b.css')]
entries.forEach(write)

test('watch', function(t) {
  var changeNum = 3
  t.plan((changeNum + 1) * 3)
  var bundleOptions = {
    common: 'c.css',
    groups: '**/+(a|b).css',
  }
  reduce.watch()
    .on('error', console.log.bind(console))
    .on('done', next)
    .src(['a.css', 'b.css'], {
      basedir: src(),
      bundleOptions: bundleOptions,
    })
    .pipe(reduce.dest, dest())

  function next() {
    t.equal(
      readDest('a.css'),
      getExpectedContents('a'),
      [changeNum, 'a', pool.a].join(':')
    )
    t.equal(
      readDest('b.css'),
      getExpectedContents('b'),
      [changeNum, 'b', pool.b].join(':')
    )
    t.equal(
      readDest('c.css'),
      getExpectedContents('c'),
      [changeNum, 'c', pool.c].join(':')
    )
    setTimeout(change.bind(this), 50)
  }

  function change() {
    if (!changeNum--) {
      return this.close()
    }
    var file = [src('c.css')].concat(entries)[changeNum % 3]
    var k = path.basename(file, '.css')
    var n = Math.floor(Math.random() * 10) + 1 + pool[k]
    write(file, n)
  }

})

