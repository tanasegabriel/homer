<template>
  <Generic :item="item" :subtitle="details" :status="reachabilityStatus()" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayCount } from "@/utils/format.js";

export default {
  name: "OpenHAB",
  mixins: [service],
  data: () => ({
    things: null,
    items: null,
    serverError: null,
  }),
  computed: {
    headers: function () {
      const basicAuth = `${this.item.apikey}:`;

      return {
        Authorization: `Basic ${btoa(basicAuth)}`,
      };
    },
    details: function () {
      if (this.serverError) {
        return null;
      }

      const details = [];

      if (this.item.things && this.things) {
        details.push(
          `${displayCount(this.things.count, "thing")} (${this.things.online} Online)`,
        );
      }

      if (this.item.items && this.items) {
        details.push(displayCount(this.items.count, "item"));
      }

      return details.join(", ") || null;
    },
  },
  methods: {
    fetchData: function () {
      const headers = this.headers;

      return this.load(
        this.fetch("/rest/systeminfo", { headers }).then((response) => {
          if (!response?.systemInfo) {
            throw new Error("Unexpected answer from /rest/systeminfo");
          }
          if (this.item.subtitle) {
            return;
          }
          return Promise.all([
            this.item.things &&
              this.fetch("/rest/things?summary=true", { headers }).then(
                (things) => {
                  this.things = {
                    count: things.length,
                    online: things.filter(
                      (thing) => thing.statusInfo.status === "ONLINE",
                    ).length,
                  };
                },
              ),
            this.item.items &&
              this.fetch("/rest/items", { headers }).then((items) => {
                this.items = { count: items.length };
              }),
          ]);
        }),
      );
    },
  },
};
</script>
