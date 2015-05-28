
var Slack = module.exports = function(server, config) {
	this.server = server;
	this.config = config;
};

Slack.prototype.proxyWebhook = function(webhook) {
	this.server.output("trace", "Slack.proxyWebhook()");

	this.server.output('debug', "Sending message: " + webhook.msg);

	// translate/build request to Slack inbound webhook
	// Build the post string from an object
	var post_data = JSON.stringify({
		username: webhook.chat_user || this.config.user || this.server.config.default_chat_user,
		channel: webhook.chat_channel || this.config.channel || this.server.config.default_chat_channel,
		text: webhook.msg,
		attachments: webhook.attachments
	});

	// An object of options to indicate where to post to
	var post_options = {
		host: this.config.host,
		port: 443,
		path: this.config.incoming_hook_uri,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(post_data)
		}
	};

	var post_req = https.request(post_options, function(post_res) {
		post_res.setEncoding('utf8');
		post_res.on('data', function (chunk) {
			this.server.output('debug', 'Response: ' + chunk);
		});

		if (post_res.statusCode >= 400) {
			this.server.output('error', 'Error sending ' + webhook.name + ' webhook: Slack sent HTTP error "' + post_res.statusCode + ' ' + post_res.statusMessage + '" from ' + slack_host);
		} else {
			this.server.output('info', 'Sent ' + webook.name + ' webhook to Slack');
		}
	});

	// post the data
	post_req.write(post_data);
	post_req.end();
};