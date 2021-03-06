'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var Evented = require('../util/evented');
var TileCoord = require('./tile_coord');
var Source = require('./source');

module.exports = RasterTileSource;

function RasterTileSource(options) {
    util.extend(this, util.pick(options, 'url', 'tileSize'));

    Source._loadTileJSON.call(this, options);
}

RasterTileSource.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 22,
    tileSize: 512,
    _loaded: false,

    onAdd(map) {
        this.map = map;
    },

    loaded() {
        return this._pyramid && this._pyramid.loaded();
    },

    update(transform) {
        if (this._pyramid) {
            this._pyramid.update(this.used, transform, this.map.style.rasterFadeDuration);
        }
    },

    render: Source._renderTiles,

    _loadTile(tile) {
        ajax.getImage(TileCoord.url(tile.id, this.tiles), (err, img) => {
            if (tile.aborted)
                return;

            if (err)
                return this.fire('tile.error', {tile: tile});

            var gl = this.map.painter.gl;
            tile.texture = this.map.painter.getTexture(img.width);
            if (tile.texture) {
                gl.bindTexture(gl.TEXTURE_2D, tile.texture);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
            } else {
                tile.texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tile.texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                tile.texture.size = img.width;
            }
            gl.generateMipmap(gl.TEXTURE_2D);

            tile.timeAdded = new Date().getTime();
            this.map.animationLoop.set(this.style.rasterFadeDuration);

            tile.source = this;
            tile.buckets = {};
            var buckets = this.style.buckets;
            for (var b in buckets) {
                var bucket = buckets[b];
                var sourceid = bucket && bucket.source;
                if (this.id === sourceid) {
                    tile.buckets[b] = {
                        layoutProperties: bucket.layout,
                        type: 'raster'
                    };
                }
            }

            tile.loaded = true;
            this.fire('tile.load', {tile: tile});
        });
    },

    _abortTile(tile) {
        tile.aborted = true;
    },

    _addTile(tile) {
        this.fire('tile.add', {tile: tile});
    },

    _removeTile(tile) {
        this.fire('tile.remove', {tile: tile});
    },

    _unloadTile(tile) {
        if (tile.texture) this.map.painter.saveTexture(tile.texture);
    },

    featuresAt(point, params, callback) {
        callback(null, []);
    }
});
