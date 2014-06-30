geocoder
========

Uses either a MaxMind omni key or freegeoip.net to get geo information for an IP


requirements
============
* node - tested on v0.10.29
 * express + morgan, cors, compression
 * async
 * bluebird
 * mongodb
* mongodb - tested on v2.6.3
* a [MaxMind](https://www.maxmind.com) account with Omni api quota available

running
=====

```
export GEO_PORT=80
export GEO_DB=geocode
export GEO_MAXMIND_USER=my_maxmind_user_id
export GEO_MAXMIND_PASS=my_maxmind_license_key
node lib
```
