<template>
  <Generic :item="item" :subtitle="rttLabel" :status="reachabilityStatus()" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayLatency } from "@/utils/format.js";

export default {
  name: "Ping",
  mixins: [service],
  data: () => ({
    serverError: null,
    rtt: null,
  }),
  computed: {
    rttLabel: function () {
      return this.serverError === false ? displayLatency(this.rtt) : null;
    },
  },
  methods: {
    fetchData: function () {
      const method =
        typeof this.item.method === "string"
          ? this.item.method.toUpperCase()
          : "HEAD";

      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        console.error(`Ping: ${method} is not a supported HTTP method`);
        this.serverError = true;
        return;
      }

      const startTime = performance.now();
      const timeout = parseInt(this.item.timeout, 10) || 2000;
      const params = {
        method,
        signal: AbortSignal.timeout(timeout),
      };

      return this.load(
        this.fetch("/", params, false).then(
          () => {
            this.rtt = performance.now() - startTime;
          },
          (e) => {
            this.rtt = null;
            throw e;
          },
        ),
      );
    },
  },
};
</script>
