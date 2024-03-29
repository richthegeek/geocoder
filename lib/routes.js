// Generated by CoffeeScript 1.7.1
(function() {
  var app, cache_stats, disable_paid, ipmod, rand_write, request,
    __slice = [].slice;

  app = require('express').Router();

  request = require('request');

  ipmod = require('ip');

  app.get('/', function(req, res, next) {
    return res.send({
      code: "HELLO_WORLD",
      message: "Where? There!",
      handle: "Trakapo Geocoding service",
      spout: "https://twitter.com/trakapo"
    });
  });

  disable_paid = false;

  cache_stats = {
    hit: 0,
    miss: 0
  };

  rand_write = function() {
    var args, chance;
    chance = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (Math.floor(Math.random() * chance) === 0) {
      return console.log.apply(console, args);
    }
  };

  app.get('/:ip', function(req, res, next) {
    var e, fns_free, fns_paid, ip, map, run, send;
    ip = req.params.ip;
    try {
      ipmod.toBuffer(ip);
      if (!ipmod.isPublic(ip)) {
        throw new Error('IP is not public');
      }
    } catch (_error) {
      e = _error;
      return res.send(400, e.message);
    }
    map = function(input, output) {
      return JSON.parse(JSON.stringify(output), function(key, val) {
        if ('string' === typeof val) {
          try {
            return eval('input.' + val);
          } catch (_error) {}
          return '';
        }
        return val;
      });
    };
    fns_paid = {
      check: function(callback) {
        var _ref, _ref1;
        if (disable_paid === true) {
          console.warn('Maxmind queries are disabled due to low quota! Restart the server once it is topped up.');
          return callback(null, false, 'Low quota');
        }
        return callback(null, (((_ref = req.query) != null ? (_ref1 = _ref.key) != null ? _ref1.match : void 0 : void 0) != null) && req.query.key.match(/^[0-9a-f]{16}$/));
      },
      get_cache: function(callback) {
        return req.db.paid.findOne({
          _id: ip
        }, callback);
      },
      set_cache: function(data, callback) {
        return req.db.paid.update({
          _id: ip
        }, data, {
          upsert: true
        }, callback);
      },
      api: function(callback) {
        var opts;
        opts = {
          method: 'GET',
          uri: 'https://geoip.maxmind.com/geoip/v2.0/omni/' + ip,
          auth: {
            user: req.settings.maxmind_user,
            pass: req.settings.maxmind_pass
          }
        };
        return request(opts, function(err, resp, body) {
          var data;
          if (err) {
            console.log('maxmind api error', err);
            return callback(err);
          }
          body = JSON.parse(body);
          data = map(body, {
            ip: 'traits.ip_address',
            country_code: 'country.iso_code',
            country_name: 'country.names.en',
            region_code: 'subdivisions[0].iso_code',
            region_name: 'subdivisions[0].names.en',
            city: 'city.names.en',
            zipcode: 'postal.code',
            latitude: 'location.longitude',
            longitude: 'location.latitude',
            metro_code: 'location.metro_code',
            area_code: 'location.area_code',
            accuracy: 'location.accuracy_radius',
            continent: 'continent.names.en',
            traits: 'traits'
          });
          try {
            rand_write(10, 'Maxmind queries remaining:', body.maxmind.queries_remaining);
            if (body.maxmind.queries_remaining < 100) {
              disable_paid = true;
            }
          } catch (_error) {
            e = _error;
            console.log('no queries?', body);
          }
          return callback(err, data);
        });
      }
    };
    fns_free = {
      check: function(callback) {
        return callback(null, true);
      },
      get_cache: function(callback) {
        return req.db.free.findOne({
          _id: ip
        }, callback);
      },
      set_cache: function(data, callback) {
        return req.db.free.update({
          _id: ip
        }, data, {
          upsert: true
        }, callback);
      },
      api: function(callback) {
        var opts;
        opts = {
          method: 'GET',
          uri: 'https://freegeoip.net/json/' + ip
        };
        return request(opts, function(err, resp, body) {
          try {
            body = JSON.parse(body);
          } catch (_error) {}
          body.source = 'free';
          return callback(err, body);
        });
      }
    };
    run = function(fns, callback) {
      var eh;
      eh = function(next) {
        return function() {
          var args, err;
          err = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
          if (err) {
            return callback(err);
          }
          return next.apply(null, [null].concat(__slice.call(args)));
        };
      };
      return fns.check(eh(function(err, pass, reason) {
        if (!pass) {
          return callback(reason || 'Not authorized');
        }
        return fns.get_cache(eh(function(err, row) {
          if (row && !req.query.nocache) {
            return callback(null, row, true);
          }
          return fns.api(eh(function(err, data) {
            return fns.set_cache(data, eh(function() {
              return callback(null, data, false);
            }));
          }));
        }));
      }));
    };
    send = function(err, row, cached) {
      var perc;
      if (err) {
        return res.send(err);
      } else {
        if (cached) {
          cache_stats.hit++;
        } else {
          cache_stats.miss++;
        }
        perc = Math.round(100 * cache_stats.hit / (cache_stats.hit + cache_stats.miss)) + '%';
        rand_write(20, 'Cache stats:', cache_stats.hit, cache_stats.miss, perc);
        delete row._id;
        row.cached = cached;
        return res.send(row);
      }
    };
    return run(fns_paid, function(err, row, cached) {
      if (err) {
        return run(fns_free, send);
      } else {
        return send(err, row, cached);
      }
    });
  });

  module.exports = app;

}).call(this);

//# sourceMappingURL=routes.map
