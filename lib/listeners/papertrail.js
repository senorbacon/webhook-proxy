
var PaperTrail = module.exports = function(server, config) {
	this.server = server;
	this.config = config;
};

PaperTrail.prototype.proxyWebhook = function(event) {
	this.server.output("trace", "PaperTrail.proxyWebhook()");
};