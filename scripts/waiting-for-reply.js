export const WAITING = "waiting-for-reply";
export const STALE = "stale";

const ISSUES = `
  query ($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issues(states: OPEN, first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          author {
            login
          }
          labels(first: 50) {
            nodes {
              name
            }
          }
          comments(last: 10) {
            nodes {
              author {
                __typename
                login
              }
            }
          }
        }
      }
    }
  }
`;

const lower = (value) => value?.toLowerCase();

const list = (value, separator) =>
  (value ?? "")
    .split(separator)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export function decide(issue, { maintainers, exempt }) {
  const labels = issue.labels.nodes.map(({ name }) => lower(name));
  const last = issue.comments.nodes.findLast(
    ({ author }) => author?.__typename !== "Bot",
  );
  const waiting =
    !maintainers.includes(lower(issue.author?.login)) &&
    !labels.some((name) => exempt.includes(name)) &&
    maintainers.includes(lower(last?.author?.login));

  if (waiting) {
    return labels.includes(WAITING) ? "keep" : "add";
  }
  return labels.includes(WAITING) || labels.includes(STALE) ? "remove" : "keep";
}

export default async function sync({ github, context, core, env }) {
  const options = {
    maintainers: list(env.MAINTAINERS, /\s+/),
    exempt: list(env.EXEMPT, ","),
  };
  const dryRun = env.DRY_RUN !== "false";
  const { owner, repo } = context.repo;
  let cursor = null;

  do {
    const { repository } = await github.graphql(ISSUES, {
      owner,
      repo,
      cursor,
    });
    for (const issue of repository.issues.nodes) {
      const action = decide(issue, options);
      const target = { owner, repo, issue_number: issue.number };
      if (action === "add") {
        core.info(
          `${dryRun ? "Would add" : "Adding"} ${WAITING} to #${issue.number}`,
        );
        if (!dryRun) {
          await github.rest.issues.addLabels({ ...target, labels: [WAITING] });
        }
      }
      if (action === "remove") {
        const present = issue.labels.nodes
          .map(({ name }) => name)
          .filter((name) => [WAITING, STALE].includes(lower(name)));
        for (const name of present) {
          core.info(
            `${dryRun ? "Would remove" : "Removing"} ${name} from #${issue.number}`,
          );
          if (!dryRun) {
            await github.rest.issues.removeLabel({ ...target, name });
          }
        }
      }
    }
    const { hasNextPage, endCursor } = repository.issues.pageInfo;
    cursor = hasNextPage ? endCursor : null;
  } while (cursor);
}
