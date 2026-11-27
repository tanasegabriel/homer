<template>
  <Generic :item="item" :subtitle="blocked" :status="status" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayPercent } from "@/utils/format.js";

const PROTECTION = {
  enabled: { state: "online", label: "enabled" },
  disabled: { state: "warning", label: "disabled" },
};

export default {
  name: "AdGuardHome",
  mixins: [service],
  data: () => ({
    serverStatus: null,
    stats: null,
    serverError: null,
  }),
  computed: {
    blocked: function () {
      if (this.serverError || !this.stats) {
        return null;
      }
      const percent = displayPercent(
        (this.stats.num_blocked_filtering * 100) / this.stats.num_dns_queries,
      );
      return percent && `${percent} blocked`;
    },
    status: function () {
      if (this.serverError || !this.serverStatus) {
        return this.reachabilityStatus();
      }
      return this.serverStatus.protection_enabled
        ? PROTECTION.enabled
        : PROTECTION.disabled;
    },
  },
  methods: {
    fetchData: function () {
      const requests = [
        this.fetch("/control/status").then((status) => {
          this.serverStatus = status;
        }),
      ];

      if (!this.item.subtitle) {
        requests.push(
          this.fetch("/control/stats").then((stats) => {
            this.stats = stats;
          }),
        );
      }

      return this.load(...requests);
    },
  },
};
</script>
