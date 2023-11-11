import express from "express";

const app = express();
const slackURL = process.env.SLACK_WEBHOOK_URL!;

function postSlackMessage(message: string) {
    fetch(slackURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: message,
            type: 'mrkdwn'
        })
    }).catch((error) => {
        console.log('Error posting message to Slack');
        console.error(error);
    });
}

async function isVaadinOrgMember(username: string) {
    const response = await fetch(`https://api.github.com/orgs/vaadin/members/${username}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        }
    });
    return response.status === 204;
}

async function handleNotification(
    user: string,
    action: string,
    title: string,
    html_url: string,
    user_url: string,
    created_at: string,
    item: string,
    repository_name: string,
    repository_url: string
) {

    function getArticle(word: string) {
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        const firstLetter = word.charAt(0).toLowerCase();
        const article = vowels.includes(firstLetter) ? 'an' : 'a';
        return `${article} ${word}`;
    }

    // escape < and > in title
    title = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let message = '';
    if (action === 'opened' || action === 'reopened') {
        message = `🔔 *<${user_url}|${user}> ${action} ${getArticle(item)}:*\n
        Title: <${html_url}|${title}>
        Repo: <${repository_url}|${repository_name}>
    `;
    } else if (action === 'closed') {
        const timeOpenInDays = Math.round((new Date().getTime() - new Date(created_at).getTime()) / (1000 * 3600 * 24));
        message = `🎉 *<${user_url}|${user}>'s ${item} was closed! (open ${timeOpenInDays} days)* \n
        Title: <${html_url}|${title}>
        Repo: <${repository_url}|${repository_name}> 
    `;
    }

    if (message) {
        console.log(message);
        postSlackMessage(message);
    }
}

/**
 * Handle GitHub webhooks.
 */
app.post('/webhook', express.json({type: 'application/json'}), async (request, response) => {
    response.status(202).send('Accepted');

    const githubEvent = request.headers['x-github-event'];

    if (githubEvent === 'issues' || githubEvent === 'pull_request') {
        const isIssue = githubEvent === 'issues';
        const data = request.body;
        const user = isIssue ? data.issue.user.login : data.pull_request.user.login;

        if (await isVaadinOrgMember(user)) return; // Only notify for non-Vaadin members

        const action = data.action;
        const title = isIssue ? data.issue.title : data.pull_request.title;
        const html_url = isIssue ? data.issue.html_url : data.pull_request.html_url;
        const user_url = isIssue ? data.issue.user.html_url : data.pull_request.user.html_url;
        const created_at = isIssue ? data.issue.created_at : data.pull_request.created_at;
        const item = isIssue ? 'issue' : 'PR';
        const repository_name = data.repository.name;
        const repository_url = data.repository.html_url;

        await handleNotification(user, action, title, html_url, user_url, created_at, item, repository_name, repository_url);
    }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
