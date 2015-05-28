var fs = require("fs")
var concat = require("concat-stream")
var http = require('http');
var https = require('https');

if (require.main === module)
{
	var config_pipe = process.stdin;
	if (process.argv.length > 2)
		config_pipe = fs.createReadStream(process.argv[2]);

	config_pipe.pipe(concat(function(body) {
		var config = JSON.parse(body);
		setTimeout(webhook_proxy.startServer, 0, config);
	}))
}

var webhook_proxy = module.exports = function () {

	var config, publishers = [], listeners = [], output;
	var server = {
		WP_DEFAULT_PORT: 8777,
		WP_UNRECOGNIZED: "unrecognized",
		WP_BROADCAST: "broadcast",
		WP_IGNORE: "ignore",
	};

	function init(conf)
	{
		config = conf || {};

		if (typeof config == "string") {
			config = JSON.parse(fs.readFileSync(config));
			if (!config)
				throw new Error("Couldn't parse config file");
		}

		server.config = config;

		var level = config.level || "info";

		var levels = {"trace": 10, "debug": 20, "info": 30, "warn": 40, "error": 50, "fatal": 60};

		var output_pipe = config.logfile ? fs.createWriteStream(config.logfile, {flags: 'a'}) : process.stdout;

		if (!output_pipe)
			throw new Error("Couldn't open file [" + config.logfile + "] for writing.");

		output = server.output = function(sev, str) {
			if (levels[sev] >= levels[level])
				output_pipe.write(sev + ': ' + str + '\n');
		};

		output("info", "Initializing webhook-proxy...");

		config.port = config.port || server.WP_DEFAULT_PORT;
		config.host = config.host || "localhost";

		publishers = config.publishers || {};
		listeners = config.listeners || {};

		if (!publishers.length)
			throw new Error("No publishers defined, aborting.");

		if (!listeners.length)
			throw new Error("No listeners defined, aborting.");

		publishers.forEach(function(module) {
			if (!module.name)
				throw new Error("Invalid configuration, publisher module has no name");

			var plugin = require('./lib/publishers/' + module.name);

			if (!plugin)
				throw new Error("No plugin exists for publisher module [" + module.name + "]");

			module.plugin = new plugin(server, module);
		});

		listeners.forEach(function(module) {
			if (!module.name)
				throw new Error("Invalid configuration, listener module has no name");

			var plugin = require('./lib/listeners/' + module.name);

			if (!plugin)
				throw new Error("No plugin exists for listener module [" + module.name + "]");

			module.plugin = new plugin(server, module);
		});
	}

	function handleRequest(req, res) {
		var e;

		req.pipe(concat(function (body) {
			var incoming;
			if (publishers.every(function(module) {
				if ( (incoming = module.plugin.processRequest(body)) && incoming.status != server.WP_UNRECOGNIZED)
				{
					if (incoming.status == server.WP_BROADCAST)
					{	
						broadcast(incoming);
						output("debug", "request handled by plugin [" + module.name + "], broadcasting to listeners");
					} else {
						output("debug", "request tossed by plugin [" + module.name + "]");
					}
					return false;
				}
				return true;
			})) {
				output("error", "None of the configured plugins recognized the last event.");
				output("debug", "Event body:\n" + body);
				res.statusCode = 400;
				res.statusMessage = "Unhandled webhook";
			}

			res.end()
		}));
	}

	function broadcast(event)
	{
		listeners.every(function(module) {
			if (module.plugin.proxyWebhook(event))
				output("debug", "Event sent to module [" + module.name + "]");
			else {
				output("error", "Plugin for [" + module.name + "] failed to send event.");
				output("debug", "Event: \n" + JSON.stringify(event, null, 2));
			}
			return true;
		})
	}

	server.startServer = function(conf) {
		try {
			init(conf);

			var s = http.createServer(function(req, res) {
				if (req.method === 'POST') {
					handleRequest(req, res);
				} else {
					output('warn', "Got non-POST request: " + req.method + ' ' + req.url);
					res.statusCode = 405;
					res.statusMessage = "POST only";
				}

				res.end();
			}).listen(config.port, config.host);

			output('info', 'webhook-proxy listening on ' + config.host + ':' + config.port);

			process.on('SIGINT', function() {
			  s.close();
			  output('info', 'webhook-proxy has closed.');
			  process.exit();
			});
		} catch (e) {
			if (typeof output != 'undefined')
				output('fatal', 'unhandled error: ' + e.toString());
			else 
				console.log(e.toString());
			process.exit(1);
		}
	}

	return server;
} ();

