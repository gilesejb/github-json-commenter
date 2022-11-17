import fs from 'fs';

function readJSON(filename: string) {
  const rawdata = fs.readFileSync(filename);
  const benchmarkJSON = JSON.parse(rawdata.toString());
  return benchmarkJSON;
}

function createMessage(benchmark, comparisonBenchmark) : string {
  let message = "## Result of Benchmark Tests\n";

  message += "| Key | Current PR | Default Branch |\n";
  message += "| :--- | :---: | :---: |\n";

  for(const key in benchmark) {
    message += `| ${key}`;

    const value = benchmark[key];
    message += `| ${value.toFixed(2)}`;

    try {
        const oldValue = comparisonBenchmark[key];
        message += `| ${oldValue.toFixed(2)}`;
    } catch (error) {
        console.log("Can not read key", key, "from the comparison file.")
        message += "| ";
    }
    message += "| \n";
  }

  return message;
}

import core from '@actions/core';
import github from '@actions/github';

async function run() {
  if (github.context.eventName !== 'pull_request') {
    core.setFailed('Can only run on Pull Requests!');
    return;
  }

  const githubToken = core.getInput('token');
  const benchmarkFilename = core.getInput('json_file');
  const oldBenchmarkFilename = core.getInput('comparison_json_file');

  const benchmarks = readJSON(benchmarkFilename);
  let oldBenchmarks = undefined;
  if (oldBenchmarkFilename) {
    try {
      oldBenchmarks = readJSON(oldBenchmarkFilename);
    } catch (error) {
      console.log('Error reading comparison file. Continuing without it.');
    }
  }

  const message = createMessage(benchmarks, oldBenchmarks);

  console.log(message);

  const context = github.context;
  const repo = context.repo;
  const prNumber = context.payload.pull_request?.number || 0;

  const octokit = github.getOctokit(githubToken);

  const { data: comments } = await octokit.rest.issues.listComments({
    ...repo,
    issue_number: prNumber
  });

  const comment = comments.find(comment => {
    return (
      comment.user?.login === 'github-actions[bot]' &&
      comment.body?.startsWith('## Result of Benchmark Tests\n')
    );
  });

  if (comment) {
    await octokit.rest.issues.updateComment({
      ...repo,
      comment_id: comment.id,
      body: message
    });
  } else {
    await octokit.rest.issues.createComment({
      ...repo,
      issue_number: prNumber,
      body: message
    });
  }
}

run()