import { describe, expect, it, vi } from "vitest";
import sync, { decide } from "../../scripts/waiting-for-reply.js";

const user = (login) => ({ __typename: "User", login });
const bot = (login) => ({ __typename: "Bot", login });

const issue = ({
  number = 1,
  author = "reporter",
  labels = [],
  comments = [],
} = {}) => ({
  number,
  author: author && { login: author },
  labels: { nodes: labels.map((name) => ({ name })) },
  comments: { nodes: comments.map((author) => ({ author })) },
});

const options = {
  maintainers: ["tanasegabriel", "bastienwirtz"],
  exempt: ["help wanted", "good first issue"],
};

describe("decide", () => {
  it.each([
    ["no comments", "keep", {}],
    [
      "the reporter replied last",
      "keep",
      { comments: [user("tanasegabriel"), user("reporter")] },
    ],
    [
      "a maintainer replied last",
      "add",
      { comments: [user("reporter"), user("bastienwirtz")] },
    ],
    [
      "a mixed-case maintainer replied last",
      "add",
      { comments: [user("TanaseGabriel")] },
    ],
    [
      "a bot commented after a maintainer",
      "add",
      { comments: [user("tanasegabriel"), bot("github-actions")] },
    ],
    ["only bots commented", "keep", { comments: [bot("github-actions")] }],
    [
      "a deleted account replied last",
      "keep",
      { comments: [user("tanasegabriel"), null] },
    ],
    [
      "the issue has no author",
      "add",
      { author: null, comments: [user("tanasegabriel")] },
    ],
    [
      "a maintainer opened it",
      "keep",
      { author: "bastienwirtz", comments: [user("tanasegabriel")] },
    ],
    [
      "it has an exempt label",
      "keep",
      { labels: ["Help Wanted"], comments: [user("tanasegabriel")] },
    ],
    [
      "it is already waiting",
      "keep",
      { labels: ["waiting-for-reply"], comments: [user("tanasegabriel")] },
    ],
    [
      "it was answered",
      "remove",
      {
        labels: ["waiting-for-reply"],
        comments: [user("tanasegabriel"), user("reporter")],
      },
    ],
    [
      "it was answered after going stale",
      "remove",
      { labels: ["waiting-for-reply", "stale"], comments: [user("reporter")] },
    ],
    ["it is stale but no longer waiting", "remove", { labels: ["stale"] }],
    [
      "it became exempt while waiting",
      "remove",
      {
        labels: ["waiting-for-reply", "good first issue"],
        comments: [user("tanasegabriel")],
      },
    ],
  ])("%s: %s", (_, expected, fields) => {
    expect(decide(issue(fields), options)).toBe(expected);
  });
});

describe("sync", () => {
  const pages = [
    [
      issue({ number: 1, comments: [user("tanasegabriel")] }),
      issue({
        number: 2,
        labels: ["Waiting-For-Reply", "stale"],
        comments: [user("reporter")],
      }),
    ],
    [issue({ number: 3, comments: [user("reporter")] })],
  ];

  const run = async (env) => {
    const github = {
      graphql: vi.fn(async (_, { cursor }) => {
        const page = cursor ? 1 : 0;
        return {
          repository: {
            issues: {
              nodes: pages[page],
              pageInfo: {
                hasNextPage: page === 0,
                endCursor: page === 0 ? "next" : null,
              },
            },
          },
        };
      }),
      rest: { issues: { addLabels: vi.fn(), removeLabel: vi.fn() } },
    };
    const core = { info: vi.fn() };
    const context = { repo: { owner: "homer-dashboard", repo: "homer" } };
    await sync({
      github,
      context,
      core,
      env: {
        MAINTAINERS: "tanasegabriel  bastienwirtz",
        EXEMPT: "help wanted,good first issue",
        ...env,
      },
    });
    return { github, core };
  };

  it("walks every page and only logs in dry-run", async () => {
    const { github, core } = await run({});

    expect(github.graphql).toHaveBeenCalledTimes(2);
    expect(github.graphql.mock.calls[1][1]).toMatchObject({
      owner: "homer-dashboard",
      repo: "homer",
      cursor: "next",
    });
    expect(github.rest.issues.addLabels).not.toHaveBeenCalled();
    expect(github.rest.issues.removeLabel).not.toHaveBeenCalled();
    expect(core.info.mock.calls.flat()).toEqual([
      "Would add waiting-for-reply to #1",
      "Would remove Waiting-For-Reply from #2",
      "Would remove stale from #2",
    ]);
  });

  it("changes labels only when dry-run is off", async () => {
    const { github } = await run({ DRY_RUN: "false" });
    const target = { owner: "homer-dashboard", repo: "homer" };

    expect(github.rest.issues.addLabels.mock.calls).toEqual([
      [{ ...target, issue_number: 1, labels: ["waiting-for-reply"] }],
    ]);
    expect(github.rest.issues.removeLabel.mock.calls).toEqual([
      [{ ...target, issue_number: 2, name: "Waiting-For-Reply" }],
      [{ ...target, issue_number: 2, name: "stale" }],
    ]);
  });
});
