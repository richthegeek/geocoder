app = require('express').Router()
request = require 'request'

app.get '/', (req, res, next) ->
	res.send {
		code: "HELLO_WORLD",
		message: "Where? There!",
		handle: "Trakapo Geocoding service",
		spout: "https://twitter.com/trakapo"
	}

# this little flag is for when the quota runs out
disable_paid = false

app.get '/:ip', (req, res, next) ->
	ip = req.params.ip
	# stages...
	# if we have a key, try get from the paid site
	# if we dont have a key, or we are out of requests, get from the free site
	# either way, save that bitch

	# in order to simplify things a bit we do the same flow for both,
	# with some mapping to ensure the return format is broadly the same

	# evaluate output leaves as properties of the input
	map = (input, output) ->
		return JSON.parse JSON.stringify(output), (key, val) ->
			if 'string' is typeof val
				try return eval('input.' + val)
				return ''
			return val

	fns_paid =
		# for now, keys are just "is it 16 hex chars?"
		# later this might be based on actual faction/trakapo subscriptions
		check: (callback) ->
			if disable_paid is true
				console.warn 'Maxmind queries are disabled due to low quota! Restart the server once it is topped up.'
				return callback null, false, 'Low quota'
			callback null, req.query?.key?.match? and req.query.key.match /^[0-9a-f]{16}$/
		get_cache: (callback) -> req.db.paid.findOne {_id: ip}, callback
		set_cache: (data, callback) -> req.db.paid.update {_id: ip}, data, {upsert: true}, callback
		api: (callback) ->
			opts =
				method: 'GET',
				uri: 'https://geoip.maxmind.com/geoip/v2.0/omni/' + ip
				auth: 
					user: req.settings.maxmind_user
					pass: req.settings.maxmind_pass

			request opts, (err, resp, body) ->
				if err
					console.log 'maxmind api error', err
					return callback err

				body = JSON.parse body
				data = map body, {
					# this is just a map to the "free" format
					ip: 'traits.ip_address'
					country_code: 'country.iso_code'
					country_name: 'country.names.en'
					region_code: 'subdivisions[0].iso_code'
					region_name: 'subdivisions[0].names.en'
					city: 'city.names.en'
					zipcode: 'postal.code'
					latitude: 'location.longitude'
					longitude: 'location.latitude'
					metro_code: 'location.metro_code'
					area_code: 'location.area_code'

					# this is additional stuff
					accuracy: 'location.accuracy_radius'
					continent: 'continent.names.en'
					traits: 'traits'
				}
				try console.info 'Maxmind queries remaining:', body.maxmind.queries_remaining
				if body.maxmind.queries_remaining < 100
					disable_paid = true
				callback err, data

	fns_free =
		check: (callback) -> callback null, true
		get_cache: (callback) -> req.db.free.findOne {_id: ip}, callback
		set_cache: (data, callback) -> req.db.free.update {_id: ip}, data, {upsert: true}, callback
		api: (callback) ->
			opts =
				method: 'GET',
				uri: 'https://freegeoip.net/json/' + ip
			request opts, (err, resp, body) ->
				try body = JSON.parse body
				body.source = 'free'
				callback err, body


	# do each fn in order, bubble errors out to callback
	run = (fns, callback) ->
		# simple error-handling curry
		eh = (next) -> (err, args...) ->
			return callback err if err
			next null, args...

		fns.check eh (err, pass, reason) ->
			if not pass
				return callback reason or 'Not authorized'
			fns.get_cache eh (err, row) ->
				if row and not req.query.nocache
					return callback null, row, true
				fns.api eh (err, data) ->
					fns.set_cache data, eh ->
						callback null, data, false

	send = (err, row, cached) ->
		if err
			return res.send err
		else
			delete row._id
			row.cached = cached
			res.send row

	run fns_paid, (err, row, cached) ->
		if err
			run fns_free, send
		else
			send err, row, cached

module.exports = app
