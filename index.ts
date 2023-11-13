import express from 'express';
import {handleGitHubWebhook} from "./github.ts";

const app = express();
app.post('/webhook', express.json({type: 'application/json'}), handleGitHubWebhook);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
