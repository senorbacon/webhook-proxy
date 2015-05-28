
var Jira = module.exports = function(server, config) {
	this.server = server;
	this.config = config;
};

Jira.prototype.processRequest = function(requestBody) {
	var response = {status: this.server.WP_UNRECOGNIZED}

	this.server.output("trace", "Jira.processRequest()");

	if ( !(e = JSON.parse(requestBody)) ) {
		this.server.output('debug', "Couldn't parse JSON from body:\n" + requestBody)
	} else {
		var msg_data;

		if (e.webhookEvent && e.webhookEvent.substring(0, 4) == 'jira' && (msg_data = this.parseMessage(e))) {
			var msg, attachments = [], username, channel;

			response.status = this.server.WP_BROADCAST;

			response.name = "Jira " + msg_data[0];
			response.msg = msg_data[1];
			response.attachments = msg_data[2];

			response.chat_user = this.config.chat_user;
			response.chat_channel = this.config.chat_channel;
		}
		else
		{
			this.server.output('debug', "Didn't understand JSON request:\n" + requestBody)
		}
	}

	return response;
};

Jira.prototype.parseMessage = function(e) {
	var msg, 
		type = e.webhookEvent.substring(5);
		attachments = [],
	    user = e.user,
	    issue = e.issue,
	    changelog = e.changelog && e.changelog.items[0],
	    comment = e.comment,
	    issue_link = e.issue.self.replace(/rest.*$/, 'browse/' + issue.key);

	switch (type)
	{
		case 'issue_updated':
			if (changelog) {
				msg = user.displayName + 
				      ' updated ' + issue.fields.issuetype.name + 
				      ' <' + issue_link + '|' + issue.key + '>' + 
				      ' ' + changelog.field + 
				      ' from "' + changelog.fromString + '" to "' + changelog.toString + '"';

				attachments.push({
					fallback: "",
					pretext: "",
					color: "#00FF00",
					fields: [
						{
							title: "Summary",
							value: issue.fields.summary,
							short: false
						},
						{
							title: "Priority",
							value: issue.fields.priority.name,
							short: true
						}
					]
				});
			} else if (comment) {
				user = comment.author;

				msg = user.displayName + 
				      ' added a comment to ' + issue.fields.issuetype.name + 
				      ' <' + issue_link + '|' + issue.key + '> (' + issue.fields.summary + ')';

				attachments.push({
					fallback: "",
					pretext: "",
					color: "#00FF00",
					fields: [
						{
							title: "Comment",
							value: comment.body,
							short: false
						}
					]
				});
			} 
			break;

		case 'issue_created':
			msg = user.displayName + 
			      ' created ' + issue.fields.issuetype.name + 
			      ' <' + issue_link + '|' + issue.key + '>'; 

			attachments.push({
				fallback: "",
				pretext: "",
				color: "#00FF00",
				fields: [
					{
						title: "Summary",
						value: issue.fields.summary,
						short: false
					},
					{
						title: "Priority",
						value: issue.fields.priority.name,
						short: true
					}
				]
			});
			break;
	}

    return [type, msg, attachments];
}



