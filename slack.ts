const slackURL = process.env.SLACK_WEBHOOK_URL!;

export async function postSlackMessage(message: string) {
    await fetch(slackURL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: message, type: 'mrkdwn'})
    }).catch((error) => {
        console.log('Error posting message to Slack');
        console.error(error);
    });
}