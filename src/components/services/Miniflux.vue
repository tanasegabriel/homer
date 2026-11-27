<template>
  <Generic
    :item="item"
    :subtitle="unreadText"
    :status="status"
    :badges="badges"
  />
</template>

<script>
import service from "@/mixins/service.js";

export default {
  name: "Miniflux",
  mixins: [service],
  data: () => ({
    unreadEntries: 0,
    unreadFeeds: 0,
    serverError: null,
  }),
  computed: {
    style: function () {
      return this.item.style ?? "status";
    },
    unreadText: function () {
      if (this.serverError || !this.unreadEntries) {
        return null;
      }
      return this.unreadFeeds < 2
        ? `${this.unreadEntries} unread`
        : `${this.unreadEntries} unread in ${this.unreadFeeds} feeds`;
    },
    status: function () {
      if (this.style !== "status") {
        return null;
      }
      if (this.serverError === false && this.unreadEntries > 0) {
        return { state: "warning", label: "unread" };
      }
      return this.reachabilityStatus();
    },
    badges: function () {
      if (this.style === "status") {
        return [];
      }
      return [
        {
          key: "unread",
          label: "Unread",
          value: this.unreadEntries,
          tone: "warning",
          cap: false,
        },
        this.connectionBadge(),
      ];
    },
  },
  methods: {
    fetchData: async function () {
      const headers = {
        "X-Auth-Token": this.item.apikey,
      };

      return this.load(
        this.fetch("/v1/feeds/counters", { headers }).then((counters) => {
          const unreads = Object.values(counters.unreads || {});
          this.unreadFeeds = unreads.length;
          this.unreadEntries = unreads.reduce(
            (accumulator, value) => accumulator + value,
            0,
          );
        }),
      );
    },
  },
};
</script>
