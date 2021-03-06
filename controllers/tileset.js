var fs = require('fs')
var path = require('path')
var _ = require('lodash')
var async = require('async')
var mongoose = require('mongoose')
var shortid = require('shortid')
var filesniffer = require('mapbox-file-sniff')
var tilelive = require('tilelive')
var tiletype = require('tiletype')
var shpFairy = require('shapefile-fairy')
var mkdirp = require('mkdirp')
var config = require('../config')
var TileSchema = require('../models/tile')
var Tileset = require('../models/tileset')


module.exports.list = function(req, res) {
  Tileset.find({
    owner: req.params.username,
    is_deleted: false
  }, 'tileset_id owner scope tags filename filesize name description \
  createdAt updatedAt', function(err, tilesets) {
    if (err) {
      return res.status(500).json({ error: err })
    }

    res.json(tilesets)
  }).sort({ createdAt: -1 })
}


module.exports.retrieve = function(req, res) {
  Tileset.findOne({
    tileset_id: req.params.tileset_id,
    owner: req.params.username
  }, function(err, tileset) {
    if (err) {
      return res.status(500).json({ error: err })
    }

    if (!tileset) {
      return res.sendStatus(404)
    }

    res.json(tileset)
  })
}


module.exports.upload = function(req, res) {
  var username = req.params.username
  var filePath = req.files[0].path
  var originalname = req.files[0].originalname
  var size = req.files[0].size
  var apiUrl = req.protocol + '://' + req.headers.host + req.baseUrl

  var tileset_id = shortid.generate()

  async.autoInject({
    protocol: function(callback) {
      filesniffer.quaff(filePath, true, callback)
    },
    filetype: function(callback) {
      filesniffer.quaff(filePath, false, callback)
    },
    tilesetDir: function(protocol, callback) {
      var tilesetDir = path.join('tilesets', username)
      mkdirp(tilesetDir, function(err) {
        callback(err, tilesetDir)
      })
    },
    newPath: function(tilesetDir, callback) {
      var newPath = path.join(tilesetDir, tileset_id)
      fs.rename(filePath, newPath, function(err) {
        callback(err, path.resolve(newPath))
      })
    },
    source: function(protocol, filetype, newPath, callback) {
      if (filetype !== 'zip') {
        return callback(null, protocol + '//' + newPath)
      }

      shpFairy(newPath, function(err, shpPath) {
        return callback(err, protocol + '//' + shpPath)
      })
    },
    info: function(source, callback) {
      tilelive.info(source, function(err, info) {
        return callback(err, info)
      })
    },
    copy: function(source, callback) {
      var dst = 'foxgis+' + config.DB + '?tileset_id=' + tileset_id + '&owner=' + username
      var opts = {
        type: 'scanline',
        retry: 2,
        timeout: 3600000,
        close: true
      }

      tilelive.copy(source, dst, opts, callback)
    },
    writeDB: function(info, copy, callback) {
      var newTileset = {
        tileset_id: tileset_id,
        owner: username,
        scope: 'private',
        is_deleted: false,
        filename: originalname,
        filesize: size,
        name: path.basename(originalname, path.extname(originalname)),
        tiles: [apiUrl + '/tilesets/' + username + '/' + tileset_id + '/{z}/{x}/{y}.' + info.format]
      }

      var keys = ['scope', 'tags', 'description', 'vector_layers']
      keys.forEach(function(key) {
        if (req.body[key]) {
          newTileset[key] = req.body[key]
        }
      })

      Tileset.findOneAndUpdate({
        tileset_id: tileset_id,
        owner: username
      }, newTileset, { upsert: true, new: true, setDefaultsOnInsert: true }, callback)
    }
  }, function(err, results) {
    fs.unlink(filePath, function() {})

    if (err) {
      return res.status(500).json({ error: err })
    }

    res.json(results.writeDB)
  })
}


module.exports.update = function(req, res) {
  var filter = ['scope', 'tags', 'name', 'description', 'vector_layers']

  Tileset.findOneAndUpdate({
    tileset_id: req.params.tileset_id,
    owner: req.params.username
  }, _.pick(req.body, filter), { new: true }, function(err, tileset) {
    if (err) {
      return res.status(500).json({ error: err })
    }

    if (!tileset) {
      return res.sendStatus(404)
    }

    res.json(tileset)
  })
}


module.exports.delete = function(req, res) {
  Tileset.findOneAndUpdate({
    tileset_id: req.params.tileset_id,
    owner: req.params.username
  }, { is_deleted: true }, { new: true }, function(err, tileset) {
    if (err) {
      return res.status(500).json({ error: err })
    }

    if (!tileset) {
      return res.sendStatus(404)
    }

    res.sendStatus(204)
  })
}


module.exports.downloadTile = function(req, res) {
  var tileset_id = req.params.tileset_id
  var z = +req.params.z || 0
  var x = +req.params.x || 0
  var y = +req.params.y || 0

  var tiles = 'tiles_' + tileset_id
  var Tile = mongoose.model(tiles, TileSchema, tiles)

  Tile.findOne({
    zoom_level: z,
    tile_column: x,
    tile_row: y
  }, function(err, tile) {
    if (err) {
      return res.status(500).json({ error: err })
    }

    if (!tile || !tile.tile_data) {
      return res.sendStatus(404)
    }

    res.set('Expires', new Date(Date.now() + 604800000).toUTCString())
    res.set(tiletype.headers(tile.tile_data))
    res.send(tile.tile_data)
  })
}


module.exports.downloadRaw = function(req, res) {
  var filePath = path.join('tilesets', req.params.username, req.params.tileset_id)

  Tileset.findOne({
    tileset_id: req.params.tileset_id,
    owner: req.params.username
  }, function(err, tileset) {
    if (err) {
      return res.status(500).json({ error: err })
    }

    if (!tileset) {
      return res.sendStatus(404)
    }

    var filename = tileset.name + path.extname(tileset.filename)
    res.download(filePath, filename, function(err) {
      if (err) {
        return res.status(err.status).end()
      }
    })
  })
}
