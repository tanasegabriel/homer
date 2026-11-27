<template>
  <Generic :item="item" :subtitle="documents" :badges="badges" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayCount } from "@/utils/format.js";

export default {
  name: "Paperless",
  mixins: [service],
  data: () => ({
    api: null,
    serverError: null,
  }),
  computed: {
    badges() {
      return [this.connectionBadge()];
    },
    documents() {
      if (this.serverError || !this.api) {
        return null;
      }
      return `happily storing ${displayCount(this.api.count, "document")}`;
    },
  },
  methods: {
    fetchData: async function () {
      if (!this.requireConfig("apikey")) {
        return;
      }

      return this.load(
        this.fetch("/api/documents/?page_size=1", {
          headers: {
            Authorization: "Token " + this.item.apikey,
          },
        }).then((api) => {
          this.api = api;
        }),
      );
    },
  },
};
</script>
