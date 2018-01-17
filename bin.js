#!/usr/bin/env node

var protobuf = require('./')
var encodings = require('protocol-buffers-encodings')
var fs = require('fs')
var os = require('os')

var filename = null
var output = null
var watch = false

// handrolled parser to not introduce minimist as this is used a bunch of prod places
// TODO: if this becomes more complicated / has bugs, move to minimist
for (var i = 2; i < process.argv.length; i++) {
  var v = process.argv[i]
  var n = v.split('=')[0]
  if (v[0] !== '-') {
    filename = v
  } else if (n === '--output' || n === '-o' || n === '-wo') {
    if (n === '-wo') watch = true
    output = v === n ? process.argv[++i] : v.split('=').slice(1).join('=')
  } else if (n === '--watch' || n === '-w') {
    watch = true
  }
}

if (!filename) {
  console.error('Usage: protocol-buffers [schema-file.proto] [options]')
  console.error()
  console.error(' --output, -o  [output-file.js]')
  console.error(' --watch,  -w  (recompile on schema change)')
  console.error()
  process.exit(1)
}

if (watch && !output) {
  console.error('--watch requires --output')
  process.exit(1)
}

if (!output) {
  process.stdout.write(compile())
} else {
  write()
  if (watch) fs.watch(filename, write)
}

function write () {
  fs.writeFileSync(output, compile())
}

function compile () {
  var messages = protobuf(fs.readFileSync(filename))
  var out = ''

  out += '// This file is auto generated by the protocol-buffers cli tool' + os.EOL
  out += os.EOL
  out += '/* eslint-disable quotes */' + os.EOL
  out += '/* eslint-disable indent */' + os.EOL
  out += '/* eslint-disable no-redeclare */' + os.EOL
  out += os.EOL
  out += '// Remember to `npm install --save protocol-buffers-encodings`' + os.EOL
  out += 'var encodings = require(\'protocol-buffers-encodings\')' + os.EOL
  out += 'var varint = encodings.varint' + os.EOL
  out += 'var skip = encodings.skip' + os.EOL
  out += os.EOL

  Object.keys(messages).forEach(function (name) {
    out += 'var ' + name + ' = exports.' + name + ' = {' + os.EOL
    out += '  buffer: true,' + os.EOL
    out += '  encodingLength: null,' + os.EOL
    out += '  encode: null,' + os.EOL
    out += '  decode: null' + os.EOL
    out += '}' + os.EOL
    out += os.EOL
  })

  Object.keys(messages).forEach(function (name) {
    out += 'define' + name + '()' + os.EOL
  })

  if (Object.keys(messages).length) out += os.EOL

  Object.keys(messages).forEach(function (name) {
    out += 'function define' + name + ' () {' + os.EOL
    out += '  var enc = [' + os.EOL

    messages[name].dependencies.forEach(function (e, i, enc) {
      var name = encodings.name(e)
      if (name) name = 'encodings.' + name
      else name = e.name
      out += '    ' + name + (i < enc.length - 1 ? ',' : '') + os.EOL
    })

    out += '  ]' + os.EOL + os.EOL
    out += '  ' + name + '.encodingLength = encodingLength' + os.EOL
    out += '  ' + name + '.encode = encode' + os.EOL
    out += '  ' + name + '.decode = decode' + os.EOL + os.EOL
    out += '  ' + funToString(messages[name].encodingLength, '  ') + os.EOL + os.EOL
    out += '  ' + funToString(messages[name].encode, '  ') + os.EOL + os.EOL
    out += '  ' + funToString(messages[name].decode, '  ') + os.EOL
    out += '}' + os.EOL + os.EOL
  })

  out += funToString(require('./compile').defined, '') + os.EOL

  return out

  function funToString (fn, spaces) {
    return fn.toString().split('\n').map(indent).join('\n')

    function indent (n, i) {
      if (!i) return n.replace(/(function \w+)\(/, '$1 (')
      return spaces + n
    }
  }
}