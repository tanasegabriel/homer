<template>
  <Generic :item="item" :subtitle="details" :status="reachabilityStatus()" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayCount } from "@/utils/format.js";

export default {
  name: "HomeAssistant",
  mixins: [service],
  data: () => ({
    serverConfig: null,
    entities: null,
    serverError: null,
  }),
  computed: {
    headers: function () {
      return {
        Authorization: `Bearer ${this.item.apikey}`,
        "Content-Type": "application/json",
      };
    },
    shownItems: function () {
      return [].concat(this.item.items ?? ["name", "version"]);
    },
    details: function () {
      if (this.serverError || !this.serverConfig) {
        return null;
      }

      return this.shownItems
        .map((key) => {
          switch (key) {
            case "version":
              return `v${this.serverConfig.version ?? ""}`;
            case "name":
              return `${this.serverConfig.location_name ?? ""}`;
            case "entities":
              return displayCount(this.entities, "entity", "entities");
            default:
              return `undefined key ${key} `;
          }
        })
        .join(this.item.separator || " ");
    },
  },
  methods: {
    fetchData: function () {
      const headers = this.headers;

      return this.load(
        this.fetch("/api/", { headers }).then((response) => {
          if (!response?.message) {
            throw new Error("Unexpected answer from /api/");
          }
          if (this.item.subtitle) {
            return;
          }
          return Promise.all([
            this.fetch("/api/config", { headers }),
            this.shownItems.includes("entities")
              ? this.fetch("/api/states", { headers })
              : null,
          ]).then(([serverConfig, states]) => {
            this.serverConfig = serverConfig;
            this.entities = states?.length ?? null;
          });
        }),
      );
    },
  },
};
</script>
