var request = require("request")
var http = require('http')
var url = require('url')
var querystring = require('querystring')
var fs = require('fs')

var url
var measures_taken
var data = {}
var user_data = {}

var users = [
	'id1'
]
var grab_rate = 60000
var backup_rate = 2
var backup_file = 'backup-vk.dat'
var colors = {
	no_data: '#eee',
	offline: '#ccc',
	online: '#00308F',
	mobile: '#5c8be7'
}

function init() {
	console.log('Init grabber')
	restore_data()
	measures_taken = 0
}

function add_sample(id, time, status) {
	var sample = { 
		time: time,
		status: status
	}

	if(data[id] === undefined) {
		data[id] = []
	}

	data[id].push(sample)

	//console.log(data)
}

function restore_data() {
	fs.readFile(backup_file, 'utf8', function(err, contents) {
		
		if(contents !== undefined) {
			console.log('Restored data from backup!');
			data = JSON.parse(contents)
		}
		
	});
}

function grab() {
	var current_time = new Date()

	fs.readFile('users.json', 'utf8', function(err, contents) {
		
		if(contents !== undefined) {
			users = JSON.parse(contents)
		}
		
	});

	url = 'https://api.vk.com/method/users.get?user_ids='
	for(var i = 0; i < users.length; i++) {
		url += users[i]

		if(i !== users.length-1)
			url += ','
	}
	url += '&fields=online&access_token=b3e45ba4b3e45ba4b3e45ba423b3b0e517bb3e4b3e45ba4e92fbb8b61e538268c92e3a2&v=5.74'

	request({
		url: url,
		json: true
	}, function (error, response, body) {
	
		if (!error && response.statusCode === 200) {
			var count_online = 0

			for(var user of body.response) {
				var online_status = user.online === 1 ? user.online_mobile === 1 ? 2 : 1 : 0

				if(online_status !== 0)
					count_online++

				if(user_data[user.id] === undefined) {
					user_data[user.id] = {
						first_name: user.first_name,
						last_name: user.last_name
					}
				}

				add_sample(user.id, current_time, online_status)
			}
			
			measures_taken++
			
			console.log(current_time.getHours() + ':' + current_time.getMinutes() + ':' + 
			current_time.getSeconds() + '> Fetch #' + measures_taken + ': ' + 
			count_online + '/' + body.response.length + ' online')

			if(measures_taken % backup_rate === 0) {
				backup()
			}
		}

	})
}

function user_block_html(id) {
	var graph_scale = 2
	var block_width = 1440
	var graph_height = 50

	var block = `<h1>${user_data[id].first_name} ${user_data[id].last_name} <small>(${id})</small></h1>\n` 
	block += `<div style='height: 50px; width: ${block_width}px; background: #000;'>`

	var user_samples = []
	for(sample of data[id]) {
		var scaled_minutes = get_scaled_minutes(sample.time, graph_scale)
		var color = sample.status === 0 ? colors.offline : sample.status === 1 ? colors.online : colors.mobile
		user_samples[scaled_minutes] = color
	}

	for(var i = 0; i < block_width/graph_scale; i++) {
		if(user_samples[i] !== undefined) {
			block += `<div style='height: ${graph_height}px; width: ${graph_scale}px; background: ${user_samples[i]}; float: left;'></div>`
		} else {
			block += `<div style='height: ${graph_height}px; width: ${graph_scale}px; background: ${colors.no_data}; float: left;'></div>`
		}			
	}
	for(var i = 1; i < block_width/graph_scale; i++) {
		if(i % 30 === 0) {
			block += `<div style='height: 10px; width: ${graph_scale}px; background: black; float: left;'></div>`
		} else {
			block += `<div style='height: 10px; width: ${graph_scale}px; background: transparent; float: left;'></div>`
		}			
	}

	block += `</div>\n`

	return block
}

function get_scaled_minutes(timestamp, scale) {
	var d = new Date(timestamp)
	var hours = d.getHours()
	var minutes = d.getMinutes() + hours * 60
	var scaled_minutes = Math.floor(minutes / scale)

	return scaled_minutes
}

var params = function(req){
	let q = req.url.split('?'), result = {}
	if(q.length >= 2) {
		q[1].split('&').forEach((item) => {
			 try {
			 	result[ item.split('=')[0] ] = item.split('=')[1]
			 } catch (e) {
			 	result[ item.split('=')[0] ] = ''
			 }
		})
	}
	return result
  }

function backup() {
	fs.writeFile(backup_file, JSON.stringify(data), function(err) {
		if(err) {
			return console.log('Error creating backup! ' + err)
		}
	
		console.log('Backup completed!')
	})
}

function processUser(userid, day, month, compensate) {
	let scale = 2

	let user_object = {
		id: userid,
		first_name: user_data[userid].first_name,
		last_name: user_data[userid].last_name,
		samples: []
	}

	const minutes_in_day = 1440

	for(i = 0; i < minutes_in_day/scale; i++) {
		user_object.samples[i] = -1;
	}

	for(sample of data[userid]) {

		var sample_time = new Date(sample.time)

		if(sample_time.getDate() == day && sample_time.getMonth() == month) {
			var scaled_minutes = get_scaled_minutes(sample.time, scale)
			user_object.samples[scaled_minutes] = sample.status
		}
	}

	// Compressing data
	var compressed_samples = []
	var current_value = user_object.samples[0]
	var current_region = {
		val: current_value,
		count: 1
	}
	for(i = 1; i < user_object.samples.length; i++) {
		var value = user_object.samples[i]

		if(value === current_value) { // Continue region
			current_region.count++
		} else { // Start new region
			compressed_samples.push(current_region)

			current_region = {
				val: value,
				count: 1
			}

			current_value = value
		}
	}
	compressed_samples.push(current_region) // Adding last region manually

	console.log(`comp ${compensate}`)
	if(compensate)
		compressed_samples = compensateOnline(compressed_samples)

	user_object.samples = compressed_samples

	return user_object
}

function processRawData(scale, day, month, compensate) {
	var processed = []

	for(var userid in data) {
		processed.push(processUser(userid, day, month, compensate))
	}	

	return JSON.stringify(processed)
}

function day_of_year(date) {
	var start = new Date(date.getFullYear(), 0, 0);
	var diff = date - start;
	var oneDay = 1000 * 60 * 60 * 24;
	var day = Math.floor(diff / oneDay);

	return day
}

function compensateOnline(regions) {
	if(regions.length === 1)
		return regions 
	
	for(let i = 0; i < regions.length-1; i++) {
		if(regions[i].val === 2 && regions[i+1].val === 0) {
			if(regions[i].count !== 1 && regions[i+1].count !== 1) {
				regions[i].count -= 1
				regions[i+1].count += 1
			}                   
		}		
	}
	return regions
}

function dateFromDay(day){
	var date = new Date(new Date().getFullYear(), 0);
	return new Date(date.setDate(day));
}

function processUserData(user, from, to, compensate) {
	let days_data = []
	for(let i = from; i <= to; i++) {
		let date = dateFromDay(i)
		days_data.push( processUser(user, date.getDate(), date.getMonth(), compensate).samples ) 
	}
	return days_data
}

function accept(req, res) {

	req.params = params(req)

	res.writeHead(200, {
	'Content-Type': 'text/html; charset=utf-8',

	'Cache-Control': 'no-cache',
	'Access-Control-Allow-Origin': '*'

	
	})

	var time_scale = req.params.scale === undefined ? 2 : req.params.scale
	var day = req.params.day === undefined ? 0 : req.params.day
	var month = req.params.month === undefined ? 0 : req.params.month
	var compensate = req.params.c === undefined ? false : req.params.c == 'true' ? true : false

	if(req.params.user !== undefined) {
		if(req.params.from !== undefined && req.params.to !== undefined && data[req.params.user] !== undefined) {
			res.end( JSON.stringify( processUserData(parseInt(req.params.user), parseInt(req.params.from), parseInt(req.params.to), compensate) ) )
		} else {
			res.end(`{"error":"wrong arguments on USER"}`)
		}
	}

	// var d = new Date()

	// res.write(`day given: ${day}; current month: ${d.getDate()} \n`)
	// res.write(`month given: ${month}; current month: ${d.getMonth()} \n`)

	if(time_scale > 0 && day > 0 && month >= 0) {

		res.end(processRawData(time_scale, day, month, compensate))

	} else {
		res.end(`{"error":"wrong arguments"}`)
	}

	/*res.write(`<style>h1 { font-weight:normal; font-size:25px; font-family:verdana, sans-serif; } small { font-size: 0.3em; }</style>`)

	for(var user_id in data) {
		res.write(user_block_html(user_id))
	}

	res.end()*/

}

init()
http.createServer(accept).listen(8080)
grab()
setInterval(grab, grab_rate)