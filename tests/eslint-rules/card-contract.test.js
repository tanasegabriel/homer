import { RuleTester } from "eslint";
import vueParser from "vue-eslint-parser";
import { describe, it } from "vitest";
import rule from "../../eslint-rules/card-contract.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    ecmaVersion: "latest",
    sourceType: "module",
  },
});

const SCRIPT = `import service from "@/mixins/service.js";

export default {
  mixins: [service],
  data: () => ({ serverError: null }),
  computed: {
    status() {
      return this.reachabilityStatus();
    },
  },
  methods: {
    fetchData() {
      return this.load(this.fetch("/api"));
    },
  },
};`;

const card = ({
  template = '<Generic :item="item" :status="status" />',
  script = SCRIPT,
  style = "",
} = {}) => ({
  filename: "Card.vue",
  code: `<template>\n  ${template}\n</template>\n\n<script>\n${script}\n</script>\n${style}`,
});

const withMethod = (body) =>
  SCRIPT.replace('return this.load(this.fetch("/api"));', body);

tester.run("card-contract", rule, {
  valid: [
    card(),
    card({
      template: `<Generic :item="item">
    <template #icon><i /></template>
    <template #subtitle>up</template>
    <template #aside>1</template>
    <template #badges>2</template>
  </Generic>`,
    }),
    card({
      script: `${SCRIPT}\nconst LEVEL_STATE = { ok: "online", ko: "offline" };\nconst badge = { tone: "danger", state: "busy" };`,
    }),
    card({
      script: `// card-contract: off fetch -- the service lives on another host\n${withMethod('return this.load(fetch("/rpc"));')}`,
    }),
    card({
      template: `<!-- card-contract: off -- a list of cards -->\n  <div><Generic v-for="i in 2" :key="i" /></div>`,
    }),
    card({ script: 'export default { name: "NotACard" };' }),
    card({ style: "<style>.title { color: red; }</style>" }),
  ],
  invalid: [
    {
      ...card({ template: "<div />" }),
      errors: [{ message: /single <Generic> as its template root/ }],
    },
    {
      ...card({ template: '<Generic :item="item" />\n  <span />' }),
      errors: [{ message: /single <Generic> as its template root/ }],
    },
    {
      ...card({ template: '<Generic v-for="i in 2" :key="i" />' }),
      errors: [{ message: /v-for on the root <Generic>/ }],
    },
    {
      ...card({
        template:
          '<Generic :item="item">\n    <template #footer>x</template>\n  </Generic>',
      }),
      errors: [{ message: /Unknown slot "#footer"/ }],
    },
    {
      ...card({ script: `${SCRIPT}\nconst badge = { tone: "red" };` }),
      errors: [{ message: /Unknown tone "red"/ }],
    },
    {
      ...card({ script: `${SCRIPT}\nconst chip = { state: "up" };` }),
      errors: [{ message: /Unknown state "up"/ }],
    },
    {
      ...card({ script: `${SCRIPT}\nconst LEVEL_STATE = { ok: "green" };` }),
      errors: [{ message: /Unknown state "green" in LEVEL_STATE/ }],
    },
    {
      ...card({
        script: SCRIPT.replace(
          "mixins: [service],",
          "mixins: [service],\n  props: { item: Object },",
        ),
      }),
      errors: [{ message: /already declares the "item" prop/ }],
    },
    {
      ...card({
        script: SCRIPT.replace("  methods: {", "  methods: {\n    load() {},"),
      }),
      errors: [{ message: /"load" in methods\(\) shadows/ }],
    },
    {
      ...card({
        script: SCRIPT.replace(
          "data: () => ({ serverError: null })",
          "data: () => ({ serverError: null, config: {} })",
        ),
      }),
      errors: [{ message: /"config" in data\(\) shadows/ }],
    },
    {
      ...card({ script: withMethod('return this.load(fetch("/api"));') }),
      errors: [{ message: /calls the native fetch\(\)/ }],
    },
    {
      ...card({
        script: withMethod('return this.load(window.fetch("/api"));'),
      }),
      errors: [{ message: /calls the native fetch\(\)/ }],
    },
    {
      ...card({
        script: SCRIPT.replace(
          "data: () => ({ serverError: null })",
          "data: () => ({})",
        ),
      }),
      errors: [{ message: /never declares it/ }],
    },
    {
      ...card({ script: withMethod('return this.fetch("/api");') }),
      errors: [{ message: /never calls this\.load\(\)/ }],
    },
    {
      ...card({
        template: '<Generic :item="item" />',
        script: SCRIPT.replace(
          "return this.reachabilityStatus();",
          "return null;",
        ),
      }),
      errors: [{ message: /never shows a failure/ }],
    },
    {
      ...card({ style: "<style>.badge { color: red; }</style>" }),
      errors: [{ message: /must not define `\.badge`/ }],
    },
    {
      ...card({ style: "<style>.icon { position: absolute; }</style>" }),
      errors: [{ message: /must not define absolute positioning/ }],
    },
    {
      ...card({
        script: `// card-contract: off fetch\n${withMethod('return this.load(fetch("/rpc"));')}`,
      }),
      errors: [
        { message: /must say why/ },
        { message: /calls the native fetch\(\)/ },
      ],
    },
    {
      ...card({
        script: `// card-contract: off fetchh -- typo\n${withMethod('return this.load(fetch("/rpc"));')}`,
      }),
      errors: [
        { message: /Unknown check group "fetchh"/ },
        { message: /calls the native fetch\(\)/ },
      ],
    },
  ],
});
