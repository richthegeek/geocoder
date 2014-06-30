# set shit up
express = require 'express'
app = express()


# get envvars
settings =
	port: process.env.GEO_PORT or 80
	database: process.env.GEO_DB or 'geocode'
	maxmind_user: process.env.GEO_MAXMIND_USER
	maxmind_pass: process.env.GEO_MAXMIND_PASS

if not settings.maxmind_user?
	console.error 'GEO_MAXMIND_USER envvar not set!'
	process.exit 1

if not settings.maxmind_pass?
	console.error 'GEO_MAXMIND_PASS envvar not set!'
	process.exit 2

app.use (req, res, next) ->
	req.settings = settings
	next()

# gzip compression
app.use do require 'compression'

# logging
app.use require('morgan')('short')

# database
app.use require('./db')

# actual api
app.use require('./routes')

console.log 'Listening on', settings.port
app.listen settings.port