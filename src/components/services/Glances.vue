<template>
  <Generic :item="item" :badges="badges">
    <template v-if="!serverError" #subtitle>
      <template v-for="(statItem, index) in item.stats" :key="statItem">
        <span v-if="stats[statItem]" :title="stats[statItem].label">
          <i :class="stats[statItem].icon"></i>
          {{ displayPercent(stats[statItem].value) }}
          <span v-if="index != item.stats.length - 1"> / </span>
        </span>
      </template>
    </template>
  </Generic>
</template>

<script>
import service from "@/mixins/service.js";
import { displayPercent } from "@/utils/format.js";

export default {
  name: "Glances",
  mixins: [service],
  data: () => ({
    stats: [],
    serverError: null,
  }),
  computed: {
    badges() {
      return [this.connectionBadge()];
    },
  },
  methods: {
    fetchData: function () {
      return this.load(
        this.fetch(`/api/4/quicklook`).then((response) => {
          this.stats["load"] = {
            value: response.load,
            label: "System load",
            icon: "fa-solid fa-bolt",
          };
          this.stats["cpu"] = {
            value: response.cpu,
            label: `CPU usage (${response.cpu_name})`,
            icon: "fa-solid fa-microchip",
          };
          this.stats["mem"] = {
            value: response.mem,
            label: `RAM usage`,
            icon: "fa-solid fa-memory",
          };
          this.stats["swap"] = {
            value: response.swap,
            label: `Swap usage`,
            icon: "fa-solid fa-file-arrow-down",
          };
        }),
      );
    },
    displayPercent,
  },
};
</script>
