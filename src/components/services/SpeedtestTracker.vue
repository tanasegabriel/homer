<template>
  <Generic :item="item" :badges="badges">
    <template v-if="speedtest && !serverError" #subtitle>
      <i class="fas fa-arrow-down"></i> {{ download }} Mbit/s |
      <i class="fas fa-arrow-up"></i> {{ upload }} Mbit/s |
      <i class="fas fa-stopwatch"></i> {{ ping }}
    </template>
  </Generic>
</template>

<script>
import service from "@/mixins/service.js";
import { displayLatency } from "@/utils/format.js";

export default {
  name: "SpeedtestTracker",
  mixins: [service],
  data: () => ({
    speedtest: null,
    serverError: null,
  }),
  computed: {
    badges() {
      return [this.connectionBadge()];
    },
    download: function () {
      return this.format(this.speedtest?.download);
    },
    upload: function () {
      return this.format(this.speedtest?.upload);
    },
    ping: function () {
      return displayLatency(parseFloat(this.speedtest?.ping)) ?? "n/a";
    },
  },
  methods: {
    fetchData: function () {
      return this.load(
        this.fetch("/api/speedtest/latest").then((response) => {
          this.speedtest = response.data;
        }),
      );
    },
    format: function (value) {
      const number = parseFloat(value);
      return Number.isFinite(number) ? number.toFixed(1) : "n/a";
    },
  },
};
</script>
