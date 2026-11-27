<template>
  <Generic
    :item="item"
    :subtitle="isValueShown('version') ? displayVersion(version) : null"
    :status="reachabilityStatus()"
    :badges="badges"
  />
</template>

<script>
import service from "@/mixins/service.js";
import { displayVersion } from "@/utils/format.js";

export default {
  name: "Memos",
  mixins: [service],
  data: () => ({
    userName: null,
    version: null,
    count: null,
    serverError: null,
  }),
  computed: {
    authHeaders() {
      return this.item.apikey
        ? { Authorization: `Bearer ${this.item.apikey}` }
        : {};
    },
    badges() {
      const badges = [];
      if (this.count !== null && this.count !== undefined) {
        badges.push({
          key: "memos",
          label: "Memos",
          value: this.count,
          showZero: true,
          tone: "success",
          cap: false,
        });
      }
      return badges;
    },
  },
  methods: {
    displayVersion,
    fetchData: async function () {
      const requests = [
        this.fetch("/api/instance/profile").then((profile) => {
          this.version = profile.version?.replace(/^v/, "") || null;
        }),
      ];
      if (this.item.apikey && this.isValueShown("memos")) {
        requests.push(this.fetchMemoCount());
      } else {
        this.count = null;
      }
      await this.load(...requests);
      if (this.serverError) {
        this.version = null;
        this.count = null;
      }
    },
    fetchMemoCount: async function () {
      const init = { headers: this.authHeaders };
      this.userName ??= (await this.fetch("/api/auth/me", init)).user.name;
      const stats = await this.fetch(`/api/${this.userName}:getStats`, init);
      this.count = stats.totalMemoCount ?? 0;
    },
  },
};
</script>
