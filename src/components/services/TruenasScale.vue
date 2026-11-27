<template>
  <Generic :item="item" :subtitle="version" :status="reachabilityStatus()" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayVersion } from "@/utils/format.js";

export default {
  name: "TruenasScale",
  mixins: [service],
  autoUpdate: false,
  data: () => ({
    serverError: null,
    versionstring: null,
  }),
  computed: {
    version() {
      return displayVersion(
        this.versionstring?.replace(/^TrueNAS-(SCALE-)?/, ""),
      );
    },
  },
  methods: {
    fetchData: function () {
      const headers = this.item.api_token
        ? { Authorization: `Bearer ${this.item.api_token}` }
        : {};

      return this.load(
        this.fetch("/api/v2.0/system/version", { headers }).then((version) => {
          this.versionstring = version;
        }),
      );
    },
  },
};
</script>
