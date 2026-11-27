<template>
  <Generic :item="item" :subtitle="messageCount" :status="status" />
</template>

<script>
import service from "@/mixins/service.js";
import { capCount, displayCount } from "@/utils/format.js";

export default {
  name: "Gotify",
  mixins: [service],
  data: () => ({
    health: {},
    messages: 0,
    serverError: null,
  }),
  computed: {
    messageCount: function () {
      if (this.serverError || !this.messages) {
        return null;
      }
      return displayCount(capCount(this.messages), "message");
    },
    status: function () {
      if (this.serverError || !this.health?.health) {
        return this.reachabilityStatus();
      }
      const statuses = [this.health.health, this.health.database];

      if (statuses.includes("red")) {
        return { state: "offline" };
      } else if (statuses.includes("orange")) {
        return { state: "warning" };
      }

      return { state: "online" };
    },
  },
  methods: {
    fetchData: async function () {
      const requests = [
        this.fetch(`/health`).then((health) => {
          this.health = health;
        }),
      ];
      if (this.item.apikey) {
        requests.push(this.fetchMessages());
      }
      await this.load(...requests);
    },
    fetchMessages: async function () {
      const response = await this.fetch(`/message?limit=100`, {
        headers: { "X-Gotify-Key": this.item.apikey },
      });
      this.messages = response.messages.length;
    },
  },
};
</script>
