<template>
  <Generic :item="item" :subtitle="user" :status="status" />
</template>

<script>
import service from "@/mixins/service.js";

export default {
  name: "Authelia",
  mixins: [service],
  data: () => ({
    signedIn: null,
    user: null,
    serverError: null,
  }),
  computed: {
    status() {
      if (this.serverError || this.signedIn === null) {
        return this.reachabilityStatus();
      }
      return this.signedIn
        ? { state: "online", label: "signed in" }
        : { state: "unknown", label: "signed out" };
    },
  },
  methods: {
    fetchData: function () {
      return this.load(
        this.fetch("/api/user/info").then(
          (response) => {
            const info = response?.data ?? {};
            this.signedIn = true;
            this.user = info.display_name || info.emails?.[0] || null;
          },
          (e) => {
            this.user = null;
            if (e.cause?.status === 403) {
              this.signedIn = false;
              return;
            }
            this.signedIn = null;
            throw e;
          },
        ),
      );
    },
  },
};
</script>
