import express from "express";

const app = express();
const slackURL = process.env.SLACK_WEBHOOK_URL!;

app.post('/webhook', express.json({type: 'application/json'}), async (request, response) => {
    response.status(202).send('Accepted');

    const githubEvent = request.headers['x-github-event'] as string;

    if (['issues', 'pull_request'].includes(githubEvent)) {
        const eventData = githubEvent === 'issues' ? request.body.issue : request.body.pull_request;
        if (await isVaadinOrgMember(eventData.user.login)) return;

        await notifyEvent(githubEvent, request.body, eventData);
    }
});

async function isVaadinOrgMember(username: string) {
    const response = await fetch(`https://api.github.com/orgs/vaadin/members/${username}`, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        }
    });
    return response.status === 204;
}

async function notifyEvent(githubEvent: string, data: any, eventData: any) {
    const message = createNotificationMessage(githubEvent, data, eventData);
    if (message) {
        postSlackMessage(message);
    }
}

function createNotificationMessage(githubEvent: string, data: any, eventData: any): string {
    const item = githubEvent === 'issues' ? 'issue' : 'PR';
    let title = escapeHtml(eventData.title);
    const action = data.action;
    const html_url = eventData.html_url;
    const user_url = eventData.user.html_url;
    const repository_name = data.repository.name;
    const repository_url = data.repository.html_url;
    const isMerged = githubEvent === 'pull_request' && eventData.merged;

    switch (action) {
        case 'opened':
        case 'reopened':
            return formatOpenReopenMessage(user_url, eventData.user.login, action, item, title, html_url, repository_name, repository_url);
        case 'closed':
            return formatClosedMessage(user_url, eventData.user.login, item, eventData.created_at, title, html_url, repository_name, repository_url, isMerged);
        default:
            return '';
    }
}

function formatOpenReopenMessage(user_url: string, user: string, action: string, item: string, title: string, html_url: string, repository_name: string, repository_url: string): string {
    return `🔔 *<${user_url}|${user}> ${action} ${getArticle(item)} ${item}:* \nTitle: <${html_url}|${title}>\nRepo: <${repository_url}|${repository_name}>`.trim();
}

function formatClosedMessage(user_url: string, user: string, item: string, created_at: string, title: string, html_url: string, repository_name: string, repository_url: string, isMerged?: boolean): string {
    const timeOpenInDays = Math.round((new Date().getTime() - new Date(created_at).getTime()) / (1000 * 3600 * 24));
    const yay = item === 'PR' ? (isMerged ? '🎉' : '😢') : '🎉';
    return `${yay} *<${user_url}|${user}>'s ${item} was ${item === 'PR' ? (isMerged ? 'merged' : 'not merged') : 'closed'}:*\nOpen: ${timeOpenInDays} days\nTitle: <${html_url}|${title}>\nRepo: <${repository_url}|${repository_name}>`.trim();
}

function getArticle(word: string): string {
    return ['a', 'e', 'i', 'o', 'u'].includes(word.charAt(0).toLowerCase()) ? 'an' : 'a';
}

function escapeHtml(text: string): string {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;');
}

function postSlackMessage(message: string) {
    fetch(slackURL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: message, type: 'mrkdwn'})
    }).catch((error) => {
        console.log('Error posting message to Slack');
        console.error(error);
    });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
